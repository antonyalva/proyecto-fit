import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mergeRows, mergeState, mergeSupplements } from './merge.ts'
import type { AppState, Food, LogEntry, PlanItem, Supplement } from '../types.ts'

function entry(id: string, patch: Partial<LogEntry> = {}): LogEntry {
  return {
    id,
    date: '2026-08-11',
    name: id,
    protein: 20,
    ts: 100,
    updatedAt: 100,
    deleted: false,
    ...patch,
  }
}

function alimento(patch: Partial<Food> = {}): Food {
  return {
    id: 'f-pollo',
    name: 'Pechuga de pollo',
    emoji: '🍗',
    proteinPer100g: 23,
    defaultPortionG: 150,
    category: 'carnes',
    updatedAt: 0,
    deleted: false,
    ...patch,
  }
}

function supplement(patch: Partial<Supplement> = {}): Supplement {
  return {
    id: 'whey',
    name: 'Nitro Whey',
    unitLabel: 'scoop',
    servingsTotal: 33,
    servingsLeft: 33,
    servingsPerDay: 1,
    gramsPerServing: 30,
    proteinPerServing: 22,
    takenDates: [],
    updatedAt: 0,
    deleted: false,
    ...patch,
  }
}

function state(patch: Partial<AppState> = {}): AppState {
  return {
    profile: { weightKg: 75, goal: 'ganar', gPerKg: 1.9, updatedAt: 0 },
    foods: [],
    meals: [],
    planItems: [],
    log: [],
    weighIns: [],
    supplements: [],
    ...patch,
  }
}

test('conserva los registros de ambos dispositivos', () => {
  const movil = state({ log: [entry('a'), entry('b')] })
  const servidor = { log: [entry('c')] }

  assert.deepEqual(
    mergeState(movil, servidor).log.map((e) => e.id).sort(),
    ['a', 'b', 'c'],
    'ningún registro puede desaparecer al fusionar',
  )
})

test('no duplica un registro que ya existe en los dos lados', () => {
  const movil = state({ log: [entry('a')] })
  const servidor = { log: [entry('a'), entry('b')] }

  assert.equal(mergeState(movil, servidor).log.length, 2)
})

test('ordena el registro del más reciente al más antiguo', () => {
  const movil = state({ log: [entry('viejo', { ts: 100 })] })
  const servidor = { log: [entry('nuevo', { ts: 900 })] }

  assert.deepEqual(
    mergeState(movil, servidor).log.map((e) => e.id),
    ['nuevo', 'viejo'],
  )
})

test('un borrado más reciente gana sobre la copia viva del otro dispositivo', () => {
  // El móvil borró "b"; el servidor aún tiene su versión anterior, sin borrar.
  const movil = state({ log: [entry('b', { deleted: true, updatedAt: 500 })] })
  const servidor = { log: [entry('b', { deleted: false, updatedAt: 100 })] }

  assert.equal(mergeState(movil, servidor).log[0].deleted, true)
})

test('el borrado se propaga también del servidor al dispositivo', () => {
  const movil = state({ log: [entry('b', { deleted: false, updatedAt: 100 })] })
  const servidor = { log: [entry('b', { deleted: true, updatedAt: 500 })] }

  assert.equal(mergeState(movil, servidor).log[0].deleted, true)
})

test('una edición posterior al borrado lo resucita', () => {
  // Importante que sea así: la última acción del usuario es la que manda.
  const movil = state({ log: [entry('b', { deleted: false, updatedAt: 900 })] })
  const servidor = { log: [entry('b', { deleted: true, updatedAt: 100 })] }

  assert.equal(mergeState(movil, servidor).log[0].deleted, false)
})

test('en un suplemento tocado en los dos sitios gana el más reciente', () => {
  const merged = mergeSupplements(
    [supplement({ servingsLeft: 30, updatedAt: 500 })],
    [supplement({ servingsLeft: 32, updatedAt: 100 })],
  )
  assert.equal(merged[0].servingsLeft, 30)
})

test('las fechas de toma se unen aunque el suplemento pierda', () => {
  // La racha es un histórico: sincronizar no puede romperla descartando el lado perdedor.
  const merged = mergeSupplements(
    [supplement({ takenDates: ['2026-08-10'], updatedAt: 500 })],
    [supplement({ takenDates: ['2026-08-09', '2026-08-11'], updatedAt: 100 })],
  )
  assert.deepEqual(merged[0].takenDates, ['2026-08-09', '2026-08-10', '2026-08-11'])
})

test('el perfil editado más recientemente gana', () => {
  const movil = state({ profile: { weightKg: 78, goal: 'ganar', gPerKg: 1.9, updatedAt: 900 } })
  const servidor = {
    profile: { weightKg: 75, goal: 'definir' as const, gPerKg: 2.2, updatedAt: 100 },
  }

  assert.equal(mergeState(movil, servidor).profile.weightKg, 78)
})

test('una descarga incremental vacía no toca nada', () => {
  // El caso normal: casi todas las sincronizaciones no traen filas nuevas.
  const movil = state({ log: [entry('a')], supplements: [supplement()] })

  const merged = mergeState(movil, { log: [], foods: [], supplements: [] })

  assert.deepEqual(merged.log, movil.log)
  assert.deepEqual(merged.supplements, movil.supplements)
  assert.deepEqual(merged.profile, movil.profile)
})

