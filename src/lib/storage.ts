import type {
  AppState, Food, FoodCategory, LogEntry, Meal, PlanItem, Supplement, SyncMeta, WeighIn,
} from '../types'
import { G_PER_KG } from './nutrition.ts'
import { ALL_WEEKDAYS } from './date.ts'

const KEY = 'protein-tracker/v4'
const LEGACY_KEYS = ['protein-tracker/v3', 'protein-tracker/v2', 'protein-tracker/v1']
const SYNC_KEY = 'protein-tracker/sync'

/**
 * Cada cuenta guarda en su propia clave, y sin sesión se usa la anónima.
 *
 * Con una sola clave compartida, iniciar sesión en un móvil prestado fusionaba
 * los datos del dueño anterior con la cuenta que entraba y los subía a ella.
 * RLS protege el servidor; esto protege el dispositivo.
 */
export function stateKey(userId: string | null): string {
  return userId ? `${KEY}:${userId}` : KEY
}

function food(
  id: string,
  emoji: string,
  name: string,
  proteinPer100g: number,
  defaultPortionG: number,
  category: FoodCategory,
  /** Nombre y gramos de una unidad, para alimentos que nadie pesa antes de comer. */
  unit?: [label: string, grams: number],
): Food {
  return {
    id,
    emoji,
    name,
    proteinPer100g,
    defaultPortionG,
    category,
    unitLabel: unit?.[0],
    unitGrams: unit?.[1],
    updatedAt: 0,
    deleted: false,
  }
}

export const CATEGORY_LABEL: Record<FoodCategory, string> = {
  carnes: 'Carnes',
  pescados: 'Pescados y mariscos',
  'huevos-lacteos': 'Huevos y lácteos',
  legumbres: 'Legumbres y granos',
  frutas: 'Frutas',
  'frutos-secos': 'Frutos secos y semillas',
  suplementos: 'Suplementos',
  otros: 'Otros',
}

/** Orden de aparición: primero lo que más proteína aporta por ración. */
export const CATEGORY_ORDER: FoodCategory[] = [
  'carnes',
  'pescados',
  'huevos-lacteos',
  'legumbres',
  'frutas',
  'frutos-secos',
  'suplementos',
  'otros',
]

/**
 * Catálogo inicial pensado para Lima: todo esto se consigue en mercado, bodega
 * o supermercado, y las porciones son las que se sirven de normal.
 *
 * Son valores de referencia y aproximados. Los de conserva y lácteos varían
 * bastante entre marcas — corrígelos en la pantalla de Comida con lo que diga
 * tu envase, que es el único dato que vale de verdad.
 */
