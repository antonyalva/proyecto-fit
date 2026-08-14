/**
 * Genera los PNG del manifiesto a partir de public/icon.svg.
 *
 * Chrome en Android solo genera un WebAPK (una app instalada de verdad, con su
 * entrada en el cajón y su propio almacenamiento) si el manifiesto trae PNG de
 * 192 y 512. Con solo SVG se queda en un acceso directo, que es más frágil.
 *
 * El "maskable" lleva la figura al 60% central porque Android recorta el icono
 * a la forma del lanzador: sin ese margen, un lanzador circular come los bordes.
 *
 *   node scripts/icons.mjs
 */
import { readFile, writeFile } from 'node:fs/promises'
import sharp from 'sharp'

const SRC = new URL('../public/icon.svg', import.meta.url)
const OUT = new URL('../public/', import.meta.url)
const BACKGROUND = '#0f1115' // igual que theme_color, para que no se vea borde

const svg = await readFile(SRC)

async function square(size, { safeArea = 1 } = {}) {
  // El relleno se calcula primero y el interior se deriva de él. Al revés,
  // un margen impar deja el resultado en 513 px cuando pedías 512.
  const pad = Math.round((size * (1 - safeArea)) / 2)
  const inner = size - pad * 2

  return sharp(svg, { density: 384 })
    .resize(inner, inner, { fit: 'contain', background: BACKGROUND })
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: BACKGROUND })
    // Sin alfa: el SVG lleva esquinas redondeadas y las dejaría transparentes.
    // Un icono maskable tiene que rellenar el cuadrado entero — el lanzador pone
    // su propia máscara encima, y un hueco transparente se ve como un mordisco.
    .flatten({ background: BACKGROUND })
    .png()
    .toBuffer()
}

const targets = [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  // Apple ignora el manifiesto y usa apple-touch-icon; sin fondo se ve negro sobre negro.
  ['apple-touch-icon.png', 180, {}],
  ['icon-maskable-512.png', 512, { safeArea: 0.6 }],
]

for (const [name, size, opts] of targets) {
  await writeFile(new URL(name, OUT), await square(size, opts))
  console.log(`${name}  ${size}x${size}`)
}
