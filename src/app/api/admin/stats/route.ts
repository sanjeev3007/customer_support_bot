import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/api/auth-helper';

/**
 * Handle GET requests to fetch admin dashboard metrics and overview data.
 * Path: /api/admin/stats
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

    // Run statistical queries in parallel for efficiency
    const [
      totalDocuments,
      totalChunks,
      totalConversations,
      totalMessages,
      documents,
      conversations,
      userMessages,
    ] = await Promise.all([
      prisma.document.count(),
      prisma.documentChunk.count(),
      prisma.conversation.count(),
      prisma.message.count(),
      // Fetch documents for the list view
      prisma.document.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      // Fetch recent conversations with user emails
      prisma.conversation.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          user: {
            select: {
              email: true,
              name: true,
            },
          },
          _count: {
            select: { messages: true },
          },
        },
      }),
      // Fetch recent customer queries to extract questions
      prisma.message.findMany({
        where: { role: 'user' },
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: { content: true },
      }),
    ]);

    // Calculate document statuses
    const failedDocuments = documents.filter(d => d.status === 'FAILED').length;
    const completedDocuments = documents.filter(d => d.status === 'COMPLETED').length;
    const processingDocuments = documents.filter(d => d.status === 'PROCESSING').length;

    // Process frequent questions (simple frequency distribution of user queries)
    const questionFrequencies: Record<string, number> = {};
    userMessages.forEach(msg => {
      // Clean and normalize query
      const queryText = msg.content.trim().replace(/\?$/, '').trim();
      if (queryText.length > 5) {
        questionFrequencies[queryText] = (questionFrequencies[queryText] || 0) + 1;
      }
    });

    // Sort questions by frequency
    const frequentQuestions = Object.entries(questionFrequencies)
      .map(([text, count]) => ({ text, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Fallback if not enough repeated questions, list recent questions
    if (frequentQuestions.length < 3) {
      const recentUnique = Array.from(new Set(userMessages.map(m => m.content.trim())))
        .slice(0, 5)
        .map(text => ({ text, count: 1 }));
      frequentQuestions.push(...recentUnique.filter(q => !frequentQuestions.some(fq => fq.text === q.text)));
    }

    return NextResponse.json({
      metrics: {
        totalDocuments,
        totalChunks,
        totalConversations,
        totalMessages,
        completedDocuments,
        failedDocuments,
        processingDocuments,
      },
      documents,
      conversations: conversations.map(c => ({
        id: c.id,
        title: c.title,
        userEmail: c.user.email,
        userName: c.user.name,
        messageCount: c._count.messages,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
      frequentQuestions: frequentQuestions.slice(0, 5),
    });
  } catch (error) {
    console.error('Admin stats API error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred while compiling metrics.' },
      { status: 500 }
    );
  }
}
