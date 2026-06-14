import { GoogleGenAI } from '@google/genai';

function getAIClient() {
  const apiKey = process.env.GEMINI_API_KEY || '';
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set. Please add it to your .env file.');
  }
  return new GoogleGenAI({ apiKey });
}

export const CHAT_MODEL = 'gemini-2.5-flash';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Initiates a streaming chat completion with the Gemini model.
 * Maps standard roles (user/assistant) to Gemini roles (user/model)
 * and passes the system instruction in the config parameter.
 */
export async function generateChatStream(
  messages: ChatMessage[],
  systemInstruction?: string
) {
  try {
    const ai = getAIClient();

    // Map system messages and filter them out since systemInstructions go to configuration
    const filteredMessages = messages.filter(m => m.role !== 'system');
    
    // Fallback if system instruction is not explicitly passed but is present in system role messages
    const systemMessage = messages.find(m => m.role === 'system');
    const instruction = systemInstruction || systemMessage?.content;

    const geminiContents = filteredMessages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    const responseStream = await ai.models.generateContentStream({
      model: CHAT_MODEL,
      contents: geminiContents,
      config: instruction ? { systemInstruction: instruction } : undefined,
    });

    return responseStream;
  } catch (error) {
    console.error('Error generating chat stream:', error);
    throw error;
  }
}

/**
 * Counts the tokens of a text prompt.
 */
export async function countTokens(text: string): Promise<number> {
  try {
    const ai = getAIClient();
    const response = await ai.models.countTokens({
      model: CHAT_MODEL,
      contents: text,
    });
    return response.totalTokens || Math.ceil(text.length / 4);
  } catch (e) {
    // Fallback estimation
    return Math.ceil(text.length / 4);
  }
}
