# Proteína & Suplementos

PWA personal para llevar la proteína diaria y el inventario de suplementos.
Sin cuentas, sin servidor, sin coste: los datos viven en el `localStorage` de tu móvil.

## Arrancar

```bash
npm install
```

```bash
npm run dev
```

Vite imprime dos URLs. La de `Network` (algo como `http://192.168.1.x:5173`) es la que
abres desde el móvil estando en el mismo WiFi.

## Iconos

Los PNG del manifiesto se generan desde [`public/icon.svg`](public/icon.svg):

```bash
npm run icons
```

Hay que reejecutarlo solo si cambias el SVG. Los PNG de 192 y 512 no son decorativos:
son la condición para que Chrome en Android genere un **WebAPK** (una app instalada de
verdad) en lugar de un simple acceso directo.

## Desplegar en Netlify

Necesario para instalarla de forma permanente: mientras la app solo exista en `localhost`,
tu móvil no la alcanza salvo que esté en tu misma WiFi con el portátil encendido.

1. Crea una cuenta gratis en [netlify.com](https://netlify.com) (esto lo haces tú, no un
   comando).
2. Desde la carpeta del proyecto:

   ```bash
   npm run build
   ```

   ```bash
   npx netlify-cli login
   ```

   Abre tu navegador para que autorices la CLI — es tu cuenta, tu sesión.

   ```bash
   npx netlify-cli deploy --prod --dir=dist
   ```

   La primera vez te preguntará si quieres crear un sitio nuevo; di que sí y ponle el nombre
   que quieras. Al terminar te da una URL tipo `https://tu-app.netlify.app` — esa es la
   permanente.

**Para publicar un cambio más adelante**, repite solo los dos últimos comandos (`npm run
build` y `netlify-cli deploy --prod --dir=dist`) — el login queda recordado.

Las claves de Supabase viajan dentro de `dist/` porque se incrustan en la build al ejecutar
`npm run build` en tu máquina, donde ya tienes `.env.local`. No hace falta configurarlas en
Netlify para este flujo.

## Instalarla en el móvil

**Con la app ya desplegada en Netlify** (lo de arriba), es lo único que hace falta:

1. Abre la URL de Netlify en Chrome (Android) o Safari (iOS) desde el móvil.
2. Android: menú ⋮ → *Instalar aplicación*. iOS: *Compartir* → *Añadir a pantalla de inicio*.

En Android, Chrome no crea un simple acceso directo: genera e instala un **APK real**
(un WebAPK) por debajo, gracias a los iconos PNG del manifiesto. Queda en el cajón de
aplicaciones y en Ajustes → Aplicaciones, se abre a pantalla completa y sigue funcionando
sin conexión — el service worker guarda la app entera en el móvil la primera vez que carga.

### Probarla sin desplegar todavía

Para verla en el móvil antes de desplegar, con el portátil y el móvil en el mismo WiFi:

```bash
npm run build
```

```bash
npm run preview -- --host
```

Vite imprime una URL de `Network` tipo `http://192.168.x.x:4173`. Solo funciona con el
portátil encendido — para que quede instalada de forma permanente, despliega en Netlify.

### En iPhone (iOS)

Funciona, con diferencias reales frente a Android que conviene conocer:

- **Solo desde Safari.** Chrome o cualquier otro navegador en iOS no ofrece *Añadir a
  pantalla de inicio* con las mismas capacidades — es Apple quien lo restringe, no algo que
  se pueda evitar desde el código.
- **No es un APK.** En Android, Chrome genera un WebAPK real por debajo. En iOS no existe
  ese equivalente: queda como un acceso directo respaldado por Safari en modo standalone,
  sin paso por la App Store. Se ve y se siente como una app, pero no lo es en el sentido
  estricto de Apple.
- **Safari ignora casi todo el manifiesto** — íconos, `display`, nombre — y solo obedece
  unas etiquetas `<meta>` propias. Ya están puestas en [`index.html`](index.html):
  `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style` y
  `apple-mobile-web-app-title`, más el `apple-touch-icon.png` de 180×180 (Safari no
  acepta el SVG). Sin ellas, "Añadir a pantalla de inicio" abriría la app dentro de una
  ventana de Safari con barra de direcciones, no a pantalla completa.
