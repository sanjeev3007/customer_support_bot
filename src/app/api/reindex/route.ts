import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseURL } from '@/services/parser';
import { splitText } from '@/services/chunker';
import { generateEmbedding, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } from '@/lib/embeddings/embeddings';
import { addDocumentChunk } from '@/lib/vectorStore/vectorStore';
import { getAuthUser } from '@/api/auth-helper';

/**
 * Handle POST requests to re-scrape and re-index a URL-type document.
 * Path: /api/reindex
 */
export async function POST(request: Request) {
  try {
    // Check authentication
    const user = await getAuthUser(request);
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden. Admin credentials required.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { documentId, chunkSize: customChunkSize, chunkOverlap: customChunkOverlap } = body;
    
    const chunkSize = customChunkSize ? parseInt(customChunkSize, 10) : 1000;
    const chunkOverlap = customChunkOverlap ? parseInt(customChunkOverlap, 10) : 200;

    if (!documentId) {
      return NextResponse.json(
        { error: 'documentId parameter is required.' },
        { status: 400 }
      );
    }

    const doc = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!doc) {
      return NextResponse.json(
        { error: 'Document not found.' },
        { status: 404 }
      );
    }

    // Re-indexing is only supported for URLs
    if (doc.type !== 'URL' || !doc.sourceUrl) {
      return NextResponse.json(
        { error: 'Re-indexing is only supported for website URLs. For files, please delete and upload the new version.' },
        { status: 400 }
      );
    }

    // 1. Mark Document as PROCESSING in database
    await prisma.document.update({
      where: { id: doc.id },
      data: {
        status: 'PROCESSING',
        error: null,
      },
    });

    try {
      // 2. Delete existing chunks. Cascade deletes corresponding EmbeddingsMetadata.
      await prisma.documentChunk.deleteMany({
        where: { documentId },
      });

      // 3. Fetch URL content again
      const textContent = await parseURL(doc.sourceUrl);

      if (!textContent || textContent.trim().length === 0) {
        throw new Error('No readable text content extracted from the URL.');
      }

      // 4. Split and embed
      const textChunks = splitText(textContent, { chunkSize, chunkOverlap });
      let indexedCount = 0;

      for (const chunkText of textChunks) {
        if (chunkText.trim().length < 5) continue;

        // Generate embedding vector
        const embedding = await generateEmbedding(chunkText);

        // Store chunk in pgvector table
        const chunkId = await addDocumentChunk(doc.id, chunkText, embedding, {
          name: doc.name,
          source: doc.sourceUrl,
          chunkIndex: indexedCount,
        });

        // Store metadata
        await prisma.embeddingsMetadata.create({
          data: {
            chunkId,
            model: EMBEDDING_MODEL,
            dimensions: EMBEDDING_DIMENSIONS,
          },
        });

        indexedCount++;
      }

      // 5. Update document status to COMPLETED
      const updatedDoc = await prisma.document.update({
        where: { id: doc.id },
        data: {
          status: 'COMPLETED',
          chunkCount: indexedCount,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Document successfully re-indexed.',
        document: updatedDoc,
      });
    } catch (indexError) {
      console.error('Re-indexing failure:', indexError);

      await prisma.document.update({
        where: { id: doc.id },
        data: {
          status: 'FAILED',
          error: (indexError as Error).message || 'Re-indexing failed during processing',
        },
      });

      return NextResponse.json(
        { 
          error: 'Re-indexing execution failed.', 
          details: (indexError as Error).message 
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Re-index API route error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred during re-indexing.' },
      { status: 500 }
    );
  }
}
