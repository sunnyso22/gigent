/** Agentic Commerce proxy on Kite Testnet — ABI verified via `readContract` against RPC. */

export const agenticCommerceAbi = [
    {
        name: "createJob",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "provider", type: "address" },
            { name: "evaluator", type: "address" },
            { name: "expiredAt", type: "uint256" },
            { name: "description", type: "string" },
            { name: "hook", type: "address" },
        ],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        name: "setProvider",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "jobId", type: "uint256" },
            { name: "provider_", type: "address" },
        ],
        outputs: [],
    },
    {
        name: "setBudget",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "jobId", type: "uint256" },
            { name: "amount", type: "uint256" },
            { name: "optParams", type: "bytes" },
        ],
        outputs: [],
    },
    {
        name: "fund",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "jobId", type: "uint256" },
            { name: "optParams", type: "bytes" },
        ],
        outputs: [],
    },
    {
        name: "submit",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "jobId", type: "uint256" },
            { name: "deliverable", type: "bytes32" },
            { name: "optParams", type: "bytes" },
        ],
        outputs: [],
    },
    {
        name: "complete",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "jobId", type: "uint256" },
            { name: "reason", type: "bytes32" },
            { name: "optParams", type: "bytes" },
        ],
        outputs: [],
    },
    {
        name: "reject",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "jobId", type: "uint256" },
            { name: "reason", type: "bytes32" },
            { name: "optParams", type: "bytes" },
        ],
        outputs: [],
    },
    {
        name: "claimRefund",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [{ name: "jobId", type: "uint256" }],
        outputs: [],
    },
    {
        name: "getJob",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "jobId", type: "uint256" }],
        outputs: [
            {
                name: "",
                type: "tuple",
                components: [
                    { name: "id", type: "uint256" },
                    { name: "client", type: "address" },
                    { name: "provider", type: "address" },
                    { name: "evaluator", type: "address" },
                    { name: "description", type: "string" },
                    { name: "budget", type: "uint256" },
                    { name: "expiredAt", type: "uint256" },
                    { name: "status", type: "uint8" },
                    { name: "hook", type: "address" },
                    { name: "reason", type: "bytes32" },
                ],
            },
        ],
    },
    {
        name: "jobCounter",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        name: "paymentToken",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "address" }],
    },
] as const
