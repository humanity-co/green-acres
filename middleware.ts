import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get('session')?.value;

  // Protect resident, guard, and admin pages from unauthenticated browser access
  const isAuthPage = pathname.startsWith('/auth');
  const isApiRoute = pathname.startsWith('/api');
  const isPublicAsset = pathname.startsWith('/_next') || pathname.startsWith('/uploads') || pathname === '/favicon.ico' || pathname === '/manifest.json';

  // Redirect unauthenticated browser users to /auth/sign-in
  if (!sessionToken && !isAuthPage && !isApiRoute && !isPublicAsset) {
    const signInUrl = new URL('/auth/sign-in', request.url);
    signInUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Continue to page/route
  const response = NextResponse.next();

  // Security Headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');

  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  // Content Security Policy
  // Preserves https://cdn.jsdelivr.net required by ideavo scripts per AGENTS.md
  // Allows https://checkout.razorpay.com and api.razorpay.com for payment processing
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://checkout.razorpay.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https: https://lumberjack.razorpay.com https://api.razorpay.com",
    "frame-src 'self' https://api.razorpay.com",
    "frame-ancestors 'self'",
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public svg/png assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};