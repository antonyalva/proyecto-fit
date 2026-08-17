import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  dailyTarget,
  formatQuantity,
  gramsFromUnits,
  isUnitFood,
  perServingTarget,
  proteinFor,
  unitsFromGrams,
} from './nutrition.ts'
import type { Food } from '../types.ts'

const pollo: Food = {
  id: 'f-pollo',
  name: 'Pechuga de pollo',
  emoji: '🍗',
  proteinPer100g: 23,
  defaultPortionG: 150,
  category: 'otros',
  updatedAt: 0,
  deleted: false,
}

const platano: Food = {
  id: 'f-platano',
  name: 'Plátano',
  emoji: '🍌',
  proteinPer100g: 1.1,
  defaultPortionG: 118,
  category: 'frutas',
  unitLabel: 'plátano',
  unitGrams: 118,
  updatedAt: 0,
  deleted: false,
}

test('la proteína escala con la cantidad', () => {
  assert.equal(proteinFor(pollo, 100), 23)
  assert.equal(proteinFor(pollo, 150), 34.5)
  assert.equal(proteinFor(pollo, 200), 46)
})

test('media ración es media proteína, salvo el redondeo a una décima', () => {
  // 23 g/100 g × 75 g = 17.25, que se guarda como 17.3. La diferencia con la mitad
  // exacta es de 0.05 g: irrelevante frente al error de pesar la comida a ojo.
  assert.equal(proteinFor(pollo, 75), 17.3)
  // La tolerancia es una décima, que es la precisión que promete la función.
  assert.ok(Math.abs(proteinFor(pollo, 75) - proteinFor(pollo, 150) / 2) <= 0.1)
})

test('cantidad cero no aporta nada', () => {
  assert.equal(proteinFor(pollo, 0), 0)
})

test('redondea a una décima en vez de arrastrar decimales', () => {
  const leche: Food = { ...pollo, proteinPer100g: 3.4, name: 'Leche' }
  assert.equal(proteinFor(leche, 250), 8.5)
})

test('la meta diaria sale del peso y los g/kg', () => {
  assert.equal(dailyTarget(75, 1.9), 143)
  assert.equal(dailyTarget(80, 2.2), 176)
})

test('el objetivo por toma se queda dentro del rango útil de 20 a 40 g', () => {
  assert.equal(perServingTarget(50), 20, 'una persona ligera no baja de 20 g')
  assert.equal(perServingTarget(75), 23)
  assert.equal(perServingTarget(200), 40, 'una persona muy pesada no pasa de 40 g')
})

test('un alimento por gramos no es "por unidades"', () => {
  assert.equal(isUnitFood(pollo), false)
})

test('un alimento con nombre y peso de unidad sí lo es', () => {
  assert.equal(isUnitFood(platano), true)
})

test('faltando la mitad del par no cuenta como "por unidades"', () => {
  // Un nombre de unidad sin su peso no sirve para calcular nada, y viceversa.
  assert.equal(isUnitFood({ ...platano, unitGrams: undefined }), false)
  assert.equal(isUnitFood({ ...platano, unitLabel: undefined }), false)
  assert.equal(isUnitFood({ ...platano, unitGrams: 0 }), false)
})

test('convierte unidades a gramos y de vuelta sin perder la cantidad', () => {
  assert.equal(gramsFromUnits(platano, 2), 236)
  assert.equal(unitsFromGrams(platano, 236), 2)
  assert.equal(unitsFromGrams(platano, 118), 1)
})

test('un alimento por gramos no convierte nada: no tiene unidad que valga', () => {
  assert.equal(gramsFromUnits(pollo, 2), 0)
  assert.equal(unitsFromGrams(pollo, 300), 0)
})

test('formatQuantity muestra gramos para lo que se pesa', () => {
  assert.equal(formatQuantity(pollo, 150), '150 g')
})

test('formatQuantity muestra unidades para lo que se cuenta', () => {
  assert.equal(formatQuantity(platano, 118), '1 × plátano (118 g)')
  assert.equal(formatQuantity(platano, 236), '2 × plátano (236 g)')
})

test('formatQuantity redondea unidades fraccionarias a una décima', () => {
  // Media unidad real (59 g de un plátano de 118 g) debe leerse "0.5 × plátano", no "0.4999...".
  assert.equal(formatQuantity(platano, 59), '0.5 × plátano (59 g)')
})
