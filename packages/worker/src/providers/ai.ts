import type { BugRecord } from '../types.js';
import { GeminiProvider } from './gemini.js';

export interface AnalysisResult {
  analysis: string;     // markdown under 250 words
  diff: string | "NONE";
  confidence: number;   // 0..1
  provider: string;     // 'gemini' | 'fallback'
}

export interface AIProvider {
  analyze(params: {
    bug: BugRecord;
    codeContext: string[];
  }): Promise<AnalysisResult>;
}

export interface ProviderConfig {
  apiKey?: string;
  modelId?: string;
  provider?: 'gemini' | 'fallback';
}

// Simple fallback provider that returns a basic analysis
class FallbackProvider implements AIProvider {
  async analyze(params: { bug: BugRecord; codeContext: string[] }): Promise<AnalysisResult> {
    const { bug } = params;
    
    return {
      analysis: `## Bug Analysis (Fallback)\n\n**Issue:** ${bug.title}\n\n**Description:** ${bug.actual}\n\n**Likely Cause:** Unable to analyze due to missing API configuration.\n\n**Recommendation:** Please check your AI provider configuration and API keys.`,
      diff: "NONE",
      confidence: 0.1,
      provider: 'fallback'
    };
  }
}

// Provider selection logic
export function selectProvider(config: ProviderConfig): AIProvider {
  if (config.provider === 'gemini' && config.apiKey) {
    return new GeminiProvider(config);
  } else if (config.apiKey) {
    // Default to Gemini if API key is provided but no provider specified
    return new GeminiProvider(config);
  } else {
    return new FallbackProvider();
  }
}