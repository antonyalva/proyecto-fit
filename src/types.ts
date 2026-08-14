export type Goal = 'ganar' | 'mantener' | 'definir'

/**
 * Todo lo que se sincroniza lleva estas dos marcas.
 *
 * `deleted` es borrado lógico: si la fila desapareciera del todo, el otro
 * dispositivo la volvería a subir en la siguiente sincronización, sin saber
 * que la habías borrado.
 */
export interface Syncable {
  /** Reloj del dispositivo. Decide quién gana cuando los dos editan la misma fila. */
  updatedAt: number
  deleted: boolean
}

export interface Profile {
  weightKg: number
  goal: Goal
  /** Gramos de proteína por kg de peso corporal al día. Editable a mano. */
  gPerKg: number
  updatedAt: number
}

/** Para agrupar el catálogo en vez de mostrar una lista plana de treinta cosas. */
export type FoodCategory =
  | 'carnes'
  | 'pescados'
  | 'huevos-lacteos'
  | 'legumbres'
  | 'frutos-secos'
  | 'suplementos'
  | 'otros'

/**
 * Un alimento del catálogo. Se define por su proteína por 100 g, que no depende
 * de la ración, y por tu ración habitual, que es lo que se registra al pulsarlo.
 */
export interface Food extends Syncable {
  id: string
  name: string
  emoji: string
  proteinPer100g: number
  defaultPortionG: number
  category: FoodCategory
}

/** Una comida del plan: Desayuno, Comida, Post-entreno, Cena… */
export interface Meal extends Syncable {
  id: string
  name: string
  /** Para ordenarlas como transcurre el día, no por orden de creación. */
  order: number
}

/** Un alimento con su cantidad dentro de una comida del plan. */
export interface PlanItem extends Syncable {
  id: string
  mealId: string
  foodId: string
  grams: number
  /**
   * Días de la semana en los que toca, con lunes = 0. Los siete para lo que comes
   * a diario; un subconjunto para lo que solo entra los días de entreno.
   */
  days: number[]
}

/** Una toma de proteína registrada. */
export interface LogEntry extends Syncable {
  id: string
  /** YYYY-MM-DD, en hora local. */
  date: string
  name: string
  protein: number
  /** Nulos si lo metiste como proteína suelta, sin pasar por el catálogo. */
  grams?: number
  foodId?: string
  /** De qué línea del plan salió, para saber si ya la has cumplido hoy. */
  planItemId?: string
  ts: number
}

/**
 * Una pesada. El `id` ES la fecha (YYYY-MM-DD): así solo cabe una por día sin
 * lógica extra, y pesarte dos veces el mismo día corrige la anterior en vez de
 * duplicarla.
 */
export interface WeighIn extends Syncable {
  id: string
  weightKg: number
}

export interface Supplement extends Syncable {
  id: string
  name: string
  /** Cómo se llama una toma: "scoop", "dosis", "cápsula". */
  unitLabel: string
  servingsTotal: number
  servingsLeft: number
  servingsPerDay: number
  gramsPerServing: number
  /** Proteína por toma, en g. 0 para creatina y similares. */
  proteinPerServing: number
  /** Fechas YYYY-MM-DD en las que se registró una toma. Alimenta la racha. */
  takenDates: string[]
}

export interface AppState {
  profile: Profile
  foods: Food[]
  meals: Meal[]
  planItems: PlanItem[]
  log: LogEntry[]
  weighIns: WeighIn[]
  supplements: Supplement[]
}

/** Dónde se quedó la última sincronización. Vive aparte del estado de la app. */
export interface SyncMeta {
  /** Marca del SERVIDOR: pide solo lo modificado después de esto. */
  lastPulledAt: string | null
  /** Marca de ESTE dispositivo: sube solo lo tocado después de esto. */
  lastPushedAt: number
  /** A quién pertenece el cursor, para no reutilizarlo con otra cuenta. */
  userId: string | null
}
