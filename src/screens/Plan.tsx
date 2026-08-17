import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { useToast } from '../toast'
import {
  dailyTarget,
  formatQuantity,
  gramsFromUnits,
  isUnitFood,
  proteinFor,
  unitsFromGrams,
} from '../lib/nutrition'
import { suggestForGap } from '../lib/suggest'
import { uid } from '../lib/storage'
import {
  ALL_WEEKDAYS,
  WEEKDAY_NAME,
  WEEKDAY_SHORT,
  todayKey,
  weekdayOf,
} from '../lib/date'
import type { Food, Meal, PlanItem } from '../types'

export function Plan() {
  const {
    state,
    weightKg,
    view,
    saveMeal,
    removeMeal,
    savePlanItem,
    removePlanItem,
    logPlanItem,
    logMeal,
  } = useStore()
  const toast = useToast()

  const today = todayKey()
  const todayWeekday = weekdayOf(today)

  const [day, setDay] = useState(todayWeekday)
  const [editing, setEditing] = useState(false)

  const isToday = day === todayWeekday

  const foodById = useMemo(() => new Map(view.foods.map((f) => [f.id, f])), [view.foods])

  /** Qué líneas del plan ya has registrado hoy. */
  const doneToday = useMemo(
    () =>
      new Set(
        view.log
          .filter((e) => e.date === today && e.planItemId)
          .map((e) => e.planItemId as string),
      ),
    [view.log, today],
  )

  const meals = useMemo(() => [...view.meals].sort((a, b) => a.order - b.order), [view.meals])

  const proteinOf = (item: PlanItem) => {
    const food = foodById.get(item.foodId)
    return food ? proteinFor(food, item.grams) : 0
  }

  /**
   * Al mirar, solo las líneas del día elegido. Al editar, todas.
   *
   * Editando hace falta ver la semana entera: si el batido está solo en L X V y
   * estás mirando el martes, no aparecería, y no habría forma de añadirle el martes.
   */
  const itemsOf = (mealId: string, weekday: number) =>
    view.planItems.filter(
      (i) =>
        i.mealId === mealId &&
        foodById.has(i.foodId) &&
        (editing || i.days.includes(weekday)),
    )

  const target = dailyTarget(weightKg, state.profile.gPerKg)

  const week = useMemo(
    () =>
      ALL_WEEKDAYS.map((d) => ({
        day: d,
        total: view.planItems
          .filter((i) => i.days.includes(d) && foodById.has(i.foodId))
          .reduce((sum, i) => sum + proteinOf(i), 0),
      })),
    [view.planItems, foodById],
  )

  const dayTotal = week[day].total
  const gap = Math.round((dayTotal - target) * 10) / 10
  const weekMax = Math.max(target, ...week.map((w) => w.total))
  const shortDays = week.filter((w) => w.total < target - 10)

  const orphans = view.planItems.filter((i) => !foodById.has(i.foodId))

  return (
    <>
      <h1>Plan semanal</h1>
      <p className="sub">
        Las comidas son las mismas cada día; lo que cambia es qué entra en ellas.
      </p>

      <div className="card">
        <div className="week">
          {week.map((w) => {
            const hit = w.total >= target - 10
            return (
              <button
                key={w.day}
                className={`week-day${w.day === day ? ' on' : ''}`}
                onClick={() => setDay(w.day)}
                aria-label={`${WEEKDAY_NAME[w.day]}: ${Math.round(w.total)} g`}
              >
                <span className="week-bar-slot">
                  <span
                    className={`week-bar${hit ? '' : ' low'}`}
                    style={{ height: `${Math.max(4, (w.total / weekMax) * 46)}px` }}
                  />
                </span>
                <span className="week-label">{WEEKDAY_SHORT[w.day]}</span>
                {w.day === todayWeekday && <span className="week-dot" />}
              </button>
            )
          })}
        </div>

        <div className="row" style={{ borderTop: '1px solid var(--line)', marginTop: 12 }}>
          <div className="row-main">
            <div className="row-title" style={{ textTransform: 'capitalize' }}>
              {WEEKDAY_NAME[day]}
              {isToday && <span className="pill streak" style={{ marginLeft: 8 }}>hoy</span>}
            </div>
            <div className="row-sub">
              Tu meta son {target} g ·{' '}
              {Math.abs(gap) <= 10 ? (
                <span style={{ color: 'var(--accent)' }}>encaja bien</span>
              ) : gap < 0 ? (
                <span style={{ color: 'var(--warn)' }}>faltan {Math.abs(gap)} g</span>
              ) : (
                <span style={{ color: 'var(--muted)' }}>{gap} g por encima</span>
              )}
            </div>
          </div>
          <span className="row-value" style={{ fontSize: 22 }}>
            {Math.round(dayTotal)} g
          </span>
        </div>
      </div>

      {shortDays.length > 0 && (
        <div className="note">
          Te quedas corto el {shortDays.map((w) => WEEKDAY_NAME[w.day]).join(', ')}. Con una
          semana desigual el promedio engaña: lo que cuenta es llegar la mayoría de días.
        </div>
      )}

      {gap < -5 && meals.length > 0 && (
        <Suggestions
          gap={-gap}
          day={day}
          foods={view.foods}
          usedFoodIds={view.planItems
            .filter((i) => i.days.includes(day))
            .map((i) => i.foodId)}
          meals={meals}
          onAdd={(mealId, foodId, grams) => {
            savePlanItem({
              id: uid(),
              mealId,
              foodId,
              grams,
              days: [day],
              updatedAt: 0,
              deleted: false,
            })
            toast('Añadido al plan')
          }}
        />
      )}

      <div className="btn-row" style={{ margin: '16px 0' }}>
        <button className={editing ? 'btn primary' : 'btn'} onClick={() => setEditing(!editing)}>
          {editing ? 'Terminar de editar' : 'Editar plan'}
        </button>
      </div>

      {editing && (
        <p className="sub" style={{ marginTop: -8 }}>
          Editando ves la semana entera, no solo el {WEEKDAY_NAME[day]}. Los días marcados
          bajo cada alimento son los que toca comerlo.
        </p>
      )}

      {orphans.length > 0 && (
        <div className="note">
          ⚠️ {orphans.length} línea{orphans.length > 1 ? 's' : ''} del plan apunta
          {orphans.length > 1 ? 'n' : ''} a un alimento que ya no está en el catálogo. No
          cuenta{orphans.length > 1 ? 'n' : ''} en los totales.
        </div>
      )}

      {meals.length === 0 && (
        <div className="card">
          <p className="empty">
            No hay comidas en el plan.
            <br />
            Pulsa «Editar plan» para añadir la primera.
          </p>
        </div>
      )}

      {meals.map((meal) => (
        <MealCard
          key={meal.id}
          meal={meal}
          day={day}
          isToday={isToday}
          items={itemsOf(meal.id, day)}
          foods={view.foods}
          foodById={foodById}
          doneToday={doneToday}
          editing={editing}
          onLogItem={(item) => {
            logPlanItem(item)
            toast(`+${proteinOf(item)} g`)
          }}
          onLogMeal={() => {
            logMeal(meal.id)
            toast(`${meal.name} registrado`)
          }}
          onSaveMeal={saveMeal}
          onRemoveMeal={() => {
            if (window.confirm(`¿Borrar "${meal.name}" y todas sus líneas del plan?`)) {
              removeMeal(meal.id)
              toast('Comida borrada')
            }
          }}
          onSaveItem={savePlanItem}
          onRemoveItem={removePlanItem}
        />
      ))}

      {editing && (
        <button
          className="btn"
          style={{ width: '100%' }}
          onClick={() => {
            const name = window.prompt('¿Cómo se llama la comida?', 'Merienda')
            if (name?.trim()) {
              saveMeal({
                id: uid(),
                name: name.trim(),
                order: meals.length,
                updatedAt: 0,
                deleted: false,
              })
              toast('Comida añadida')
            }
          }}
        >
          + Añadir comida
        </button>
      )}

      <p className="sub" style={{ marginTop: 20 }}>
        Solo se puede registrar el día de hoy. Registrar una comida entera no duplica lo que
        ya hubieras marcado, y si un día comes otra cosa lo apuntas desde Hoy.
      </p>
    </>
  )
}

