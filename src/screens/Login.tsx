import { AuthForm } from '../components/AuthForm'

/**
 * La puerta de entrada. Sin sesión —viva o recordada sin conexión— no se llega
 * a ver ni un gramo de nadie: cada cuenta tiene su propio plan, y esta pantalla
 * es lo que hace que eso sea real y no solo una promesa de las políticas RLS.
 */
export function Login() {
  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="30" height="30">
            <circle
              cx="12"
              cy="12"
              r="9"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeDasharray="42 14"
              strokeLinecap="round"
              opacity="0.9"
            />
            <path
              d="M9 8v8M12 6.5v11M15 8v8"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <h1 style={{ marginBottom: 2 }}>Proteína &amp; Suplementos</h1>
        <p className="sub" style={{ marginBottom: 20 }}>
          Entra con tu cuenta para ver tu plan. Cada cuenta tiene el suyo, separado del
          de cualquier otra persona que use este mismo móvil.
        </p>
        <AuthForm />
      </div>
    </div>
  )
}
