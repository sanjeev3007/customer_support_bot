import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { executeRAG } from '@/lib/rag/rag';
import { getAuthUser } from '@/api/auth-helper';

/**
 * Handle POST requests to generate streaming RAG chatbot answers.
 * Path: /api/chat
 */
export async function POST(request: Request) {
  try {
    // Check authentication
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized. Credentials missing.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { 
      conversationId, 
      message, 
      useHybrid = true, 
      topK = 5, 
      similarityThreshold = 0.20 // Configurable threshold (default to 0.20 for Gemini embeddings cosine similarity)
    } = body;

    if (!conversationId || !message || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Parameters conversationId and message are required.' },
        { status: 400 }
      );
    }

    // Verify conversation existence and ownership
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found.' },
        { status: 404 }
      );
    }

    if (conversation.userId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden. You do not have access to this conversation.' },
        { status: 403 }
      );
    }

    // 1. Persist user's message
    await prisma.message.create({
      data: {
        conversationId,
        role: 'user',
        content: message.trim(),
      },
    });

    // 2. Fetch full conversation history (excluding the current user message we just saved to pass to RAG)
    const rawMessages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });

    // Remove the last message from the RAG pipeline's history input (since executeRAG receives the query separately)
    const pastMessages = rawMessages
      .slice(0, -1)
      .map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));

    const startTime = Date.now();

    // 3. Execute RAG Pipeline (Embedding -> Search -> Prompt -> LLM stream initialization)
    const { retrievedChunks, responseStream, promptTokens } = await executeRAG(
      message.trim(),
      pastMessages,
      { useHybrid, topK, similarityThreshold }
    );

    // 4. Create readable stream for SSE streaming response
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        // A. Send the retrieved chunks (citations metadata) first so UI can display sources immediately
        const sourcesEvent = `event: sources\ndata: ${JSON.stringify(retrievedChunks)}\n\n`;
        controller.enqueue(encoder.encode(sourcesEvent));

        let fullGeneratedResponse = '';

        try {
          // B. Stream text chunks as they arrive from Gemini API
          for await (const chunk of responseStream) {
            const textChunk = chunk.text || '';
            fullGeneratedResponse += textChunk;

            const textEvent = `event: text\ndata: ${JSON.stringify(textChunk)}\n\n`;
            controller.enqueue(encoder.encode(textEvent));
          }

          // C. RAG Generation completed successfully - calculate metrics
          const latencyMs = Date.now() - startTime;
          const outputTokens = Math.ceil(fullGeneratedResponse.length / 4); // Estimation
          const totalTokens = promptTokens + outputTokens;

          // D. Persist assistant's reply and metadata in PostgreSQL
          await prisma.message.create({
            data: {
              conversationId,
              role: 'assistant',
              content: fullGeneratedResponse,
              latency: latencyMs,
              tokenUsage: totalTokens,
              retrievedChunks: retrievedChunks as any, // Chunks are standard JSON-serializable
            },
          });

          // E. Update conversation's updatedAt timestamp to bubble it in list
          await prisma.conversation.update({
            where: { id: conversationId },
            data: { updatedAt: new Date() },
          });

          // F. Emit completion metadata event
          const doneEvent = `event: done\ndata: ${JSON.stringify({ latency: latencyMs, tokens: totalTokens })}\n\n`;
          controller.enqueue(encoder.encode(doneEvent));
        } catch (streamError) {
          console.error('RAG output streaming failure:', streamError);
          const errorEvent = `event: error\ndata: ${JSON.stringify('Failed to stream response from chatbot.')}\n\n`;
          controller.enqueue(encoder.encode(errorEvent));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('Chat API route error:', error?.message || error);
    console.error('Chat API route stack:', error?.stack);
    return NextResponse.json(
      { error: `Chat pipeline error: ${error?.message || 'Unknown error'}` },
      { status: 500 }
    );
  }
}
