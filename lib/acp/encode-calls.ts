import {
    type Address,
    encodeFunctionData,
    type Hex,
    zeroHash,
} from "viem"

import { agenticCommerceAbi } from "./abi"

const emptyOptParams = "0x" as Hex

export const encodeAcpCreateJob = (input: {
    provider: Address
    evaluator: Address
    expiredAt: bigint
    description: string
    hook: Address
}) =>
    encodeFunctionData({
        abi: agenticCommerceAbi,
        functionName: "createJob",
        args: [
            input.provider,
            input.evaluator,
            input.expiredAt,
            input.description,
            input.hook,
        ],
    })

export const encodeAcpSetProvider = (input: {
    jobId: bigint
    provider: Address
}) =>
    encodeFunctionData({
        abi: agenticCommerceAbi,
        functionName: "setProvider",
        args: [input.jobId, input.provider],
    })

export const encodeAcpSetBudget = (input: {
    jobId: bigint
    amount: bigint
    optParams?: Hex
}) =>
    encodeFunctionData({
        abi: agenticCommerceAbi,
        functionName: "setBudget",
        args: [input.jobId, input.amount, input.optParams ?? emptyOptParams],
    })

export const encodeAcpFund = (input: {
    jobId: bigint
    optParams?: Hex
}) =>
    encodeFunctionData({
        abi: agenticCommerceAbi,
        functionName: "fund",
        args: [input.jobId, input.optParams ?? emptyOptParams],
    })

export const encodeAcpSubmit = (input: {
    jobId: bigint
    deliverable: Hex
    optParams?: Hex
}) =>
    encodeFunctionData({
        abi: agenticCommerceAbi,
        functionName: "submit",
        args: [
            input.jobId,
            input.deliverable,
            input.optParams ?? emptyOptParams,
        ],
    })

export const encodeAcpComplete = (input: {
    jobId: bigint
    reason?: Hex
    optParams?: Hex
}) =>
    encodeFunctionData({
        abi: agenticCommerceAbi,
        functionName: "complete",
        args: [
            input.jobId,
            input.reason ?? zeroHash,
            input.optParams ?? emptyOptParams,
        ],
    })

export const encodeAcpReject = (input: {
    jobId: bigint
    reason?: Hex
    optParams?: Hex
}) =>
    encodeFunctionData({
        abi: agenticCommerceAbi,
        functionName: "reject",
        args: [
            input.jobId,
            input.reason ?? zeroHash,
            input.optParams ?? emptyOptParams,
        ],
    })

export const encodeAcpClaimRefund = (input: { jobId: bigint }) =>
    encodeFunctionData({
        abi: agenticCommerceAbi,
        functionName: "claimRefund",
        args: [input.jobId],
    })
