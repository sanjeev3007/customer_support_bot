import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyJWT } from './lib/auth';

// Define route patterns to protect
const PROTECTED_PAGES = ['/admin', '/chat'];
const ADMIN_PAGES = ['/admin'];
const ADMIN_APIS = ['/api/upload', '/api/reindex', '/api/documents', '/api/admin/stats'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Extract token from cookies
  const tokenCookie = request.cookies.get('token');
  const token = tokenCookie?.value;

  // Check if target is a protected page or API
  const isProtectedPage = PROTECTED_PAGES.some(page => pathname.startsWith(page));
  const isAdminPage = ADMIN_PAGES.some(page => pathname.startsWith(page));
  const isAdminApi = ADMIN_APIS.some(api => pathname.startsWith(api));

  // If not a protected path, let it pass
  if (!isProtectedPage && !isAdminApi) {
    return NextResponse.next();
  }

  console.log(`[Proxy] Intercepted path: ${pathname}`);
  console.log(`[Proxy] Token cookie present: ${!!token}`);

  // 1. Verify token
  let payload = null;
  if (token) {
    payload = await verifyJWT(token);
    console.log(`[Proxy] JWT Payload verified:`, payload ? `Success (Role: ${payload.role})` : "Failed");
  }

  // 2. Unauthenticated request
  if (!payload) {
    // If it's an API route, return 401 JSON
    if (pathname.startsWith('/api/')) {
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized. Please log in.' }),
        { status: 401, headers: { 'content-type': 'application/json' } }
      );
    }
    // If it's a page, redirect to login page
    const loginUrl = new URL('/login', request.url);
    // Keep track of the original page to redirect back after login
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 3. Authenticated - Check Admin privileges for Admin-only routes
  if (isAdminPage || isAdminApi) {
    if (payload.role !== 'ADMIN') {
      if (pathname.startsWith('/api/')) {
        return new NextResponse(
          JSON.stringify({ error: 'Forbidden. Admin role required.' }),
          { status: 403, headers: { 'content-type': 'application/json' } }
        );
      }
      // Redirect customers trying to visit admin dashboard to the customer chat interface
      return NextResponse.redirect(new URL('/chat', request.url));
    }
  }

  // Set the user info in request headers so API routes don't need to re-decode the token
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', payload.userId);
  requestHeaders.set('x-user-email', payload.email);
  requestHeaders.set('x-user-role', payload.role);
  if (payload.name) {
    requestHeaders.set('x-user-name', encodeURIComponent(payload.name));
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    '/admin',
    '/admin/:path*',
    '/chat',
    '/chat/:path*',
    '/api/chat',
    '/api/chat/:path*',
    '/api/conversations',
    '/api/conversations/:path*',
    '/api/upload',
    '/api/upload/:path*',
    '/api/reindex',
    '/api/reindex/:path*',
    '/api/documents',
    '/api/documents/:path*',
    '/api/admin',
    '/api/admin/:path*',
  ],
};
