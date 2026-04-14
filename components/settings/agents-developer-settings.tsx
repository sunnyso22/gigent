"use client"

import * as React from "react"

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import {
    readShowToolLogs,
    writeShowToolLogs,
} from "@/lib/agents/show-tool-logs-storage"

export const AgentsDeveloperSettings = () => {
    const [mounted, setMounted] = React.useState(false)
    const [showToolLogs, setShowToolLogs] = React.useState(false)

    React.useEffect(() => {
        setMounted(true)
    }, [])

    React.useEffect(() => {
        if (!mounted) {
            return
        }
        setShowToolLogs(readShowToolLogs())
    }, [mounted])

    return (
        <Card className="rounded-none border-border">
            <CardHeader className="space-y-1">
                <CardTitle className="font-heading text-base">Developer</CardTitle>
                <CardDescription className="text-xs">
                    Optional diagnostics for the Agents workspace. Tool logs show raw
                    tool inputs and outputs inside each assistant message.
                </CardDescription>
            </CardHeader>
            <CardContent className="min-w-0">
                {!mounted ? (
                    <p className="text-xs text-muted-foreground">Loading…</p>
                ) : (
                    <div className="flex w-full min-w-0 items-center justify-between gap-3">
                        <label
                            htmlFor="agents-show-tool-logs"
                            className="min-w-0 flex-1 cursor-pointer pr-1"
                        >
                            <span className="block text-xs font-medium text-foreground">
                                Show tool logs in chat
                            </span>
                            <span className="mt-0.5 block text-[10px] text-muted-foreground">
                                Off by default. Turn on to debug tool calls.
                            </span>
                        </label>
                        <Switch
                            id="agents-show-tool-logs"
                            checked={showToolLogs}
                            onCheckedChange={(checked) => {
                                setShowToolLogs(checked)
                                writeShowToolLogs(checked)
                            }}
                        />
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
