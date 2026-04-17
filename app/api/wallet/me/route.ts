import { and, eq } from "drizzle-orm"
import { NextResponse } from "next/server"

import { unauthorizedJson } from "@/lib/api-response"
import { getSession } from "@/lib/auth/session"
import { userWallet } from "@/lib/db/schema"
import { db } from "@/lib/db"
import { X402_BASE_SEPOLIA_NETWORK } from "@/lib/wallet/constants"

export const GET = async () => {
    const session = await getSession()
    if (!session?.user?.id) {
        return unauthorizedJson()
    }

    const [row] = await db
        .select({
            address: userWallet.address,
            chainId: userWallet.chainId,
        })
        .from(userWallet)
        .where(
            and(
                eq(userWallet.userId, session.user.id),
                eq(userWallet.chainId, X402_BASE_SEPOLIA_NETWORK)
            )
        )
        .limit(1)

    if (!row) {
        return NextResponse.json({ linked: false as const })
    }

    return NextResponse.json({
        linked: true as const,
        address: row.address,
        chainId: row.chainId,
    })
}
