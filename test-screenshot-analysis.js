// Test script to verify screenshot processing
const { selectProvider } = require('./packages/worker/dist/providers/ai.js');

// Create a test bug with a real screenshot (1x1 PNG)
const testBug = {
  id: 'test-screenshot-001',
  title: 'Button not working - screenshot test',
  steps: '1. Click the submit button\n2. Nothing happens',
  expected: 'Form should submit and show success message',
  actual: 'Button click does nothing, no response',
  severity: 'medium',
  url: 'http://localhost:8787/demo',
  userAgent: 'Mozilla/5.0 (Test Browser)',
  viewport: { width: 1920, height: 1080 },
  consoleLogs: [],
  networkErrors: [],
  screenshotDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  projectPublicKey: 'demo-key',
  createdAt: new Date().toISOString(),
  status: 'pending'
};

const codeContext = [
  'src/components/Button.tsx',
  'src/pages/Form.tsx'
];

async function testScreenshotProcessing() {
  console.log('=== SCREENSHOT PROCESSING TEST ===');
  console.log('Screenshot data URL length:', testBug.screenshotDataUrl.length);
  
  // Test data URL parsing
  const dataUrlMatch = testBug.screenshotDataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (dataUrlMatch) {
    console.log('✅ Data URL parsing successful');
    console.log('MIME Type:', dataUrlMatch[1]);
    console.log('Base64 length:', dataUrlMatch[2].length);
  } else {
    console.log('❌ Data URL parsing failed');
    return;
  }
  
  // Test provider selection
  const provider = selectProvider({
    apiKey: process.env.GEMINI_API_KEY,
    modelId: 'gemini-2.5-flash',
    provider: 'gemini'
  });
  
  console.log('Provider type:', provider.constructor.name);
  
  if (provider.constructor.name === 'FallbackProvider') {
    console.log('⚠️  Using fallback provider - Gemini API key not configured');
    console.log('To test multimodal functionality, set GEMINI_API_KEY environment variable');
    return;
  }
  
  try {
    console.log('\n=== SENDING MULTIMODAL REQUEST ===');
    const result = await provider.analyze({
      bug: testBug,
      codeContext: codeContext
    });
    
    console.log('\n=== ANALYSIS RESULT ===');
    console.log('Provider:', result.provider);
    console.log('Confidence:', result.confidence);
    console.log('Analysis preview:', result.analysis.substring(0, 200) + '...');
    
    // Check if analysis mentions visual elements
    const mentionsVisual = result.analysis.toLowerCase().includes('screenshot') || 
                          result.analysis.toLowerCase().includes('image') ||
                          result.analysis.toLowerCase().includes('visual') ||
                          result.analysis.toLowerCase().includes('see');
    
    console.log('\n=== MULTIMODAL VERIFICATION ===');
    console.log('Analysis mentions visual elements:', mentionsVisual);
    
    if (mentionsVisual) {
      console.log('✅ SUCCESS: Multimodal functionality working!');
      console.log('✅ Gemini analyzed the screenshot successfully!');
    } else {
      console.log('⚠️  WARNING: No visual analysis detected');
      console.log('The screenshot may not have been processed by Gemini');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testScreenshotProcessing();
