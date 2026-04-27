import { type Address, encodeFunctionData } from "viem"

const erc20ApproveAbi = [
    {
        name: "approve",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" },
        ],
        outputs: [{ type: "bool" }],
    },
] as const

export const encodeErc20Approve = (spender: Address, amount: bigint) =>
    encodeFunctionData({
        abi: erc20ApproveAbi,
        functionName: "approve",
        args: [spender, amount],
    })
