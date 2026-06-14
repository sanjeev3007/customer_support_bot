import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * Handle POST requests for user logout.
 * Path: /api/auth/logout
 */
export async function POST() {
  try {
    // Clear the authentication cookie by setting Max-Age to 0 (expired)
    const cookieStore = await cookies();
    cookieStore.set('token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    return NextResponse.json({
      message: 'Logout successful.',
    });
  } catch (error) {
    console.error('Logout API error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred during logout.' },
      { status: 500 }
    );
  }
}
