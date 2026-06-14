import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parsePDF, parseDOCX, parseText, parseURL } from '@/services/parser';
import { splitText } from '@/services/chunker';
import { generateEmbedding, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } from '@/lib/embeddings/embeddings';
import { addDocumentChunk } from '@/lib/vectorStore/vectorStore';
import { getAuthUser } from '@/api/auth-helper';

// 10 MB maximum file size limit
const MAX_FILE_SIZE = 10 * 1024 * 1024; 

/**
 * Handles POST requests to upload and index documents or URLs.
 * Path: /api/upload
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

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const url = formData.get('url') as string | null;
    
    // Chunking configuration
    const chunkSizeStr = formData.get('chunkSize') as string | null;
    const chunkOverlapStr = formData.get('chunkOverlap') as string | null;
    const chunkSize = chunkSizeStr ? parseInt(chunkSizeStr, 10) : 1000;
    const chunkOverlap = chunkOverlapStr ? parseInt(chunkOverlapStr, 10) : 200;

    if (chunkOverlap >= chunkSize) {
      return NextResponse.json(
        { error: 'Overlap size must be less than chunk size.' },
        { status: 400 }
      );
    }

    let documentName = '';
    let docType: 'PDF' | 'DOCX' | 'TXT' | 'MD' | 'URL';
    let textContent = '';

    // A. Parse File Upload
    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File exceeds maximum limit of 10MB (Size: ${(file.size / 1024 / 1024).toFixed(1)}MB).` },
          { status: 400 }
        );
      }

      documentName = file.name;
      const fileExt = documentName.split('.').pop()?.toLowerCase();
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (fileExt === 'pdf') {
        docType = 'PDF';
        textContent = await parsePDF(buffer);
      } else if (fileExt === 'docx') {
        docType = 'DOCX';
        textContent = await parseDOCX(buffer);
      } else if (fileExt === 'txt') {
        docType = 'TXT';
        textContent = parseText(buffer);
      } else if (fileExt === 'md' || fileExt === 'markdown') {
        docType = 'MD';
        textContent = parseText(buffer);
      } else {
        return NextResponse.json(
          { error: `Unsupported file type: .${fileExt}. Allowed: .pdf, .docx, .txt, .md` },
          { status: 400 }
        );
      }
    } 
    // B. Parse URL Scraper
    else if (url) {
      // Basic URL verification
      try {
        new URL(url);
      } catch (e) {
        return NextResponse.json(
          { error: 'Invalid URL format provided.' },
          { status: 400 }
        );
      }

      documentName = url;
      docType = 'URL';
      textContent = await parseURL(url);
    } 
    // C. Missing parameters
    else {
      return NextResponse.json(
        { error: 'Either a file upload or a website URL is required.' },
        { status: 400 }
      );
    }

    if (!textContent || textContent.trim().length === 0) {
      return NextResponse.json(
        { error: 'Document does not contain extractable text content.' },
        { status: 422 }
      );
    }

    // 1. Create Document in database with PROCESSING state
    const document = await prisma.document.create({
      data: {
        name: documentName,
        type: docType,
        sourceUrl: url || null,
        status: 'PROCESSING',
        chunkCount: 0,
      },
    });

    // Run the rest of indexing operations
    try {
      // 2. Segment extracted text into chunks
      const textChunks = splitText(textContent, { chunkSize, chunkOverlap });

      let indexedCount = 0;

      // 3. Generate embeddings and store chunks sequentially
      for (const chunkText of textChunks) {
        // Skip empty or trivial chunks
        if (chunkText.trim().length < 5) continue;

        // Generate vector embedding
        const embedding = await generateEmbedding(chunkText);

        // Store chunk in pgvector table
        const chunkId = await addDocumentChunk(document.id, chunkText, embedding, {
          name: documentName,
          source: url || 'file',
          chunkIndex: indexedCount,
        });

        // Store metadata logging model and dimensions
        await prisma.embeddingsMetadata.create({
          data: {
            chunkId,
            model: EMBEDDING_MODEL,
            dimensions: EMBEDDING_DIMENSIONS,
          },
        });

        indexedCount++;
      }

      // 4. Update Document status to COMPLETED
      const updatedDoc = await prisma.document.update({
        where: { id: document.id },
        data: {
          status: 'COMPLETED',
          chunkCount: indexedCount,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Document successfully indexed.',
        document: updatedDoc,
      });
    } catch (indexError) {
      console.error('Indexing execution failure:', indexError);
      
      // Update status to FAILED in database
      await prisma.document.update({
        where: { id: document.id },
        data: {
          status: 'FAILED',
          error: (indexError as Error).message || 'Unknown failure during chunk generation',
        },
      });

      return NextResponse.json(
        { 
          error: 'Index generation failed during embedding processing.', 
          details: (indexError as Error).message 
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Upload API route error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred during document uploading.' },
      { status: 500 }
    );
  }
}
