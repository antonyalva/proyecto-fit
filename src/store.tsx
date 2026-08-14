import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  AppState, Food, LogEntry, Meal, PlanItem, Profile, Supplement, WeighIn,
} from './types'
import { effectiveWeight } from './lib/weight'
import { DEFAULT_FOODS, loadState, saveState, uid, visible } from './lib/storage'
import { useAuth } from './auth'
import { todayKey, weekdayOf } from './lib/date'
import { proteinFor } from './lib/nutrition'

interface Store {
  /** Estado completo, incluidas las filas borradas que aún faltan por sincronizar. */
  state: AppState
  /**
   * El peso con el que se calcula la meta: tu media de 7 días si te pesas, y el
   * escrito a mano si no. Derivado, nunca copiado, para que no se desfase entre
   * dispositivos.
   */
  weightKg: number
  /** Lo que debe pintar la interfaz: sin filas borradas. */
  view: {
    foods: Food[]
    meals: Meal[]
    planItems: PlanItem[]
    log: LogEntry[]
    weighIns: WeighIn[]
    supplements: Supplement[]
  }
  /** Proteína suelta, sin pasar por el catálogo. */
  addEntry: (name: string, protein: number) => void
  /** Una ración concreta de un alimento: guarda los gramos y de qué era. */
  addFoodEntry: (food: Food, grams: number) => void
  removeEntry: (id: string) => void
  setProfile: (patch: Partial<Profile>) => void
  saveFood: (food: Food) => void
  removeFood: (id: string) => void
  /** Deja el catálogo como recién instalado. No toca el historial ya registrado. */
  restoreDefaultFoods: () => void
  saveMeal: (meal: Meal) => void
  removeMeal: (id: string) => void
  savePlanItem: (item: PlanItem) => void
  removePlanItem: (id: string) => void
  /** Registra una línea del plan como comida de hoy. */
  logPlanItem: (item: PlanItem) => void
  /** Registra de golpe todas las líneas de una comida que falten por hoy. */
  logMeal: (mealId: string) => void
  /** Anota una pesada. Una por día: repetir el mismo día corrige la anterior. */
  addWeighIn: (weightKg: number, date?: string) => void
  removeWeighIn: (date: string) => void
  addSupplement: (s: Omit<Supplement, 'id' | 'takenDates' | 'updatedAt' | 'deleted'>) => void
  takeSupplement: (id: string) => void
  refillSupplement: (id: string, servings: number) => void
  removeSupplement: (id: string) => void
  replaceState: (next: AppState) => void
}

const StoreContext = createContext<Store | null>(null)

/**
 * Marca la fila como borrada en vez de quitarla.
 * Si desapareciera, el otro dispositivo la volvería a subir sin saber que ya no está.
 */
function bury<T extends { id: string; updatedAt: number; deleted: boolean }>(
  rows: T[],
  id: string,
): T[] {
  return rows.map((r) => (r.id === id ? { ...r, deleted: true, updatedAt: Date.now() } : r))
}