export const DEFAULT_FOODS: Food[] = [
  // Carnes
  food('f-pollo', '🍗', 'Pechuga de pollo', 23, 150, 'carnes'),
  food('f-pollo-pierna', '🍗', 'Pierna de pollo', 18, 150, 'carnes'),
  food('f-pavita', '🦃', 'Pechuga de pavita', 24, 150, 'carnes'),
  food('f-bistec', '🥩', 'Bistec de res', 26, 150, 'carnes'),
  food('f-molida', '🥩', 'Carne molida (7% grasa)', 18, 125, 'carnes'),
  food('f-cerdo', '🥓', 'Lomo de cerdo', 22, 150, 'carnes'),
  food('f-higado', '🥩', 'Hígado de res', 20, 100, 'carnes'),
  food('f-sangrecita', '🩸', 'Sangrecita', 20, 100, 'carnes'),

  // Pescados y mariscos
  food('f-bonito', '🐟', 'Bonito', 23, 150, 'pescados'),
  food('f-jurel', '🐟', 'Jurel', 20, 150, 'pescados'),
  food('f-trucha', '🐟', 'Trucha', 20, 150, 'pescados'),
  food('f-atun', '🥫', 'Atún en lata', 25, 80, 'pescados'),
  food('f-anchoveta', '🥫', 'Anchoveta en conserva', 21, 100, 'pescados'),
  food('f-caballa', '🥫', 'Caballa en conserva', 21, 100, 'pescados'),
  food('f-pota', '🦑', 'Pota', 16, 150, 'pescados'),
  food('f-langostinos', '🦐', 'Langostinos', 20, 120, 'pescados'),

  // Huevos y lácteos
  food('f-huevo', '🥚', 'Huevo', 13, 140, 'huevos-lacteos', ['huevo', 50]),
  food('f-clara', '🥚', 'Clara de huevo', 11, 200, 'huevos-lacteos'),
  food('f-queso-fresco', '🧀', 'Queso fresco', 17, 80, 'huevos-lacteos'),
  food('f-requeson', '🧀', 'Requesón', 11, 100, 'huevos-lacteos'),
  food('f-yogur', '🥛', 'Yogur griego', 9, 150, 'huevos-lacteos'),
  food('f-leche', '🥛', 'Leche fresca', 3.2, 250, 'huevos-lacteos'),
  food('f-leche-evap', '🥛', 'Leche evaporada', 6.5, 100, 'huevos-lacteos'),

  // Legumbres y granos
  food('f-tarwi', '🫘', 'Tarwi (chocho)', 17, 150, 'legumbres'),
  food('f-lentejas', '🫘', 'Lentejas cocidas', 9, 200, 'legumbres'),
  food('f-garbanzos', '🫘', 'Garbanzos cocidos', 9, 200, 'legumbres'),
  food('f-frejol', '🫘', 'Frejol canario cocido', 8, 200, 'legumbres'),
  food('f-pallares', '🫘', 'Pallares cocidos', 8, 200, 'legumbres'),
  food('f-habas', '🫛', 'Habas frescas', 8, 150, 'legumbres'),
  food('f-quinua', '🌾', 'Quinua cocida', 4.4, 200, 'legumbres'),
  food('f-kiwicha', '🌾', 'Kiwicha cocida', 4, 200, 'legumbres'),

  // Frutas — poca proteína por sí solas, pero cuentan igual en el día
  food('f-platano', '🍌', 'Plátano', 1.1, 118, 'frutas', ['plátano', 118]),

  // Frutos secos y semillas
  food('f-mani', '🥜', 'Maní', 26, 40, 'frutos-secos'),
  food('f-almendras', '🌰', 'Almendras', 21, 30, 'frutos-secos'),
  food('f-pecanas', '🌰', 'Pecanas', 9, 30, 'frutos-secos'),
  food('f-chia', '🌱', 'Semillas de chía', 17, 25, 'frutos-secos'),
  food('f-linaza', '🌱', 'Linaza', 18, 25, 'frutos-secos'),

  // Suplementos
  food('f-whey', '🥤', 'Proteína en polvo', 80, 30, 'suplementos'),
]

export const DEFAULT_MEALS: Meal[] = [
  { id: 'm-desayuno', name: 'Desayuno', order: 0, updatedAt: 0, deleted: false },
  { id: 'm-comida', name: 'Comida', order: 1, updatedAt: 0, deleted: false },
  { id: 'm-postentreno', name: 'Post-entreno', order: 2, updatedAt: 0, deleted: false },
  { id: 'm-cena', name: 'Cena', order: 3, updatedAt: 0, deleted: false },
]

function item(
  id: string,
  mealId: string,
  foodId: string,
  grams: number,
  days: number[] = ALL_WEEKDAYS,
): PlanItem {
  return { id, mealId, foodId, grams, days, updatedAt: 0, deleted: false }
}

const DIARIO = ALL_WEEKDAYS
const ENTRENO = [0, 2, 4] // lunes, miércoles y viernes
const ENTRESEMANA = [0, 1, 2, 3, 4]
const FINDE = [5, 6]

/**
 * Plan de partida, montado con el catálogo de fábrica.
 *
 * Varía entre días a propósito para que se vea que el plan es semanal y no el mismo
 * bucle siete veces: batido los días de entreno, atún los de descanso para compensar
 * esa proteína, y ternera el fin de semana en vez de pollo.
 *
 * Pero varía cuadrando: los siete días caen entre 141 y 146 g, contra los 143 g de
 * una persona de 75 kg a 1.9 g/kg. Un plan de ejemplo que no llega a su propia meta
 * no sirve de ejemplo.
 *
 * Sigue siendo un punto de partida para editar, no una recomendación: no sé qué
 * comes, qué te gusta ni qué días entrenas de verdad.
 */
