import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/api/auth-helper';

/**
 * Handle GET requests to list all documents.
 * Path: /api/documents
 */
export async function GET(request: Request) {
  try {
    // Check authentication
    const user = await getAuthUser(request);
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden. Admin credentials required.' },
        { status: 403 }
      );
    }

    const documents = await prisma.document.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ documents });
  } catch (error) {
    console.error('List documents API error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while fetching documents.' },
      { status: 500 }
    );
  }
}
