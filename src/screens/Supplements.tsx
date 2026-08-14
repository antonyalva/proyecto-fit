import { useState } from 'react'
import { useStore } from '../store'
import { useToast } from '../toast'
import { addDays, currentStreak, formatShort, todayKey } from '../lib/date'
import type { Supplement } from '../types'

const BLANK = {
  name: '',
  unitLabel: 'scoop',
  servingsTotal: '',
  servingsPerDay: '1',
  gramsPerServing: '30',
  proteinPerServing: '0',
}

export function Supplements() {
  const { view, takeSupplement, refillSupplement, removeSupplement, addSupplement } = useStore()
  const toast = useToast()
  const [form, setForm] = useState(BLANK)
  const [open, setOpen] = useState(false)

  const today = todayKey()

  function submit() {
    const servings = Number(form.servingsTotal)
    const perDay = Number(form.servingsPerDay)
    if (!form.name.trim() || !(servings > 0) || !(perDay > 0)) return
    addSupplement({
      name: form.name.trim(),
      unitLabel: form.unitLabel.trim() || 'toma',
      servingsTotal: servings,
      servingsLeft: servings,
      servingsPerDay: perDay,
      gramsPerServing: Number(form.gramsPerServing) || 0,
      proteinPerServing: Number(form.proteinPerServing) || 0,
    })
    setForm(BLANK)
    setOpen(false)
    toast('Suplemento añadido')
  }

  return (
    <>
      <h1>Suplementos</h1>
      <p className="sub">Cuánto te queda y cuándo tienes que reponer.</p>

      {view.supplements.length === 0 && !open && (
        <div className="card">
          <p className="empty">
            Sin suplementos todavía.
            <br />
            Añade tu proteína y tu creatina para ver cuántos días te duran.
          </p>
        </div>
      )}

      {view.supplements.map((s) => (
        <SupplementCard
          key={s.id}
          supplement={s}
          today={today}
          onTake={() => {
            takeSupplement(s.id)
            toast(`${s.name} ✓`)
          }}
          onRefill={() => {
            const answer = window.prompt(
              `¿Cuántos ${s.unitLabel}s trae el envase nuevo?`,
              String(s.servingsTotal),
            )
            const servings = Number(answer)
            if (servings > 0) {
              refillSupplement(s.id, servings)
              toast('Inventario repuesto')
            }
          }}
          onRemove={() => {
            if (window.confirm(`¿Borrar "${s.name}"? Se pierde su historial.`)) {
              removeSupplement(s.id)
            }
          }}
        />
      ))}

      {open ? (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Nuevo suplemento</h2>
          <div className="field">
            <label htmlFor="s-name">Nombre</label>
            <input
              id="s-name"
              value={form.name}
              placeholder="Iso Whey 90"
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="field field-pair">
            <div>
              <label htmlFor="s-total">Servicios por envase</label>
              <input
                id="s-total"
                type="number"
                inputMode="numeric"
                placeholder="37"
                value={form.servingsTotal}
                onChange={(e) => setForm({ ...form, servingsTotal: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="s-perday">Tomas al día</label>
              <input
                id="s-perday"
                type="number"
                inputMode="decimal"
                value={form.servingsPerDay}
                onChange={(e) => setForm({ ...form, servingsPerDay: e.target.value })}
              />
            </div>
          </div>
          <div className="field field-pair">
            <div>
              <label htmlFor="s-grams">Gramos por toma</label>
              <input
                id="s-grams"
                type="number"
                inputMode="decimal"
                value={form.gramsPerServing}
                onChange={(e) => setForm({ ...form, gramsPerServing: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="s-protein">Proteína por toma</label>
              <input
                id="s-protein"
                type="number"
                inputMode="decimal"
                value={form.proteinPerServing}
                onChange={(e) => setForm({ ...form, proteinPerServing: e.target.value })}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="s-unit">Cómo llamas a una toma</label>
            <input
              id="s-unit"
              value={form.unitLabel}
              placeholder="scoop"
              onChange={(e) => setForm({ ...form, unitLabel: e.target.value })}
            />
          </div>
          <div className="btn-row">
            <button className="btn primary" onClick={submit}>
              Guardar
            </button>
            <button className="btn ghost" onClick={() => setOpen(false)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button className="btn" style={{ width: '100%' }} onClick={() => setOpen(true)}>
          + Añadir suplemento
        </button>
      )}
    </>
  )
}

interface CardProps {
  supplement: Supplement
  today: string
  onTake: () => void
  onRefill: () => void
  onRemove: () => void
}

function SupplementCard({ supplement: s, today, onTake, onRefill, onRemove }: CardProps) {
  const daysLeft = s.servingsPerDay > 0 ? Math.floor(s.servingsLeft / s.servingsPerDay) : 0
  const restock = addDays(today, daysLeft)
  const ratio = s.servingsTotal > 0 ? s.servingsLeft / s.servingsTotal : 0
  const streak = currentStreak(s.takenDates, today)
  const takenToday = s.takenDates.includes(today)
  const out = s.servingsLeft <= 0
  const low = daysLeft <= 7

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div className="row-main">
          <div className="row-title" style={{ fontSize: 16 }}>
            {s.name}
          </div>
          <div className="row-sub">
            {s.gramsPerServing} g por {s.unitLabel} · {s.servingsPerDay}/día
          </div>
        </div>
        <button className="btn-icon" aria-label={`Borrar ${s.name}`} onClick={onRemove}>
          ×
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 12 }}>
        <span className="big-days">{out ? 0 : daysLeft}</span>
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>
          {daysLeft === 1 ? 'día restante' : 'días restantes'}
        </span>
      </div>

      <div className="bar">
        <div
          className={`bar-fill${out ? ' out' : low ? ' low' : ''}`}
          style={{ width: `${Math.max(0, Math.min(100, ratio * 100))}%` }}
        />
      </div>

      <div className="row-sub" style={{ marginBottom: 12 }}>
        {out ? (
          <span style={{ color: 'var(--danger)' }}>Se acabó. Toca reponer.</span>
        ) : (
          <>
            Quedan {Math.round(s.servingsLeft)} de {s.servingsTotal} · repón antes del{' '}
            {formatShort(restock)}
          </>
        )}
      </div>

      <div className="btn-row" style={{ alignItems: 'center' }}>
        <button className="btn primary" onClick={onTake} disabled={out}>
          {takenToday ? 'Otra toma' : 'Tomar hoy'}
        </button>
        <button className="btn ghost" onClick={onRefill}>
          Reponer
        </button>
        {streak > 0 && (
          <span className={`pill ${takenToday ? 'streak' : 'warn'}`}>
            🔥 {streak} {streak === 1 ? 'día' : 'días'}
          </span>
        )}
        {low && !out && <span className="pill danger">Quedan pocos</span>}
      </div>
    </div>
  )
}
