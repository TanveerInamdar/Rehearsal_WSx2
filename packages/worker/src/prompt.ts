import type { BugRecord } from './types.js';

export function buildPrompt(bug: BugRecord, codeContext: string[]): string {
  const contextList = codeContext.slice(0, 30).join('\n');
  
  return `You are a helpful AI assistant that analyzes bug reports and provides actionable feedback and suggested fixes.

## Bug Report

**Title:** ${bug.title}
**Severity:** ${bug.severity}
**URL:** ${bug.url}
**Steps to reproduce:** ${bug.steps}
**Expected behavior:** ${bug.expected}
**Actual behavior:** ${bug.actual}
**User Agent:** ${bug.userAgent}
**Viewport:** ${JSON.stringify(bug.viewport)}

**Console Logs:**
${bug.consoleLogs?.map((log: any) => `- ${log.level}: ${log.message}`).join('\n') || 'None'}

**Network Errors:**
${bug.networkErrors?.map((error: any) => `- ${error.method} ${error.url}: ${error.status}`).join('\n') || 'None'}

## Code Context (file paths only)
${contextList}

## Instructions

Please provide your analysis in the following format:

## Analysis
[Concise markdown analysis, ≤ 250 words, bullet points allowed. Focus on likely causes and recommended fixes.]

## Patch
[Exactly one unified diff or the word NONE. If proposing a diff, reference paths from the provided list. Prefer minimal, safe fixes like null checks and guard clauses.]

## Confidence
[Single float line, 0..1. If not confident, set confidence ≤ 0.4 and Patch = NONE.]

## Rules
- If not confident, set confidence ≤ 0.4 and Patch = NONE
- Prefer minimal, safe fixes (null checks, guard clauses, prop existence)
- If proposing a diff, reference paths from the provided list
- Keep analysis under 250 words
- Use bullet points for clarity`;
}
