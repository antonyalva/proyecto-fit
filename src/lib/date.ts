/**
 * Fechas en hora local. Nunca uses toISOString() para esto: devuelve UTC y en
 * España eso adelanta el "día de hoy" a partir de las 22:00/23:00.
 */
export function todayKey(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  return todayKey(date)
}

export function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = from.split('-').map(Number)
  const [y2, m2, d2] = to.split('-').map(Number)
  const a = Date.UTC(y1, m1 - 1, d1)
  const b = Date.UTC(y2, m2 - 1, d2)
  return Math.round((b - a) / 86_400_000)
}

const MESES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
]

export function formatShort(key: string): string {
  const [, m, d] = key.split('-').map(Number)
  return `${d} ${MESES[m - 1]}`
}

/**
 * Días de la semana con lunes = 0, como se lee un calendario español.
 * `Date.getDay()` usa domingo = 0, así que siempre hay que convertir; hacerlo en
 * un solo sitio evita el clásico error de un día de desfase.
 */
export const WEEKDAY_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
export const WEEKDAY_NAME = [
  'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo',
]
export const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6]

export function weekdayOf(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  return (new Date(y, m - 1, d).getDay() + 6) % 7
}

/** Racha de días consecutivos que terminan hoy o ayer. */
export function currentStreak(dates: string[], today = todayKey()): number {
  if (dates.length === 0) return 0
  const set = new Set(dates)
  // Una racha sigue viva si tomaste hoy, o si tomaste ayer y aún no toca hoy.
  let cursor = set.has(today) ? today : addDays(today, -1)
  if (!set.has(cursor)) return 0
  let streak = 0
  while (set.has(cursor)) {
    streak++
    cursor = addDays(cursor, -1)
  }
  return streak
}
