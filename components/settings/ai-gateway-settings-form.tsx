"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { IconTrash } from "@tabler/icons-react"

import {
    deleteAiGatewayApiKeyAction,
    getAiGatewaySettingsAction,
    saveAiGatewayApiKeyAction,
} from "@/app/actions/ai-gateway"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Loading, LoadingSpinner } from "@/components/ui/loading"
import {
    AI_GATEWAY_API_KEY_FORMAT_HINT,
    isValidAiGatewayApiKeyFormat,
} from "@/lib/ai-gateway/api-key-format"

type StatusState =
    | { kind: "idle" }
    | { kind: "error"; message: string }
    | { kind: "success"; message: string }

type AiGatewaySettingsFormProps = {
    showRequiredBanner?: boolean
}

export const AiGatewaySettingsForm = ({
    showRequiredBanner = false,
}: AiGatewaySettingsFormProps) => {
    const router = useRouter()
    const [mounted, setMounted] = React.useState(false)
    const [loading, setLoading] = React.useState(true)
    const [configured, setConfigured] = React.useState(false)
    const [keyLast4, setKeyLast4] = React.useState<string | null>(null)
    const [apiKeyDraft, setApiKeyDraft] = React.useState("")
    const [saving, setSaving] = React.useState(false)
    const [status, setStatus] = React.useState<StatusState>({ kind: "idle" })

    React.useEffect(() => {
        setMounted(true)
    }, [])

    React.useEffect(() => {
        if (!mounted) {
            return
        }
        let cancelled = false
        ;(async () => {
            setLoading(true)
            try {
                const result = await getAiGatewaySettingsAction()
                if (!result.ok) {
                    if (!cancelled) {
                        setStatus({
                            kind: "error",
                            message:
                                result.error === "unauthorized"
                                    ? "Sign in required"
                                    : "Failed to load settings",
                        })
                    }
                    return
                }
                if (!cancelled) {
                    setConfigured(Boolean(result.configured))
                    setKeyLast4(result.keyLast4 ?? null)
                    setStatus({ kind: "idle" })
                }
            } catch {
                if (!cancelled) {
                    setStatus({
                        kind: "error",
                        message: "Network error while loading settings",
                    })
                }
            } finally {
                if (!cancelled) {
                    setLoading(false)
                }
            }
        })()
        return () => {
            cancelled = true
        }
    }, [mounted])

    const onSave = async () => {
        const trimmed = apiKeyDraft.trim()
        if (!isValidAiGatewayApiKeyFormat(trimmed)) {
            setStatus({
                kind: "error",
                message: AI_GATEWAY_API_KEY_FORMAT_HINT,
            })
            return
        }
        setSaving(true)
        setStatus({ kind: "idle" })
        try {
            const result = await saveAiGatewayApiKeyAction(trimmed)
            if (!result.ok) {
                setStatus({
                    kind: "error",
                    message: result.error ?? "Could not save key",
                })
                return
            }
            setApiKeyDraft("")
            setConfigured(Boolean(result.configured))
            setKeyLast4(result.keyLast4 ?? null)
            router.push("/agents?keySaved=1")
            router.refresh()
        } catch {
            setStatus({
                kind: "error",
                message: "Network error while saving",
            })
        } finally {
            setSaving(false)
        }
    }

    const onRemove = async () => {
        setSaving(true)
        setStatus({ kind: "idle" })
        try {
            const result = await deleteAiGatewayApiKeyAction()
            if (!result.ok) {
                setStatus({
                    kind: "error",
                    message:
                        result.error === "unauthorized"
                            ? "Sign in required"
                            : "Could not remove key",
                })
                return
            }
            setConfigured(false)
            setKeyLast4(null)
            setApiKeyDraft("")
            setStatus({
                kind: "success",
                message:
                    "Key removed. Add a key again here before opening the Agents workspace.",
            })
        } catch {
            setStatus({
                kind: "error",
                message: "Network error while removing key",
            })
        } finally {
            setSaving(false)
        }
    }

    return (
        <Card className="rounded-none border-border">
            <CardHeader className="space-y-1">
                <CardTitle className="font-heading text-base">
                    Vercel AI Gateway API key
                </CardTitle>
                <CardDescription className="text-xs">
                    Required to send chat messages. Paste your team&apos;s{" "}
                    <code className="text-foreground">AI_GATEWAY_API_KEY</code>{" "}
                    so requests bill to your Vercel AI Gateway account.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
                {!mounted || loading ? (
                    <Loading
                        layout="section"
                        label="Loading settings…"
                        className="min-h-[10rem]"
                    />
                ) : (
                    <>
                        {showRequiredBanner ? (
                            <p className="rounded-none border border-border bg-muted/40 px-2 py-1.5 text-xs text-foreground">
                                Save a key below to send messages from the
                                Agents workspace.
                            </p>
                        ) : null}
                        {configured ? (
                            <p className="text-xs text-muted-foreground">
                                A key is saved (ends with{" "}
                                <span className="font-mono text-foreground">
                                    …{keyLast4 ?? "????"}
                                </span>
                                ). Paste a new key to replace it.
                            </p>
                        ) : (
                            <p className="text-xs text-muted-foreground">
                                No personal key saved yet.
                            </p>
                        )}

                        {status.kind === "error" ? (
                            <p className="rounded-none border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
                                {status.message}
                            </p>
                        ) : null}
                        {status.kind === "success" ? (
                            <p className="rounded-none border border-emerald-500/40 bg-emerald-500/10 px-2 py-1.5 text-xs text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200">
                                {status.message}
                            </p>
                        ) : null}

                        <div className="flex flex-col gap-2">
                            <label
                                htmlFor="ai-gateway-api-key"
                                className="text-xs font-medium text-foreground"
                            >
                                API key
                            </label>
                            <Input
                                id="ai-gateway-api-key"
                                name="ai-gateway-api-key"
                                autoComplete="off"
                                value={apiKeyDraft}
                                onChange={(e) =>
                                    setApiKeyDraft(e.target.value)
                                }
                                placeholder="vck_..."
                                pattern="vck_[A-Za-z0-9_-]{20,}"
                                title={AI_GATEWAY_API_KEY_FORMAT_HINT}
                                className="rounded-none font-mono text-xs"
                            />
                            <p className="text-xs text-muted-foreground">
                                {AI_GATEWAY_API_KEY_FORMAT_HINT}
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <Button
                                type="button"
                                size="sm"
                                className="inline-flex gap-2 rounded-none"
                                disabled={
                                    saving ||
                                    apiKeyDraft.trim().length === 0 ||
                                    !isValidAiGatewayApiKeyFormat(
                                        apiKeyDraft,
                                    )
                                }
                                onClick={() => {
                                    void onSave()
                                }}
                            >
                                {saving ? (
                                    <LoadingSpinner data-icon="inline-start" />
                                ) : null}
                                Save key
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="rounded-none"
                                disabled={saving || !configured}
                                onClick={() => {
                                    void onRemove()
                                }}
                            >
                                <IconTrash className="size-4" aria-hidden />
                                Remove key
                            </Button>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    )
}
