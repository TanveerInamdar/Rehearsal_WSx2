import * as fs from 'fs';
import * as path from 'path';

export function discoverCodeContext(bugUrl: string, repoRoot: string = process.cwd()): string[] {
  const urlPath = new URL(bugUrl).pathname;
  const urlSegments = urlPath.split('/').filter(Boolean);
  
  const relevantFiles: Array<{ path: string; score: number }> = [];
  
  try {
    walkDirectory(repoRoot, relevantFiles, urlSegments);
  } catch (error) {
    console.warn('Error walking directory for code context:', error);
    return [];
  }
  
  // Sort by score (highest first) and take top 30
  return relevantFiles
    .sort((a, b) => b.score - a.score)
    .slice(0, 30)
    .map(item => item.path)
    .filter((path, index, array) => array.indexOf(path) === index); // dedupe
}

function walkDirectory(dir: string, relevantFiles: Array<{ path: string; score: number }>, urlSegments: string[], depth: number = 0) {
  // Limit depth to avoid infinite recursion
  if (depth > 10) return;
  
  // Skip certain directories
  const skipDirs = ['node_modules', 'dist', '.git', 'prisma/migrations', '.next', 'build'];
  const dirName = path.basename(dir);
  
  if (skipDirs.includes(dirName)) return;
  
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(process.cwd(), fullPath);
      
      if (entry.isDirectory()) {
        walkDirectory(fullPath, relevantFiles, urlSegments, depth + 1);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (['.ts', '.tsx', '.js', '.jsx', '.css'].includes(ext)) {
          const score = calculateRelevanceScore(relativePath, entry.name, urlSegments);
          if (score > 0) {
            relevantFiles.push({ path: relativePath, score });
          }
        }
      }
    }
  } catch (error) {
    // Skip directories we can't read
  }
}

function calculateRelevanceScore(filePath: string, fileName: string, urlSegments: string[]): number {
  let score = 0;
  
  // Filename contains relevant keywords
  const keywords = ['error', 'logger', 'form', 'route', 'api', 'bug', 'component'];
  const lowerFileName = fileName.toLowerCase();
  const lowerPath = filePath.toLowerCase();
  
  for (const keyword of keywords) {
    if (lowerFileName.includes(keyword)) {
      score += 10;
    }
    if (lowerPath.includes(keyword)) {
      score += 5;
    }
  }
  
  // Path segment overlaps with URL path parts
  for (const segment of urlSegments) {
    if (lowerPath.includes(segment.toLowerCase())) {
      score += 8;
    }
  }
  
  // Prefer files closer to root
  const depth = filePath.split('/').length;
  score += Math.max(0, 10 - depth);
  
  // Prefer specific file types
  if (fileName.endsWith('.tsx') || fileName.endsWith('.jsx')) {
    score += 3;
  } else if (fileName.endsWith('.ts') || fileName.endsWith('.js')) {
    score += 2;
  }
  
  return score;
}
