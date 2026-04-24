/**
 * App.jsx
 * Shell de la aplicación con logo grande en login.
 */
import { useState } from 'react'
import './App.css'
import { useAuth }     from './context/AuthContext'
import DashboardAdmin  from './components/DashboardAdmin'
import BusquedaUsuario from './components/BusquedaUsuario'
import { Spinner }     from './components/ui'
import logoImg         from './assets/logo.jpeg'

function LoginScreen() {
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
            {/* Logo grande en login */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
              <img
                src={logoImg}
                alt="Logo"
                style={{ height: 120, maxWidth: 280, objectFit: 'contain', borderRadius: 12 }}
              />
            </div>
            <span className="login-kicker">SISTEMA EMPRESARIAL</span>
            <h1 className="login-title">Sistema de Afiliados Casa Funeral La última Morada</h1>
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

            <div style={{ position: 'relative', marginBottom: 10 }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: '#9ca3af' }}>✉</span>
              <input
                className="input"
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="username"
                required
                style={{ paddingLeft: 32 }}
              />
            </div>
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: '#9ca3af' }}>🔒</span>
              <input
                className="input"
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                style={{ paddingLeft: 32 }}
              />
            </div>
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

export default function App() {
  const { user, loading, authLoading, role, isAdmin, isUser, logout } = useAuth()

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

  if (!user) return <LoginScreen />

  return (
    <div className="app-bg">
      <div className="app-shell">
        <div className="dashboard-card">

          <div className="header">
            <div>
              <div className="title-with-logo">
                <h1 className="title">Sistema de Afiliados Casa Funeral La última Morada</h1>
              </div>
              <p className="sub              const FORM_EMPTY = {
                nombre: '',
                apellido: '',
                documento: '',
                fecha_ingreso: '',
                fecha_nacimiento: '',
                telefono: '',
                correo: '',
                direccion: '',
                asesor: '',
              }
              
              // ...existing code...
              async function crearAfiliado(e) {
                e.preventDefault()
                setFormMsg(null)
                const nombre = form.nombre.trim()
                const documento = form.documento.trim()
              
                if (!nombre || !documento) {
                  setFormMsg({ type: 'error', text: 'Nombre y documento son obligatorios.' })
                  return
                }
              
                setFormLoading(true)
              
                const { data: dup } = await supabase
                  .from('clientes').select('id').eq('documento', documento).maybeSingle()
              
                if (dup) {
                  setFormMsg({ type: 'error', text: 'Ya existe un afiliado con ese documento.' })
                  setFormLoading(false)
                  return
                }
              
                const { error } = await supabase.from('clientes').insert([{
                  nombre,
                  apellido:         form.apellido.trim()         || '',
                  documento,
                  fecha_ingreso:    form.fecha_ingreso            || null,
                  fecha_nacimiento: form.fecha_nacimiento         || null,
                  telefono:         form.telefono.trim()          || null,
                  correo:           form.correo.trim()            || null,
                  direccion:        form.direccion.trim()         || null,
                  asesor:           form.asesor.trim()            || null,
                  estado:           'activo',
                }])
              
                if (error) {
                  setFormMsg({ type: 'error', text: error.message })
                } else {
                  setFormMsg({ type: 'ok', text: 'Afiliado creado correctamente.' })
                  setForm(FORM_EMPTY)
                }
              
                setFormLoading(false)
              }
              // ...existing code...
              {[
                { lbl: 'Cédula *',        key: 'documento' },
                { lbl: 'Nombre *',        key: 'nombre' },
                { lbl: 'Apellido',        key: 'apellido' },
                { lbl: 'Teléfono',        key: 'telefono' },
                { lbl: 'Correo',          key: 'correo', type: 'email' },
                { lbl: 'Dirección',       key: 'direccion' },
                { lbl: 'Asesor',          key: 'asesor' },
                { lbl: 'Fecha Nacimiento',key: 'fecha_nacimiento', type: 'date' },
                { lbl: 'Fecha Ingreso',   key: 'fecha_ingreso', type: 'date' },
              ].map(({ lbl, key, type }) => (
                <div key={key} style={s.fieldGroup}>
                  <label style={s.label}>{lbl}:</label>
                  <input
                    style={s.input}
                    type={type || 'text'}
                    value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    disabled={formLoading}
                  />
                </div>
              ))}title">Panel de control</p>
            </div>
            <div className="header-actions">
              <span className="role-badge">{role}</span>
              <span style={{ fontSize: 13, color: '#6b7280' }}>{user.email}</span>
              <button className="button button-ghost" onClick={logout} disabled={authLoading}>
                {authLoading ? <Spinner size={12} /> : 'Cerrar sesión'}
              </button>
            </div>
          </div>

          {isAdmin && <DashboardAdmin />}
          {isUser  && <BusquedaUsuario />}

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
