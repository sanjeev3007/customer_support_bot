import { readFileSync } from 'fs';
import { GoogleGenAI } from '@google/genai';

const envContent = readFileSync('.env', 'utf-8');
const match = envContent.match(/GEMINI_API_KEY=["']?([^"'\s\r\n]+)["']?/);
const key = match?.[1];

if (!key) { console.error('No key'); process.exit(1); }

const ai = new GoogleGenAI({ apiKey: key });

console.log('Testing streaming with gemini-2.5-flash...\n');

try {
  const stream = await ai.models.generateContentStream({
    model: 'gemini-2.5-flash',
    contents: [{ role: 'user', parts: [{ text: 'Say hello in 5 words.' }] }],
    config: { systemInstruction: 'You are a helpful assistant.' },
  });

  console.log('Stream object type:', typeof stream);
  
  let fullText = '';
  let chunkCount = 0;
  
  for await (const chunk of stream) {
    chunkCount++;
    console.log(`\nChunk ${chunkCount} keys:`, Object.keys(chunk));
    console.log('  chunk.text:', chunk.text);
    
    const text = chunk.text || '';
    fullText += text;
  }
  
  console.log('\n✅ Full response:', fullText);
  console.log('Total chunks:', chunkCount);
} catch (e) {
  console.error('❌ Stream error:', e.message);
  console.error(e);
}
