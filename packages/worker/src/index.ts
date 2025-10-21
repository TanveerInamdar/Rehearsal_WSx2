import dotenv from 'dotenv';
import { prisma } from './db.js';
import { selectProvider } from './providers/ai.js';
import { discoverCodeContext } from './context.js';
import type { BugRecord } from './types.js';

// Load environment variables from root directory
dotenv.config({ path: '../../.env' });

const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '5000');
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const AI_PROVIDER = process.env.AI_PROVIDER || 'gemini'; // Default to Gemini
const MODEL_ID = process.env.MODEL_ID || (AI_PROVIDER === 'gemini' ? 'gemini-2.5-flash' : 'claude-3-5-sonnet-20241022');

class Worker {
  private isRunning = false;
  private pollTimer?: NodeJS.Timeout;
  private provider = selectProvider({
    apiKey: AI_PROVIDER === 'gemini' ? GEMINI_API_KEY : undefined,
    modelId: MODEL_ID,
    provider: AI_PROVIDER as 'gemini' | 'fallback'
  });

  async start(): Promise<void> {
    console.log(`Worker starting...`);
    console.log(`Polling every ${POLL_INTERVAL_MS}ms`);
    console.log(`Provider: ${AI_PROVIDER === 'gemini' && GEMINI_API_KEY ? 'Gemini' : AI_PROVIDER === 'anthropic' && ANTHROPIC_API_KEY ? 'Anthropic' : 'Fallback'}`);
    
    this.isRunning = true;
    await this.poll();
  }

  stop(): void {
    console.log('Worker stopping...');
    this.isRunning = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
    }
  }

  private async poll(): Promise<void> {
    if (!this.isRunning) return;

    try {
      await this.processNextJob();
    } catch (error) {
      console.error('Error during polling cycle:', error);
    }

    // Schedule next poll
    this.pollTimer = setTimeout(() => {
      this.poll();
    }, POLL_INTERVAL_MS);
  }

  private async processNextJob(): Promise<void> {
    let job: any = null;
    let bugId: string | null = null;

    try {
      // Atomically select and mark a job as processing
      job = await prisma.job.findFirst({
        where: { status: 'queued', type: 'ANALYZE_BUG' },
        orderBy: { createdAt: 'asc' }
      });

      if (!job) {
        return; // No jobs to process
      }

      // Mark job as processing
      await prisma.job.update({
        where: { id: job.id },
        data: { status: 'processing' }
      });

      console.log(`Processing job ${job.id} for bug analysis`);

      // Parse job payload
      const payload = JSON.parse(job.payload as string);
      bugId = payload.bugId;

      if (!bugId) {
        throw new Error('Job payload missing bugId');
      }

      // Load the bug and its project
      const bug = await prisma.bug.findUnique({
        where: { id: bugId },
        include: { project: true }
      });

      if (!bug) {
        throw new Error(`Bug ${bugId} not found`);
      }

      // Check if already analyzed (idempotent safety)
      if (bug.status === 'analyzed' && bug.aiAnalysis) {
        console.log(`Bug ${bugId} already analyzed, marking job as done`);
        await prisma.job.update({
          where: { id: job.id },
          data: { status: 'done' }
        });
        return;
      }

      // Discover code context
      const codeContext = discoverCodeContext(bug.url);
      console.log(`Found ${codeContext.length} relevant files for context`);

      // Parse JSON fields for analysis
      const bugRecord: BugRecord = {
        id: bug.id,
        title: bug.title,
        steps: bug.steps,
        expected: bug.expected,
        actual: bug.actual,
        severity: bug.severity as any,
        url: bug.url,
        userAgent: bug.userAgent,
        viewport: JSON.parse(bug.viewport),
        consoleLogs: bug.consoleLogs ? JSON.parse(bug.consoleLogs) : undefined,
        networkErrors: bug.networkErrors ? JSON.parse(bug.networkErrors) : undefined,
        screenshotDataUrl: bug.screenshotDataUrl || undefined,
        status: bug.status as any,
        aiAnalysis: bug.aiAnalysis || undefined,
        aiPatchDiff: bug.aiPatchDiff || undefined,
        confidence: bug.confidence || undefined,
        createdAt: bug.createdAt.toISOString(),
        projectPublicKey: bug.project.publicKey
      };

      // Run AI analysis
      const result = await this.provider.analyze({
        bug: bugRecord,
        codeContext
      });

      // Update bug with analysis results
      await prisma.bug.update({
        where: { id: bugId },
        data: {
          status: 'analyzed',
          aiAnalysis: result.analysis,
          aiPatchDiff: result.diff === 'NONE' ? null : result.diff,
          confidence: result.confidence,
          aiProvider: result.provider
        }
      });

      // Mark job as done
      await prisma.job.update({
        where: { id: job.id },
        data: { status: 'done' }
      });

      console.log(`Job ${job.id} completed successfully`);
      console.log(`Bug ${bugId} analyzed with confidence: ${result.confidence}`);

    } catch (error) {
      console.error('Error processing job:', error);
      
      // Mark job as error
      if (job) {
        await prisma.job.update({
          where: { id: job.id },
          data: { 
            status: 'error',
            error: error instanceof Error ? error.message : String(error)
          }
        }).catch(err => {
          console.error('Failed to update job error status:', err);
        });
      }

      // Mark bug as error if we have the bugId
      if (bugId) {
        await prisma.bug.update({
          where: { id: bugId },
          data: { status: 'error' }
        }).catch(err => {
          console.error('Failed to update bug error status:', err);
        });
      }
    }
  }
}

// Create and start worker
const worker = new Worker();

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT, shutting down gracefully...');
  worker.stop();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...');
  worker.stop();
  await prisma.$disconnect();
  process.exit(0);
});

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the worker
worker.start().catch((error) => {
  console.error('Failed to start worker:', error);
  process.exit(1);
});