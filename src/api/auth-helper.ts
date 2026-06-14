import { verifyJWT } from '@/lib/auth';

/**
 * Extracts authenticated user details from the request.
 * 
 * Strategy:
 * 1. First tries middleware-injected x-user-* headers (fast path).
 * 2. Falls back to reading + verifying the JWT cookie directly,
 *    which is necessary because Next.js App Router does not reliably
 *    forward headers modified by middleware to route handlers.
 *
 * Returns null if the user cannot be identified (unauthenticated).
 */
export async function getAuthUser(request: Request) {
  // Fast path: check middleware-injected headers
  const userId = request.headers.get('x-user-id');
  const email = request.headers.get('x-user-email');
  const role = request.headers.get('x-user-role') as 'ADMIN' | 'CUSTOMER' | null;

  if (userId && email && role) {
    const nameHeader = request.headers.get('x-user-name');
    const name = nameHeader ? decodeURIComponent(nameHeader) : undefined;
    return { id: userId, email, role, name };
  }

  // Fallback: read JWT directly from the cookie header
  const cookieHeader = request.headers.get('cookie') || '';
  const tokenMatch = cookieHeader.match(/(?:^|;\s*)token=([^;]*)/);
  const token = tokenMatch?.[1];

  if (!token) {
    return null;
  }

  const payload = await verifyJWT(token);
  if (!payload) {
    return null;
  }

  return {
    id: payload.userId,
    email: payload.email,
    role: payload.role,
    name: payload.name,
  };
}
