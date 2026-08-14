import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { useToast } from '../toast'
import { proteinFor } from '../lib/nutrition'
import { CATEGORY_LABEL, CATEGORY_ORDER, uid } from '../lib/storage'
import type { Food, FoodCategory } from '../types'

const BLANK = (): Food => ({
  id: uid(),
  name: '',
  emoji: '🍽️',
  proteinPer100g: 20,
  defaultPortionG: 100,
  category: 'carnes',
  updatedAt: 0,
  deleted: false,
})

export function Foods() {
  const { view, saveFood, removeFood, restoreDefaultFoods } = useStore()
  const toast = useToast()
  const [draft, setDraft] = useState<Food | null>(null)
  const [query, setQuery] = useState('')

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q ? view.foods.filter((f) => f.name.toLowerCase().includes(q)) : view.foods

    return CATEGORY_ORDER.map((category) => ({
      category,
      foods: list
        .filter((f) => f.category === category)
        .sort((a, b) => b.proteinPer100g - a.proteinPer100g),
    })).filter((g) => g.foods.length > 0)
  }, [view.foods, query])

  const total = groups.reduce((sum, g) => sum + g.foods.length, 0)

  function commit() {
    if (!draft) return
    if (!draft.name.trim()) {
      toast('Ponle un nombre')
      return
    }
    if (!(draft.proteinPer100g > 0) || !(draft.defaultPortionG > 0)) {
      toast('Revisa las cantidades')
      return
    }
    if (draft.proteinPer100g > 100) {
      toast('No puede haber más de 100 g de proteína en 100 g')
      return
    }
    saveFood({ ...draft, name: draft.name.trim() })
    setDraft(null)
    toast('Guardado')
  }

  return (
    <>
      <h1>Alimentos</h1>
      <p className="sub">
        Tu catálogo. La cifra que define un alimento es su proteína por 100 g; la ración es
        solo lo que se registra al pulsarlo.
      </p>

      {draft ? (
        <div className="card">
          <div className="field field-pair" style={{ gridTemplateColumns: '70px 1fr' }}>
            <div>
              <label htmlFor="f-emoji">Icono</label>
              <input
                id="f-emoji"
                value={draft.emoji}
                onChange={(e) => setDraft({ ...draft, emoji: e.target.value.slice(0, 4) })}
              />
            </div>
            <div>
              <label htmlFor="f-name">Nombre</label>
              <input
                id="f-name"
                value={draft.name}
                placeholder="Pechuga de pavo"
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
          </div>

          <div className="field field-pair">
            <div>
              <label htmlFor="f-per100">Proteína por 100 g</label>
              <input
                id="f-per100"
                type="number"
                inputMode="decimal"
                step="0.1"
                value={draft.proteinPer100g}
                onChange={(e) =>
                  setDraft({ ...draft, proteinPer100g: Number(e.target.value) || 0 })
                }
              />
            </div>
            <div>
              <label htmlFor="f-portion">Tu ración (g)</label>
              <input
                id="f-portion"
                type="number"
                inputMode="decimal"
                value={draft.defaultPortionG}
                onChange={(e) =>
                  setDraft({ ...draft, defaultPortionG: Number(e.target.value) || 0 })
                }
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="f-category">Categoría</label>
            <select
              id="f-category"
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value as FoodCategory })}
            >
              {CATEGORY_ORDER.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </div>

          <div className="row" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
            <div className="row-main">
              <div className="row-title">Al pulsarlo registrará</div>
              <div className="row-sub">
                {draft.defaultPortionG} g de {draft.name.trim() || 'este alimento'}
              </div>
            </div>
            <span className="row-value" style={{ fontSize: 18 }}>
              {proteinFor(draft, draft.defaultPortionG)} g
            </span>
          </div>

          <div className="btn-row" style={{ marginTop: 14 }}>
            <button className="btn primary" onClick={commit}>
              Guardar
            </button>
            <button className="btn ghost" onClick={() => setDraft(null)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          className="btn primary"
          style={{ width: '100%', marginBottom: 12 }}
          onClick={() => setDraft(BLANK())}
        >
          + Nuevo alimento
        </button>
      )}

      {view.foods.length > 6 && (
        <div className="field">
          <input
            type="search"
            placeholder="Buscar…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}

      {total === 0 ? (
        <div className="card">
          <p className="empty">
            {query ? 'Ningún alimento con ese nombre.' : 'Tu catálogo está vacío.'}
          </p>
        </div>
      ) : (
        groups.map((group) => (
          <details className="group" key={group.category} open={Boolean(query)}>
            <summary>
              <span className="group-name">{CATEGORY_LABEL[group.category]}</span>
              <span className="group-count">{group.foods.length}</span>
            </summary>
            <div className="card">
              {group.foods.map((f) => (
                <div className="row" key={f.id}>
                  <span className="preset-emoji">{f.emoji}</span>
                  <div className="row-main">
                    <div className="row-title">{f.name}</div>
                    <div className="row-sub">
                      {f.proteinPer100g} g/100 g · ración de {f.defaultPortionG} g ={' '}
                      {proteinFor(f, f.defaultPortionG)} g
                    </div>
                  </div>
                  <button
                    className="btn-icon"
                    aria-label={`Editar ${f.name}`}
                    onClick={() => setDraft(f)}
                  >
                    ✎
                  </button>
                  <button
                    className="btn-icon"
                    aria-label={`Borrar ${f.name}`}
                    onClick={() => {
                      if (window.confirm(`¿Quitar "${f.name}" del catálogo?`)) {
                        removeFood(f.id)
                        toast('Quitado')
                      }
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </details>
        ))
      )}

      <p className="sub">
        Los valores iniciales son de referencia y aproximados. Si tienes el envase delante,
        cópialos de su tabla nutricional: esos son los que valen.
      </p>

      <h2>Restaurar</h2>
      <div className="card">
        <p className="row-sub" style={{ marginTop: 0, marginBottom: 14 }}>
          Si tu catálogo viene de una versión anterior, las cifras por 100 g pueden estar mal
          (todas con ración de 100 g). Esto lo deja como recién instalado. Tu historial de
          comidas ya registrado no se toca.
        </p>
        <button
          className="btn"
          onClick={() => {
            if (window.confirm('¿Reemplazar el catálogo por el de fábrica? Los alimentos que hayas creado tú se quitarán.')) {
              restoreDefaultFoods()
              toast('Catálogo restaurado')
            }
          }}
        >
          Restaurar catálogo por defecto
        </button>
      </div>
    </>
  )
}
