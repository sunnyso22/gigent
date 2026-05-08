/** Shape returned from many job/bid tools—user-facing **Job ID** vs internal **listingId**. */
export const packJobToolRef = (
    job: { id: string; acpJobId: string | null } | null
) => {
    if (!job) {
        return {
            jobId: null as string | null,
            listingId: undefined as string | undefined,
        }
    }
    const pub = job.acpJobId?.trim() || null
    if (pub) {
        return { jobId: pub, listingId: undefined as string | undefined }
    }
    return { jobId: null as string | null, listingId: job.id }
}
