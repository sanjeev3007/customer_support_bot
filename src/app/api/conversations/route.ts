import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/api/auth-helper';

/**
 * Handle GET requests to list all conversations for the authenticated user.
 * Path: /api/conversations
 */
export async function GET(request: Request) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized. Credentials missing.' },
        { status: 401 }
      );
    }

    const conversations = await prisma.conversation.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error('List conversations API error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while fetching conversations.' },
      { status: 500 }
    );
  }
}

/**
 * Handle POST requests to create a new conversation thread.
 * Path: /api/conversations
 */
export async function POST(request: Request) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized. Credentials missing.' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { title } = body;

    const newConversation = await prisma.conversation.create({
      data: {
        title: title || 'New Chat',
        userId: user.id,
      },
    });

    return NextResponse.json({
      success: true,
      conversation: newConversation,
    });
  } catch (error) {
    console.error('Create conversation API error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while starting a conversation.' },
      { status: 500 }
    );
  }
}
