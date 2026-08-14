import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from './lib/supabase'
import { pullChanges, pushChanges } from './lib/remote'
import { mergeState } from './lib/merge'
import {
  DEFAULT_STATE,
  DEFAULT_SYNC_META,
  isPristine,
  loadState,
  loadSyncMeta,
  saveSyncMeta,
} from './lib/storage'
import { useAuth } from './auth'
import { useStore } from './store'

export type SyncStatus = 'off' | 'syncing' | 'ok' | 'offline' | 'error'

interface Sync {
  status: SyncStatus
  lastSyncedAt: number | null
  error: string | null
  syncNow: () => Promise<void>
}

const SyncContext = createContext<Sync>({
  status: 'off',
  lastSyncedAt: null,
  error: null,
  syncNow: async () => {},
})

const DEBOUNCE_MS = 1500

export function SyncProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { state, replaceState } = useStore()

  const [status, setStatus] = useState<SyncStatus>('off')
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const meta = useRef(DEFAULT_SYNC_META)
  const stateRef = useRef(state)
  stateRef.current = state
  // Una sincronización a la vez: dos a la vez avanzarían el cursor a medias.
  const running = useRef(false)

  const fail = useCallback((e: unknown) => {
    if (!navigator.onLine) {
      setStatus('offline')
      setError(null)
      return
    }
    setStatus('error')
    setError(e instanceof Error ? e.message : 'Error desconocido')
  }, [])

  const syncNow = useCallback(async () => {
    if (!supabase || !user || running.current) return
    running.current = true
    setStatus('syncing')
    setError(null)

    try {
      // Cada cuenta tiene su propio cursor guardado, así que alternar entre dos
      // no obliga a resincronizar desde cero.
      if (meta.current.userId !== user.id) {
        meta.current = { ...loadSyncMeta(user.id), userId: user.id }
      }

      if (meta.current.lastPulledAt === null) {
        // Primera vez en este dispositivo: bajar ANTES de subir.
        //
        // Al revés se pierden datos: una instalación nueva trae el catálogo de
        // fábrica, y subirlo primero sobrescribiría con `upsert` los alimentos
        // que ya hubieras editado desde el otro dispositivo. El upsert reemplaza
        // la fila entera sin comparar marcas de tiempo; quien decide quién gana
        // es la fusión, y por eso tiene que ocurrir antes.
        const { remote, cursor } = await pullChanges(supabase, user.id, null)

        // Si acabas de crear la cuenta y venías usando la app sin sesión, esos
        // datos son tuyos y hay que adoptarlos. Solo cuando las dos condiciones
        // se cumplen: la cuenta está vacía en el servidor y aquí no has tocado
        // nada todavía. Si cualquiera de las dos falla, no se toca — es la
        // diferencia entre recuperar tus datos y colarle los tuyos a otra cuenta.
        const serverEmpty = isPristine(mergeState(DEFAULT_STATE, remote))
        const base =
          serverEmpty && isPristine(stateRef.current) ? loadState(null) : stateRef.current

        const merged = mergeState(base, remote)
        replaceState(merged)

        // -1 en vez del cursor: sube también las filas de fábrica, que tienen
        // updatedAt 0 y con el filtro normal no se subirían nunca.
        const pushedAt = Date.now()
        await pushChanges(supabase, user.id, merged, -1)
        meta.current = { ...meta.current, lastPulledAt: cursor, lastPushedAt: pushedAt }
      } else {
        // Ya sincronizado antes: subir lo pendiente y bajar lo que haya cambiado.
        const pushedAt = Date.now()
        await pushChanges(supabase, user.id, stateRef.current, meta.current.lastPushedAt)

        const { remote, cursor } = await pullChanges(
          supabase,
          user.id,
          meta.current.lastPulledAt,
        )

        const merged = mergeState(stateRef.current, remote)
        if (JSON.stringify(merged) !== JSON.stringify(stateRef.current)) {
          replaceState(merged)
        }

        meta.current = { ...meta.current, lastPulledAt: cursor, lastPushedAt: pushedAt }
      }

      saveSyncMeta(user.id, meta.current)

      setLastSyncedAt(Date.now())
      setStatus('ok')
    } catch (e) {
      fail(e)
    } finally {
      running.current = false
    }
  }, [user, replaceState, fail])

  // Al entrar, o al cambiar de cuenta.
  useEffect(() => {
    if (!user) {
      setStatus('off')
      setError(null)
      meta.current = DEFAULT_SYNC_META
      return
    }
    void syncNow()
  }, [user, syncNow])

  // Cada cambio local sube, agrupado: registrar cuatro comidas seguidas es un envío.
  useEffect(() => {
    if (!supabase || !user) return
    if (!hasPending(state, meta.current.lastPushedAt)) return

    const timer = window.setTimeout(() => void syncNow(), DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [state, user, syncNow])

  // Volver a la app en el portátil tras usar el móvil es justo cuando hay que fusionar.
  useEffect(() => {
    if (!user) return
    const onWake = () => {
      if (document.visibilityState === 'visible') void syncNow()
    }
    document.addEventListener('visibilitychange', onWake)
    window.addEventListener('online', onWake)
    return () => {
      document.removeEventListener('visibilitychange', onWake)
      window.removeEventListener('online', onWake)
    }
  }, [user, syncNow])

  const value = useMemo<Sync>(
    () => ({ status, lastSyncedAt, error, syncNow }),
    [status, lastSyncedAt, error, syncNow],
  )

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
}

function hasPending(state: Parameters<typeof mergeState>[0], since: number): boolean {
  return (
    state.profile.updatedAt > since ||
    state.foods.some((f) => f.updatedAt > since) ||
    state.meals.some((m) => m.updatedAt > since) ||
    state.planItems.some((i) => i.updatedAt > since) ||
    state.log.some((e) => e.updatedAt > since) ||
    state.weighIns.some((w) => w.updatedAt > since) ||
    state.supplements.some((s) => s.updatedAt > since)
  )
}

export function useSync(): Sync {
  return useContext(SyncContext)
}
