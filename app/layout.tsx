import type { Metadata } from "next"
import { Geist, Geist_Mono, JetBrains_Mono } from "next/font/google"

import "./globals.css"
import AppProviders from "@/components/app-providers"
import { ThemeProvider } from "@/components/layout/theme-provider"
import { cn } from "@/lib/utils"

const geistMonoHeading = Geist_Mono({
    subsets: ["latin"],
    variable: "--font-heading",
})

const fontSans = Geist({
    subsets: ["latin"],
    variable: "--font-sans",
})

const jetbrainsMono = JetBrains_Mono({
    subsets: ["latin"],
    variable: "--font-mono",
})

export const metadata: Metadata = {
    title: "Gigent",
}

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode
}>) {
    return (
        <html
            lang="en"
            suppressHydrationWarning
            className={cn(
                "antialiased",
                fontSans.variable,
                "font-mono",
                jetbrainsMono.variable,
                geistMonoHeading.variable
            )}
        >
            <body>
                <ThemeProvider>
                    <AppProviders>{children}</AppProviders>
                </ThemeProvider>
            </body>
        </html>
    )
}