test('un dispositivo nuevo y vacío recibe todo el historial del servidor', () => {
  const portatilNuevo = state()
  const servidor = {
    log: [entry('a')],
    supplements: [supplement()],
    profile: { weightKg: 78, goal: 'ganar' as const, gPerKg: 2.0, updatedAt: 500 },
  }

  const merged = mergeState(portatilNuevo, servidor)

  assert.equal(merged.log.length, 1)
  assert.equal(merged.supplements.length, 1)
  assert.equal(merged.profile.weightKg, 78)
})

test('fusionar dos veces da el mismo resultado', () => {
  const movil = state({ log: [entry('a')] })
  const servidor = { log: [entry('b', { ts: 200, updatedAt: 200 })] }

  const once = mergeState(movil, servidor)
  const twice = mergeState(once, servidor)

  assert.deepEqual(twice, once, 'sincronizar repetidamente no debe cambiar nada')
})

test('el catálogo de fábrica de un dispositivo nuevo no pisa lo editado en el servidor', () => {
  // Este es el caso que obliga a bajar antes de subir en la primera sincronización.
  // El alimento de fábrica llega con updatedAt 0, así que cualquier edición real gana.
  const portatilNuevo = state({
    foods: [alimento({ proteinPer100g: 23, defaultPortionG: 150, updatedAt: 0 })],
  })
  const servidor = {
    foods: [alimento({ proteinPer100g: 31, defaultPortionG: 200, updatedAt: 5000 })],
  }

  const merged = mergeState(portatilNuevo, servidor)

  assert.equal(merged.foods[0].proteinPer100g, 31, 'gana lo que editaste, no el valor de fábrica')
  assert.equal(merged.foods[0].defaultPortionG, 200)
})

test('un alimento borrado en el móvil no revive al instalar en el portátil', () => {
  const portatilNuevo = state({ foods: [alimento({ id: 'f-leche', updatedAt: 0 })] })
  const servidor = {
    foods: [alimento({ id: 'f-leche', updatedAt: 5000, deleted: true })],
  }

  assert.equal(mergeState(portatilNuevo, servidor).foods[0].deleted, true)
})

test('las comidas del plan quedan ordenadas por su hora del día, no por id', () => {
  const meal = (id: string, name: string, order: number) => ({
    id, name, order, updatedAt: 0, deleted: false,
  })
  const movil = state({ meals: [meal('m-cena', 'Cena', 3)] })
  const servidor = {
    meals: [meal('m-desayuno', 'Desayuno', 0), meal('m-comida', 'Comida', 1)],
  }

  assert.deepEqual(
    mergeState(movil, servidor).meals.map((m) => m.name),
    ['Desayuno', 'Comida', 'Cena'],
  )
})

const linea = (patch: Partial<PlanItem> = {}): PlanItem => ({
  id: 'pi-1',
  mealId: 'm-comida',
  foodId: 'f-pollo',
  grams: 150,
  days: [0, 1, 2, 3, 4, 5, 6],
  updatedAt: 0,
  deleted: false,
  ...patch,
})

test('cambiar la cantidad de una línea del plan en un dispositivo gana en el otro', () => {
  const movil = state({ planItems: [linea({ grams: 200, updatedAt: 900 })] })
  const servidor = { planItems: [linea({ grams: 150, updatedAt: 100 })] }

  assert.equal(mergeState(movil, servidor).planItems[0].grams, 200)
})

test('cambiar los días de una línea gana entera, sin mezclar los dos lados', () => {
  // Los días son una elección, no un histórico: unirlos daría un plan que nadie pidió.
  const movil = state({ planItems: [linea({ days: [0, 2, 4], updatedAt: 900 })] })
  const servidor = { planItems: [linea({ days: [1, 3], updatedAt: 100 })] }

  assert.deepEqual(mergeState(movil, servidor).planItems[0].days, [0, 2, 4])
})

test('pesarte el mismo día en dos dispositivos deja una sola pesada', () => {
  // El id es la fecha, así que la misma jornada no puede duplicarse: gana la más reciente.
  const bascula = (kg: number, updatedAt: number) => ({
    id: '2026-08-11', weightKg: kg, updatedAt, deleted: false,
  })
  const movil = state({ weighIns: [bascula(76.4, 900)] })
  const servidor = { weighIns: [bascula(76.1, 100)] }

  const merged = mergeState(movil, servidor)
  assert.equal(merged.weighIns.length, 1)
  assert.equal(merged.weighIns[0].weightKg, 76.4)
})

test('mergeRows mantiene la fila local cuando los tiempos empatan', () => {
  // Sin desempate estable, dos dispositivos podrían quedarse alternando valores.
  const merged = mergeRows(
    [{ id: 'x', updatedAt: 100, valor: 'local' }],
    [{ id: 'x', updatedAt: 100, valor: 'remoto' }],
  )
  assert.equal(merged[0].valor, 'local')
})
