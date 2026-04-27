"use client"

import * as React from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { WagmiProvider } from "wagmi"

import { config } from "@/config/wagmi"

type AppProvidersProps = {
    children: React.ReactNode
}

const AppProviders = ({ children }: AppProvidersProps) => {
    const [queryClient] = React.useState(() => new QueryClient())

    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </WagmiProvider>
    )
}

export default AppProviders
