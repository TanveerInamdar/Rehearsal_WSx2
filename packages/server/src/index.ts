import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
  CreateBugPayloadSchema, 
  ListBugsQuerySchema,
  CreateBugResponseSchema,
  ErrorResponseSchema,
  type CreateBugPayload,
  type ListBugsQuery,
  type CreateBugResponse,
  type BugRecord,
  type ErrorResponse
} from './contracts.js';

// Load environment variables
dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 8787;

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['content-type', 'x-bugger-key']
}));

// Body parsing with size limit
app.use(express.json({ limit: '1mb' }));

// Rate limiting for POST /api/bugs
const createBugRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Authentication middleware
async function authenticateProject(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    const secretKey = req.headers['x-bugger-key'] as string;
    
    if (!secretKey) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Find project by secret key
    const project = await prisma.project.findUnique({
      where: { secretKey }
    });

    if (!project) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Attach project to request for use in route handlers
    (req as any).project = project;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Authentication required' });
  }
}

// Validation middleware
function validateBody<T>(schema: any) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const result = schema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          error: 'Invalid request data',
          details: result.error.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ')
        });
      }
      req.body = result.data;
      next();
    } catch (error) {
      console.error('Validation error:', error);
      res.status(400).json({ error: 'Invalid request data' });
    }
  };
}

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// POST /api/bugs - Create a new bug report
app.post('/api/bugs', createBugRateLimit, authenticateProject, validateBody(CreateBugPayloadSchema), async (req, res) => {
  try {
    const payload: CreateBugPayload = req.body;
    const project = (req as any).project;

    // Verify the projectPublicKey matches the authenticated project
    if (payload.projectPublicKey !== project.publicKey) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Create bug record
    const bug = await prisma.bug.create({
      data: {
        title: payload.title,
        steps: payload.steps,
        expected: payload.expected,
        actual: payload.actual,
        severity: payload.severity,
        url: payload.url,
        userAgent: payload.userAgent,
        viewport: JSON.stringify(payload.viewport),
        consoleLogs: payload.consoleLogs ? JSON.stringify(payload.consoleLogs) : null,
        networkErrors: payload.networkErrors ? JSON.stringify(payload.networkErrors) : null,
        screenshotDataUrl: payload.screenshotDataUrl || null,
        status: 'queued',
        projectId: project.id
      }
    });

    // Create analysis job
    await prisma.job.create({
      data: {
        type: 'ANALYZE_BUG',
        payload: JSON.stringify({ bugId: bug.id }),
        status: 'queued'
      }
    });

    const response: CreateBugResponse = {
      id: bug.id,
      status: 'queued'
    };

    console.log(`Bug created: ${bug.id} for project: ${project.name}`);
    res.status(201).json(response);
  } catch (error) {
    console.error('Error creating bug:', error);
    res.status(500).json({ error: 'Failed to create bug report' });
  }
});

// GET /api/bugs - List bugs with optional filters
app.get('/api/bugs', authenticateProject, async (req, res) => {
  try {
    const project = (req as any).project;
    const query = req.query as any;

    // Validate query parameters
    const validatedQuery = ListBugsQuerySchema.parse(query);

    // Build where clause
    const where: any = {
      projectId: project.id
    };

    if (validatedQuery.status) {
      where.status = validatedQuery.status;
    }

    if (validatedQuery.severity) {
      where.severity = validatedQuery.severity;
    }

    if (validatedQuery.from || validatedQuery.to) {
      where.createdAt = {};
      if (validatedQuery.from) {
        where.createdAt.gte = new Date(validatedQuery.from);
      }
      if (validatedQuery.to) {
        where.createdAt.lte = new Date(validatedQuery.to);
      }
    }

    // Fetch bugs
    const bugs = await prisma.bug.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    // Parse JSON fields and map to BugRecord format
    const bugRecords: BugRecord[] = bugs.map(bug => ({
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
      aiProvider: bug.aiProvider || undefined,
      createdAt: bug.createdAt.toISOString(),
      projectPublicKey: project.publicKey
    }));

    res.json(bugRecords);
  } catch (error) {
    console.error('Error fetching bugs:', error);
    res.status(500).json({ error: 'Failed to fetch bugs' });
  }
});

// GET /api/bugs/:id - Get a specific bug
app.get('/api/bugs/:id', authenticateProject, async (req, res) => {
  try {
    const project = (req as any).project;
    const { id } = req.params;

    const bug = await prisma.bug.findFirst({
      where: {
        id,
        projectId: project.id
      }
    });

    if (!bug) {
      return res.status(404).json({ error: 'Bug not found' });
    }

    // Parse JSON fields and map to BugRecord format
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
      aiProvider: bug.aiProvider || undefined,
      createdAt: bug.createdAt.toISOString(),
      projectPublicKey: project.publicKey
    };

    res.json(bugRecord);
  } catch (error) {
    console.error('Error fetching bug:', error);
    res.status(500).json({ error: 'Failed to fetch bug' });
  }
});

