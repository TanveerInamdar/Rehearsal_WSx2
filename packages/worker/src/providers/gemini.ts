import axios from 'axios';
import type { AIProvider, AnalysisResult, ProviderConfig } from './ai.js';
import type { BugRecord } from '../types.js';
import { buildPrompt } from '../prompt.js';

export class GeminiProvider implements AIProvider {
  private apiKey: string;
  private modelId: string;

  constructor(config: ProviderConfig) {
    this.apiKey = config.apiKey!;
    this.modelId = config.modelId || 'gemini-2.5-flash';
  }

  async analyze(params: { bug: BugRecord; codeContext: string[] }): Promise<AnalysisResult> {
    try {
      const prompt = buildPrompt(params.bug, params.codeContext);
      
      console.log('Sending request to Gemini API...');
      console.log('Model:', this.modelId);
      console.log('Prompt length:', prompt.length);
      console.log('Screenshot available:', !!params.bug.screenshotDataUrl);
      console.log('Screenshot data URL:', params.bug.screenshotDataUrl ? params.bug.screenshotDataUrl.substring(0, 50) + '...' : 'null');
      
      // Build content parts - include screenshot if available
      const parts: any[] = [];
      
      // Add screenshot first if available (best practice per official docs)
      if (params.bug.screenshotDataUrl) {
        try {
          // Extract base64 data and MIME type from data URL
          const dataUrlMatch = params.bug.screenshotDataUrl.match(/^data:([^;]+);base64,(.+)$/);
          if (dataUrlMatch) {
            const mimeType = dataUrlMatch[1];
            const base64Data = dataUrlMatch[2];
            
            // Validate MIME type is an image
            if (mimeType.startsWith('image/')) {
              parts.push({
                inline_data: {
                  mime_type: mimeType,
                  data: base64Data
                }
              });
              console.log('Added screenshot to Gemini request:', mimeType);
            } else {
              console.warn('Invalid MIME type for screenshot:', mimeType);
            }
          } else {
            console.warn('Invalid data URL format for screenshot');
          }
        } catch (error) {
          console.warn('Failed to process screenshot:', error);
        }
      }
      
      // Add text prompt after image (best practice per official docs)
      parts.push({
        text: prompt
      });
      
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.modelId}:generateContent?key=${this.apiKey}`,
        {
          contents: [{
            parts: parts
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2000,
            topP: 0.8,
            topK: 40
          }
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000 // 30 second timeout
        }
      );

      console.log('Gemini API response received');
      
      // Check for API errors in the response
      if (response.data.error) {
        console.error('Gemini API error:', response.data.error);
        throw new Error(`Gemini API error: ${response.data.error.message} (${response.data.error.code})`);
      }
      
      // Validate response structure
      if (!response.data.candidates || 
          !response.data.candidates[0] || 
          !response.data.candidates[0].content) {
        console.error('Invalid response structure:', JSON.stringify(response.data, null, 2));
        throw new Error('Invalid response structure from Gemini API');
      }

      const candidate = response.data.candidates[0];
      
      // Check if response was truncated due to token limit
      if (candidate.finishReason === 'MAX_TOKENS') {
        console.warn('Response truncated due to token limit');
      }
      
      // Extract content - it might be in different formats
      let content = '';
      if (candidate.content.parts && candidate.content.parts[0] && candidate.content.parts[0].text) {
        content = candidate.content.parts[0].text;
      } else if (candidate.content.text) {
        content = candidate.content.text;
      } else {
        console.error('No text content found in response:', JSON.stringify(candidate.content, null, 2));
        throw new Error('No text content found in Gemini API response');
      }
      console.log('Raw Gemini response:', content);
      
      return this.parseResponse(content);
    } catch (error) {
      console.error('Gemini API error:', error);
      
      // If it's an axios error, provide more details
      if (axios.isAxiosError(error)) {
        if (error.response) {
          console.error('Response status:', error.response.status);
          console.error('Response data:', error.response.data);
          throw new Error(`Gemini API failed with status ${error.response.status}: ${JSON.stringify(error.response.data)}`);
        } else if (error.request) {
          throw new Error('Gemini API request failed - no response received');
        }
      }
      
      throw new Error(`Gemini API failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private parseResponse(content: string): AnalysisResult {
    console.log('Parsing Gemini response...');
    
    // Try to find structured sections
    const analysisMatch = content.match(/## Analysis\s*\n([\s\S]*?)(?=\n## |$)/i);
    const patchMatch = content.match(/## Patch\s*\n([\s\S]*?)(?=\n## |$)/i);
    const confidenceMatch = content.match(/## Confidence\s*\n([\s\S]*?)(?=\n## |$)/i);
    
    let analysis = '';
    let diff = 'NONE';
    let confidence = 0.5;
    
    if (analysisMatch) {
      analysis = analysisMatch[1].trim();
    }
    
    if (patchMatch) {
      const patchContent = patchMatch[1].trim();
      if (patchContent.toLowerCase() !== 'none' && patchContent.length > 0) {
        diff = patchContent;
      }
    }
    
    if (confidenceMatch) {
      const confidenceText = confidenceMatch[1].trim();
      const confidenceValue = parseFloat(confidenceText);
      if (!isNaN(confidenceValue)) {
        // If it's a percentage (0-100), convert to decimal
        confidence = confidenceValue > 1 ? confidenceValue / 100 : confidenceValue;
      }
    }
    
    // If we couldn't parse structured sections, use the raw content as analysis
    if (!analysis) {
      analysis = content.trim();
    }
    
    // Ensure confidence is within bounds
    confidence = Math.max(0.1, Math.min(1.0, confidence));
    
    console.log('Parsed result:', { 
      analysisLength: analysis.length, 
      diffLength: diff.length, 
      confidence 
    });
    
    return {
      analysis,
      diff: diff === '' ? 'NONE' : diff,
      confidence,
      provider: 'gemini'
    };
  }
}