import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/api/auth-helper';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Handle GET requests to fetch a specific conversation's detail and message history.
 * Path: /api/conversations/:id
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized.' },
        { status: 401 }
      );
    }

    const { id } = await params;

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found.' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (conversation.userId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden. You do not have access to this conversation.' },
        { status: 403 }
      );
    }

    return NextResponse.json({ conversation });
  } catch (error) {
    console.error('Fetch conversation details API error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while fetching conversation details.' },
      { status: 500 }
    );
  }
}

/**
 * Handle PUT requests to update a conversation (e.g. rename title).
 * Path: /api/conversations/:id
 */
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized.' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { title } = body;

    if (!title || title.trim().length === 0) {
      return NextResponse.json(
        { error: 'A valid title is required.' },
        { status: 400 }
      );
    }

    // Check ownership
    const conversation = await prisma.conversation.findUnique({
      where: { id },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found.' },
        { status: 404 }
      );
    }

    if (conversation.userId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden.' },
        { status: 403 }
      );
    }

    const updatedConversation = await prisma.conversation.update({
      where: { id },
      data: {
        title: title.trim(),
      },
    });

    return NextResponse.json({
      success: true,
      conversation: updatedConversation,
    });
  } catch (error) {
    console.error('Rename conversation API error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while updating the conversation.' },
      { status: 500 }
    );
  }
}

/**
 * Handle DELETE requests to delete a conversation thread.
 * Path: /api/conversations/:id
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized.' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Check ownership
    const conversation = await prisma.conversation.findUnique({
      where: { id },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found.' },
        { status: 404 }
      );
    }

    if (conversation.userId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden.' },
        { status: 403 }
      );
    }

    // Delete conversation. Cascade deletion handles corresponding messages.
    await prisma.conversation.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Conversation successfully deleted.',
    });
  } catch (error) {
    console.error('Delete conversation API error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while deleting the conversation.' },
      { status: 500 }
    );
  }
}
