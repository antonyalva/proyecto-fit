import type { AppState, Profile, Supplement } from '../types'

interface Row {
  id: string
  updatedAt: number
}

/**
 * Fusiona dos colecciones de filas por id: gana la tocada más tarde.
 *
 * Las filas borradas viajan como cualquier otra (con `deleted: true`), así que
 * un borrado hecho en el móvil llega al portátil sin necesidad de lápidas aparte.
 */
export function mergeRows<T extends Row>(local: T[], remote: T[]): T[] {
  const byId = new Map<string, T>()
  for (const row of local) byId.set(row.id, row)

  for (const row of remote) {
    const mine = byId.get(row.id)
    if (!mine || row.updatedAt > mine.updatedAt) byId.set(row.id, row)
  }

  return [...byId.values()]
}

/**
 * Igual que `mergeRows`, pero las fechas de toma se unen en vez de sobrescribirse.
 * Son un histórico, no un valor: si el lado perdedor tenía un día que el ganador
 * no, sincronizar rompería la racha.
 */
export function mergeSupplements(local: Supplement[], remote: Supplement[]): Supplement[] {
  const merged = mergeRows(local, remote)
  const takenById = new Map<string, Set<string>>()

  for (const s of [...local, ...remote]) {
    const set = takenById.get(s.id) ?? new Set<string>()
    for (const date of s.takenDates) set.add(date)
    takenById.set(s.id, set)
  }

  return merged.map((s) => ({
    ...s,
    takenDates: [...(takenById.get(s.id) ?? [])].sort(),
  }))
}

export function mergeProfile(local: Profile, remote: Profile | null): Profile {
  if (!remote) return local
  return remote.updatedAt > local.updatedAt ? remote : local
}

/** El estado completo, aplicando a cada trozo la regla que le corresponde. */
export function mergeState(local: AppState, remote: Partial<AppState>): AppState {
  const log = mergeRows(local.log, remote.log ?? [])
  log.sort((a, b) => b.ts - a.ts)

  const meals = mergeRows(local.meals, remote.meals ?? [])
  meals.sort((a, b) => a.order - b.order)

  return {
    profile: mergeProfile(local.profile, remote.profile ?? null),
    foods: mergeRows(local.foods, remote.foods ?? []),
    meals,
    planItems: mergeRows(local.planItems, remote.planItems ?? []),
    log,
    weighIns: mergeRows(local.weighIns, remote.weighIns ?? []),
    supplements: mergeSupplements(local.supplements, remote.supplements ?? []),
  }
}
