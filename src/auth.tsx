import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase, syncEnabled } from './lib/supabase'

export interface SignUpResult {
  error: string | null
  /** El proyecto exige confirmar el email: hay cuenta, pero todavía no hay sesión. */
  needsConfirmation: boolean
}

/**
 * Última cuenta que tuvo sesión en este dispositivo.
 *
 * Sin esto, abrir la app sin cobertura con el token caducado te deja fuera de tus
 * propios datos, que están aquí mismo. Guarda solo el id, nunca credenciales.
 */
const LAST_USER_KEY = 'protein-tracker/last-user'

interface Auth {
  enabled: boolean
  user: User | null
  /** Id de la última sesión, cuando no hay red para validarla. Permite entrar igual. */
  offlineUserId: string | null
  /** Quién manda para cargar datos: la sesión viva, o la recordada sin red. */
  activeUserId: string | null
  /** true mientras se restaura la sesión guardada, para no parpadear al abrir. */
  loading: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (email: string, password: string) => Promise<SignUpResult>
  signOut: () => Promise<void>
}

const AuthContext = createContext<Auth | null>(null)

/** Los mensajes de Supabase llegan en inglés y son crípticos. */
function translate(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Email o contraseña incorrectos.'
  if (m.includes('email not confirmed')) {
    return 'Tienes que confirmar el email antes de entrar. Mira tu bandeja.'
  }
  if (m.includes('user already registered')) {
    return 'Ese email ya tiene cuenta. Entra en vez de registrarte.'
  }
  if (m.includes('password should be at least')) {
    return 'La contraseña es demasiado corta: mínimo 6 caracteres.'
  }
  if (
    m.includes('unable to validate email') ||
    m.includes('invalid email') ||
    // Supabase también responde 'Email address "..." is invalid' — sin este
    // caso, ese mensaje concreto se colaba en inglés sin traducir.
    (m.includes('email address') && m.includes('is invalid'))
  ) {
    return 'Ese email no parece válido.'
  }
  if (m.includes('failed to fetch') || m.includes('network')) {
    return 'Sin conexión con Supabase. Revisa tu red o las claves del .env.local.'
  }
  return message
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(syncEnabled)
  const [offlineUserId, setOfflineUserId] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) return

    const remember = (u: User | null) => {
      setUser(u)
      if (u) {
        localStorage.setItem(LAST_USER_KEY, u.id)
        setOfflineUserId(null)
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      const session = data.session
      remember(session?.user ?? null)

      // Sin sesión válida y sin red: si este dispositivo ya entró alguna vez,
      // se abre con esos datos locales en vez de dejarte en la puerta.
      if (!session && !navigator.onLine) {
        setOfflineUserId(localStorage.getItem(LAST_USER_KEY))
      }
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      remember(session?.user ?? null)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  // La sesión viva manda; sin ella, la cuenta recordada mientras no haya red.
  const activeUserId = user?.id ?? offlineUserId

  const value = useMemo<Auth>(
    () => ({
      enabled: syncEnabled,
      user,
      offlineUserId,
      activeUserId,
      loading,
      async signIn(email, password) {
        if (!supabase) return 'La sincronización no está configurada.'
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return error ? translate(error.message) : null
      },
      async signUp(email, password) {
        if (!supabase) {
          return { error: 'La sincronización no está configurada.', needsConfirmation: false }
        }
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) return { error: translate(error.message), needsConfirmation: false }

        // Con la confirmación activada, Supabase no revela si el email ya existe:
        // devuelve un usuario con identities vacío en vez de un error.
        if (data.user && data.user.identities?.length === 0) {
          return {
            error: 'Ese email ya tiene cuenta. Entra en vez de registrarte.',
            needsConfirmation: false,
          }
        }

        return { error: null, needsConfirmation: data.session === null }
      },
      async signOut() {
        // Un cierre de sesión explícito debe cerrar también la puerta trasera
        // sin conexión: si no se borrara, apagar el wifi bastaría para volver
        // a entrar sin credenciales.
        localStorage.removeItem(LAST_USER_KEY)
        setOfflineUserId(null)
        await supabase?.auth.signOut()
      },
    }),
    [user, offlineUserId, activeUserId, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): Auth {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth fuera de AuthProvider')
  return ctx
}