export const DEFAULT_PLAN_ITEMS: PlanItem[] = [
  item('pi-1', 'm-desayuno', 'f-huevo', 140, DIARIO),
  item('pi-2', 'm-desayuno', 'f-leche', 250, DIARIO),
  item('pi-3', 'm-comida', 'f-lentejas', 200, DIARIO),
  item('pi-4', 'm-comida', 'f-pollo', 150, ENTRESEMANA),
  item('pi-5', 'm-comida', 'f-bistec', 150, FINDE),
  item('pi-6', 'm-comida', 'f-atun', 80, [1, 3]),
  item('pi-7', 'm-comida', 'f-tarwi', 100, FINDE),
  item('pi-8', 'm-postentreno', 'f-whey', 30, ENTRENO),
  item('pi-9', 'm-cena', 'f-bonito', 150, DIARIO),
  item('pi-10', 'm-cena', 'f-queso-fresco', 80, DIARIO),
]

export const DEFAULT_STATE: AppState = {
  profile: { weightKg: 75, goal: 'ganar', gPerKg: G_PER_KG.ganar, updatedAt: 0 },
  foods: DEFAULT_FOODS,
  meals: DEFAULT_MEALS,
  planItems: DEFAULT_PLAN_ITEMS,
  log: [],
  weighIns: [],
  supplements: [],
}

export const DEFAULT_SYNC_META: SyncMeta = {
  lastPulledAt: null,
  lastPushedAt: 0,
  userId: null,
}

/** Rellena lo que falte para que un guardado de una versión anterior siga abriendo. */
export function normalizeState(input: Partial<AppState> | null | undefined): AppState {
  // Un plan vacío es una elección válida (lo borraste entero), pero solo si ya
  // existían comidas. Si no hay ninguna, es un guardado anterior al plan y toca sembrar.
  const hasPlan = Boolean(input?.meals?.length)

  return {
    profile: { ...DEFAULT_STATE.profile, ...input?.profile },
    foods: input?.foods?.length ? input.foods.map(normalizeFood) : DEFAULT_FOODS,
    meals: hasPlan ? input!.meals!.map(normalizeMeal) : DEFAULT_MEALS,
    planItems: hasPlan ? (input?.planItems ?? []).map(normalizeItem) : DEFAULT_PLAN_ITEMS,
    log: (input?.log ?? []).map(normalizeEntry),
    weighIns: (input?.weighIns ?? []).map(normalizeWeighIn),
    supplements: (input?.supplements ?? []).map(normalizeSupplement),
  }
}

function normalizeWeighIn(w: WeighIn): WeighIn {
  return { ...w, updatedAt: w.updatedAt ?? 0, deleted: w.deleted ?? false }
}

function normalizeMeal(m: Meal): Meal {
  return { ...m, order: m.order ?? 0, updatedAt: m.updatedAt ?? 0, deleted: m.deleted ?? false }
}

function normalizeItem(i: PlanItem): PlanItem {
  // Sin días guardados significa "todos": es como se comportaba antes del plan semanal.
  return {
    ...i,
    days: i.days?.length ? i.days : ALL_WEEKDAYS,
    updatedAt: i.updatedAt ?? 0,
    deleted: i.deleted ?? false,
  }
}

function normalizeFood(f: Food): Food {
  return {
    ...f,
    defaultPortionG: f.defaultPortionG || 100,
    // Un alimento de una versión anterior no traía categoría: cae en "Otros",
    // que es visible y editable, en vez de desaparecer de la lista agrupada.
    category: f.category ?? 'otros',
    updatedAt: f.updatedAt ?? 0,
    deleted: f.deleted ?? false,
  }
}

function normalizeEntry(e: LogEntry): LogEntry {
  return { ...e, updatedAt: e.updatedAt ?? e.ts ?? 0, deleted: e.deleted ?? false }
}

function normalizeSupplement(s: Supplement): Supplement {
  return {
    ...s,
    takenDates: s.takenDates ?? [],
    updatedAt: s.updatedAt ?? 0,
    deleted: s.deleted ?? false,
  }
}

interface LegacyPreset {
  id: string
  name: string
  emoji: string
  protein: number
  deleted?: boolean
  updatedAt?: number
}

/**
 * Convierte los botones antiguos en alimentos.
 *
 * Un preset solo guardaba "35 g de proteína", sin decir de cuánta comida. Se asume
 * que esa era una ración de 100 g, así que el número por ración se conserva exacto
 * y lo que queda aproximado es el por-100-g. Es la única lectura posible sin
 * inventarse datos, y se corrige editando el alimento.
 */
function presetToFood(p: LegacyPreset): Food {
  return {
    id: p.id,
    name: p.name,
    emoji: p.emoji ?? '🍽️',
    proteinPer100g: p.protein,
    defaultPortionG: 100,
    category: 'otros',
    updatedAt: p.updatedAt ?? 0,
    deleted: p.deleted ?? false,
  }
}

