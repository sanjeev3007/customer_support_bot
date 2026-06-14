import { GoogleGenAI } from '@google/genai';

function getAIClient() {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set. Please add it to your .env file.');
  }
  return new GoogleGenAI({ apiKey });
}

export const EMBEDDING_MODEL = 'gemini-embedding-001';
export const EMBEDDING_DIMENSIONS = 3072;

/**
 * Generates a 768-dimensional vector embedding for the given text using Gemini's text-embedding-004 model.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const ai = getAIClient();
    // Clean text: strip newlines as recommended for embedding generation
    const cleanText = text.replace(/\n/g, ' ');
    
    const response = await ai.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: cleanText,
    });

    if (response.embeddings && response.embeddings.length > 0 && response.embeddings[0].values) {
      return response.embeddings[0].values;
    }
    throw new Error('Failed to extract embedding values from response');
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}
