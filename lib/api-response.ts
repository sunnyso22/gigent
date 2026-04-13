import { NextResponse } from "next/server"

export const unauthorizedJson = () =>
    NextResponse.json({ error: "Unauthorized" }, { status: 401 })

export const jsonError = (status: number, error: string) =>
    NextResponse.json({ error }, { status })
