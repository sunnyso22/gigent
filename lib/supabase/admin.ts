import { createClient } from "@supabase/supabase-js"

type SupabaseEnv = {
    url: string
    serviceRoleKey: string
    bucket: string
}

export const getSupabaseStorageEnv = (): SupabaseEnv | null => {
    const url = process.env.SUPABASE_URL?.trim()
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim()
    if (!url || !serviceRoleKey || !bucket) {
        return null
    }
    return { url, serviceRoleKey, bucket }
}

export const createSupabaseServiceClient = () => {
    const env = getSupabaseStorageEnv()
    if (!env) {
        return null
    }
    return createClient(env.url, env.serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    })
}
