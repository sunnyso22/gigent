"use client"

import { IconBrandGithub, IconBrandGoogle } from "@tabler/icons-react"
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

    const getCallbackUrl = () => {
        let callbackURL = "/"
        if (typeof window !== "undefined") {
            const next = new URLSearchParams(window.location.search).get(
                "callbackUrl"
            )
            if (next?.startsWith("/") && !next.startsWith("//")) {
                callbackURL = next
            }
        }
        return callbackURL
    }

    const signInWithSocial = async (provider: "github" | "google") => {
        setError(null)
        setPending(true)
        try {
            await authClient.signIn.social({
                provider,
                callbackURL: getCallbackUrl(),
            })
        } catch {
            setError(
                `Could not start ${provider === "google" ? "Google" : "GitHub"} sign-in. Check your OAuth app and environment variables.`
            )
            setPending(false)
        }
    }

    return (
        <div className="flex min-h-dvh flex-col bg-background text-foreground">
            <SiteHeader />

            <main className="flex flex-1 flex-col items-center justify-center px-4 py-12 sm:px-6">
                <Card className="w-full max-w-sm border-border">
                    <CardHeader className="space-y-1">
                        <CardTitle className="font-heading text-base">
                            Sign in
                        </CardTitle>
                        <CardDescription className="text-xs">
                            Continue with GitHub or Google.
                        </CardDescription>
                    </CardHeader>
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
                            onClick={() => signInWithSocial("github")}
                        >
                            <IconBrandGithub className="size-4" aria-hidden />
                            {pending ? "Redirecting…" : "Sign in with GitHub"}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={pending}
                            className="w-full gap-2"
                            onClick={() => signInWithSocial("google")}
                        >
                            <IconBrandGoogle className="size-4" aria-hidden />
                            {pending ? "Redirecting…" : "Sign in with Google"}
                        </Button>
                    </CardContent>
                </Card>
            </main>
        </div>
    )
}

export default Page
