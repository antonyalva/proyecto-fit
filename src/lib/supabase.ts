import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * null cuando no hay claves configuradas. Toda la app funciona igual sin ellas:
 * la sincronización es opcional, no un requisito para usar la aplicación.
 *
 * La anon key está pensada para vivir en el cliente; lo que protege los datos es
 * la política RLS de la tabla, no ocultar esta clave.
 */
export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: { persistSession: true, autoRefreshToken: true },
      })
    : null

export const syncEnabled = supabase !== null
