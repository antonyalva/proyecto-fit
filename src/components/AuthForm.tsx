import { useState } from 'react'
import { useAuth } from '../auth'
import { useToast } from '../toast'

/**
 * El formulario de entrar/crear cuenta, sin el marco alrededor.
 *
 * Vive aparte de dónde se usa: la puerta de entrada de la app lo pinta a
 * pantalla completa, y Perfil lo reutiliza igual dentro de una tarjeta cuando
 * estás sin conexión y sin sesión viva. Una sola copia de la lógica de
 * traducción de errores y del caso de confirmación por email.
 */
export function AuthForm({ onSuccess }: { onSuccess?: () => void } = {}) {
  const { signIn, signUp } = useAuth()
  const toast = useToast()

  const [mode, setMode] = useState<'entrar' | 'crear'>('entrar')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)

  async function submit() {
    if (!email.trim() || password.length < 6) {
      setFormError('Escribe tu email y una contraseña de al menos 6 caracteres.')
      return
    }
    setBusy(true)
    setFormError(null)
    setPendingEmail(null)

    if (mode === 'entrar') {
      const message = await signIn(email.trim(), password)
      setBusy(false)
      if (message) {
        setFormError(message)
        return
      }
      setPassword('')
      toast('Sesión iniciada')
      onSuccess?.()
      return
    }

    const { error: message, needsConfirmation } = await signUp(email.trim(), password)
    setBusy(false)
    if (message) {
      setFormError(message)
      return
    }
    setPassword('')

    if (needsConfirmation) {
      // Hay cuenta pero todavía no hay sesión. Sin decirlo, la pantalla se quedaría
      // igual y parecería que el registro ha fallado.
      setPendingEmail(email.trim())
      setMode('entrar')
      return
    }
    toast('Cuenta creada')
    onSuccess?.()
  }

  return (
    <>
      <div className="field">
        <div className="seg">
          <button className={mode === 'entrar' ? 'on' : ''} onClick={() => setMode('entrar')}>
            Entrar
          </button>
          <button className={mode === 'crear' ? 'on' : ''} onClick={() => setMode('crear')}>
            Crear cuenta
          </button>
        </div>
      </div>

      <div className="field">
        <label htmlFor="a-email">Email</label>
        <input
          id="a-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="a-password">Contraseña</label>
        <input
          id="a-password"
          type="password"
          autoComplete={mode === 'entrar' ? 'current-password' : 'new-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void submit()}
        />
      </div>

      {pendingEmail && (
        <div className="note">
          ✉️ Cuenta creada. Te hemos enviado un correo a <strong>{pendingEmail}</strong>: pulsa
          el enlace para confirmarla y luego entra aquí con tu contraseña. Hasta que la
          confirmes, no se puede iniciar sesión.
        </div>
      )}

      {formError && <div className="note">{formError}</div>}

      <button
        className="btn primary"
        style={{ width: '100%', marginTop: 6 }}
        disabled={busy}
        onClick={() => void submit()}
      >
        {busy ? 'Un momento…' : mode === 'entrar' ? 'Entrar' : 'Crear cuenta'}
      </button>

      <p className="row-sub" style={{ marginTop: 12 }}>
        {mode === 'crear'
          ? 'Al crear la cuenta, lo que ya tienes en este navegador se sube tal cual. No se pierde nada.'
          : 'Al entrar, lo local y lo del servidor se fusionan: no se sobrescribe ningún registro.'}
      </p>
    </>
  )
}
