import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/api/auth-helper';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Handle DELETE requests to remove a document and its chunks.
 * Path: /api/documents/:id
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    // Check authentication
    const user = await getAuthUser(request);
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden. Admin credentials required.' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Check if the document exists
    const document = await prisma.document.findUnique({
      where: { id },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found.' },
        { status: 404 }
      );
    }

    // Delete the document. Cascade relationships handle deleting
    // all corresponding document_chunks and embeddings_metadata in the database.
    await prisma.document.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Document and all its vector chunks successfully deleted.',
    });
  } catch (error) {
    console.error('Delete document API error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while deleting the document.' },
      { status: 500 }
    );
  }
}
