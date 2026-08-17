-- Esquema de sincronización. Pégalo entero en el SQL Editor de Supabase y ejecútalo.
-- Es idempotente: puedes volver a ejecutarlo sin romper nada.
--
-- Diseño: una fila por entidad, no un blob JSON por usuario. Eso permite
-- sincronización incremental (solo lo que cambió desde la última vez) y consultas
-- reales sobre el historial, en vez de descargarlo todo para calcular una media.
--
-- Dos marcas de tiempo por fila, y hacen cosas distintas:
--   updated_at        -> reloj del SERVIDOR. Cursor para "tráeme lo nuevo desde X".
--   client_updated_at -> reloj del DISPOSITIVO. Decide quién gana si ambos editan.
-- Mezclarlas rompe la sincronización cuando los relojes no coinciden.

-- La tabla del diseño anterior. Si nunca la creaste, esta línea no hace nada.
drop table if exists public.app_state;

-- ---------------------------------------------------------------- perfil

create table if not exists public.profiles (
  user_id           uuid primary key references auth.users (id) on delete cascade,
  weight_kg         numeric     not null default 75,
  goal              text        not null default 'ganar'
                                check (goal in ('ganar', 'mantener', 'definir')),
  g_per_kg          numeric     not null default 1.9,
  client_updated_at bigint      not null default 0,
  updated_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------- alimentos

-- Sustituye a la tabla `presets`, que guardaba un número fijo de proteína y por
-- tanto no dejaba registrar "200 g de pollo" en vez de 150.
drop table if exists public.presets;

create table if not exists public.foods (
  id                text        not null,
  user_id           uuid        not null references auth.users (id) on delete cascade,
  name              text        not null,
  emoji             text        not null default '🍽️',
  -- La cifra que define al alimento y no depende de cuánto te sirvas.
  protein_per_100g  numeric     not null,
  -- Tu ración habitual: lo que se registra al pulsar el botón una vez.
  default_portion_g numeric     not null default 100,
  -- Sin check() a propósito: si añado una categoría en la app, un cliente viejo
  -- seguiría sincronizando en vez de que el servidor le rechace la fila.
  category          text        not null default 'otros',
  deleted           boolean     not null default false,
  client_updated_at bigint      not null default 0,
  updated_at        timestamptz not null default now(),
  primary key (user_id, id)
);

-- ---------------------------------------------------------------- plan de comidas

-- Las comidas del día: Desayuno, Comida, Post-entreno, Cena…
create table if not exists public.meals (
  id                text        not null,
  user_id           uuid        not null references auth.users (id) on delete cascade,
  name              text        not null,
  -- Para ordenarlas como transcurre el día, no por orden de creación.
  sort_order        integer     not null default 0,
  deleted           boolean     not null default false,
  client_updated_at bigint      not null default 0,
  updated_at        timestamptz not null default now(),
  primary key (user_id, id)
);

-- Qué alimento y cuánto va en cada comida del plan, y qué días de la semana toca.
create table if not exists public.plan_items (
  id                text        not null,
  user_id           uuid        not null references auth.users (id) on delete cascade,
  meal_id           text        not null,
  food_id           text        not null,
  grams             numeric     not null,
  -- Días con lunes = 0. Los siete por defecto: lo que comes a diario es el caso
  -- normal, y así una línea antigua sin este dato sigue significando "todos".
  days              smallint[]  not null default '{0,1,2,3,4,5,6}',
  deleted           boolean     not null default false,
  client_updated_at bigint      not null default 0,
  updated_at        timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.plan_items
  add column if not exists days smallint[] not null default '{0,1,2,3,4,5,6}';

alter table public.foods
  add column if not exists category text not null default 'otros';

-- Ambas nulas = el alimento se registra por peso (comportamiento de siempre).
-- Ambas presentes = se piensa "por unidades" (1 plátano, 2 huevos).
alter table public.foods
  add column if not exists unit_label text,
  add column if not exists unit_grams numeric;

-- Sin claves foráneas a meals/foods a propósito: al sincronizar, las filas de dos
-- tablas pueden llegar en cualquier orden, y una foránea rechazaría el item que
-- llega antes que su comida. La app ignora los items huérfanos, que es más
-- tolerante y no pierde datos.

-- ---------------------------------------------------------------- historial diario

create table if not exists public.log_entries (
  id                text        not null,
  user_id           uuid        not null references auth.users (id) on delete cascade,
  entry_date        date        not null,
  name              text        not null,
  protein           numeric     not null,
  -- Cuántos gramos comiste y de qué alimento. Nulos cuando lo metiste a mano
  -- como proteína suelta, sin pasar por el catálogo.
  grams             numeric,
  food_id           text,
  ts                bigint      not null,
  -- Borrado lógico: un borrado tiene que viajar al otro dispositivo. Si la fila
  -- desapareciera sin más, el otro móvil la volvería a subir en la siguiente sync.
  deleted           boolean     not null default false,
  client_updated_at bigint      not null default 0,
  updated_at        timestamptz not null default now(),
  primary key (user_id, id)
);

-- `create table if not exists` NO añade columnas a una tabla que ya existe: se la
-- salta entera. Estos alter son los que hacen que el script sirva también para
-- actualizar un esquema antiguo, no solo para crearlo de cero.
alter table public.log_entries add column if not exists grams        numeric;
alter table public.log_entries add column if not exists food_id      text;
-- De qué línea del plan salió, para marcarla como hecha hoy sin una tabla aparte.
alter table public.log_entries add column if not exists plan_item_id text;

-- Para "dame los días de este mes" sin recorrer todo el historial.
create index if not exists log_entries_by_date
  on public.log_entries (user_id, entry_date desc);

-- Para el cursor de sincronización incremental.
create index if not exists log_entries_by_updated
  on public.log_entries (user_id, updated_at);

-- ---------------------------------------------------------------- peso corporal

create table if not exists public.weigh_ins (
  -- El id ES la fecha (YYYY-MM-DD). Así solo cabe una pesada por día sin lógica
  -- extra, y pesarte dos veces el mismo día simplemente corrige la anterior.
  id                text        not null,
  user_id           uuid        not null references auth.users (id) on delete cascade,
  weight_kg         numeric     not null,
  deleted           boolean     not null default false,
  client_updated_at bigint      not null default 0,
  updated_at        timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists weigh_ins_by_updated
  on public.weigh_ins (user_id, updated_at);

-- ---------------------------------------------------------------- suplementos

create table if not exists public.supplements (
  id                  text        not null,
  user_id             uuid        not null references auth.users (id) on delete cascade,
  name                text        not null,
  unit_label          text        not null default 'toma',
  servings_total      numeric     not null,
  servings_left       numeric     not null,
  servings_per_day    numeric     not null,
  grams_per_serving   numeric     not null default 0,
  protein_per_serving numeric     not null default 0,
  -- Una fecha por día tomado: ~4 KB al año. No merece tabla propia, y así la
  -- racha se lee de un tirón sin un join.
  taken_dates         text[]      not null default '{}',
  deleted             boolean     not null default false,
  client_updated_at   bigint      not null default 0,
  updated_at          timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists supplements_by_updated
  on public.supplements (user_id, updated_at);

-- ---------------------------------------------------------------- updated_at automático

-- Sin esto, un cliente podría enviar un updated_at cualquiera y romper el cursor
-- de los demás dispositivos. El servidor lo pone siempre él.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_profiles    on public.profiles;
drop trigger if exists touch_foods       on public.foods;
drop trigger if exists touch_meals       on public.meals;
drop trigger if exists touch_plan_items  on public.plan_items;
drop trigger if exists touch_log_entries on public.log_entries;
drop trigger if exists touch_weigh_ins   on public.weigh_ins;
drop trigger if exists touch_supplements on public.supplements;

create trigger touch_profiles    before insert or update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger touch_foods       before insert or update on public.foods
  for each row execute function public.touch_updated_at();
create trigger touch_meals       before insert or update on public.meals
  for each row execute function public.touch_updated_at();
create trigger touch_plan_items  before insert or update on public.plan_items
  for each row execute function public.touch_updated_at();
create trigger touch_log_entries before insert or update on public.log_entries
  for each row execute function public.touch_updated_at();
create trigger touch_weigh_ins   before insert or update on public.weigh_ins
  for each row execute function public.touch_updated_at();
create trigger touch_supplements before insert or update on public.supplements
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- seguridad

-- Esto es lo único que separa tus datos de ser públicos: la anon key viaja en el
-- bundle del navegador y cualquiera puede leerla.
--
-- Escrito de forma explícita y repetitiva a propósito. Un bucle `do $$ execute
-- format(...) $$` queda más corto, pero genera el SQL en tiempo de ejecución y
-- entonces ni el analizador de Supabase ni tú podéis comprobar de un vistazo que
-- las cuatro tablas quedan protegidas. En seguridad, verificable gana a compacto.

alter table public.profiles    enable row level security;
alter table public.foods       enable row level security;
alter table public.meals       enable row level security;
alter table public.plan_items  enable row level security;
alter table public.log_entries enable row level security;
alter table public.weigh_ins   enable row level security;
alter table public.supplements enable row level security;

drop policy if exists "solo mis filas" on public.profiles;
drop policy if exists "solo mis filas" on public.foods;
drop policy if exists "solo mis filas" on public.meals;
drop policy if exists "solo mis filas" on public.plan_items;
drop policy if exists "solo mis filas" on public.log_entries;
drop policy if exists "solo mis filas" on public.weigh_ins;
drop policy if exists "solo mis filas" on public.supplements;

create policy "solo mis filas" on public.profiles
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "solo mis filas" on public.foods
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "solo mis filas" on public.meals
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "solo mis filas" on public.plan_items
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "solo mis filas" on public.log_entries
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "solo mis filas" on public.weigh_ins
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "solo mis filas" on public.supplements
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
