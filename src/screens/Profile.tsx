import { useMemo, useRef } from 'react'
import { useStore } from '../store'
import { useToast } from '../toast'
import { DEFAULT_STATE, exportState, parseImport } from '../lib/storage'
import { G_PER_KG, GOAL_LABEL, dailyTarget } from '../lib/nutrition'
import { addDays, formatShort, todayKey } from '../lib/date'
import { Account } from '../components/Account'
import { WeightPanel } from '../components/WeightPanel'
import type { Goal } from '../types'

const GOALS: Goal[] = ['definir', 'mantener', 'ganar']

export function Profile() {
  const { state, weightKg, view, setProfile, replaceState } = useStore()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)

  const target = dailyTarget(weightKg, state.profile.gPerKg)

  const history = useMemo(() => {
    const today = todayKey()
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(today, i - 6)
      const total = view.log
        .filter((e) => e.date === date)
        .reduce((sum, e) => sum + e.protein, 0)
      return { date, total }
    })
  }, [view.log])

  const logged = history.filter((d) => d.total > 0)
  const average = logged.length
    ? Math.round(logged.reduce((sum, d) => sum + d.total, 0) / logged.length)
    : 0

  function download() {
    const blob = new Blob([exportState(state)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `proteina-${todayKey()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function upload(file: File) {
    const next = parseImport(await file.text())
    if (!next) {
      toast('Ese archivo no es una copia válida')
      return
    }
    if (window.confirm('Esto reemplaza todos tus datos actuales. ¿Seguir?')) {
      replaceState(next)
      toast('Copia restaurada')
    }
  }

  return (
    <>
      <h1>Perfil</h1>
      <p className="sub">Tu peso, tu objetivo y de ahí tu meta diaria de proteína.</p>

      <h2>Peso</h2>
      <WeightPanel />

      <h2>Objetivo</h2>
      <div className="card">
        {view.weighIns.length === 0 ? (
          <div className="field">
            <label htmlFor="weight">Peso corporal (kg)</label>
            <input
              id="weight"
              type="number"
              inputMode="decimal"
              value={state.profile.weightKg}
              onChange={(e) => setProfile({ weightKg: Number(e.target.value) || 0 })}
            />
            <p className="row-sub" style={{ marginTop: 8 }}>
              En cuanto anotes tu primera pesada arriba, la meta pasará a usar tu media de
              7 días y este campo dejará de hacer falta.
            </p>
          </div>
        ) : (
          <div className="row" style={{ paddingTop: 0 }}>
            <div className="row-main">
              <div className="row-title">Peso corporal</div>
              <div className="row-sub">Tu media de 7 días, no la última pesada</div>
            </div>
            <span className="row-value">{weightKg} kg</span>
          </div>
        )}

        <div className="field">
          <label>Objetivo</label>
          <div className="seg">
            {GOALS.map((g) => (
              <button
                key={g}
                className={state.profile.goal === g ? 'on' : ''}
                onClick={() => setProfile({ goal: g, gPerKg: G_PER_KG[g] })}
              >
                {GOAL_LABEL[g]}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label htmlFor="gperkg">Proteína por kg de peso (g/kg)</label>
          <input
            id="gperkg"
            type="number"
            inputMode="decimal"
            step="0.1"
            value={state.profile.gPerKg}
            onChange={(e) => setProfile({ gPerKg: Number(e.target.value) || 0 })}
          />
          <p className="row-sub" style={{ marginTop: 8 }}>
            El rango con respaldo para ganar músculo es 1.6–2.2 g/kg. En déficit calórico
            conviene el extremo alto para no perder masa magra.
          </p>
        </div>

        <div className="row" style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
          <div className="row-main">
            <div className="row-title">Tu meta diaria</div>
            <div className="row-sub">
              {weightKg} kg × {state.profile.gPerKg} g/kg
            </div>
          </div>
          <span className="row-value" style={{ fontSize: 20 }}>
            {target} g
          </span>
        </div>
      </div>

      <h2>Últimos 7 días</h2>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 90 }}>
          {history.map((d) => {
            const ratio = target > 0 ? Math.min(1.15, d.total / target) : 0
            const hit = d.total >= target && target > 0
            return (
              <div key={d.date} style={{ flex: 1, textAlign: 'center' }}>
                <div
                  title={`${formatShort(d.date)}: ${Math.round(d.total)} g`}
                  style={{
                    height: `${Math.max(3, ratio * 70)}px`,
                    background: hit ? 'var(--accent)' : 'var(--surface-2)',
                    borderRadius: 5,
                    border: hit ? 'none' : '1px solid var(--line)',
                  }}
                />
                <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6 }}>
                  {formatShort(d.date).split(' ')[0]}
                </div>
              </div>
            )
          })}
        </div>
        <p className="row-sub" style={{ marginTop: 12 }}>
          {average > 0 ? (
            <>
              Media de <strong style={{ color: 'var(--text)' }}>{average} g</strong> en los días
              con registro. El total diario sostenido pesa mucho más que cualquier día suelto.
            </>
          ) : (
            'Sin registros esta semana todavía.'
          )}
        </p>
      </div>

      <h2>Cuenta y sincronización</h2>
      <Account />

      <h2>Copia de seguridad</h2>
      <div className="card">
        <p className="row-sub" style={{ marginTop: 0, marginBottom: 14 }}>
          Un archivo tuyo, independiente de la nube. Útil aunque uses sincronización: te deja
          volver atrás si borras algo por error.
        </p>
        <div className="btn-row">
          <button className="btn" onClick={download}>
            Exportar
          </button>
          <button className="btn ghost" onClick={() => fileRef.current?.click()}>
            Importar
          </button>
          <button
            className="btn ghost danger"
            onClick={() => {
              if (window.confirm('¿Borrar todos los datos y empezar de cero?')) {
                replaceState(DEFAULT_STATE)
                toast('Datos borrados')
              }
            }}
          >
            Borrar todo
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void upload(file)
            e.target.value = ''
          }}
        />
      </div>
    </>
  )
}
