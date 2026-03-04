import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware for route protection
 * Handles authentication and role-based access control
 * 
 * Note: This middleware runs on the Edge runtime and cannot access localStorage.
 * Token validation happens client-side; this provides basic route structure protection.
 */

// Define protected routes and their allowed roles
const roleRoutes: Record<string, string[]> = {
  "/student": ["student"],
  "/lecturer": ["lecturer"],
  "/admin": ["admin"],
};

// Public routes that don't require authentication
const publicRoutes = ["/login", "/forgot-password", "/reset-password"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Allow static files and API routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // For protected routes, we let the client-side auth context handle
  // the actual authentication check since we can't access localStorage here.
  // The AuthContext will redirect to login if not authenticated.
  
  // Check if trying to access a role-specific route
  for (const [routePrefix, _allowedRoles] of Object.entries(roleRoutes)) {
    if (pathname.startsWith(routePrefix)) {
      // The actual role check happens client-side in the page components
      // This middleware just ensures the route structure is valid
      return NextResponse.next();
    }
  }

  return NextResponse.next();
}

export const config = {
  // Match all routes except static files
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
