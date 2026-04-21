/**
 * App.jsx
 * Shell de la aplicación:
 * - Pantalla de login
 * - Despacho por rol (admin / user)
 * - Header con info de sesión y logout
 */
import { useState } from 'react'
import './App.css'
import { useAuth }          from './context/AuthContext'
import DashboardAdmin       from './components/DashboardAdmin'
import BusquedaUsuario      from './components/BusquedaUsuario'
import { Spinner }          from './components/ui'

function LoginScreen({ loading }) {
  const { login, authLoading } = useAuth()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState(null)

  async function handleLogin(e) {
    e.preventDefault()
    setError(null)
    const res = await login(email.trim(), password)
    if (!res.success) setError(res.error)
  }

  return (
    <div className="app-bg">
      <div className="app-shell login-shell-wide">
        <div className="login-card">
          <div className="login-brand">
            <span className="login-kicker">SISTEMA EMPRESARIAL</span>
            <h1 className="login-title">Sistema de Afiliados</h1>
            <p className="login-text">
              Gestiona afiliados, consultas y beneficiarios desde un panel seguro.
            </p>
            <div className="login-badges">
              <span className="login-badge">Seguridad</span>
              <span className="login-badge">Roles</span>
              <span className="login-badge">Auditoría</span>
            </div>
          </div>

          <form className="panel login-panel" onSubmit={handleLogin}>
            <h2 className="section-title">Iniciar sesión</h2>

            {error && (
              <div style={{
                background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626',
                borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 8
              }}>
                {error}
              </div>
            )}

            <input
              className="input"
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
            <input
              className="input"
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <button
              className="button button-primary button-full"
              type="submit"
              disabled={authLoading}
            >
              {authLoading ? <><Spinner size={14} /> Entrando…</> : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────

export default function App() {
  const { user, profile, loading, authLoading, role, isAdmin, isUser, logout } = useAuth()

  // 1. Sesión inicializando
  if (loading) {
    return (
      <div className="app-bg">
        <div className="app-shell">
          <div className="dashboard-card" style={{ textAlign: 'center', padding: 48 }}>
            <Spinner size={28} />
            <p className="muted" style={{ marginTop: 12 }}>Cargando sesión…</p>
          </div>
        </div>
      </div>
    )
  }

  // 2. No autenticado
  if (!user) return <LoginScreen />

  // 3. Autenticado — mostrar dashboard
  return (
    <div className="app-bg">
      <div className="app-shell">
        <div className="dashboard-card">

          {/* Header */}
          <div className="header">
            <div>
              <div className="title-with-logo">
                <h1 className="title">Sistema de Afiliados</h1>
              </div>
              <p className="subtitle">Panel de control</p>
            </div>
            <div className="header-actions">
              <span className="role-badge">{role}</span>
              <span style={{ fontSize: 13, color: '#6b7280' }}>{user.email}</span>
              <button className="button button-ghost" onClick={logout} disabled={authLoading}>
                {authLoading ? <Spinner size={12} /> : 'Cerrar sesión'}
              </button>
            </div>
          </div>

          {/* Vista por rol */}
          {isAdmin && <DashboardAdmin />}
          {isUser  && <BusquedaUsuario />}

          {/* Rol desconocido — ayuda al developer */}
          {!isAdmin && !isUser && (
            <div className="section">
              <div style={{
                background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8,
                padding: '14px 18px', color: '#92400e', fontSize: 13
              }}>
                <strong>Rol no reconocido: "{role}"</strong>
                <p style={{ margin: '6px 0 0' }}>
                  Edita la columna <code>role</code> de la tabla <code>profiles</code> para este usuario.
                  Los valores válidos son <code>admin</code> y <code>user</code>.
                </p>
                <p style={{ margin: '6px 0 0', fontSize: 11, color: '#6b7280' }}>
                  User ID: <code>{user.id}</code>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}