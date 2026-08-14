import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_STATE,
  clearState,
  isPristine,
  loadState,
  saveState,
  stateKey,
} from './storage.ts'
import type { AppState } from '../types.ts'

/** localStorage mínimo: node no lo trae y storage.ts lo usa directamente. */
function fakeStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size
    },
  }
}

beforeEach(() => {
  ;(globalThis as { localStorage: Storage }).localStorage = fakeStorage() as unknown as Storage
})

const conDatos = (nombre: string): AppState => ({
  ...DEFAULT_STATE,
  profile: { ...DEFAULT_STATE.profile, weightKg: 80, updatedAt: Date.now() },
  log: [
    {
      id: nombre,
      date: '2026-08-12',
      name: nombre,
      protein: 30,
      ts: 1,
      updatedAt: 1,
      deleted: false,
    },
  ],
})

test('cada cuenta escribe en su propia clave', () => {
  assert.equal(stateKey(null), 'protein-tracker/v4')
  assert.equal(stateKey('uid-ana'), 'protein-tracker/v4:uid-ana')
  assert.notEqual(stateKey('uid-ana'), stateKey('uid-luis'))
})

test('los datos de una cuenta no se ven desde otra', () => {
  saveState(conDatos('pollo de ana'), 'uid-ana')
  saveState(conDatos('atún de luis'), 'uid-luis')

  assert.equal(loadState('uid-ana').log[0].name, 'pollo de ana')
  assert.equal(loadState('uid-luis').log[0].name, 'atún de luis')
})

test('entrar con una cuenta nueva en un dispositivo usado no hereda nada', () => {
  // El fallo que esto previene: los datos del dueño anterior acababan fusionados
  // en la cuenta que entraba, y de ahí subidos a su servidor.
  saveState(conDatos('comida del dueño anterior'), 'uid-ana')

  const recienLlegado = loadState('uid-luis')
  assert.equal(recienLlegado.log.length, 0)
  assert.ok(isPristine(recienLlegado))
})

test('sin sesión se usa el almacén anónimo, separado de las cuentas', () => {
  saveState(conDatos('anónimo'), null)
  saveState(conDatos('de ana'), 'uid-ana')

  assert.equal(loadState(null).log[0].name, 'anónimo')
  assert.equal(loadState('uid-ana').log[0].name, 'de ana')
})

test('borrar los datos de una cuenta no toca los de las demás', () => {
  saveState(conDatos('de ana'), 'uid-ana')
  saveState(conDatos('de luis'), 'uid-luis')
  saveState(conDatos('anónimo'), null)

  clearState('uid-ana')

  assert.equal(loadState('uid-ana').log.length, 0, 'la borrada queda vacía')
  assert.equal(loadState('uid-luis').log[0].name, 'de luis', 'la otra cuenta intacta')
  assert.equal(loadState(null).log[0].name, 'anónimo', 'y el almacén anónimo también')
})

test('el estado recién instalado se reconoce como intacto', () => {
  assert.ok(isPristine(DEFAULT_STATE))
  assert.ok(isPristine(loadState('uid-nuevo')))
})

test('cualquier cosa registrada deja de contar como intacto', () => {
  assert.equal(isPristine(conDatos('algo')), false)
})

test('editar un alimento de fábrica ya cuenta como tocado', () => {
  // Importante para la adopción: si tocaste el catálogo, tus datos no se pisan.
  const editado: AppState = {
    ...DEFAULT_STATE,
    foods: DEFAULT_STATE.foods.map((f, i) => (i === 0 ? { ...f, updatedAt: Date.now() } : f)),
  }
  assert.equal(isPristine(editado), false)
})

test('los formatos antiguos solo migran al almacén anónimo', () => {
  // Son de antes de que existieran las cuentas; adjudicarlos a una sería inventar.
  localStorage.setItem(
    'protein-tracker/v1',
    JSON.stringify({ profile: { weightKg: 90 }, log: [], presets: [], deletedIds: [] }),
  )

  assert.equal(loadState(null).profile.weightKg, 90, 'el anónimo sí lo hereda')
  assert.equal(
    loadState('uid-ana').profile.weightKg,
    DEFAULT_STATE.profile.weightKg,
    'una cuenta no',
  )
})
