"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

import {
    type AgentJobStatus,
    parseAgentJobStatusFilter,
} from "@/lib/agent-jobs/job-status"

type StatusFilter = AgentJobStatus | "all"

type MarketplaceFiltersProps = {
    initialQuery: string
    initialStatus: StatusFilter
}

const STATUS_LABEL: Record<StatusFilter, string> = {
    all: "All statuses",
    open: "Open",
    funded: "Funded",
    submitted: "Submitted",
    completed: "Completed",
    rejected: "Rejected",
    expired: "Expired",
}

const buildPath = (q: string, status: StatusFilter) => {
    const params = new URLSearchParams()
    const trimmed = q.trim()
    if (trimmed) {
        params.set("q", trimmed)
    }
    if (status !== "all") {
        params.set("status", status)
    }
    const qs = params.toString()
    return qs ? `/marketplace?${qs}` : "/marketplace"
}

export const MarketplaceFilters = ({
    initialQuery,
    initialStatus,
}: MarketplaceFiltersProps) => {
    const router = useRouter()
    const [value, setValue] = useState(initialQuery)
    const [status, setStatus] = useState<StatusFilter>(initialStatus)

    useEffect(() => {
        setValue(initialQuery)
    }, [initialQuery])

    useEffect(() => {
        setStatus(initialStatus)
    }, [initialStatus])

    useEffect(() => {
        const onPopState = () => {
            const params = new URLSearchParams(window.location.search)
            setValue(params.get("q") ?? "")
            setStatus(parseAgentJobStatusFilter(params.get("status")))
        }
        window.addEventListener("popstate", onPopState)
        return () => window.removeEventListener("popstate", onPopState)
    }, [])

    useEffect(() => {
        const id = window.setTimeout(() => {
            const next = value.trim()
            const params = new URLSearchParams(window.location.search)
            const cur = (params.get("q") ?? "").trim()
            const curStatus = parseAgentJobStatusFilter(params.get("status"))
            if (next === cur && status === curStatus) {
                return
            }
            router.replace(buildPath(value, status))
        }, 350)
        return () => window.clearTimeout(id)
    }, [value, status, router])

    return (
        <div
            className="flex w-full flex-col gap-3 sm:flex-row sm:items-center"
            role="search"
        >
            <label htmlFor="marketplace-search" className="sr-only">
                Search jobs
            </label>
            <Input
                id="marketplace-search"
                name="q"
                type="search"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Title, description, model name, or client name"
                className="h-9 flex-1 text-xs"
                autoComplete="off"
            />
            <Select
                value={status}
                onValueChange={(v) => {
                    const next = v as StatusFilter
                    setStatus(next)
                    router.replace(buildPath(value, next))
                }}
            >
                <SelectTrigger
                    className="h-9 w-full shrink-0 py-1 data-[size=default]:h-9 data-[size=sm]:h-9 sm:w-[min(100%,11rem)]"
                    aria-label="Filter by job status"
                >
                    <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                    {(Object.keys(STATUS_LABEL) as StatusFilter[]).map((k) => (
                        <SelectItem key={k} value={k} className="text-xs">
                            {STATUS_LABEL[k]}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )
}
