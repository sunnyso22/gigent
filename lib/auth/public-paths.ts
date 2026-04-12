/**
 * URL paths that never require a session. Authenticated-only routes are handled
 * in `proxy.ts` via `requiresSessionPath`.
 *
 * @see https://www.better-auth.com/docs/integrations/next#auth-protection
 */
export const isPublicPath = (pathname: string): boolean =>
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth")

/** `/agents` workspace (chat UI). */
export const isAgentsRoute = (pathname: string): boolean =>
    pathname === "/agents" || pathname.startsWith("/agents/")

/** Personal settings (`/settings`, future sections). */
export const isSettingsPath = (pathname: string): boolean =>
    pathname === "/settings" || pathname.startsWith("/settings/")

export const requiresSessionPath = (pathname: string): boolean =>
    isAgentsRoute(pathname) || isSettingsPath(pathname)
