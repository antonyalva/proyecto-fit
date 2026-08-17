import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { useToast } from '../toast'
import { ProgressRing } from '../components/ProgressRing'
import { SyncBanner } from '../components/SyncBanner'
import {
  dailyTarget,
  formatQuantity,
  gramsFromUnits,
  isUnitFood,
  perServingTarget,
  proteinFor,
  unitsFromGrams,
} from '../lib/nutrition'
import { CATEGORY_LABEL, CATEGORY_ORDER } from '../lib/storage'
import { addDays, todayKey } from '../lib/date'
import type { Food } from '../types'

const SUELTA = '__suelta__'

function FoodButton({ food, onPick }: { food: Food; onPick: (f: Food) => void }) {
  return (
    <button className="preset" onClick={() => onPick(food)}>
      <span className="preset-emoji">{food.emoji}</span>
      <span>
        <span className="preset-name">{food.name}</span>
        <span className="preset-grams" style={{ display: 'block' }}>
          {formatQuantity(food, food.defaultPortionG)} · {proteinFor(food, food.defaultPortionG)} g prot.
        </span>
      </span>
    </button>
  )
}

export function Today({ onGoToProfile }: { onGoToProfile: () => void }) {
  const { state, weightKg, view, addEntry, addFoodEntry, removeEntry, takeSupplement } =
    useStore()
  const toast = useToast()

  const [foodId, setFoodId] = useState(SUELTA)
  const [amount, setAmount] = useState('')

  const today = todayKey()
  const entries = useMemo(() => view.log.filter((e) => e.date === today), [view.log, today])
  const total = entries.reduce((sum, e) => sum + e.protein, 0)
  const target = dailyTarget(weightKg, state.profile.gPerKg)
  const left = target - total

  const pending = view.supplements.filter(
    (s) => !s.takenDates.includes(today) && s.servingsLeft > 0,
  )

  const chosen = view.foods.find((f) => f.id === foodId) ?? null
  const chosenIsUnit = chosen ? isUnitFood(chosen) : false
  const amountNum = Number(amount)
  // Lo que teclea el usuario se interpreta como unidades o como gramos sueltos
  // según el alimento — pero por dentro siempre se guarda en gramos.
  const grams = chosen && chosenIsUnit ? gramsFromUnits(chosen, amountNum) : amountNum
  const preview = chosen && amountNum > 0 ? proteinFor(chosen, grams) : null

  function pick(food: Food) {
    addFoodEntry(food, food.defaultPortionG)
    toast(`${formatQuantity(food, food.defaultPortionG)} · +${proteinFor(food, food.defaultPortionG)} g`)
  }

  /** Los seis que más has registrado en las últimas semanas. */
  const frequent = useMemo(() => {
    const since = addDays(today, -28)
    const counts = new Map<string, number>()
    for (const e of view.log) {
      if (e.date < since || !e.foodId) continue
      counts.set(e.foodId, (counts.get(e.foodId) ?? 0) + 1)
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([id]) => view.foods.find((f) => f.id === id))
      .filter((f): f is Food => f !== undefined)
  }, [view.log, view.foods, today])

  const groups = useMemo(() => {
    const frequentIds = new Set(frequent.map((f) => f.id))
    return CATEGORY_ORDER.map((category) => ({
      category,
      foods: view.foods.filter((f) => f.category === category && !frequentIds.has(f.id)),
    })).filter((g) => g.foods.length > 0)
  }, [view.foods, frequent])

  /**
   * "1 × plátano (118 g)" si el alimento sigue en el catálogo, o el gramaje
   * suelto si se borró después de registrarlo — no hay de dónde sacar la unidad.
   */
  function quantityLabel(entry: (typeof entries)[number]): string {
    const food = entry.foodId ? view.foods.find((f) => f.id === entry.foodId) : null
    return food && entry.grams ? formatQuantity(food, entry.grams) : `${entry.grams} g`
  }

  function submitCustom() {
    if (!(amountNum > 0)) return
    if (chosen) {
      addFoodEntry(chosen, grams)
      toast(`${formatQuantity(chosen, grams)} · +${proteinFor(chosen, grams)} g`)
    } else {
      addEntry('Proteína suelta', Math.round(amountNum * 10) / 10)
      toast(`+${Math.round(amountNum)} g`)
    }
    setAmount('')
  }

  return (
    <>
      <h1>Hoy</h1>
      <p className="sub">
        Meta {target} g · {weightKg} kg × {state.profile.gPerKg} g/kg
      </p>

      <SyncBanner onFix={onGoToProfile} />

      <div className="card">
        <div className="ring-wrap">
          <ProgressRing value={total} max={target} />
          <div>
            <div className="ring-label">
              {Math.round(total)} <span>/ {target} g</span>
            </div>
            <p className="ring-note">
              {left > 0 ? (
                <>
                  Te faltan <strong>{Math.round(left)} g</strong>. Eso son{' '}
                  {Math.ceil(left / perServingTarget(weightKg))} tomas de{' '}
                  ~{perServingTarget(weightKg)} g.
                </>
              ) : (
                <>
                  Meta cumplida. Vas <strong>{Math.round(-left)} g</strong> por encima, que no
                  es problema: el exceso de proteína no engorda por sí solo.
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {pending.length > 0 && (
        <>
          <h2>Pendiente hoy</h2>
          <div className="card">
            {pending.map((s) => (
              <div className="row" key={s.id}>
                <div className="row-main">
                  <div className="row-title">{s.name}</div>
                  <div className="row-sub">
                    {s.gramsPerServing} g por {s.unitLabel}
                    {s.proteinPerServing > 0 && ` · ${s.proteinPerServing} g de proteína`}
                  </div>
                </div>
                <button
                  className="btn primary"
                  onClick={() => {
                    takeSupplement(s.id)
                    toast(`${s.name} ✓`)
                  }}
                >
                  Tomar
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <h2>Añadir</h2>
      {view.foods.length === 0 ? (
        <div className="card">
          <p className="empty">
            No tienes alimentos en el catálogo.
            <br />
            Créalos en la pestaña Comida.
          </p>
        </div>
      ) : (
        <>
          {/*
            Lo que más repites, arriba y sin desplegar: con un catálogo de
            treinta y tantos, buscar el pollo cada día sería peor que antes.
          */}
          {frequent.length > 0 && (
            <div className="preset-grid" style={{ marginBottom: 12 }}>
              {frequent.map((f) => (
                <FoodButton key={f.id} food={f} onPick={pick} />
              ))}
            </div>
          )}

          {groups.map((group) => (
            <details className="group" key={group.category}>
              <summary>
                <span className="group-name">{CATEGORY_LABEL[group.category]}</span>
                <span className="group-count">{group.foods.length}</span>
              </summary>
              <div className="preset-grid">
                {group.foods.map((f) => (
                  <FoodButton key={f.id} food={f} onPick={pick} />
                ))}
              </div>
            </details>
          ))}
        </>
      )}

      <div className="card" style={{ marginTop: 12 }}>
        <div className="field">
          <label htmlFor="pick">Otra cantidad</label>
          <select id="pick" value={foodId} onChange={(e) => setFoodId(e.target.value)}>
            <option value={SUELTA}>Proteína suelta (en gramos)</option>
            {view.foods.map((f) => (
              <option key={f.id} value={f.id}>
                {f.emoji} {f.name}
              </option>
            ))}
          </select>
        </div>

        <label htmlFor="amount">
          {chosen
            ? chosenIsUnit
              ? `Cantidad (${chosen.unitLabel})`
              : `Gramos de ${chosen.name.toLowerCase()}`
            : 'Gramos de proteína'}
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            id="amount"
            type="number"
            inputMode="decimal"
            step={chosenIsUnit ? '0.5' : undefined}
            placeholder={
              chosen
                ? chosenIsUnit
                  ? String(unitsFromGrams(chosen, chosen.defaultPortionG))
                  : String(chosen.defaultPortionG)
                : '25'
            }
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitCustom()}
          />
          <button className="btn primary" onClick={submitCustom} disabled={!(amountNum > 0)}>
            Sumar
          </button>
        </div>
        {preview !== null && chosen && (
          <p className="row-sub" style={{ marginTop: 8 }}>
            {formatQuantity(chosen, grams)} de {chosen.name.toLowerCase()} son{' '}
            <strong style={{ color: 'var(--text)' }}>{preview} g</strong> de proteína.
          </p>
        )}
      </div>

      <h2>Registro de hoy</h2>
      <div className="card">
        {entries.length === 0 ? (
          <p className="empty">Nada registrado todavía.</p>
        ) : (
          entries.map((e) => (
            <div className="row" key={e.id}>
              <div className="row-main">
                <div className="row-title">{e.name}</div>
                <div className="row-sub">
                  {e.grams ? `${quantityLabel(e)} · ` : ''}
                  {new Date(e.ts).toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              </div>
              <span className="row-value">{e.protein} g</span>
              <button
                className="btn-icon"
                aria-label={`Borrar ${e.name}`}
                onClick={() => removeEntry(e.id)}
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
    </>
  )
}
