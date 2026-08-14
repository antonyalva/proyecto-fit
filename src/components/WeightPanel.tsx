import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { useToast } from '../toast'
import { MIN_TREND_DAYS, readTrend, weightSeries, weightTrend } from '../lib/weight'
import { formatShort, todayKey } from '../lib/date'

export function WeightPanel() {
  const { view, addWeighIn, removeWeighIn } = useStore()
  const toast = useToast()
  const [value, setValue] = useState('')

  const today = todayKey()
  const series = useMemo(() => weightSeries(view.weighIns), [view.weighIns])
  const trend = useMemo(() => weightTrend(series), [series])

  const last = series[series.length - 1]
  const weighedToday = series.some((p) => p.date === today)
  const reading = trend ? readTrend(trend.kgPerWeek) : null

  // Días que faltan para que la tendencia signifique algo.
  const spanSoFar = series.length > 1 ? series.length : 0
  const missingDays = Math.max(0, MIN_TREND_DAYS - spanSoFar)

  function submit() {
    const kg = Number(value)
    if (!(kg > 0)) return
    if (kg < 25 || kg > 300) {
      toast('Ese peso no parece correcto')
      return
    }
    addWeighIn(kg)
    setValue('')
    toast(weighedToday ? 'Pesada corregida' : 'Pesada anotada')
  }

  return (
    <div className="card">
      <label htmlFor="weigh">
        {weighedToday ? 'Ya te pesaste hoy — corregir' : 'Peso de hoy (kg)'}
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          id="weigh"
          type="number"
          inputMode="decimal"
          step="0.1"
          placeholder={last ? String(last.weightKg) : '75'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <button className="btn primary" onClick={submit} disabled={!(Number(value) > 0)}>
          Anotar
        </button>
      </div>

      {series.length === 0 ? (
        <p className="row-sub" style={{ marginTop: 12, marginBottom: 0 }}>
          Pésate por la mañana, en ayunas y después de ir al baño. Siempre igual: lo que
          importa no es el número, sino que sea comparable con el de mañana.
        </p>
      ) : (
        <>
          <div className="row" style={{ marginTop: 14 }}>
            <div className="row-main">
              <div className="row-title">Media de 7 días</div>
              <div className="row-sub">
                Último dato {last.weightKg} kg el {formatShort(last.date)} ·{' '}
                {series.length} pesada{series.length > 1 ? 's' : ''}
              </div>
            </div>
            <span className="row-value" style={{ fontSize: 20 }}>
              {last.average} kg
            </span>
          </div>

          {series.length > 1 && <WeightChart series={series} />}

          <div className="row">
            <div className="row-main">
              <div className="row-title">Tendencia</div>
              <div className="row-sub">
                {trend
                  ? `Últimos ${trend.spanDays} días`
                  : `Necesita ${MIN_TREND_DAYS} días de recorrido${missingDays > 0 ? `, faltan ~${missingDays}` : ''}`}
              </div>
            </div>
            <span
              className="row-value"
              style={{
                fontSize: 18,
                color: !reading
                  ? 'var(--muted)'
                  : reading.tone === 'warn'
                    ? 'var(--warn)'
                    : reading.tone === 'good'
                      ? 'var(--accent)'
                      : 'var(--text)',
              }}
            >
              {trend
                ? `${trend.kgPerWeek > 0 ? '+' : ''}${trend.kgPerWeek} kg/sem`
                : '—'}
            </span>
          </div>

          {reading && <p className="row-sub">{reading.text}</p>}

          {!trend && (
            <p className="row-sub">
              Con menos de dos semanas, cualquier cifra sería ruido: el peso oscila un kilo
              largo entre días sin que cambie nada de fondo.
            </p>
          )}

          <details style={{ marginTop: 12 }}>
            <summary className="row-sub" style={{ cursor: 'pointer' }}>
              Ver todas las pesadas
            </summary>
            <div style={{ marginTop: 8 }}>
              {[...series].reverse().map((p) => (
                <div className="row" key={p.date}>
                  <div className="row-main">
                    <div className="row-title">{p.weightKg} kg</div>
                    <div className="row-sub">
                      {formatShort(p.date)} · media {p.average}
                    </div>
                  </div>
                  <button
                    className="btn-icon"
                    aria-label={`Borrar la pesada del ${p.date}`}
                    onClick={() => {
                      removeWeighIn(p.date)
                      toast('Pesada borrada')
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </details>
        </>
      )}
    </div>
  )
}

/**
 * Puntos crudos y línea de media móvil sobre el mismo eje.
 * La dispersión de los puntos frente a la línea es justo lo que hay que ver: enseña
 * cuánto ruido tiene tu báscula y por qué no hay que hacer caso de un día suelto.
 */
function WeightChart({ series }: { series: { date: string; weightKg: number; average: number }[] }) {
  const width = 300
  const height = 90
  const pad = 6

  const values = series.flatMap((p) => [p.weightKg, p.average])
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const x = (i: number) =>
    series.length === 1 ? width / 2 : pad + (i / (series.length - 1)) * (width - pad * 2)
  const y = (v: number) => pad + (1 - (v - min) / range) * (height - pad * 2)

  const line = series.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.average)}`).join(' ')

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: '100%', height: 'auto', margin: '4px 0 12px' }}
      role="img"
      aria-label={`Peso de ${series[0].weightKg} a ${series[series.length - 1].weightKg} kg`}
    >
      {series.map((p, i) => (
        <circle key={p.date} cx={x(i)} cy={y(p.weightKg)} r={2} fill="var(--muted)" opacity={0.55} />
      ))}
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" />
    </svg>
  )
}
