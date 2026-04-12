/**
 * URL paths that never require a session. `/agents` is **not** public —
 * unauthenticated users are redirected from there in `proxy.ts`.
 *
 * @see https://www.better-auth.com/docs/integrations/next#auth-protection
 */
export const isPublicPath = (pathname: string): boolean =>
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/chat")

/** Workspace routes that require a logged-in user. */
export const isAgentsRoute = (pathname: string): boolean =>
    pathname === "/agents" || pathname.startsWith("/agents/")
