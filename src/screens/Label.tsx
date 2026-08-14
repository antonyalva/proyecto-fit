import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { useToast } from '../toast'
import { classify, costPerGramProtein, servingsInContainer } from '../lib/labels'

const COMPARE_KEY = 'protein-tracker/compare'

interface Saved {
  name: string
  percent: number
  title: string
  costPerGram: number | null
  servings: number | null
}

export function Label() {
  const { addSupplement } = useStore()
  const toast = useToast()

  const [name, setName] = useState('')
  const [protein, setProtein] = useState('')
  const [serving, setServing] = useState('')
  const [container, setContainer] = useState('')
  const [price, setPrice] = useState('')

  const [saved, setSaved] = useState<Saved[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(COMPARE_KEY) ?? '[]')
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem(COMPARE_KEY, JSON.stringify(saved))
  }, [saved])

  const proteinNum = Number(protein)
  const servingNum = Number(serving)
  const containerNum = Number(container)
  const priceNum = Number(price)

  const verdict = classify(proteinNum, servingNum, name)
  const servings = servingsInContainer(containerNum, servingNum)
  const cost = costPerGramProtein(priceNum, containerNum, proteinNum, servingNum)

  const invalid = proteinNum > 0 && servingNum > 0 && proteinNum > servingNum

  function saveForCompare() {
    if (!verdict) return
    setSaved((prev) =>
      [
        ...prev.filter((p) => p.name !== (name.trim() || 'Sin nombre')),
        {
          name: name.trim() || 'Sin nombre',
          percent: verdict.percent,
          title: verdict.title,
          costPerGram: cost,
          servings,
        },
      ].slice(-4),
    )
    toast('Guardado para comparar')
  }

  function addToSupplements() {
    if (!verdict || !servings) return
    addSupplement({
      name: name.trim() || 'Proteína',
      unitLabel: 'scoop',
      servingsTotal: servings,
      servingsLeft: servings,
      servingsPerDay: 1,
      gramsPerServing: servingNum,
      proteinPerServing: proteinNum,
    })
    toast('Añadido a suplementos')
  }

  const best = saved.length > 1
    ? saved.reduce((a, b) =>
        (a.costPerGram ?? Infinity) <= (b.costPerGram ?? Infinity) ? a : b,
      )
    : null

  return (
    <>
      <h1>Etiqueta</h1>
      <p className="sub">
        Dos cifras de la tabla nutricional y sabes qué estás comprando de verdad.
      </p>

      <div className="card">
        <div className="field">
          <label htmlFor="l-name">Nombre del producto (opcional)</label>
          <input
            id="l-name"
            value={name}
            placeholder="Iso Whey 90"
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="field field-pair">
          <div>
            <label htmlFor="l-protein">Proteína por servicio (g)</label>
            <input
              id="l-protein"
              type="number"
              inputMode="decimal"
              placeholder="24"
              value={protein}
              onChange={(e) => setProtein(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="l-serving">Tamaño del servicio (g)</label>
            <input
              id="l-serving"
              type="number"
              inputMode="decimal"
              placeholder="30"
              value={serving}
              onChange={(e) => setServing(e.target.value)}
            />
          </div>
        </div>
        <div className="field field-pair">
          <div>
            <label htmlFor="l-container">Peso del envase (g)</label>
            <input
              id="l-container"
              type="number"
              inputMode="decimal"
              placeholder="1100"
              value={container}
              onChange={(e) => setContainer(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="l-price">Precio del envase</label>
            <input
              id="l-price"
              type="number"
              inputMode="decimal"
              placeholder="45"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
        </div>
      </div>

      {invalid && (
        <div className="card">
          <p className="empty">
            La proteína por servicio no puede superar el peso del servicio. Revisa si has
            cambiado las dos cifras de sitio.
          </p>
        </div>
      )}

      {verdict && (
        <div className="card">
          <div className="verdict">
            <div className="verdict-pct">{verdict.percent.toFixed(0)}%</div>
            <div className="row-sub" style={{ marginTop: -4 }}>
              de proteína sobre el peso del producto
            </div>
            <div className="verdict-title">{verdict.title}</div>
            <p className="verdict-detail">{verdict.detail}</p>
          </div>

          {verdict.mismatch && <div className="note">⚠️ {verdict.mismatch}</div>}

          {(servings || cost) && (
            <div style={{ marginTop: 16 }}>
              {servings && (
                <div className="row">
                  <div className="row-main">
                    <div className="row-title">Servicios por envase</div>
                    <div className="row-sub">
                      A 1 al día te dura {servings} días
                      {servings >= 30 && ` (unas ${Math.round(servings / 7)} semanas)`}
                    </div>
                  </div>
                  <span className="row-value">{servings}</span>
                </div>
              )}
              {cost && (
                <div className="row">
                  <div className="row-main">
                    <div className="row-title">Coste por gramo de proteína</div>
                    <div className="row-sub">
                      La cifra que compara de verdad, no el precio del bote
                    </div>
                  </div>
                  <span className="row-value">{cost.toFixed(3)}</span>
                </div>
              )}
            </div>
          )}

          <div className="btn-row" style={{ marginTop: 16 }}>
            <button className="btn" onClick={saveForCompare}>
              Guardar para comparar
            </button>
            <button className="btn primary" onClick={addToSupplements} disabled={!servings}>
              Añadir a suplementos
            </button>
          </div>
        </div>
      )}

      {saved.length > 0 && (
        <>
          <h2>Comparativa</h2>
          <div className="card">
            {saved.map((p) => (
              <div className="row" key={p.name}>
                <div className="row-main">
                  <div className="row-title">
                    {p.name}
                    {best && p.name === best.name && saved.length > 1 && (
                      <span className="pill streak" style={{ marginLeft: 8 }}>
                        más barato
                      </span>
                    )}
                  </div>
                  <div className="row-sub">
                    {p.percent.toFixed(0)}% · {p.title}
                    {p.costPerGram && ` · ${p.costPerGram.toFixed(3)} por g`}
                  </div>
                </div>
                <button
                  className="btn-icon"
                  aria-label={`Quitar ${p.name}`}
                  onClick={() => setSaved((prev) => prev.filter((x) => x.name !== p.name))}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <p className="sub">
            Si la diferencia de coste por gramo es pequeña, elige por digestión y sabor: a
            igualdad de proteína diaria, el tipo de whey no cambia el resultado.
          </p>
        </>
      )}
    </>
  )
}
