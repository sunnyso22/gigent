import { KITE_CAIP2_NETWORK } from "./constants"

export const buildWalletLinkMessage = (input: {
    userId: string
    nonce: string
    expiresAtIso: string
}) => {
    return [
        "Gigent wallet link",
        "",
        `User ID: ${input.userId}`,
        `Chain: ${KITE_CAIP2_NETWORK}`,
        `Nonce: ${input.nonce}`,
        `Expires: ${input.expiresAtIso}`,
    ].join("\n")
}
