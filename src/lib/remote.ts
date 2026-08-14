import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AppState, Food, LogEntry, Meal, PlanItem, Profile, Supplement, WeighIn,
} from '../types'
import { ALL_WEEKDAYS } from './date'

/* --------------------------------------------------------- fila <-> objeto */

type Row = Record<string, unknown>

const toEntry = (r: Row): LogEntry => ({
  id: r.id as string,
  date: r.entry_date as string,
  name: r.name as string,
  protein: Number(r.protein),
  grams: r.grams == null ? undefined : Number(r.grams),
  foodId: (r.food_id as string) ?? undefined,
  planItemId: (r.plan_item_id as string) ?? undefined,
  ts: Number(r.ts),
  updatedAt: Number(r.client_updated_at),
  deleted: Boolean(r.deleted),
})

const fromEntry = (userId: string, e: LogEntry): Row => ({
  id: e.id,
  user_id: userId,
  entry_date: e.date,
  name: e.name,
  protein: e.protein,
  grams: e.grams ?? null,
  food_id: e.foodId ?? null,
  plan_item_id: e.planItemId ?? null,
  ts: e.ts,
  deleted: e.deleted,
  client_updated_at: e.updatedAt,
})

const toMeal = (r: Row): Meal => ({
  id: r.id as string,
  name: r.name as string,
  order: Number(r.sort_order),
  updatedAt: Number(r.client_updated_at),
  deleted: Boolean(r.deleted),
})

const fromMeal = (userId: string, m: Meal): Row => ({
  id: m.id,
  user_id: userId,
  name: m.name,
  sort_order: m.order,
  deleted: m.deleted,
  client_updated_at: m.updatedAt,
})

const toPlanItem = (r: Row): PlanItem => ({
  id: r.id as string,
  mealId: r.meal_id as string,
  foodId: r.food_id as string,
  grams: Number(r.grams),
  days: ((r.days as number[]) ?? ALL_WEEKDAYS).map(Number),
  updatedAt: Number(r.client_updated_at),
  deleted: Boolean(r.deleted),
})

const fromPlanItem = (userId: string, i: PlanItem): Row => ({
  id: i.id,
  user_id: userId,
  meal_id: i.mealId,
  food_id: i.foodId,
  grams: i.grams,
  days: i.days,
  deleted: i.deleted,
  client_updated_at: i.updatedAt,
})

const toFood = (r: Row): Food => ({
  id: r.id as string,
  name: r.name as string,
  emoji: r.emoji as string,
  proteinPer100g: Number(r.protein_per_100g),
  defaultPortionG: Number(r.default_portion_g),
  category: ((r.category as Food['category']) ?? 'otros'),
  updatedAt: Number(r.client_updated_at),
  deleted: Boolean(r.deleted),
})

const fromFood = (userId: string, f: Food): Row => ({
  id: f.id,
  user_id: userId,
  name: f.name,
  emoji: f.emoji,
  protein_per_100g: f.proteinPer100g,
  default_portion_g: f.defaultPortionG,
  category: f.category,
  deleted: f.deleted,
  client_updated_at: f.updatedAt,
})

const toSupplement = (r: Row): Supplement => ({
  id: r.id as string,
  name: r.name as string,
  unitLabel: r.unit_label as string,
  servingsTotal: Number(r.servings_total),
  servingsLeft: Number(r.servings_left),
  servingsPerDay: Number(r.servings_per_day),
  gramsPerServing: Number(r.grams_per_serving),
  proteinPerServing: Number(r.protein_per_serving),
  takenDates: (r.taken_dates as string[]) ?? [],
  updatedAt: Number(r.client_updated_at),
  deleted: Boolean(r.deleted),
})

const fromSupplement = (userId: string, s: Supplement): Row => ({
  id: s.id,
  user_id: userId,
  name: s.name,
  unit_label: s.unitLabel,
  servings_total: s.servingsTotal,
  servings_left: s.servingsLeft,
  servings_per_day: s.servingsPerDay,
  grams_per_serving: s.gramsPerServing,
  protein_per_serving: s.proteinPerServing,
  taken_dates: s.takenDates,
  deleted: s.deleted,
  client_updated_at: s.updatedAt,
})

const toWeighIn = (r: Row): WeighIn => ({
  id: r.id as string,
  weightKg: Number(r.weight_kg),
  updatedAt: Number(r.client_updated_at),
  deleted: Boolean(r.deleted),
})

const fromWeighIn = (userId: string, w: WeighIn): Row => ({
  id: w.id,
  user_id: userId,
  weight_kg: w.weightKg,
  deleted: w.deleted,
  client_updated_at: w.updatedAt,
})

const toProfile = (r: Row): Profile => ({
  weightKg: Number(r.weight_kg),
  goal: r.goal as Profile['goal'],
  gPerKg: Number(r.g_per_kg),
  updatedAt: Number(r.client_updated_at),
})

const fromProfile = (userId: string, p: Profile): Row => ({
  user_id: userId,
  weight_kg: p.weightKg,
  goal: p.goal,
  g_per_kg: p.gPerKg,
  client_updated_at: p.updatedAt,
})

