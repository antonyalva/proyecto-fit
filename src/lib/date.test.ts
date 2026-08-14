import { test } from 'node:test'
import assert from 'node:assert/strict'
import { WEEKDAY_NAME, addDays, currentStreak, daysBetween, weekdayOf } from './date.ts'

test('el lunes es el día 0, como en un calendario español', () => {
  // 2026-08-10 fue lunes. Date.getDay() diría 1; aquí tiene que decir 0.
  assert.equal(weekdayOf('2026-08-10'), 0)
  assert.equal(WEEKDAY_NAME[weekdayOf('2026-08-10')], 'lunes')
})

test('el domingo es el día 6, no el 0', () => {
  // El error clásico: getDay() devuelve 0 para domingo y lo pondría el primero.
  assert.equal(weekdayOf('2026-08-16'), 6)
  assert.equal(WEEKDAY_NAME[weekdayOf('2026-08-16')], 'domingo')
})

test('la semana completa sale en orden', () => {
  const dias = ['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13',
                '2026-08-14', '2026-08-15', '2026-08-16']
  assert.deepEqual(dias.map(weekdayOf), [0, 1, 2, 3, 4, 5, 6])
})

test('sumar días cruza el cambio de mes', () => {
  assert.equal(addDays('2026-08-30', 3), '2026-09-02')
  assert.equal(addDays('2026-01-01', -1), '2025-12-31')
})

test('sumar días cruza un año bisiesto', () => {
  assert.equal(addDays('2028-02-28', 1), '2028-02-29')
})

test('la distancia entre días no la altera el cambio de hora', () => {
  // En España el reloj cambia la última madrugada de marzo y de octubre. Restando
  // milisegundos en hora local, ese día "dura" 23 h y el resultado se iría a 0.
  assert.equal(daysBetween('2026-03-28', '2026-03-29'), 1)
  assert.equal(daysBetween('2026-10-24', '2026-10-25'), 1)
})

test('la racha cuenta los días consecutivos hasta hoy', () => {
  const dates = ['2026-08-09', '2026-08-10', '2026-08-11']
  assert.equal(currentStreak(dates, '2026-08-11'), 3)
})

test('la racha sigue viva si tomaste ayer y hoy aún no toca', () => {
  assert.equal(currentStreak(['2026-08-10'], '2026-08-11'), 1)
})

test('la racha se rompe si te saltaste un día entero', () => {
  assert.equal(currentStreak(['2026-08-08', '2026-08-09'], '2026-08-11'), 0)
})
