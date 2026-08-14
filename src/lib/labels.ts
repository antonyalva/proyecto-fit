export type Band =
  | 'hidrolizado-aislado'
  | 'aislado'
  | 'concentrado'
  | 'concentrado-anadidos'
  | 'gainer'

export interface LabelVerdict {
  /** % de proteína sobre el peso total del producto. */
  percent: number
  band: Band
  title: string
  detail: string
  /** Aviso cuando el nombre del bote no cuadra con los números. */
  mismatch: string | null
}

const BANDS: Record<Band, { title: string; detail: string }> = {
  'hidrolizado-aislado': {
    title: 'Aislado o hidrolizado',
    detail:
      'Pureza alta, prácticamente sin lactosa ni grasa. Es la opción cara, y la que tiene sentido si la leche te sienta mal.',
  },
  aislado: {
    title: 'Aislado, o concentrado de gama alta',
    detail:
      'Zona gris. Un aislado puro suele pasar del 90%; si se queda aquí es que lleva añadidos (vitaminas, aminoácidos, saborizantes) que diluyen el porcentaje.',
  },
  concentrado: {
    title: 'Concentrado',
    detail:
      'El rango típico del concentrado. Lleva algo de lactosa y grasa, y para la mayoría de la gente funciona perfectamente. Es la mejor relación calidad-precio.',
  },
  'concentrado-anadidos': {
    title: 'Concentrado con bastantes añadidos',
    detail:
      'La base es concentrado, pero una parte notable del bote no es proteína: aminoácidos, vitaminas, espesantes o azúcar. Nada malo, pero pagas por peso que no es proteína.',
  },
  gainer: {
    title: 'Ganador de peso o mezcla con carbohidratos',
    detail:
      'Menos de la mitad del producto es proteína. Esto es un gainer: está pensado para sumar calorías, no para aportar proteína de forma eficiente.',
  },
}

function bandFor(percent: number): Band {
  if (percent >= 90) return 'hidrolizado-aislado'
  if (percent >= 80) return 'aislado'
  if (percent >= 70) return 'concentrado'
  if (percent >= 50) return 'concentrado-anadidos'
  return 'gainer'
}

/**
 * Clasifica un producto por la única cifra que no se puede maquillar:
 * proteína por 100 g de producto.
 *
 * @param proteinPerServing g de proteína por servicio (tabla nutricional)
 * @param servingSize       g que pesa un servicio / scoop
 * @param productName       nombre del bote, para detectar incoherencias
 */
export function classify(
  proteinPerServing: number,
  servingSize: number,
  productName = '',
): LabelVerdict | null {
  if (!(proteinPerServing > 0) || !(servingSize > 0)) return null
  if (proteinPerServing > servingSize) return null

  const percent = (proteinPerServing / servingSize) * 100
  const band = bandFor(percent)
  const name = productName.toLowerCase()

  let mismatch: string | null = null
  const claimsIsolate = /\biso\b|aislad|isolate/.test(name)
  const claimsHydro = /hidroliz|hydro/.test(name)
  if ((claimsIsolate || claimsHydro) && percent < 85) {
    mismatch =
      'El bote se vende como aislado, pero los números dan un porcentaje de concentrado. Suele significar que lleva añadidos, o que el servicio incluye ingredientes que no son suero.'
  }

  return { percent, band, mismatch, ...BANDS[band] }
}

/** Cuánto te cuesta realmente cada gramo de proteína. La cifra que compara de verdad. */
export function costPerGramProtein(
  price: number,
  containerGrams: number,
  proteinPerServing: number,
  servingSize: number,
): number | null {
  if (!(price > 0) || !(containerGrams > 0)) return null
  if (!(proteinPerServing > 0) || !(servingSize > 0)) return null
  const totalProtein = (containerGrams / servingSize) * proteinPerServing
  return price / totalProtein
}

export function servingsInContainer(containerGrams: number, servingSize: number): number | null {
  if (!(containerGrams > 0) || !(servingSize > 0)) return null
  return Math.floor(containerGrams / servingSize)
}
