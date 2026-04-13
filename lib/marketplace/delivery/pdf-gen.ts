import { PDFDocument, StandardFonts, rgb } from "pdf-lib"

import { assertJobDeliveryUploadAllowed } from "@/lib/marketplace/service"

import { uploadDeliveryFileBytes } from "./storage"
import { DELIVERY_UPLOAD_MAX_BYTES } from "./upload-rules"

const MAX_PDF_BODY_CHARS = 500_000
const PAGE_MARGIN = 50
const LINE_HEIGHT = 14
const FONT_SIZE = 11
const TITLE_SIZE = 16
const MAX_CHARS_PER_LINE = 82

const chunkHard = (s: string, maxLen: number): string[] => {
    if (s.length <= maxLen) {
        return [s]
    }
    const out: string[] = []
    for (let i = 0; i < s.length; i += maxLen) {
        out.push(s.slice(i, i + maxLen))
    }
    return out
}

const wrapWords = (paragraph: string, maxLen: number): string[] => {
    const words = paragraph.split(/\s+/).filter(Boolean)
    if (words.length === 0) {
        return [""]
    }
    const lines: string[] = []
    let cur = ""
    const flush = () => {
        if (cur) {
            lines.push(cur)
            cur = ""
        }
    }
    for (const w of words) {
        if (w.length > maxLen) {
            flush()
            lines.push(...chunkHard(w, maxLen))
            continue
        }
        const next = cur ? `${cur} ${w}` : w
        if (next.length > maxLen) {
            flush()
            cur = w
        } else {
            cur = next
        }
    }
    flush()
    return lines.length ? lines : [""]
}

export const generateDeliveryPdfAndUpload = async (input: {
    userId: string
    jobId: string
    title?: string
    body: string
    filename?: string
}): Promise<
    | { ok: true; url: string; name: string; mimeType: string }
    | { ok: false; error: string }
> => {
    if (input.body.length > MAX_PDF_BODY_CHARS) {
        return { ok: false, error: "PDF body exceeds maximum length" }
    }

    const allowed = await assertJobDeliveryUploadAllowed({
        userId: input.userId,
        jobId: input.jobId,
    })
    if (!allowed.ok) {
        return { ok: false, error: allowed.error }
    }

    try {
        const doc = await PDFDocument.create()
        const font = await doc.embedFont(StandardFonts.Helvetica)
        const titleFont = await doc.embedFont(StandardFonts.HelveticaBold)

        const paragraphs = input.body.split(/\n/)
        const lines: string[] = []
        for (const p of paragraphs) {
            if (p.length === 0) {
                lines.push("")
                continue
            }
            lines.push(...wrapWords(p, MAX_CHARS_PER_LINE))
        }

        let page = doc.addPage()
        const { width, height } = page.getSize()
        let y = height - PAGE_MARGIN
        const textWidth = width - PAGE_MARGIN * 2

        const title = input.title?.trim()
        if (title) {
            page.drawText(title, {
                x: PAGE_MARGIN,
                y: y - TITLE_SIZE,
                size: TITLE_SIZE,
                font: titleFont,
                color: rgb(0, 0, 0),
                maxWidth: textWidth,
            })
            y -= TITLE_SIZE + LINE_HEIGHT * 2
        }

        const drawLine = (line: string, useFont: typeof font, size: number) => {
            if (y < PAGE_MARGIN + LINE_HEIGHT) {
                page = doc.addPage()
                y = page.getHeight() - PAGE_MARGIN
            }
            page.drawText(line, {
                x: PAGE_MARGIN,
                y: y - size,
                size,
                font: useFont,
                color: rgb(0, 0, 0),
                maxWidth: textWidth,
            })
            y -= LINE_HEIGHT
        }

        for (const line of lines) {
            drawLine(line || " ", font, FONT_SIZE)
        }

        const pdfBytes = await doc.save()
        if (pdfBytes.length > DELIVERY_UPLOAD_MAX_BYTES) {
            return { ok: false, error: "Generated PDF exceeds upload size limit" }
        }

        const name =
            input.filename?.trim().replace(/[/\\]/g, "") ||
            `delivery-${crypto.randomUUID()}.pdf`

        const result = await uploadDeliveryFileBytes({
            jobId: input.jobId,
            buffer: Buffer.from(pdfBytes),
            originalFileName: name.endsWith(".pdf") ? name : `${name}.pdf`,
            mimeType: "application/pdf",
        })
        if (!result.ok) {
            return { ok: false, error: result.error }
        }
        return {
            ok: true,
            url: result.data.url,
            name: result.data.name,
            mimeType: result.data.mimeType,
        }
    } catch (e) {
        const msg = e instanceof Error ? e.message : "PDF generation failed"
        console.error("[delivery-pdf-gen]", e)
        return { ok: false, error: msg }
    }
}
