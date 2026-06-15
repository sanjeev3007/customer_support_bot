import { generateEmbedding } from '../embeddings/embeddings';
import { vectorSearch, hybridSearch, SearchResult } from '../vectorStore/vectorStore';
import { generateChatStream, countTokens } from '../llm/llm';

export interface RAGOptions {
  topK?: number;
  similarityThreshold?: number;
  useHybrid?: boolean;
}

export interface RAGPipelineResult {
  retrievedChunks: SearchResult[];
  responseStream: any;
  promptTokens: number;
  systemInstruction: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Runs the complete RAG Pipeline.
 * 1. Generates query embeddings
 * 2. Fetches relevant chunks via vector or hybrid search
 * 3. Builds a grounded system prompt containing references
 * 4. Estimates prompt token count
 * 5. Calls the Gemini API stream
 */
export async function executeRAG(
  query: string,
  chatHistory: ChatMessage[],
  options: RAGOptions = {}
): Promise<RAGPipelineResult> {
  const useHybrid = options.useHybrid ?? true;
  const topK = options.topK ?? 5;
  const similarityThreshold = options.similarityThreshold ?? 0.25;

  // 1. Generate query embedding
  const queryEmbedding = await generateEmbedding(query);

  // 2. Retrieve document chunks matching query
  let retrievedChunks: SearchResult[] = [];
  if (useHybrid) {
    retrievedChunks = await hybridSearch(query, queryEmbedding, {
      topK,
      similarityThreshold,
    });
  } else {
    retrievedChunks = await vectorSearch(queryEmbedding, topK, similarityThreshold);
  }

  // 3. Construct the retrieved knowledge context text
  const contextText = retrievedChunks.length > 0
    ? retrievedChunks
        .map((chunk, index) => {
          const docName = chunk.metadata?.name || 'Document';
          const docSource = chunk.metadata?.source || '';
          const sourceLabel = docSource ? `${docName} (${docSource})` : docName;
          return `[Source ${index + 1}] (Source: ${sourceLabel})\nContent: ${chunk.content}`;
        })
        .join('\n\n---\n\n')
    : 'No relevant documents or FAQs found in the knowledge base.';

  // 4. Construct strict prompt rules
  const systemInstruction = `You are a helpful, professional company customer support chatbot.
You have access to the conversation history and a "Retrieved Context" from our knowledge base.

CRITICAL RULES:
1. For queries about products, services, or company/support policies, you MUST rely ONLY on the provided "Retrieved Context" below. Do not make up facts or policies.
2. If the user's query is about the knowledge base or company support, and the answer cannot be found in the Retrieved Context, or if the context is insufficient, state exactly:
   "I could not find that information in the knowledge base."
3. If the user is greeting you (e.g., "Hi", "Hello"), asking about the chat history (e.g., "What was my last message?", "What did we just talk about?"), or asking general conversational questions, respond naturally using the chat history. Do not state that you cannot find the information in the knowledge base.
4. For every fact, claim, or policy you state from the knowledge base, you MUST cite the relevant sources using bracket numbers (e.g. [Source 1], [Source 2]). Cite them immediately following the sentence where they are used.
5. If no sources from the Retrieved Context are used (such as for greetings or questions about the chat history itself), do not output any citation brackets.

Retrieved Context:
${contextText}
`;

  // 5. Estimate token usage
  const fullPromptText = `${systemInstruction}\n\nUser Question: ${query}`;
  const promptTokens = await countTokens(fullPromptText);

  // 6. Format full conversation history for the LLM
  // Convert standard roles to Gemini roles
  const formattedHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
    { role: 'system', content: systemInstruction }
  ];

  // Add past history (limit to last 10 messages to save context/token limits)
  const recentHistory = chatHistory.slice(-10);
  recentHistory.forEach(msg => {
    formattedHistory.push({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    });
  });

  // Add current query
  formattedHistory.push({
    role: 'user',
    content: query,
  });

  // 7. Get response stream
  const responseStream = await generateChatStream(formattedHistory, systemInstruction);

  return {
    retrievedChunks,
    responseStream,
    promptTokens,
    systemInstruction,
  };
}
