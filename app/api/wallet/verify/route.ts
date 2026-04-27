import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"
import { getAddress, verifyMessage } from "viem"

import { jsonError, unauthorizedJson } from "@/lib/api-response"
import { getSession } from "@/lib/auth/session"
import { userWallet, walletLinkChallenge } from "@/lib/db/schema"
import { db } from "@/lib/db"
import { KITE_CAIP2_NETWORK } from "@/lib/wallet/constants"
import { buildWalletLinkMessage } from "@/lib/wallet/link-message"

type Body = {
    address?: string
    signature?: `0x${string}`
}

export const POST = async (req: Request) => {
    const session = await getSession()
    if (!session?.user?.id) {
        return unauthorizedJson()
    }

    let body: Body
    try {
        body = await req.json()
    } catch {
        return jsonError(400, "Invalid JSON")
    }

    const rawAddress = body.address?.trim()
    const signature = body.signature
    if (!rawAddress?.startsWith("0x") || !signature?.startsWith("0x")) {
        return jsonError(400, "address and signature required")
    }

    const [challenge] = await db
        .select()
        .from(walletLinkChallenge)
        .where(eq(walletLinkChallenge.userId, session.user.id))
        .limit(1)

    if (!challenge || challenge.expiresAt < new Date()) {
        return jsonError(400, "Challenge missing or expired; call POST /api/wallet/prepare again")
    }

    const message = buildWalletLinkMessage({
        userId: session.user.id,
        nonce: challenge.nonce,
        expiresAtIso: challenge.expiresAt.toISOString(),
    })

    const ok = await verifyMessage({
        address: rawAddress as `0x${string}`,
        message,
        signature: signature as `0x${string}`,
    })

    if (!ok) {
        return jsonError(400, "Signature verification failed")
    }

    const address = getAddress(rawAddress)

    const [existingOwner] = await db
        .select({ userId: userWallet.userId })
        .from(userWallet)
        .where(
            and(
                eq(userWallet.chainId, KITE_CAIP2_NETWORK),
                eq(userWallet.address, address)
            )
        )
        .limit(1)

    if (existingOwner && existingOwner.userId !== session.user.id) {
        return jsonError(
            409,
            "This wallet address is already linked to a different Gigent account. Use another address or sign in as that account."
        )
    }

    try {
        await db
            .insert(userWallet)
            .values({
                userId: session.user.id,
                chainId: KITE_CAIP2_NETWORK,
                address,
                verifiedAt: new Date(),
                updatedAt: new Date(),
            })
            .onConflictDoUpdate({
                target: [userWallet.userId, userWallet.chainId],
                set: {
                    address,
                    verifiedAt: new Date(),
                    updatedAt: new Date(),
                },
            })
    } catch (e: unknown) {
        if (isPostgresUniqueViolation(e)) {
            return jsonError(
                409,
                "This wallet address is already linked to a different Gigent account. Use another address or sign in as that account."
            )
        }
        throw e
    }

    await db
        .delete(walletLinkChallenge)
        .where(eq(walletLinkChallenge.userId, session.user.id))

    return NextResponse.json({ ok: true as const, address })
}

const isPostgresUniqueViolation = (e: unknown): boolean => {
    if (typeof e === "object" && e !== null && "code" in e) {
        if ((e as { code: string }).code === "23505") return true
    }
    if (typeof e === "object" && e !== null && "cause" in e) {
        return isPostgresUniqueViolation((e as { cause: unknown }).cause)
    }
    return false
}
