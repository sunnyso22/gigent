export const CHAT_MODEL_IDS = [
    "openai/gpt-5-nano",
    "nvidia/nemotron-3-nano-30b-a3b",
    "amazon/nova-lite",
] as const

export type ChatModelId = (typeof CHAT_MODEL_IDS)[number]

type ChatModelOption = {
    id: ChatModelId
    label: string
}

export const CHAT_MODELS: ChatModelOption[] = [
    { id: "openai/gpt-5-nano", label: "GPT-5 Nano" },
    {
        id: "nvidia/nemotron-3-nano-30b-a3b",
        label: "Nemotron 3 Nano 30B",
    },
    { id: "amazon/nova-lite", label: "Amazon Nova Lite" },
]

export const DEFAULT_CHAT_MODEL_ID: ChatModelId = CHAT_MODELS[0].id

/** Short label from model id; falls back to the raw id when unknown. */
export const labelForChatModelId = (modelId: string): string => {
    const found = CHAT_MODELS.find((m) => m.id === modelId)
    return found?.label ?? modelId
}

export const isChatModelId = (
    value: string | undefined
): value is ChatModelId =>
    value !== undefined && CHAT_MODEL_IDS.includes(value as ChatModelId)