function migrate(raw: string): AppState {
  const old = JSON.parse(raw) as Partial<AppState> & {
    presets?: LegacyPreset[]
    deletedIds?: string[]
  }

  // v1 guardaba los borrados en una lista suelta en vez de marcarlos en la fila.
  const gone = new Set(old.deletedIds ?? [])
  const bury = <T extends { id: string; deleted: boolean }>(rows: T[]): T[] =>
    rows.map((r) => (gone.has(r.id) ? { ...r, deleted: true } : r))

  const foods = old.foods?.length
    ? old.foods.map(normalizeFood)
    : old.presets?.length
      ? old.presets.map(presetToFood)
      : DEFAULT_FOODS

  const state = normalizeState({ ...old, foods })

  return {
    ...state,
    foods: bury(state.foods),
    meals: bury(state.meals),
    planItems: bury(state.planItems),
    log: bury(state.log),
    supplements: bury(state.supplements),
  }
}

export function loadState(userId: string | null = null): AppState {
  try {
    const raw = localStorage.getItem(stateKey(userId))
    if (raw) return normalizeState(JSON.parse(raw) as Partial<AppState>)

    // Los formatos antiguos son de antes de que existieran las cuentas: solo
    // pueden pertenecer al almacén anónimo.
    if (userId === null) {
      for (const key of LEGACY_KEYS) {
        const legacy = localStorage.getItem(key)
        if (legacy) {
          const migrated = migrate(legacy)
          saveState(migrated, null)
          return migrated
        }
      }
    }
    return DEFAULT_STATE
  } catch {
    return DEFAULT_STATE
  }
}

export function saveState(state: AppState, userId: string | null = null): void {
  try {
    localStorage.setItem(stateKey(userId), JSON.stringify(state))
  } catch {
    // Cuota llena o modo privado. No hay nada útil que hacer aquí salvo no romper la app.
  }
}

export function clearState(userId: string | null): void {
  try {
    localStorage.removeItem(stateKey(userId))
  } catch {
    // Igual que arriba: no romper la app por no poder tocar el almacenamiento.
  }
}

/**
 * true si nadie ha tocado nada todavía: catálogo de fábrica y ningún registro.
 *
 * Sirve para decidir si una cuenta recién creada debe adoptar lo que ya había
 * en el dispositivo sin sesión, o si tiene datos propios que no hay que pisar.
 */
export function isPristine(s: AppState): boolean {
  return (
    s.log.length === 0 &&
    s.weighIns.length === 0 &&
    s.supplements.length === 0 &&
    s.profile.updatedAt === 0 &&
    s.foods.every((f) => f.updatedAt === 0) &&
    s.meals.every((m) => m.updatedAt === 0) &&
    s.planItems.every((i) => i.updatedAt === 0)
  )
}

/** El cursor también es por cuenta: alternar entre dos no debe resincronizar todo. */
export function loadSyncMeta(userId: string): SyncMeta {
  try {
    const raw = localStorage.getItem(`${SYNC_KEY}:${userId}`)
    return raw ? { ...DEFAULT_SYNC_META, ...JSON.parse(raw) } : DEFAULT_SYNC_META
  } catch {
    return DEFAULT_SYNC_META
  }
}

export function saveSyncMeta(userId: string, meta: SyncMeta): void {
  try {
    localStorage.setItem(`${SYNC_KEY}:${userId}`, JSON.stringify(meta))
  } catch {
    // Igual que arriba: sin cursor se resincroniza entero, que es lento pero correcto.
  }
}

/** Solo lo que el usuario debe ver: lo borrado sigue en memoria para poder sincronizarlo. */
export function visible<T extends { deleted: boolean }>(rows: T[]): T[] {
  return rows.filter((r) => !r.deleted)
}

export function exportState(state: AppState): string {
  return JSON.stringify({ __app: KEY, exportedAt: new Date().toISOString(), state }, null, 2)
}

/** Devuelve null si el archivo no es una copia válida, en vez de dejar la app en un estado roto. */
export function parseImport(text: string): AppState | null {
  try {
    const parsed = JSON.parse(text)
    const candidate = parsed?.state ?? parsed
    if (!candidate?.profile || !Array.isArray(candidate.log)) return null
    return candidate.foods ? normalizeState(candidate) : migrate(JSON.stringify(candidate))
  } catch {
    return null
  }
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}
