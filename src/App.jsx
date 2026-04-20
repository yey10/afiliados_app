import { useState } from 'react'
import './App.css'
import DashboardAdmin from './components/DashboardAdmin'
import BusquedaUsuario from './components/BusquedaUsuario'
import { useAuth } from './context/AuthContext'

function App() {
  const {
    user,
    profile,
    loading,
    authLoading,
    role,
    login,
    logout
  } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleLogin = async () => {
    const res = await login(email.trim(), password)
    if (!res.success) {
      alert(res.error)
    }
  }

  // 🔹 Loading inicial
  if (loading) {
    return (
      <div className="app-bg">
        <div className="app-shell">
          <div className="dashboard-card">
            <p className="muted">Cargando sesión...</p>
          </div>
        </div>
      </div>
    )
  }

  // 🔹 Login
  if (!user) {
    return (
      <div className="app-bg">
        <div className="app-shell login-shell-wide">
          <div className="login-card">
            <div className="login-brand">
              <div className="brand-logo-wrap">
                <img src="/icons.svg" alt="Logo" className="brand-logo" />
              </div>
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

            <div className="panel login-panel">
              <h2 className="section-title">Iniciar sesión</h2>

              <input
                className="input"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <input
                className="input"
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              <button
                className="button button-primary button-full"
                onClick={handleLogin}
                disabled={authLoading}
              >
                {authLoading ? 'Cargando...' : 'Entrar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const isAdmin = role === 'admin'
  const isUser = role === 'user'

  return (
    <div className="app-bg">
      <div className="app-shell">
        <div className="dashboard-card">
          
          {/* 🔹 HEADER */}
          <div className="header">
            <div>
              <div className="title-with-logo">
                <img src="/icons.svg" alt="Logo" className="header-logo" />
                <h1 className="title">Sistema de Afiliados</h1>
              </div>
              <p className="subtitle">Panel de control</p>
            </div>

            <div className="header-actions">
              <span className="role-badge">{role}</span>
              <button className="button button-ghost" onClick={logout}>
                Cerrar sesión
              </button>
            </div>
          </div>

          {/* 🔹 PERFIL */}
          <div className="section profile-summary">
            <h3 className="section-title">Sesión</h3>
            <div className="profile-grid">
              <p><b>Email:</b> {user?.email}</p>
              <p><b>Rol:</b> {role}</p>
              <p><b>User ID:</b> {user?.id}</p>
            </div>
          </div>

          {/* 🔹 VISTAS POR ROL */}
          {isAdmin && <DashboardAdmin />}
          {isUser && <BusquedaUsuario />}

          {/* 🔹 ERROR DE ROL */}
          {!isAdmin && !isUser && (
            <div className="section">
              <p className="muted">
                Rol no válido. Usa <code>admin</code> o <code>user</code> en la tabla <code>profiles</code>.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App