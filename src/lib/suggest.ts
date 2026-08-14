import type { Food } from '../types'
import { proteinFor } from './nutrition.ts'

export interface Suggestion {
  food: Food
  grams: number
  /** Proteína que aporta esa cantidad. Comparada con el hueco, dice si lo cierra. */
  protein: number
}

/**
 * Por debajo de esta densidad, cerrar un hueco exigiría raciones absurdas.
 * La quinua cocida (4.4 g/100 g) necesitaría casi 3 kg para cubrir 130 g.
 */
const MIN_DENSITY = 5

const roundTo5 = (x: number) => Math.round(x / 5) * 5

/**
 * Qué comer para cerrar un hueco de proteína, con la cantidad ya calculada.
 *
 * Las cantidades se acotan entre un 40% y el doble de tu ración habitual: sugerir
 * 600 g de pollo cierra el número pero no es una comida. Cuando ni la ración doble
 * llega, se devuelve igual — la interfaz enseña cuánto cubre y tú decides.
 *
 * @param excludeFoodIds alimentos que ya están ese día; pasan al final para dar
 *                       variedad, pero no se descartan por si el catálogo es corto.
 */
export function suggestForGap(
  gap: number,
  foods: Food[],
  excludeFoodIds: string[] = [],
  limit = 3,
): Suggestion[] {
  if (!(gap > 0)) return []

  const excluded = new Set(excludeFoodIds)

  const build = (food: Food): Suggestion | null => {
    if (!(food.proteinPer100g >= MIN_DENSITY)) return null
    if (!(food.defaultPortionG > 0)) return null

    const exact = (gap * 100) / food.proteinPer100g
    const min = Math.max(5, roundTo5(food.defaultPortionG * 0.4))
    const max = Math.max(min, roundTo5(food.defaultPortionG * 2))
    const grams = Math.min(max, Math.max(min, roundTo5(exact)))

    return { food, grams, protein: proteinFor(food, grams) }
  }

  const isSuggestion = (s: Suggestion | null): s is Suggestion => s !== null
  // Lo que más se acerque al hueco, por arriba o por abajo.
  const byFit = (a: Suggestion, b: Suggestion) =>
    Math.abs(a.protein - gap) - Math.abs(b.protein - gap)

  const fresh = foods.filter((f) => !excluded.has(f.id)).map(build).filter(isSuggestion).sort(byFit)
  const repeat = foods.filter((f) => excluded.has(f.id)).map(build).filter(isSuggestion).sort(byFit)

  return [...fresh, ...repeat].slice(0, limit)
}
