import { test } from 'node:test'
import assert from 'node:assert/strict'
import { suggestForGap } from './suggest.ts'
import type { Food } from '../types.ts'

function food(id: string, proteinPer100g: number, defaultPortionG: number): Food {
  return {
    id,
    name: id,
    emoji: '🍽️',
    proteinPer100g,
    defaultPortionG,
    category: 'otros',
    updatedAt: 0,
    deleted: false,
  }
}

const atun = food('f-atun', 25, 80)
const pollo = food('f-pollo', 23, 150)
const whey = food('f-whey', 80, 30)
const quinua = food('f-quinua', 4.4, 200)

test('calcula la cantidad exacta que cierra el hueco', () => {
  // 25 g/100 g × 80 g = 20 g justos.
  const [best] = suggestForGap(20, [atun])
  assert.equal(best.grams, 80)
  assert.equal(best.protein, 20)
})

test('sin hueco no sugiere nada', () => {
  assert.deepEqual(suggestForGap(0, [atun, pollo]), [])
  assert.deepEqual(suggestForGap(-15, [atun, pollo]), [])
})

test('descarta lo que es demasiado flojo en proteína', () => {
  // Cerrar 30 g con quinua cocida serían casi 700 g de quinua.
  assert.deepEqual(suggestForGap(30, [quinua]), [])
})

test('no propone raciones absurdas aunque no cierre el hueco', () => {
  // 130 g de proteína no salen de un solo alimento; el tope es el doble de ración.
  const [best] = suggestForGap(130, [pollo])
  assert.equal(best.grams, 300, 'se queda en el doble de la ración habitual')
  assert.ok(best.protein < 130, 'y se reconoce que no llega')
})

test('respeta un mínimo por ración en huecos pequeños', () => {
  // 2 g de proteína son 2.5 g de polvo: no es una toma, es polvo en el vaso.
  const [best] = suggestForGap(2, [whey])
  assert.ok(best.grams >= 10, `esperaba al menos 10 g, dio ${best.grams}`)
})

test('ordena por lo que mejor encaja con el hueco', () => {
  const s = suggestForGap(24, [pollo, whey, atun])
  // 30 g de polvo dan exactamente 24 g.
  assert.equal(s[0].food.id, 'f-whey')
  assert.equal(s[0].protein, 24)
})

test('lo que ya comes ese día pasa al final, pero no desaparece', () => {
  const s = suggestForGap(20, [atun, pollo], ['f-atun'])
  assert.equal(s[0].food.id, 'f-pollo', 'primero algo distinto')
  assert.ok(
    s.some((x) => x.food.id === 'f-atun'),
    'el repetido sigue disponible por si el catálogo es corto',
  )
})

test('devuelve como mucho el número pedido', () => {
  const many = Array.from({ length: 10 }, (_, i) => food(`f-${i}`, 20 + i, 100))
  assert.equal(suggestForGap(25, many, [], 3).length, 3)
})

test('las cantidades salen redondeadas a 5 g', () => {
  // Nadie pesa 83 g de atún: se redondea a algo que se pueda servir.
  for (const s of suggestForGap(21, [atun, pollo, whey])) {
    assert.equal(s.grams % 5, 0, `${s.food.id} dio ${s.grams} g`)
  }
})
