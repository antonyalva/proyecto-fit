import type { Food, Goal } from '../types'

/**
 * g de proteína por kg de peso corporal al día.
 * El rango con respaldo para ganancia muscular es 1.6–2.2 g/kg; en déficit
 * calórico conviene el extremo alto para conservar masa magra.
 */
export const G_PER_KG: Record<Goal, number> = {
  mantener: 1.6,
  ganar: 1.9,
  definir: 2.2,
}

export const GOAL_LABEL: Record<Goal, string> = {
  mantener: 'Mantener',
  ganar: 'Ganar músculo',
  definir: 'Definir',
}

export function dailyTarget(weightKg: number, gPerKg: number): number {
  return Math.round(weightKg * gPerKg)
}

/** Objetivo por toma post-entreno: ~0.3 g/kg, acotado al rango útil de 20–40 g. */
export function perServingTarget(weightKg: number): number {
  return Math.round(Math.min(40, Math.max(20, weightKg * 0.3)))
}

/** Proteína de una ración concreta, redondeada a una décima. */
export function proteinFor(food: Food, grams: number): number {
  return Math.round((food.proteinPer100g * grams) / 10) / 10
}

/**
 * true si el alimento se piensa "por unidades" (1 plátano, 2 huevos) en vez de
 * por peso suelto. Requiere las dos partes — un nombre de unidad sin su peso no
 * sirve para calcular nada, y viceversa.
 */
export function isUnitFood(
  food: Food,
): food is Food & { unitLabel: string; unitGrams: number } {
  return Boolean(food.unitLabel && food.unitGrams && food.unitGrams > 0)
}

/** Gramos que representan N unidades. 0 si el alimento no es "por unidades". */
export function gramsFromUnits(food: Food, units: number): number {
  return isUnitFood(food) ? units * food.unitGrams : 0
}

/** Unidades que representan X gramos — para devolvérselo al usuario en su forma natural. */
export function unitsFromGrams(food: Food, grams: number): number {
  return isUnitFood(food) ? grams / food.unitGrams : 0
}

/**
 * Cómo mostrar una cantidad ya calculada: "2 × plátano (236 g)" o "150 g".
 * El "×" evita tener que adivinar el plural de la unidad (no todos los
 * nombres siguen la regla de añadir una "s").
 */
export function formatQuantity(food: Food, grams: number): string {
  if (isUnitFood(food)) {
    const units = Math.round(unitsFromGrams(food, grams) * 10) / 10
    const label = Number.isInteger(units) ? String(units) : units.toFixed(1)
    return `${label} × ${food.unitLabel} (${grams} g)`
  }
  return `${grams} g`
}
