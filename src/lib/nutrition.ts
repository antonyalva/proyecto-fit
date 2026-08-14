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
