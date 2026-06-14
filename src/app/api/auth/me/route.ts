import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyJWT } from '@/lib/auth';

/**
 * Handle GET requests to fetch the authenticated user profile.
 * This endpoint reads the JWT directly from the cookie rather than
 * relying on middleware-injected headers, so it works regardless
 * of middleware matcher configuration.
 * Path: /api/auth/me
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: 'Not authenticated.' },
        { status: 401 }
      );
    }

    const payload = await verifyJWT(token);
    
    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid or expired token.' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      user: {
        id: payload.userId,
        email: payload.email,
        role: payload.role,
        name: payload.name,
      },
    });
  } catch (error) {
    console.error('Auth-me API error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
