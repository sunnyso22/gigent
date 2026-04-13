import Link from "next/link"

const NotFound = () => (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 py-16 text-center">
        <h1 className="font-heading text-lg">Job not found</h1>
        <p className="text-xs text-muted-foreground">
            It may have been removed or the link is wrong.
        </p>
        <Link
            href="/marketplace"
            className="text-xs text-foreground underline underline-offset-2"
        >
            Back to Marketplace
        </Link>
    </main>
)

export default NotFound
