import { readFileSync } from 'fs';
import { GoogleGenAI } from '@google/genai';

const envContent = readFileSync('.env', 'utf-8');
const match = envContent.match(/GEMINI_API_KEY=["']?([^"'\s\r\n]+)["']?/);
const key = match?.[1];
const ai = new GoogleGenAI({ apiKey: key });

console.log('Testing SDK embedContent response format...\n');

try {
  const response = await ai.models.embedContent({
    model: 'gemini-embedding-001',
    contents: 'hello world',
  });

  console.log('Response keys:', Object.keys(response));
  console.log('response.embedding:', response.embedding ? `exists (${response.embedding.values?.length} dims)` : 'undefined');
  console.log('response.embeddings:', response.embeddings ? `exists (length: ${response.embeddings.length})` : 'undefined');
  console.log('\nFull response (first 500 chars):', JSON.stringify(response).slice(0, 500));
} catch (e) {
  console.error('❌ Error:', e.message);
}
