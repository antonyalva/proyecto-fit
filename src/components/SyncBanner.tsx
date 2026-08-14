import { useAuth } from '../auth'
import { useSync } from '../sync'

/**
 * Aviso de que lo que estás registrando no sale de este dispositivo.
 *
 * Sin esto se puede usar la app durante semanas creyendo que sincroniza, y
 * descubrirlo el día que cambias de móvil, que es el peor momento posible.
 * Callado cuando todo va bien: un aviso permanente deja de leerse.
 */
export function SyncBanner({ onFix }: { onFix: () => void }) {
  const { enabled, user, offlineUserId, loading } = useAuth()
  const { status, error } = useSync()

  if (!enabled || loading) return null

  // Con la puerta de entrada, llegar aquí sin sesión viva solo pasa en un caso:
  // abriste la app sin red y se te dejó pasar con los datos de tu última
  // sesión. No es "nunca iniciaste sesión" — ya no hay forma de llegar así.
  if (!user && offlineUserId) {
    return (
      <div className="banner quiet">
        <span className="banner-icon">📡</span>
        <span>
          Sin conexión: viendo tus datos guardados. Se sincroniza solo en cuanto vuelvas a
          tener red.
        </span>
      </div>
    )
  }

  if (!user) return null

  if (status === 'error') {
    return (
      <button className="banner" onClick={onFix}>
        <span className="banner-icon">⚠️</span>
        <span>
          <strong>La sincronización está fallando.</strong> {error}
          <span className="banner-cta">Ver detalles →</span>
        </span>
      </button>
    )
  }

  if (status === 'offline') {
    return (
      <div className="banner quiet">
        <span className="banner-icon">📡</span>
        <span>
          Sin conexión. Se guarda aquí y se subirá solo cuando vuelvas a tener red.
        </span>
      </div>
    )
  }

  return null
}