- **La barra de estado es `black-translucent`**, para que combine con el tema oscuro en
  vez de una franja blanca encima. Dibuja transparente sobre el contenido, así que `.app` y
  `.login-screen` añaden `padding-top: env(safe-area-inset-top)` para que el notch o la
  isla dinámica no tapen el título de cada pantalla.
- **iOS ha sido históricamente más agresivo liberando almacenamiento local** que no se usa
  en un tiempo. Con la sincronización a Supabase activada esto deja de ser un riesgo real:
  aunque el sistema borrara la caché local, tus datos siguen en tu cuenta y se recuperan al
  volver a entrar con conexión.

No hace falta nada más de tu parte: se instala igual que en Android, *Compartir* → *Añadir
a pantalla de inicio* desde Safari, apuntando a la misma URL de Netlify.

## Las seis pantallas

- **Hoy** — meta diaria calculada desde tu peso, y botones de un toque para sumar raciones.
  Pulsar un alimento registra tu ración habitual; el selector de abajo sirve para una
  cantidad distinta ("hoy me he comido 220 g de pollo"). Los suplementos aún no tomados
  aparecen arriba; darle a *Tomar* descuenta inventario y suma la proteína de una sola vez.
- **Plan** — tu plan semanal. Las comidas (Desayuno, Comida, Post-entreno, Cena) son las
  mismas cada día; lo que cambia es qué entra en ellas: batido los días de entreno, otra
  carne el fin de semana. Las barras de arriba muestran la proteína de los siete días de
  un vistazo, y avisa si algún día se te queda corto. Pulsar *Registrar desayuno* apunta la
  comida entera de un toque, sin duplicar lo ya marcado y respetando el día de la semana.
  En *Editar plan* ves la semana completa y marcas con las casillas L M X J V S D qué días
  toca cada alimento.

  Cuando el día que miras se queda corto, propone **qué añadir y cuánto**, con la cantidad
  ya calculada para cerrar el hueco. Un toque lo mete en el plan, solo para ese día. Evita
  repetir lo que ya comes esa jornada, y no sugiere raciones absurdas: el tope es el doble
  de tu ración habitual, así que si un alimento no llega te dice qué porcentaje cubre en
  vez de proponerte medio kilo de pollo.
- **Comida** — tu catálogo, agrupado en Carnes, Pescados y mariscos, Huevos y lácteos,
  Legumbres y granos, Frutas, Frutos secos y semillas y Suplementos. Viene con 38 alimentos
  que se consiguen en Lima, incluidos los que aquí salen a cuenta y en otros sitios no: tarwi
  (17 g/100 g, excepcional para una legumbre), anchoveta y caballa en conserva, pota,
  sangrecita e hígado. Cada uno se define por su **proteína por 100 g**,
  que es lo que no depende de la ración, más la ración que tú sueles comer. Puedes crear,
  editar y borrar los que quieras. Los valores iniciales son de referencia y aproximados:
  si tienes el envase delante, cópialos de su tabla nutricional.
- **Botes** — cuántos días te queda cada bote, fecha límite para reponer, y racha de días
  consecutivos (pensado para la creatina, donde lo único que importa es la constancia).
- **Etiqueta** — metes proteína por servicio y peso del servicio, y te dice el porcentaje real
  de proteína, si es concentrado o aislado, y cuánto te cuesta cada gramo de proteína.
  Avisa cuando un bote se vende como "aislado" pero los números dicen otra cosa.
- **Perfil** — peso corporal, objetivo, g/kg, historial de proteína, cuenta y copia de
  seguridad.

  El peso lleva **media móvil de 7 días**: el dato de un día suelto es ruido (sal, agua,
  glucógeno mueven un kilo largo), y solo la media refleja un cambio real. Con dos semanas
  de recorrido calcula la tendencia en kg/semana y la traduce: ~0.2–0.5 kg/semana es
  ganancia limpia, por encima de 0.7 ya estás añadiendo bastante grasa. Con menos de 14
  días dice que no lo sabe en vez de inventarse una cifra.

  Tu meta de proteína **se deriva** de esa media, no de un peso copiado a mano: así
  pesarte en el móvil actualiza la meta en el portátil sin hacer nada más.

