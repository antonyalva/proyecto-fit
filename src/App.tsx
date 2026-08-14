import { useState } from 'react'
import { StoreProvider } from './store'
import { AuthProvider, useAuth } from './auth'
import { SyncProvider } from './sync'
import { ToastProvider } from './toast'
import { Login } from './screens/Login'
import { Today } from './screens/Today'
import { Plan } from './screens/Plan'
import { Foods } from './screens/Foods'
import { Supplements } from './screens/Supplements'
import { Label } from './screens/Label'
import { Profile } from './screens/Profile'

type Tab = 'hoy' | 'plan' | 'alimentos' | 'suplementos' | 'etiqueta' | 'perfil'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'hoy', label: 'HOY', icon: '◎' },
  { id: 'plan', label: 'PLAN', icon: '📋' },
  { id: 'alimentos', label: 'COMIDA', icon: '🍗' },
  { id: 'suplementos', label: 'BOTES', icon: '🥤' },
  { id: 'etiqueta', label: 'ETIQ.', icon: '🔍' },
  { id: 'perfil', label: 'PERFIL', icon: '⚙' },
]

export default function App() {
  // Auth y Toast van por fuera de la puerta: la pantalla de login también
  // necesita avisar de errores, y decide sola si se llega a ver la app.
  return (
    <AuthProvider>
      <ToastProvider>
        <Gate />
      </ToastProvider>
    </AuthProvider>
  )
}

/**
 * La puerta de entrada. Sin cuenta configurada (sin claves de Supabase) no hay
 * nada que decidir: la app es local y se abre igual que siempre. Con cuenta
 * configurada, hace falta sesión —viva, o recordada sin conexión— para pasar.
 */
function Gate() {
  const { enabled, loading, activeUserId } = useAuth()

  if (enabled && loading) return <Splash />
  if (enabled && !activeUserId) return <Login />

  return (
    <StoreProvider>
      <SyncProvider>
        <AppShell />
      </SyncProvider>
    </StoreProvider>
  )
}

function Splash() {
  return (
    <div className="login-screen">
      <div className="splash-mark" aria-hidden="true" />
    </div>
  )
}

function AppShell() {
  const [tab, setTab] = useState<Tab>('hoy')

  return (
    <>
      <main className="app">
        {tab === 'hoy' && <Today onGoToProfile={() => setTab('perfil')} />}
        {tab === 'plan' && <Plan />}
        {tab === 'alimentos' && <Foods />}
        {tab === 'suplementos' && <Supplements />}
        {tab === 'etiqueta' && <Label />}
        {tab === 'perfil' && <Profile />}
      </main>
      <nav className="nav">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'on' : ''}
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => setTab(t.id)}
          >
            <span className="nav-icon">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </>
  )
}
