import { useAuth } from '../auth'
import { clearState } from '../lib/storage'
import { useSync } from '../sync'
import type { SyncStatus } from '../sync'
import { useToast } from '../toast'
import { AuthForm } from './AuthForm'

const STATUS_LABEL: Record<SyncStatus, { text: string; className: string }> = {
  off: { text: 'Sin sincronizar', className: 'pill' },
  syncing: { text: 'Sincronizando…', className: 'pill' },
  ok: { text: 'Al día', className: 'pill streak' },
  offline: { text: 'Sin conexión', className: 'pill warn' },
  error: { text: 'Error', className: 'pill danger' },
}

export function Account() {
  const { enabled, user, offlineUserId, loading, signOut } = useAuth()
  const { status, lastSyncedAt, error, syncNow } = useSync()
  const toast = useToast()

  if (!enabled) {
    return (
      <div className="card">
        <p className="row-sub" style={{ marginTop: 0 }}>
          La sincronización está apagada porque no hay claves de Supabase configuradas. La app
          funciona igual, solo que los datos viven únicamente en este navegador.
        </p>
        <p className="row-sub">
          Para activarla, copia <code>.env.example</code> a <code>.env.local</code>, pega la URL
          y la anon key de tu proyecto, y reinicia el servidor. Las instrucciones completas
          están en el README.
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="card">
        <p className="empty">Comprobando sesión…</p>
      </div>
    )
  }

  if (user) {
    const label = STATUS_LABEL[status]
    return (
      <div className="card">
        <div className="row">
          <div className="row-main">
            <div className="row-title">{user.email}</div>
            <div className="row-sub">
              {lastSyncedAt
                ? `Última sincronización a las ${new Date(lastSyncedAt).toLocaleTimeString(
                    'es-ES',
                    { hour: '2-digit', minute: '2-digit' },
                  )}`
                : 'Todavía sin sincronizar'}
            </div>
          </div>
          <span className={label.className}>{label.text}</span>
        </div>

        {error && <div className="note">⚠️ {error}</div>}

        <div className="btn-row" style={{ marginTop: 14 }}>
          <button className="btn" disabled={status === 'syncing'} onClick={() => void syncNow()}>
            Sincronizar ahora
          </button>
          <button
            className="btn ghost"
            onClick={async () => {
              await signOut()
              toast('Sesión cerrada')
            }}
          >
            Cerrar sesión
          </button>
        </div>

        <p className="row-sub" style={{ marginTop: 12 }}>
          Los cambios se suben solos y se fusionan al volver a la app, así que puedes registrar
          desde el móvil sin cobertura y aparecerá en el portátil.
        </p>

        <div style={{ borderTop: '1px solid var(--line)', marginTop: 14, paddingTop: 14 }}>
          <p className="row-sub" style={{ marginTop: 0, marginBottom: 12 }}>
            Al cerrar sesión, tus datos siguen guardados en este dispositivo para que vuelvas
            a entrar sin conexión. En un móvil prestado querrás lo otro:
          </p>
          <button
            className="btn ghost danger"
            onClick={async () => {
              if (
                !window.confirm(
                  '¿Cerrar sesión y borrar tus datos de este dispositivo? Siguen en tu cuenta: los recuperas al volver a entrar con conexión.',
                )
              ) {
                return
              }
              // Borrar antes de cerrar sesión: después ya no se sabe de quién era.
              if (user) clearState(user.id)
              await signOut()
              toast('Datos borrados de este dispositivo')
            }}
          >
            Cerrar sesión y borrar de aquí
          </button>
        </div>
      </div>
    )
  }

  // Sin sesión viva llegando hasta aquí solo pasa en el modo sin conexión: la
  // puerta de entrada ya te deja pasar con los datos guardados de esta cuenta,
  // pero como no hay token válido no se puede sincronizar todavía.
  return (
    <div className="card">
      {offlineUserId && (
        <div className="note" style={{ marginBottom: 4 }}>
          📡 Sin conexión. Estás viendo los datos guardados de tu última sesión en este
          dispositivo. Entra de nuevo en cuanto tengas red para volver a sincronizar.
        </div>
      )}
      <AuthForm />
    </div>
  )
}
