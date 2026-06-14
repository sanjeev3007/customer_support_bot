import { readFileSync } from 'fs';

// Read API key from .env file (handles both quoted and unquoted values)
const envContent = readFileSync('.env', 'utf-8');
const match = envContent.match(/GEMINI_API_KEY=["']?([^"'\s\r\n]+)["']?/);
const apiKey = match?.[1];

if (!apiKey) {
  console.error('❌ No GEMINI_API_KEY found in .env file');
  process.exit(1);
}

console.log(`🔑 Testing API key: ${apiKey.slice(0, 10)}...${apiKey.slice(-4)}\n`);

// Test 1: Embedding model
console.log('--- Test 1: Embedding (gemini-embedding-001) ---');
try {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/gemini-embedding-001',
        content: { parts: [{ text: 'hello world' }] },
      }),
    }
  );

  if (res.ok) {
    const data = await res.json();
    const dims = data.embedding?.values?.length;
    console.log(`✅ Embedding WORKS! Returned ${dims} dimensions.\n`);
  } else {
    const err = await res.json();
    console.error(`❌ Embedding FAILED (${res.status}): ${err.error?.message}\n`);
  }
} catch (e) {
  console.error('❌ Network error:', e.message, '\n');
}

// Test 2: Chat model
console.log('--- Test 2: Chat (gemini-2.5-flash) ---');
try {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Say "hello" in one word.' }] }],
      }),
    }
  );

  if (res.ok) {
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    console.log(`✅ Chat WORKS! Response: "${text}"\n`);
  } else {
    const err = await res.json();
    console.error(`❌ Chat FAILED (${res.status}): ${err.error?.message}\n`);
  }
} catch (e) {
  console.error('❌ Network error:', e.message, '\n');
}

console.log('Done! If both show ✅, restart your dev server and try chatting.');
