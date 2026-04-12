"use client"

import { IconBrandGithub } from "@tabler/icons-react"
import { useState } from "react"

import { SiteHeader } from "@/components/layout/site-header"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { authClient } from "@/lib/auth/client"

const Page = () => {
    const [error, setError] = useState<string | null>(null)
    const [pending, setPending] = useState(false)

    const signInWithGitHub = async () => {
        setError(null)
        setPending(true)
        let callbackURL = "/"
        if (typeof window !== "undefined") {
            const next = new URLSearchParams(window.location.search).get(
                "callbackUrl"
            )
            if (next?.startsWith("/") && !next.startsWith("//")) {
                callbackURL = next
            }
        }
        try {
            await authClient.signIn.social({
                provider: "github",
                callbackURL,
            })
        } catch {
            setError(
                "Could not start GitHub sign-in. Check your OAuth app and environment variables."
            )
            setPending(false)
        }
    }

    return (
        <div className="flex min-h-dvh flex-col bg-background text-foreground">
            <SiteHeader />

            <main className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-6">
                <Card className="w-full max-w-sm border-border">
                    <CardContent className="flex flex-col gap-3">
                        {error ? (
                            <p
                                className="text-xs text-destructive"
                                role="alert"
                            >
                                {error}
                            </p>
                        ) : null}
                        <Button
                            type="button"
                            disabled={pending}
                            className="w-full gap-2"
                            onClick={signInWithGitHub}
                        >
                            <IconBrandGithub className="size-4" aria-hidden />
                            {pending ? "Redirecting…" : "Sign in with GitHub"}
                        </Button>
                    </CardContent>
                </Card>
            </main>
        </div>
    )
}

export default Page
