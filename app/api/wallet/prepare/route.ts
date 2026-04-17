import { NextResponse } from "next/server"

import { unauthorizedJson } from "@/lib/api-response"
import { getSession } from "@/lib/auth/session"
import { walletLinkChallenge } from "@/lib/db/schema"
import { db } from "@/lib/db"
import { buildWalletLinkMessage } from "@/lib/wallet/link-message"

export const POST = async () => {
    const session = await getSession()
    if (!session?.user?.id) {
        return unauthorizedJson()
    }

    const nonce = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000)

    await db
        .insert(walletLinkChallenge)
        .values({
            userId: session.user.id,
            nonce,
            expiresAt,
        })
        .onConflictDoUpdate({
            target: walletLinkChallenge.userId,
            set: {
                nonce,
                expiresAt,
            },
        })

    const message = buildWalletLinkMessage({
        userId: session.user.id,
        nonce,
        expiresAtIso: expiresAt.toISOString(),
    })

    return NextResponse.json({
        message,
        nonce,
        expiresAt: expiresAt.toISOString(),
    })
}