## Sincronizar móvil y portátil (opcional)

Sin configurar nada, la app guarda todo en el navegador y funciona perfectamente.
Si quieres los mismos datos en el móvil y en el portátil, se activa así:

1. Crea un proyecto en [supabase.com](https://supabase.com) (el plan gratuito sobra:
   esto son unos pocos cientos de KB al año).
2. En el **SQL Editor** del proyecto, pega y ejecuta [`supabase/schema.sql`](supabase/schema.sql).
   Crea la tabla y activa RLS, que es lo que impide que nadie más lea tus datos.
3. Copia `.env.example` a `.env.local` y pega tu URL y tu anon key
   (*Project Settings → Data API* y *Project Settings → API Keys*).
4. Reinicia el servidor. En *Perfil → Cuenta y sincronización* ya puedes crear tu cuenta
   con email y contraseña.

Por defecto Supabase exige **confirmar el email**: al registrarte recibes un correo y hasta
que pulses el enlace no puedes iniciar sesión. La app te lo avisa en pantalla. Si prefieres
saltártelo para uso personal, se desactiva en *Authentication → Sign In / Providers → Email
→ Confirm email* del panel de Supabase.

### Puerta de entrada

Con Supabase configurado, la app **exige sesión antes de mostrar nada**: sin entrar no se ve
ni la pestaña Hoy ni ningún dato, solo la pantalla de login. Cada cuenta ve exclusivamente su
propio plan — es lo que convierte en real la promesa de las políticas RLS del lado del
dispositivo, no solo del servidor.

Sin claves de Supabase (`.env.local` vacío), esta puerta desaparece y la app funciona como al
principio: local y anónima, sin pedir cuenta.

**Sigue funcionando sin conexión.** Si esta app ya se instaló en el móvil (ver más abajo) y
alguna vez tuvo sesión, abrirla sin red te deja entrar con los datos guardados de tu última
sesión en vez de dejarte fuera — el service worker sirve la app entera desde caché, y el
login se salta cuando no hay forma de validarlo. Se sincroniza solo en cuanto vuelve la red.
Esa puerta trasera se cierra sola al cerrar sesión: apagar el wifi después no sirve para
volver a entrar.

### Alimentos por unidades

Hay cosas que nadie pesa antes de comer: un plátano, dos huevos, una manzana. Al crear o
editar un alimento en **Comida**, marca *"Se mide por unidades"* y define el nombre de la
unidad (`plátano`) y cuántos gramos pesa una (`118`). A partir de ahí la app te pregunta
"Cantidad (plátano)" en vez de gramos, y muestra `2 × plátano (236 g)` en todas partes:
botones de Hoy, plan semanal, historial y sugerencias.

Por dentro **todo se sigue guardando en gramos** — el plan, el historial y la
sincronización no cambian. Las unidades son solo una capa de entrada y presentación, así
que un alimento puede pasar de gramos a unidades (o al revés) sin invalidar nada de lo ya
registrado. Las sugerencias además redondean a unidades enteras: nadie sirve medio plátano
para cerrar un hueco de proteína.

Los dos campos van juntos: un nombre de unidad sin su peso no sirve para calcular nada, así
que la app trata el alimento como "por peso" mientras falte cualquiera de los dos.

### Varias cuentas en un mismo dispositivo

Cada cuenta guarda en su propia clave de `localStorage` (`protein-tracker/v4:<uid>`), y sin
sesión se usa la anónima. Entrar con una cuenta en un móvil que ya usaba otra persona **no
hereda nada**: ni se ve en pantalla, ni se sube a la cuenta que entra. RLS protege el
servidor; esto protege el dispositivo.

