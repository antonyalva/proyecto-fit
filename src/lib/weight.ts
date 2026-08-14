import type { WeighIn } from '../types'
// Con extensión: `node --test` resuelve ESM de forma estricta y sin ella no encuentra
// el módulo. Vite acepta ambas, así que la explícita es la que funciona en los dos.
import { addDays, daysBetween } from './date.ts'

export interface WeightPoint {
  /** YYYY-MM-DD */
  date: string
  weightKg: number
  /** Media de los 7 días que terminan en esta fecha. Es la cifra que hay que mirar. */
  average: number
}

const WINDOW_DAYS = 7

/**
 * Serie diaria con media móvil de 7 días.
 *
 * El peso de un día suelto no significa nada: la sal, el agua, el glucógeno y la
 * hora a la que te pesas mueven fácilmente un kilo arriba o abajo. La media de 7
 * días es lo único que refleja un cambio real de masa corporal.
 *
 * La ventana son días de calendario, no las 7 últimas pesadas: si te pesas de
 * higos a brevas, promediar medidas separadas por semanas daría una tendencia falsa.
 */
export function weightSeries(weighIns: WeighIn[]): WeightPoint[] {
  const sorted = [...weighIns].sort((a, b) => a.id.localeCompare(b.id))

  return sorted.map((entry, index) => {
    const from = addDays(entry.id, -(WINDOW_DAYS - 1))
    const window: number[] = []

    // Hacia atrás desde el punto actual mientras quepan en la ventana.
    for (let i = index; i >= 0; i--) {
      if (sorted[i].id < from) break
      window.push(sorted[i].weightKg)
    }

    const average = window.reduce((sum, w) => sum + w, 0) / window.length
    return {
      date: entry.id,
      weightKg: entry.weightKg,
      average: Math.round(average * 10) / 10,
    }
  })
}

/**
 * El peso que manda para calcular la meta de proteína.
 *
 * Si te pesas, la media móvil; si no, el que escribiste a mano. Derivarlo en vez de
 * guardar una copia evita que se quede desfasado: si el peso vivo estuviera copiado
 * en el perfil, pesarte en el móvil no actualizaría la meta en el portátil.
 */
export function effectiveWeight(manualKg: number, weighIns: WeighIn[]): number {
  const series = weightSeries(weighIns.filter((w) => !w.deleted))
  return series.length > 0 ? series[series.length - 1].average : manualKg
}

export interface Trend {
  kgPerWeek: number
  /** Días de calendario entre los dos extremos usados. */
  spanDays: number
}

/** Por debajo de esto la tendencia es ruido disfrazado de dato. */
export const MIN_TREND_DAYS = 14

/**
 * Ritmo de cambio en kg por semana, comparando la media móvil de ahora con la de
 * hasta `windowDays` atrás. Devuelve null si no hay recorrido suficiente: es mejor
 * decir "todavía no lo sé" que dar una cifra inventada a partir de tres pesadas.
 */
export function weightTrend(points: WeightPoint[], windowDays = 28): Trend | null {
  if (points.length < 2) return null

  const last = points[points.length - 1]
  const from = addDays(last.date, -windowDays)
  const first = points.find((p) => p.date >= from) ?? points[0]

  const spanDays = daysBetween(first.date, last.date)
  if (spanDays < MIN_TREND_DAYS) return null

  const kgPerWeek = ((last.average - first.average) / spanDays) * 7
  return { kgPerWeek: Math.round(kgPerWeek * 100) / 100, spanDays }
}

/** Lectura en lenguaje llano de un ritmo de cambio, para un objetivo dado. */
export function readTrend(kgPerWeek: number): { tone: 'good' | 'warn' | 'flat'; text: string } {
  if (kgPerWeek >= 0.7) {
    return {
      tone: 'warn',
      text: 'Subes rápido. Por encima de ~0.5 kg por semana, buena parte de lo que ganas ya es grasa.',
    }
  }
  if (kgPerWeek >= 0.2) {
    return {
      tone: 'good',
      text: 'Ritmo de ganancia limpio. Es donde conviene estar para ganar músculo sin acumular grasa.',
    }
  }
  if (kgPerWeek > -0.2) {
    return {
      tone: 'flat',
      text: 'Estás en mantenimiento. Se puede ganar músculo así, sobre todo volviendo tras un parón, pero irá lento.',
    }
  }
  if (kgPerWeek > -0.7) {
    return {
      tone: 'good',
      text: 'Pérdida a buen ritmo. Con la proteína alta y entrenando, lo que se va es sobre todo grasa.',
    }
  }
  return {
    tone: 'warn',
    text: 'Bajas rápido. Por debajo de ~-0.7 kg por semana cuesta conservar músculo aunque comas suficiente proteína.',
  }
}