/* --------------------------------------------------------------- descarga */

export interface PullResult {
  remote: Partial<AppState>
  /** Marca del servidor más reciente vista. Es el cursor de la próxima descarga. */
  cursor: string | null
}

/**
 * Trae solo lo modificado después de `since`. En la primera sincronización
 * `since` es null y baja todo; a partir de ahí normalmente son cero filas.
 */
export async function pullChanges(
  client: SupabaseClient,
  userId: string,
  since: string | null,
): Promise<PullResult> {
  const scoped = (table: string) => {
    const q = client.from(table).select('*').eq('user_id', userId)
    return since ? q.gt('updated_at', since) : q
  }

  const [profile, foods, meals, planItems, entries, weighIns, supplements] = await Promise.all([
    scoped('profiles').maybeSingle(),
    scoped('foods'),
    scoped('meals'),
    scoped('plan_items'),
    scoped('log_entries'),
    scoped('weigh_ins'),
    scoped('supplements'),
  ])

  for (const res of [profile, foods, meals, planItems, entries, weighIns, supplements]) {
    if (res.error) throw new Error(res.error.message)
  }

  const rows: Row[] = [
    ...(profile.data ? [profile.data as Row] : []),
    ...((foods.data ?? []) as Row[]),
    ...((meals.data ?? []) as Row[]),
    ...((planItems.data ?? []) as Row[]),
    ...((entries.data ?? []) as Row[]),
    ...((weighIns.data ?? []) as Row[]),
    ...((supplements.data ?? []) as Row[]),
  ]

  // El cursor sale de las filas recibidas, no del reloj local: los relojes del
  // móvil y del servidor no tienen por qué coincidir.
  const cursor = rows.reduce<string | null>((max, r) => {
    const at = r.updated_at as string
    return !max || at > max ? at : max
  }, since)

  return {
    remote: {
      profile: profile.data ? toProfile(profile.data as Row) : undefined,
      foods: ((foods.data ?? []) as Row[]).map(toFood),
      meals: ((meals.data ?? []) as Row[]).map(toMeal),
      planItems: ((planItems.data ?? []) as Row[]).map(toPlanItem),
      log: ((entries.data ?? []) as Row[]).map(toEntry),
      weighIns: ((weighIns.data ?? []) as Row[]).map(toWeighIn),
      supplements: ((supplements.data ?? []) as Row[]).map(toSupplement),
    },
    cursor,
  }
}

/* ----------------------------------------------------------------- subida */

/** Cuántas filas subió, para poder decirlo en la interfaz. */
export async function pushChanges(
  client: SupabaseClient,
  userId: string,
  state: AppState,
  since: number,
): Promise<number> {
  const foods = state.foods.filter((f) => f.updatedAt > since)
  const meals = state.meals.filter((m) => m.updatedAt > since)
  const planItems = state.planItems.filter((i) => i.updatedAt > since)
  const entries = state.log.filter((e) => e.updatedAt > since)
  const weighIns = state.weighIns.filter((w) => w.updatedAt > since)
  const supplements = state.supplements.filter((s) => s.updatedAt > since)
  const profileChanged = state.profile.updatedAt > since

  const jobs: PromiseLike<{ error: { message: string } | null }>[] = []

  if (profileChanged) {
    jobs.push(
      client.from('profiles').upsert(fromProfile(userId, state.profile), { onConflict: 'user_id' }),
    )
  }
  if (foods.length) {
    jobs.push(
      client
        .from('foods')
        .upsert(foods.map((f) => fromFood(userId, f)), { onConflict: 'user_id,id' }),
    )
  }
  if (meals.length) {
    jobs.push(
      client
        .from('meals')
        .upsert(meals.map((m) => fromMeal(userId, m)), { onConflict: 'user_id,id' }),
    )
  }
  if (planItems.length) {
    jobs.push(
      client
        .from('plan_items')
        .upsert(planItems.map((i) => fromPlanItem(userId, i)), { onConflict: 'user_id,id' }),
    )
  }
  if (entries.length) {
    jobs.push(
      client
        .from('log_entries')
        .upsert(entries.map((e) => fromEntry(userId, e)), { onConflict: 'user_id,id' }),
    )
  }
  if (weighIns.length) {
    jobs.push(
      client
        .from('weigh_ins')
        .upsert(weighIns.map((w) => fromWeighIn(userId, w)), { onConflict: 'user_id,id' }),
    )
  }
  if (supplements.length) {
    jobs.push(
      client
        .from('supplements')
        .upsert(supplements.map((s) => fromSupplement(userId, s)), { onConflict: 'user_id,id' }),
    )
  }

  for (const res of await Promise.all(jobs)) {
    if (res.error) throw new Error(res.error.message)
  }

  return (
    foods.length +
    meals.length +
    planItems.length +
    entries.length +
    weighIns.length +
    supplements.length +
    (profileChanged ? 1 : 0)
  )
}