Con una excepción deliberada, para no perder datos al registrarse: si creas la cuenta
después de haber usado la app sin sesión, esos datos se adoptan — pero solo si se cumplen
**las dos** condiciones a la vez: la cuenta está vacía en el servidor y en este dispositivo
aún no habías tocado nada con ella. Si cualquiera falla, no se toca nada.

Al cerrar sesión, tus datos siguen en el dispositivo para que vuelvas a entrar sin conexión.
Para un móvil prestado hay *Cerrar sesión y borrar de aquí*, que los quita de local y los
deja solo en tu cuenta.

### Cómo funciona la sincronización

Es **local-first**: `localStorage` sigue siendo la fuente de verdad, así que cada toque es
instantáneo y la app funciona sin cobertura. La subida ocurre en segundo plano, agrupada,
y al volver a la app se fusiona con lo que haya en el servidor.

Es **incremental**: una fila por comida, no un blob con todo el historial. Cada
sincronización pide solo lo modificado desde la última vez, así que el coste no crece
según se acumulan meses de registros.

Y **fusiona, no sobrescribe**. Si registras un scoop en el móvil sin conexión y mientras
tanto tocas algo en el portátil, no se pierde ninguno de los dos:

| Dato | Regla al fusionar |
| --- | --- |
| Cada fila | Gana la editada más tarde, comparando el reloj del dispositivo. |
| Fechas de toma | Se unen en vez de sobrescribirse, para no romper la racha. |
| Borrados | Borrado lógico (`deleted`), para que viajen al otro dispositivo como cualquier cambio. |

Hay dos marcas de tiempo por fila y hacen cosas distintas: `updated_at` es del servidor y
sirve de cursor para pedir lo nuevo; `client_updated_at` es del dispositivo y decide quién
gana en un conflicto. Mezclarlas rompe la sincronización cuando los relojes no coinciden.

El orden importa y no es el mismo siempre. La **primera** sincronización de un dispositivo
baja antes de subir: una instalación nueva trae el catálogo de fábrica, y subirlo primero
sobrescribiría con `upsert` los alimentos que ya hubieras editado en el otro dispositivo.
A partir de ahí sube lo pendiente y luego baja.

Mientras no inicies sesión, la pantalla de Hoy muestra un aviso de que los datos no salen
del dispositivo. Sin eso se puede usar la app durante semanas creyendo que sincroniza.

Esa lógica está en [`src/lib/merge.ts`](src/lib/merge.ts) y cubierta por pruebas:

```bash
npm test
```

Sobre la anon key: está pensada para vivir en el cliente y es visible en el navegador.
Lo que protege tus datos es la política RLS del paso 2, no ocultar la clave. La
`service_role` key es otra cosa y no debe aparecer nunca en el frontend.

## Copias de seguridad

Aunque uses sincronización, en *Perfil → Copia de seguridad* puedes exportar un JSON e
importarlo después. Te deja volver atrás si borras algo por error, cosa que la nube no hace.
Si no configuras Supabase, esta es tu única red de seguridad: los datos viven solo en este
navegador y se pierden si limpias los datos de navegación o cambias de móvil.

## Dónde tocar las cosas

| Qué | Dónde |
| --- | --- |
| Rangos de g/kg por objetivo | [`src/lib/nutrition.ts`](src/lib/nutrition.ts) |
| Bandas de clasificación del whey | [`src/lib/labels.ts`](src/lib/labels.ts) |
| Catálogo, categorías y plan iniciales | [`src/lib/storage.ts`](src/lib/storage.ts) |
| Sugerencias para cerrar un día | [`src/lib/suggest.ts`](src/lib/suggest.ts) |
| Colores y tipografía | [`src/styles.css`](src/styles.css) |
| Reglas de fusión entre dispositivos | [`src/lib/merge.ts`](src/lib/merge.ts) |
| Orquestación del sync | [`src/sync.tsx`](src/sync.tsx) |

## Nota

Los rangos que usa la app (1.6–2.2 g/kg al día, 20–40 g por toma) son los de consenso
para ganancia de masa muscular en adultos sanos. No es consejo médico: si tienes alguna
condición renal o metabólica, consúltalo antes.
