import { eq, and } from "drizzle-orm"

import { userWallet } from "@/lib/db/schema"
import { db } from "@/lib/db"

import { X402_BASE_SEPOLIA_NETWORK } from "./constants"

export const getUserWalletForChain = async (input: {
    userId: string
    chainId: string
}) => {
    const [row] = await db
        .select({
            address: userWallet.address,
            chainId: userWallet.chainId,
        })
        .from(userWallet)
        .where(
            and(
                eq(userWallet.userId, input.userId),
                eq(userWallet.chainId, input.chainId)
            )
        )
        .limit(1)
    return row ?? null
}

export const getUserBaseSepoliaWalletAddress = async (userId: string) => {
    const w = await getUserWalletForChain({
        userId,
        chainId: X402_BASE_SEPOLIA_NETWORK,
    })
    return w?.address ?? null
}