// Static handler for built snippet
app.get('/cdn/bugger.min.js', (req, res) => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  
  const snippetPath = path.join(__dirname, '../../snippet/dist/bugger.min.js');
  
  try {
    if (fs.existsSync(snippetPath)) {
      const snippetContent = fs.readFileSync(snippetPath, 'utf8');
      res.setHeader('Content-Type', 'application/javascript');
      res.send(snippetContent);
    } else {
      // Fallback to placeholder if snippet not built yet
      res.setHeader('Content-Type', 'application/javascript');
      res.send(`
// Placeholder for bugger.min.js
// Build the snippet package to get the actual file
console.log('Bugger snippet placeholder loaded');
      `);
    }
  } catch (error) {
    console.error('Error serving snippet:', error);
    res.status(500).send('Error loading snippet');
  }
});

// Demo page with error triggers and recent bugs panel
app.get('/demo', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Bug Report Demo</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 20px;
      background-color: #f8fafc;
      line-height: 1.6;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    h1 {
      color: #1e293b;
      margin-bottom: 30px;
    }
    .warning {
      background: #fef3c7;
      border: 1px solid #f59e0b;
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 20px;
      color: #92400e;
    }
    .controls {
      background: white;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .controls h2 {
      margin-top: 0;
      color: #374151;
    }
    button {
      background: #4f46e5;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 6px;
      cursor: pointer;
      margin-right: 10px;
      margin-bottom: 10px;
      font-size: 14px;
    }
    button:hover {
      background: #4338ca;
    }
    .bugs-panel {
      background: white;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .bugs-panel h2 {
      margin-top: 0;
      color: #374151;
    }
    .bug-item {
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 10px;
      background: #f9fafb;
    }
    .bug-item:hover {
      background: #f3f4f6;
    }
    .bug-item a {
      text-decoration: none;
      color: #1e293b;
    }
    .bug-item a:hover {
      color: #4f46e5;
    }
    .bug-meta {
      font-size: 12px;
      color: #6b7280;
      margin-top: 4px;
    }
    .status {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
      text-transform: uppercase;
    }
    .status.queued { background: #fef3c7; color: #92400e; }
    .status.analyzing { background: #dbeafe; color: #1e40af; }
    .status.analyzed { background: #d1fae5; color: #065f46; }
    .status.error { background: #fee2e2; color: #991b1b; }
    .loading {
      color: #6b7280;
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🐛 Bug Report Demo</h1>
    
    <div class="warning">
      <strong>Demo Only:</strong> This page uses secret keys in fetch requests for demonstration purposes. In production, never expose secret keys in client-side code.
    </div>

    <div class="controls">
      <h2>Trigger Errors</h2>
      <button onclick="triggerConsoleError()">Trigger fake error</button>
      <button onclick="trigger404()">Trigger 404</button>
      <p>Click these buttons to generate console errors and network failures that will be captured by the Bugger script.</p>
      <p><strong>Note:</strong> Open your browser's Developer Tools (F12) → Console tab to see the errors being logged. These errors will be captured when you submit a bug report.</p>
    </div>

    <div class="bugs-panel">
      <h2>Recent Bugs</h2>
      <div id="bugs-list" class="loading">Loading bugs...</div>
    </div>
  </div>

  <script src="/cdn/bugger.min.js"
          data-bugger-key="public_demo_key"
          data-bugger-origin="http://localhost:8787"></script>

  <script>
    function triggerConsoleError() {
      console.error("demo error: cannot read foo.bar");
      // Show visual feedback
      const button = event.target;
      const originalText = button.textContent;
      button.textContent = "✓ Error logged!";
      button.style.background = "#10b981";
      setTimeout(() => {
        button.textContent = originalText;
        button.style.background = "#4f46e5";
      }, 2000);
    }

    function trigger404() {
      fetch("/demo-404").catch(() => {
        console.log("404 error triggered");
        // Show visual feedback
        const button = event.target;
        const originalText = button.textContent;
        button.textContent = "✓ 404 captured!";
        button.style.background = "#10b981";
        setTimeout(() => {
          button.textContent = originalText;
          button.style.background = "#4f46e5";
        }, 2000);
      });
    }

    function formatDate(dateString) {
      return new Date(dateString).toLocaleString();
    }

    function getStatusClass(status) {
      switch(status) {
        case 'queued': return 'queued';
        case 'analyzing': return 'analyzing';
        case 'analyzed': return 'analyzed';
        case 'error': return 'error';
        default: return 'queued';
      }
    }

    function renderBugs(bugs) {
      console.log('Rendering bugs:', bugs);
      const container = document.getElementById('bugs-list');
      
      if (bugs.length === 0) {
        container.innerHTML = '<p>No bugs found. Trigger some errors and submit a bug report!</p>';
        return;
      }

      container.innerHTML = bugs.slice(0, 10).map(bug => \`
        <div class="bug-item">
          <a href="/bugs/\${bug.id}/view">
            <strong>\${bug.title}</strong>
            <span class="status \${getStatusClass(bug.status)}">\${bug.status}</span>
          </a>
          <div class="bug-meta">
            ID: \${bug.id} • \${formatDate(bug.createdAt)}
          </div>
        </div>
      \`).join('');
      
      console.log('Bugs rendered successfully');
    }

    function fetchBugs() {
      console.log('Fetching bugs...');
      fetch('/api/bugs', {
        headers: {
          'x-bugger-key': 'secret_demo_key'
        }
      })
      .then(response => {
        console.log('Response status:', response.status);
        if (!response.ok) {
          throw new Error('HTTP ' + response.status + ': ' + response.statusText);
        }
        return response.json();
      })
      .then(bugs => {
        console.log('Bugs received:', bugs.length);
        renderBugs(bugs);
      })
      .catch(error => {
        console.error('Failed to fetch bugs:', error);
        document.getElementById('bugs-list').innerHTML = '<p style="color: red;">Failed to load bugs: ' + error.message + '</p>';
      });
    }

    // Initial load
    fetchBugs();

    // Auto-refresh every 5 seconds
    setInterval(fetchBugs, 5000);
  </script>
</body>
</html>
  `);
});

// Demo 404 endpoint for testing network errors
app.get('/demo-404', (req, res) => {
  res.status(404).json({ error: 'Demo 404 - This endpoint intentionally returns 404 for testing' });
});

// Bug view page
app.get('/bugs/:id/view', async (req, res) => {
  try {
  const { id } = req.params;
    
    // Find the bug by ID (no auth required for demo)
    const bug = await prisma.bug.findFirst({
      where: { id }
    });

    if (!bug) {
      res.status(404).send(`
<!DOCTYPE html>
<html>
<head>
  <title>Bug Not Found</title>
  <meta charset="utf-8">
</head>
<body>
  <h1>Bug Not Found</h1>
  <p>The bug with ID "${id}" could not be found.</p>
  <a href="/demo">← Back to Demo</a>
</body>
</html>
      `);
      return;
    }

    // Parse JSON fields
    const viewport = JSON.parse(bug.viewport);
    const consoleLogs = bug.consoleLogs ? JSON.parse(bug.consoleLogs) : [];
    const networkErrors = bug.networkErrors ? JSON.parse(bug.networkErrors) : [];

    // Sanitize function to prevent XSS
    function sanitize(str: string): string {
      if (typeof str !== 'string') return '';
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
    }

    // Simple markdown to HTML converter (basic)
    function markdownToHtml(markdown: string): string {
      if (!markdown) return '';
      return markdown
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');
    }

    // Format date function
    function formatDate(dateString: string): string {
      return new Date(dateString).toLocaleString();
    }

  res.setHeader('Content-Type', 'text/html');
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Bug Report #${sanitize(bug.id)}</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 20px;
      background-color: #f8fafc;
      line-height: 1.6;
    }
    .container {
      max-width: 1000px;
      margin: 0 auto;
    }
    .header {
      background: white;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .header h1 {
      margin: 0 0 10px 0;
      color: #1e293b;
    }
    .meta {
      color: #6b7280;
      font-size: 14px;
    }
    .severity {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 16px;
      font-size: 12px;
      font-weight: 500;
      text-transform: uppercase;
      margin-left: 10px;
    }
    .severity.low { background: #d1fae5; color: #065f46; }
    .severity.medium { background: #fef3c7; color: #92400e; }
    .severity.high { background: #fed7aa; color: #9a3412; }
    .severity.critical { background: #fee2e2; color: #991b1b; }
    .section {
      background: white;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .section h2 {
      margin-top: 0;
      color: #374151;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    th, td {
      text-align: left;
      padding: 8px 12px;
      border-bottom: 1px solid #e5e7eb;
    }
    th {
      background: #f9fafb;
      font-weight: 500;
      color: #374151;
    }
    .console-log {
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 12px;
    }
    .console-log.error { color: #dc2626; }
    .console-log.warn { color: #d97706; }
    .console-log.log { color: #059669; }
    .network-error {
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 12px;
    }
    .screenshot {
      max-width: 100%;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
    }
    .ai-analysis {
      background: #f0f9ff;
      border-left: 4px solid #0ea5e9;
      padding: 16px;
      margin: 16px 0;
    }
    .confidence-bar {
      width: 100%;
      height: 8px;
      background: #e5e7eb;
      border-radius: 4px;
      overflow: hidden;
      margin: 8px 0;
    }
    .confidence-fill {
      height: 100%;
      background: linear-gradient(90deg, #ef4444 0%, #f59e0b 50%, #10b981 100%);
      transition: width 0.3s ease;
    }
    .patch-diff {
      background: #1e293b;
      color: #e2e8f0;
      padding: 16px;
      border-radius: 6px;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 12px;
      white-space: pre-wrap;
      overflow-x: auto;
    }
    .analyzing-banner {
      background: #dbeafe;
      border: 1px solid #3b82f6;
      border-radius: 6px;
      padding: 12px;
      margin: 16px 0;
      text-align: center;
      color: #1e40af;
    }
    .back-link {
      color: #4f46e5;
      text-decoration: none;
      margin-bottom: 20px;
      display: inline-block;
    }
    .back-link:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <a href="/demo" class="back-link">← Back to Demo</a>
    
    <div class="header">
      <h1>${sanitize(bug.title)} <span class="severity ${bug.severity}">${bug.severity}</span></h1>
      <div class="meta">
        Created: ${formatDate(bug.createdAt.toISOString())} | 
        URL: ${sanitize(bug.url)} | 
        Status: <strong>${bug.status}</strong>
      </div>
    </div>

    <div class="section">
      <h2>Bug Details</h2>
      <h3>Steps to Reproduce</h3>
      <p>${sanitize(bug.steps).replace(/\\n/g, '<br>')}</p>
      
      <h3>Expected Behavior</h3>
      <p>${sanitize(bug.expected).replace(/\\n/g, '<br>')}</p>
      
      <h3>Actual Behavior</h3>
      <p>${sanitize(bug.actual).replace(/\\n/g, '<br>')}</p>
    </div>

    <div class="section">
      <h2>Environment</h2>
      <p><strong>User Agent:</strong> ${sanitize(bug.userAgent)}</p>
      <p><strong>Viewport:</strong> ${viewport.width} × ${viewport.height}</p>
    </div>

    ${consoleLogs.length > 0 ? `
    <div class="section">
      <h2>Console Logs</h2>
      <table>
        <thead>
          <tr>
            <th>Level</th>
            <th>Message</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          ${consoleLogs.map((log: any) => `
            <tr>
              <td><span class="console-log ${log.level}">${log.level}</span></td>
              <td>${sanitize(log.message)}</td>
              <td>${formatDate(log.timestamp)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    ${networkErrors.length > 0 ? `
    <div class="section">
      <h2>Network Errors</h2>
      <table>
        <thead>
          <tr>
            <th>Method</th>
            <th>URL</th>
            <th>Status</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          ${networkErrors.map((error: any) => `
            <tr>
              <td>${sanitize(error.method || 'GET')}</td>
              <td class="network-error">${sanitize(error.url)}</td>
              <td>${error.status || 'Failed'}</td>
              <td>${formatDate(error.timestamp)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}

    ${bug.screenshotDataUrl ? `
    <div class="section">
      <h2>Screenshot</h2>
      <img src="${sanitize(bug.screenshotDataUrl)}" alt="Bug screenshot" class="screenshot">
    </div>
    ` : ''}

    ${bug.status === 'analyzed' && bug.aiAnalysis ? `
    <div class="section">
      <h2>AI Analysis</h2>
      <div class="ai-analysis">
        ${markdownToHtml(sanitize(bug.aiAnalysis))}
      </div>
      ${bug.confidence ? `
        <p><strong>Confidence:</strong> ${Math.round(bug.confidence * 100)}%</p>
        <div class="confidence-bar">
          <div class="confidence-fill" style="width: ${bug.confidence * 100}%"></div>
        </div>
      ` : ''}
      ${bug.aiPatchDiff ? `
        <h3>Suggested Fix</h3>
        <div class="patch-diff">${sanitize(bug.aiPatchDiff)}</div>
      ` : ''}
    </div>
    ` : ''}

    ${bug.status === 'queued' || bug.status === 'analyzing' ? `
    <div class="analyzing-banner">
      <strong>Analyzing...</strong> This bug is being processed by AI. The page will refresh automatically.
    </div>
    ` : ''}
  </div>

  <script>
    function formatDate(dateString) {
      return new Date(dateString).toLocaleString();
    }

    // Auto-refresh if analyzing
    const status = '${bug.status}';
    if (status === 'queued' || status === 'analyzing') {
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    }
  </script>
</body>
</html>
    `);
  } catch (error) {
    console.error('Error rendering bug view:', error);
    res.status(500).send(`
<!DOCTYPE html>
<html>
<head>
  <title>Error</title>
  <meta charset="utf-8">
</head>
<body>
  <h1>Error</h1>
  <p>Failed to load bug report.</p>
  <a href="/demo">← Back to Demo</a>
</body>
</html>
  `);
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down server...');
  await prisma.$disconnect();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API docs: http://localhost:${PORT}/api/bugs`);
});