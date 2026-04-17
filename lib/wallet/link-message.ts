import { X402_BASE_SEPOLIA_NETWORK } from "./constants"

export const buildWalletLinkMessage = (input: {
    userId: string
    nonce: string
    expiresAtIso: string
}) => {
    return [
        "Gigent wallet link",
        "",
        `User ID: ${input.userId}`,
        `Chain: ${X402_BASE_SEPOLIA_NETWORK}`,
        `Nonce: ${input.nonce}`,
        `Expires: ${input.expiresAtIso}`,
    ].join("\n")
}