export function StoreProvider({ children }: { children: ReactNode }) {
  // activeUserId, no user.id: sin red y sin sesión viva, se sigue cargando el
  // almacén de la última cuenta que entró en este dispositivo.
  const { activeUserId: userId } = useAuth()

  /**
   * El dueño viaja junto a los datos, no en una variable aparte.
   *
   * Separados, al cambiar de cuenta hay un instante en que el efecto de guardado
   * ve los datos viejos con el dueño nuevo — y escribe los de una cuenta en el
   * almacén de la otra.
   */
  const [store, setStore] = useState<{ owner: string | null; data: AppState }>(() => ({
    owner: userId,
    data: loadState(userId),
  }))

  useEffect(() => {
    setStore((s) => (s.owner === userId ? s : { owner: userId, data: loadState(userId) }))
  }, [userId])

  useEffect(() => {
    saveState(store.data, store.owner)
  }, [store])

  const state = store.data

  /** Acepta valor o función, como el setState de React, para no tocar el resto. */
  const setState = useCallback((next: AppState | ((prev: AppState) => AppState)) => {
    setStore((prev) => ({
      ...prev,
      data: typeof next === 'function' ? (next as (p: AppState) => AppState)(prev.data) : next,
    }))
  }, [])

  const addEntry = useCallback((name: string, protein: number) => {
    const now = Date.now()
    setState((s) => ({
      ...s,
      log: [
        { id: uid(), date: todayKey(), name, protein, ts: now, updatedAt: now, deleted: false },
        ...s.log,
      ],
    }))
  }, [])

  const addFoodEntry = useCallback((food: Food, grams: number) => {
    const now = Date.now()
    setState((s) => ({
      ...s,
      log: [
        {
          id: uid(),
          date: todayKey(),
          name: food.name,
          protein: proteinFor(food, grams),
          grams,
          foodId: food.id,
          ts: now,
          updatedAt: now,
          deleted: false,
        },
        ...s.log,
      ],
    }))
  }, [])

  const removeEntry = useCallback((id: string) => {
    setState((s) => ({ ...s, log: bury(s.log, id) }))
  }, [])

  const setProfile = useCallback((patch: Partial<Profile>) => {
    setState((s) => ({ ...s, profile: { ...s.profile, ...patch, updatedAt: Date.now() } }))
  }, [])

  const saveFood = useCallback((food: Food) => {
    setState((s) => {
      const next = { ...food, updatedAt: Date.now(), deleted: false }
      const exists = s.foods.some((f) => f.id === food.id)
      return {
        ...s,
        foods: exists ? s.foods.map((f) => (f.id === food.id ? next : f)) : [...s.foods, next],
      }
    })
  }, [])

  const removeFood = useCallback((id: string) => {
    setState((s) => ({ ...s, foods: bury(s.foods, id) }))
  }, [])

  const saveMeal = useCallback((meal: Meal) => {
    setState((s) => {
      const next = { ...meal, updatedAt: Date.now(), deleted: false }
      const exists = s.meals.some((m) => m.id === meal.id)
      return {
        ...s,
        meals: (exists ? s.meals.map((m) => (m.id === meal.id ? next : m)) : [...s.meals, next])
          .sort((a, b) => a.order - b.order),
      }
    })
  }, [])

  /** Borrar una comida se lleva sus líneas: sueltas no son nada. */
  const removeMeal = useCallback((id: string) => {
    const now = Date.now()
    setState((s) => ({
      ...s,
      meals: bury(s.meals, id),
      planItems: s.planItems.map((i) =>
        i.mealId === id ? { ...i, deleted: true, updatedAt: now } : i,
      ),
    }))
  }, [])

  const savePlanItem = useCallback((item: PlanItem) => {
    setState((s) => {
      const next = { ...item, updatedAt: Date.now(), deleted: false }
      const exists = s.planItems.some((i) => i.id === item.id)
      return {
        ...s,
        planItems: exists
          ? s.planItems.map((i) => (i.id === item.id ? next : i))
          : [...s.planItems, next],
      }
    })
  }, [])

  const removePlanItem = useCallback((id: string) => {
    setState((s) => ({ ...s, planItems: bury(s.planItems, id) }))
  }, [])

  const logPlanItem = useCallback((item: PlanItem) => {
    const today = todayKey()
    const now = Date.now()
    setState((s) => {
      const food = s.foods.find((f) => f.id === item.foodId)
      if (!food) return s
      return {
        ...s,
        log: [
          {
            id: uid(),
            date: today,
            name: food.name,
            protein: proteinFor(food, item.grams),
            grams: item.grams,
            foodId: food.id,
            planItemId: item.id,
            ts: now,
            updatedAt: now,
            deleted: false,
          },
          ...s.log,
        ],
      }
    })
  }, [])

  const logMeal = useCallback((mealId: string) => {
    const today = todayKey()
    const now = Date.now()
    setState((s) => {
      // Solo lo que falte: pulsar dos veces no debe duplicar el desayuno.
      const yaHecho = new Set(
        s.log.filter((e) => e.date === today && !e.deleted).map((e) => e.planItemId),
      )
      const hoyEs = weekdayOf(today)
      const pendientes = s.planItems.filter(
        (i) =>
          i.mealId === mealId &&
          !i.deleted &&
          i.days.includes(hoyEs) &&
          !yaHecho.has(i.id),
      )
      if (pendientes.length === 0) return s

      const nuevos = pendientes.flatMap((item, index) => {
        const food = s.foods.find((f) => f.id === item.foodId)
        if (!food) return []
        return [
          {
            id: uid(),
            date: today,
            name: food.name,
            protein: proteinFor(food, item.grams),
            grams: item.grams,
            foodId: food.id,
            planItemId: item.id,
            // +index para que no compartan milisegundo y el orden quede estable.
            ts: now + index,
            updatedAt: now + index,
            deleted: false,
          },
        ]
      })

      return { ...s, log: [...nuevos.reverse(), ...s.log] }
    })
  }, [])

  const addWeighIn = useCallback((weightKg: number, date?: string) => {
    if (!(weightKg > 0)) return
    const day = date ?? todayKey()
    const now = Date.now()

    setState((s) => {
      const exists = s.weighIns.some((w) => w.id === day)
      const weighIns = exists
        ? s.weighIns.map((w) =>
            w.id === day ? { ...w, weightKg, deleted: false, updatedAt: now } : w,
          )
        : [...s.weighIns, { id: day, weightKg, updatedAt: now, deleted: false }]

      return { ...s, weighIns }
    })
  }, [])

  const removeWeighIn = useCallback((date: string) => {
    setState((s) => ({ ...s, weighIns: bury(s.weighIns, date) }))
  }, [])

  const restoreDefaultFoods = useCallback(() => {
    const now = Date.now()
    setState((s) => {
      const fresh = DEFAULT_FOODS.map((f) => ({ ...f, updatedAt: now, deleted: false }))
      const freshIds = new Set(fresh.map((f) => f.id))
      // Los que no son de fábrica se marcan borrados, no se tiran: así el borrado
      // también viaja al otro dispositivo en la próxima sincronización.
      const retired = s.foods
        .filter((f) => !freshIds.has(f.id))
        .map((f) => ({ ...f, deleted: true, updatedAt: now }))

      return { ...s, foods: [...fresh, ...retired] }
    })
  }, [])

  const addSupplement = useCallback(
    (s: Omit<Supplement, 'id' | 'takenDates' | 'updatedAt' | 'deleted'>) => {
      setState((prev) => ({
        ...prev,
        supplements: [
          ...prev.supplements,
          { ...s, id: uid(), takenDates: [], updatedAt: Date.now(), deleted: false },
        ],
      }))
    },
    [],
  )

  /**
   * Registrar una toma descuenta inventario y marca el día para la racha.
   * Si el suplemento aporta proteína, la suma también al diario: así un scoop
   * es un solo gesto en vez de dos.
   */
  const takeSupplement = useCallback((id: string) => {
    const today = todayKey()
    const now = Date.now()
    setState((prev) => {
      const target = prev.supplements.find((s) => s.id === id)
      if (!target || target.servingsLeft <= 0) return prev

      const supplements = prev.supplements.map((s) =>
        s.id === id
          ? {
              ...s,
              servingsLeft: s.servingsLeft - 1,
              takenDates: s.takenDates.includes(today)
                ? s.takenDates
                : [...s.takenDates, today],
              updatedAt: now,
            }
          : s,
      )

      const log =
        target.proteinPerServing > 0
          ? [
              {
                id: uid(),
                date: today,
                name: target.name,
                protein: target.proteinPerServing,
                ts: now,
                updatedAt: now,
                deleted: false,
              },
              ...prev.log,
            ]
          : prev.log

      return { ...prev, supplements, log }
    })
  }, [])

  const refillSupplement = useCallback((id: string, servings: number) => {
    setState((prev) => ({
      ...prev,
      supplements: prev.supplements.map((s) =>
        s.id === id
          ? {
              ...s,
              servingsLeft: servings,
              servingsTotal: Math.max(s.servingsTotal, servings),
              updatedAt: Date.now(),
            }
          : s,
      ),
    }))
  }, [])

  const removeSupplement = useCallback((id: string) => {
    setState((prev) => ({ ...prev, supplements: bury(prev.supplements, id) }))
  }, [])

  const replaceState = useCallback((next: AppState) => setState(next), [])

  const view = useMemo(
    () => ({
      foods: visible(state.foods),
      meals: visible(state.meals),
      planItems: visible(state.planItems),
      log: visible(state.log),
      weighIns: visible(state.weighIns),
      supplements: visible(state.supplements),
    }),
    [
      state.foods,
      state.meals,
      state.planItems,
      state.log,
      state.weighIns,
      state.supplements,
    ],
  )

  const weightKg = useMemo(
    () => effectiveWeight(state.profile.weightKg, state.weighIns),
    [state.profile.weightKg, state.weighIns],
  )

  const value = useMemo<Store>(
    () => ({
      state,
      weightKg,
      view,
      addEntry,
      addFoodEntry,
      removeEntry,
      setProfile,
      saveFood,
      removeFood,
      restoreDefaultFoods,
      saveMeal,
      removeMeal,
      savePlanItem,
      removePlanItem,
      logPlanItem,
      logMeal,
      addWeighIn,
      removeWeighIn,
      addSupplement,
      takeSupplement,
      refillSupplement,
      removeSupplement,
      replaceState,
    }),
    [
      state,
      weightKg,
      view,
      addEntry,
      addFoodEntry,
      removeEntry,
      setProfile,
      saveFood,
      removeFood,
      restoreDefaultFoods,
      saveMeal,
      removeMeal,
      savePlanItem,
      removePlanItem,
      logPlanItem,
      logMeal,
      addWeighIn,
      removeWeighIn,
      addSupplement,
      takeSupplement,
      refillSupplement,
      removeSupplement,
      replaceState,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): Store {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore fuera de StoreProvider')
  return ctx
}
