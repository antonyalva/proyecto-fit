import { test } from 'node:test'
import assert from 'node:assert/strict'
import { effectiveWeight, readTrend, weightSeries, weightTrend } from './weight.ts'
import { addDays } from './date.ts'
import type { WeighIn } from '../types.ts'

function pesada(date: string, weightKg: number): WeighIn {
  return { id: date, weightKg, updatedAt: 0, deleted: false }
}

/** Serie diaria desde una fecha, con los pesos dados. */
function diario(desde: string, pesos: number[]): WeighIn[] {
  return pesos.map((w, i) => pesada(addDays(desde, i), w))
}

test('con una sola pesada la media es esa pesada', () => {
  const s = weightSeries([pesada('2026-08-01', 75)])
  assert.equal(s[0].average, 75)
})

test('la media suaviza el ruido diario', () => {
  // Un día de +2 kg por sal y agua no debe mover la media casi nada.
  const s = weightSeries(diario('2026-08-01', [75, 75, 75, 75, 75, 75, 77]))
  assert.equal(s[6].weightKg, 77, 'el dato crudo conserva el pico')
  assert.equal(s[6].average, 75.3, 'la media apenas se inmuta')
})

test('la ventana son 7 días de calendario, no las 7 últimas pesadas', () => {
  // Pesadas muy separadas: la de agosto no debe promediarse con la de junio.
  const s = weightSeries([
    pesada('2026-06-01', 70),
    pesada('2026-07-01', 74),
    pesada('2026-08-01', 78),
  ])
  assert.equal(s[2].average, 78, 'solo entra la pesada que cae dentro de la ventana')
})

test('la serie se ordena aunque las pesadas lleguen desordenadas', () => {
  // Al sincronizar, las filas llegan en cualquier orden.
  const s = weightSeries([
    pesada('2026-08-03', 76),
    pesada('2026-08-01', 75),
    pesada('2026-08-02', 75.5),
  ])
  assert.deepEqual(s.map((p) => p.date), ['2026-08-01', '2026-08-02', '2026-08-03'])
})

test('sin recorrido suficiente no se inventa una tendencia', () => {
  // Tres días de datos no dicen nada sobre el ritmo semanal.
  const s = weightSeries(diario('2026-08-01', [75, 75.4, 75.8]))
  assert.equal(weightTrend(s), null)
})

test('una tendencia necesita al menos 14 días', () => {
  const trece = weightSeries(diario('2026-08-01', Array.from({ length: 13 }, () => 75)))
  assert.equal(weightTrend(trece), null)

  const quince = weightSeries(diario('2026-08-01', Array.from({ length: 15 }, () => 75)))
  assert.ok(weightTrend(quince) !== null)
})

test('calcula el ritmo en kg por semana', () => {
  // 28 días subiendo 0.05 kg al día = 1.4 kg en total = 0.35 kg por semana.
  const pesos = Array.from({ length: 29 }, (_, i) => 75 + i * 0.05)
  const trend = weightTrend(weightSeries(diario('2026-08-01', pesos)))

  assert.ok(trend)
  assert.equal(trend.spanDays, 28)
  assert.ok(Math.abs(trend.kgPerWeek - 0.35) < 0.05, `esperaba ~0.35, dio ${trend.kgPerWeek}`)
})

test('detecta la bajada con signo negativo', () => {
  const pesos = Array.from({ length: 29 }, (_, i) => 80 - i * 0.05)
  const trend = weightTrend(weightSeries(diario('2026-08-01', pesos)))

  assert.ok(trend)
  assert.ok(trend.kgPerWeek < 0, 'perder peso tiene que dar ritmo negativo')
})

test('el peso estable da un ritmo de cero', () => {
  const pesos = Array.from({ length: 29 }, () => 75)
  const trend = weightTrend(weightSeries(diario('2026-08-01', pesos)))

  assert.ok(trend)
  assert.equal(trend.kgPerWeek, 0)
})

test('solo mira la ventana pedida, no todo el historial', () => {
  // Tres meses: dos subiendo fuerte y el último plano. La tendencia reciente es plana.
  const subida = Array.from({ length: 60 }, (_, i) => 70 + i * 0.1)
  const plano = Array.from({ length: 30 }, () => 76)
  const s = weightSeries(diario('2026-05-01', [...subida, ...plano]))

  const reciente = weightTrend(s, 28)
  assert.ok(reciente)
  assert.ok(
    Math.abs(reciente.kgPerWeek) < 0.1,
    `el último mes fue plano, no debería marcar subida (dio ${reciente.kgPerWeek})`,
  )
})

test('sin pesadas, la meta usa el peso escrito a mano', () => {
  assert.equal(effectiveWeight(78, []), 78)
})

test('con pesadas, la meta usa la media y no el peso escrito a mano', () => {
  // El manual se queda obsoleto en cuanto empiezas a pesarte; la media manda.
  const w = diario('2026-08-01', [76, 76.2, 75.8, 76.4, 76, 76.2, 76.4])
  assert.equal(effectiveWeight(70, w), 76.1)
})

test('la meta usa la media, no el número de la báscula de hoy', () => {
  // Un día de +2 kg por sal no debe disparar la meta de proteína.
  const w = diario('2026-08-01', [75, 75, 75, 75, 75, 75, 77])
  assert.equal(effectiveWeight(75, w), 75.3)
})

test('las pesadas borradas no cuentan para la meta', () => {
  const w = [
    ...diario('2026-08-01', [75, 75, 75]),
    { id: '2026-08-04', weightKg: 999, updatedAt: 0, deleted: true },
  ]
  assert.equal(effectiveWeight(75, w), 75)
})

test('la lectura en lenguaje llano cambia según el ritmo', () => {
  assert.equal(readTrend(0.35).tone, 'good')
  assert.equal(readTrend(1.0).tone, 'warn', 'subir demasiado rápido es aviso')
  assert.equal(readTrend(0).tone, 'flat')
  assert.equal(readTrend(-0.4).tone, 'good')
  assert.equal(readTrend(-1.2).tone, 'warn', 'bajar demasiado rápido también')
})
