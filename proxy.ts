import { getSessionCookie } from "better-auth/cookies"
import { type NextRequest, NextResponse } from "next/server"

import { isAgentsRoute, isPublicPath } from "@/lib/auth/public-paths"

/**
 * Cookie-only check is optimistic (Better Auth docs). For sensitive server
 * actions, still validate with `auth.api.getSession` where it matters.
 *
 * @see https://www.better-auth.com/docs/integrations/next#auth-protection
 */
export const proxy = (request: NextRequest) => {
    const { pathname } = request.nextUrl

    if (isPublicPath(pathname)) {
        return NextResponse.next()
    }

    if (isAgentsRoute(pathname)) {
        const sessionCookie = getSessionCookie(request)
        if (!sessionCookie) {
            const login = new URL("/login", request.url)
            login.searchParams.set("callbackUrl", pathname)
            return NextResponse.redirect(login)
        }
    }

    return NextResponse.next()
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
}
