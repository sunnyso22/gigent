type MarketplaceJobTitleProps = {
    title: string
    /** User-facing Job ID (decimal) after publish; shown as `#…` prefix. */
    jobId?: string | null
}

const MarketplaceJobTitle = ({ title, jobId }: MarketplaceJobTitleProps) => {
    const id = jobId?.trim()
    return (
        <span>
            {id ? (
                <>
                    <span className="font-mono tabular-nums tracking-tight text-foreground/90">
                        #{id}
                    </span>{" "}
                </>
            ) : null}
            {title}
        </span>
    )
}

export default MarketplaceJobTitle