/**
 * Qué añadir para cerrar el hueco del día, con la cantidad ya calculada.
 * Un toque lo mete en el plan, solo para ese día de la semana.
 */
function Suggestions({
  gap,
  day,
  foods,
  usedFoodIds,
  meals,
  onAdd,
}: {
  gap: number
  day: number
  foods: Food[]
  usedFoodIds: string[]
  meals: Meal[]
  onAdd: (mealId: string, foodId: string, grams: number) => void
}) {
  const [mealId, setMealId] = useState(meals[0]?.id ?? '')
  const suggestions = useMemo(
    () => suggestForGap(gap, foods, usedFoodIds),
    [gap, foods, usedFoodIds],
  )

  if (suggestions.length === 0) return null

  const target = meals.some((m) => m.id === mealId) ? mealId : meals[0].id

  return (
    <div className="card">
      <div className="row" style={{ paddingTop: 0 }}>
        <div className="row-main">
          <div className="row-title">
            Para cerrar el {WEEKDAY_NAME[day]}
          </div>
          <div className="row-sub">Te faltan {Math.round(gap)} g. Un toque y entra al plan.</div>
        </div>
      </div>

      {suggestions.map((s) => {
        const covers = Math.min(100, Math.round((s.protein / gap) * 100))
        return (
          <div className="row" key={s.food.id}>
            <span className="preset-emoji">{s.food.emoji}</span>
            <div className="row-main">
              <div className="row-title">
                {s.food.name} · {formatQuantity(s.food, s.grams)}
              </div>
              <div className="row-sub">
                {s.protein} g de proteína{covers < 95 && ` · cubre el ${covers}% del hueco`}
              </div>
            </div>
            <button className="btn" onClick={() => onAdd(target, s.food.id, s.grams)}>
              Añadir
            </button>
          </div>
        )
      })}

      {meals.length > 1 && (
        <div className="field" style={{ marginTop: 12, marginBottom: 0 }}>
          <label htmlFor="sug-meal">¿A qué comida?</label>
          <select id="sug-meal" value={target} onChange={(e) => setMealId(e.target.value)}>
            {meals.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}

interface MealCardProps {
  meal: Meal
  day: number
  isToday: boolean
  items: PlanItem[]
  foods: Food[]
  foodById: Map<string, Food>
  doneToday: Set<string>
  editing: boolean
  onLogItem: (item: PlanItem) => void
  onLogMeal: () => void
  onSaveMeal: (meal: Meal) => void
  onRemoveMeal: () => void
  onSaveItem: (item: PlanItem) => void
  onRemoveItem: (id: string) => void
}

function MealCard({
  meal,
  day,
  isToday,
  items,
  foods,
  foodById,
  doneToday,
  editing,
  onLogItem,
  onLogMeal,
  onSaveMeal,
  onRemoveMeal,
  onSaveItem,
  onRemoveItem,
}: MealCardProps) {
  const [adding, setAdding] = useState(false)
  const [foodId, setFoodId] = useState(foods[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const [days, setDays] = useState<number[]>([day])

  const proteinOf = (item: PlanItem) => {
    const food = foodById.get(item.foodId)
    return food ? proteinFor(food, item.grams) : 0
  }

  // Editando se listan todas las líneas de la semana, pero el total y el progreso
  // siguen siendo los del día elegido: si no, el resumen no cuadraría con la cabecera.
  const dayItems = items.filter((i) => i.days.includes(day))
  const total = dayItems.reduce((sum, i) => sum + proteinOf(i), 0)
  const pending = dayItems.filter((i) => !doneToday.has(i.id))
  const allDone = dayItems.length > 0 && pending.length === 0

  const chosen = foods.find((f) => f.id === foodId) ?? null
  const chosenIsUnit = chosen ? isUnitFood(chosen) : false
  const amountNum = Number(amount)
  const gramsNum = amount
    ? chosenIsUnit && chosen
      ? gramsFromUnits(chosen, amountNum)
      : amountNum
    : chosen?.defaultPortionG || 0

  function addItem() {
    if (!chosen || !(gramsNum > 0) || days.length === 0) return
    onSaveItem({
      id: uid(),
      mealId: meal.id,
      foodId: chosen.id,
      grams: gramsNum,
      days: [...days].sort(),
      updatedAt: 0,
      deleted: false,
    })
    setAmount('')
    setDays([day])
    setAdding(false)
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="row-main">
          <div className="row-title" style={{ fontSize: 16 }}>
            {meal.name}{' '}
            {allDone && isToday && <span className="pill streak">hecho</span>}
          </div>
          <div className="row-sub">
            {dayItems.length === 0
              ? editing
                ? `Nada el ${WEEKDAY_NAME[day]}`
                : 'Nada este día'
              : `${dayItems.length} alimento${dayItems.length > 1 ? 's' : ''} · ${Math.round(total)} g de proteína`}
          </div>
        </div>
        {editing && (
          <>
            <button
              className="btn-icon"
              aria-label={`Renombrar ${meal.name}`}
              onClick={() => {
                const name = window.prompt('Nuevo nombre', meal.name)
                if (name?.trim()) onSaveMeal({ ...meal, name: name.trim() })
              }}
            >
              ✎
            </button>
            <button className="btn-icon" aria-label={`Borrar ${meal.name}`} onClick={onRemoveMeal}>
              ×
            </button>
          </>
        )}
      </div>

      {items.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {items.map((item) => {
            const food = foodById.get(item.foodId)!
            const done = doneToday.has(item.id)
            const everyDay = item.days.length === 7
            return (
              <div className="row" key={item.id}>
                <span className="preset-emoji">{food.emoji}</span>
                <div className="row-main">
                  <div
                    className="row-title"
                    style={{
                      // Atenuado si ya lo comiste, o si editando no toca el día que miras.
                      opacity:
                        (done && isToday) || (editing && !item.days.includes(day)) ? 0.45 : 1,
                    }}
                  >
                    {food.name}
                  </div>
                  <div className="row-sub">
                    {formatQuantity(food, item.grams)} · {proteinOf(item)} g de proteína
                    {!everyDay && (
                      <> · solo {item.days.map((d) => WEEKDAY_SHORT[d]).join(' ')}</>
                    )}
                  </div>
                  {editing && (
                    <DayPicker
                      value={item.days}
                      onChange={(next) => {
                        if (next.length === 0) {
                          onRemoveItem(item.id)
                          return
                        }
                        onSaveItem({ ...item, days: next })
                      }}
                    />
                  )}
                </div>
                {editing ? (
                  <>
                    <button
                      className="btn-icon"
                      aria-label={`Cambiar cantidad de ${food.name}`}
                      onClick={() => {
                        const unit = isUnitFood(food)
                        const value = window.prompt(
                          unit
                            ? `Cantidad (${food.unitLabel})`
                            : `¿Cuántos gramos de ${food.name.toLowerCase()}?`,
                          unit ? String(unitsFromGrams(food, item.grams)) : String(item.grams),
                        )
                        const num = Number(value)
                        if (!(num > 0)) return
                        const nextGrams = unit ? gramsFromUnits(food, num) : num
                        onSaveItem({ ...item, grams: nextGrams })
                      }}
                    >
                      ✎
                    </button>
                    <button
                      className="btn-icon"
                      aria-label={`Quitar ${food.name} del plan`}
                      onClick={() => onRemoveItem(item.id)}
                    >
                      ×
                    </button>
                  </>
                ) : !isToday ? null : done ? (
                  <span className="pill streak">✓</span>
                ) : (
                  <button className="btn" onClick={() => onLogItem(item)}>
                    Comí
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {editing ? (
        adding ? (
          <div style={{ marginTop: 12 }}>
            <div className="field">
              <label htmlFor={`add-${meal.id}`}>Alimento</label>
              <select
                id={`add-${meal.id}`}
                value={foodId}
                onChange={(e) => setFoodId(e.target.value)}
              >
                {foods.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.emoji} {f.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor={`g-${meal.id}`}>
                {chosen && chosenIsUnit
                  ? `Cantidad (${chosen.unitLabel}) — tu ración: ${formatQuantity(chosen, chosen.defaultPortionG)}`
                  : `Gramos ${chosen ? `(tu ración: ${chosen.defaultPortionG} g)` : ''}`}
              </label>
              <input
                id={`g-${meal.id}`}
                type="number"
                inputMode="decimal"
                step={chosenIsUnit ? '0.5' : undefined}
                placeholder={
                  chosen && chosenIsUnit
                    ? String(unitsFromGrams(chosen, chosen.defaultPortionG))
                    : String(chosen?.defaultPortionG ?? 100)
                }
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addItem()}
              />
            </div>
            <div className="field">
              <label>Qué días</label>
              <DayPicker value={days} onChange={setDays} />
            </div>
            {chosen && gramsNum > 0 && days.length > 0 && (
              <p className="row-sub" style={{ marginBottom: 12 }}>
                Añadirá {formatQuantity(chosen, gramsNum)} ·{' '}
                <strong style={{ color: 'var(--text)' }}>
                  {proteinFor(chosen, gramsNum)} g
                </strong>{' '}
                de proteína {days.length === 7 ? 'todos los días' : `${days.length} día${days.length > 1 ? 's' : ''} a la semana`}.
              </p>
            )}
            <div className="btn-row">
              <button
                className="btn primary"
                onClick={addItem}
                disabled={!chosen || days.length === 0}
              >
                Añadir
              </button>
              <button className="btn ghost" onClick={() => setAdding(false)}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            className="btn ghost"
            style={{ width: '100%', marginTop: 12 }}
            onClick={() => {
              setDays([day])
              setAdding(true)
            }}
            disabled={foods.length === 0}
          >
            + Añadir alimento
          </button>
        )
      ) : (
        items.length > 0 &&
        isToday && (
          <button
            className="btn primary"
            style={{ width: '100%', marginTop: 12 }}
            onClick={onLogMeal}
            disabled={allDone}
          >
            {allDone
              ? 'Ya registrado hoy'
              : pending.length === items.length
                ? `Registrar ${meal.name.toLowerCase()}`
                : `Registrar lo que falta (${pending.length})`}
          </button>
        )
      )}
    </div>
  )
}

/** Selector de días de la semana. Quitar todos equivale a borrar la línea. */
function DayPicker({
  value,
  onChange,
}: {
  value: number[]
  onChange: (days: number[]) => void
}) {
  return (
    <div className="day-picker">
      {ALL_WEEKDAYS.map((d) => {
        const on = value.includes(d)
        return (
          <button
            key={d}
            type="button"
            className={`day-chip${on ? ' on' : ''}`}
            aria-pressed={on}
            aria-label={WEEKDAY_NAME[d]}
            onClick={() =>
              onChange(on ? value.filter((x) => x !== d) : [...value, d].sort())
            }
          >
            {WEEKDAY_SHORT[d]}
          </button>
        )
      })}
    </div>
  )
}
