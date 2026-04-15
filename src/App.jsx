import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import './App.css'
import DashboardAdmin from './components/DashboardAdmin'
import BusquedaUsuario from './components/BusquedaUsuario'
import PerfilAfiliado from './components/PerfilAfiliado'

function App() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [profileSource, setProfileSource] = useState('none')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser()
      if (data.user) {
        setUser(data.user)
        await cargarPerfil(data.user)
      }
      setLoading(false)
    }
    getUser()
  }, [])

  const cargarPerfil = async (authUser) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle()

    if (error) {
      alert('No se pudo cargar el perfil: ' + error.message)
      setProfile(null)
      setUserRole('user')
      setProfileSource('none')
      return
    }

    let perfil = data || null
    let source = 'id'

    if (!perfil && authUser.email) {
      const { data: dataByEmail, error: errorByEmail } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', authUser.email)
        .maybeSingle()

      if (!errorByEmail && dataByEmail) {
        perfil = dataByEmail
        source = 'email'
      }
    }

    const rolNormalizado = (perfil?.role || 'user').toString().trim().toLowerCase()
    setProfile(perfil)
    setUserRole(rolNormalizado)
    setProfileSource(perfil ? source : 'none')

    if (!perfil) {
      alert('Tu usuario no tiene perfil en la tabla profiles. Se aplicara rol user por defecto.')
    }
  }

  const login = async () => {
    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      alert(error.message)
      setLoading(false)
      return
    }

    setUser(data.user)
    await cargarPerfil(data.user)
    setLoading(false)
  }

  const logout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setUserRole(null)
    setProfileSource('none')
    setEmail('')
    setPassword('')
  }

  const roleView = userRole === 'admin'
    ? 'admin'
    : (profile?.cliente_id || profile?.documento)
      ? 'afiliado'
      : 'user'

  if (!user) {
    return (
      <div className="app-bg">
        <div className="app-shell login-shell-wide">
          <div className="login-card">
            <div className="login-brand">
              <span className="login-kicker">SISTEMA EMPRESARIAL</span>
              <h1 className="login-title">Sistema de Afiliados</h1>
              <p className="login-text">
                Gestiona afiliados, consultas y beneficiarios desde un panel seguro y profesional.
              </p>

              <div className="login-badges">
                <span className="login-badge">Seguridad de acceso</span>
                <span className="login-badge">Control por roles</span>
                <span className="login-badge">Auditoria de consultas</span>
              </div>
            </div>

            <div className="panel login-panel">
              <h2 className="section-title">Iniciar sesión</h2>
              <p className="muted login-helper">Ingresa tus credenciales para continuar.</p>

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
              <button className="button button-primary button-full login-submit" onClick={login} disabled={loading}>
                {loading ? 'Cargando...' : 'Entrar al sistema'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app-bg">
      <div className="app-shell">
        <div className="dashboard-card">
          <div className="header">
            <div>
              <h1 className="title">Sistema de Afiliados</h1>
              <p className="subtitle">Panel de control por rol</p>
            </div>
            <div className="header-actions">
              <span className="role-badge">{roleView}</span>
              <button className="button button-ghost" onClick={logout}>Cerrar sesión</button>
            </div>
          </div>

          <div className="section profile-summary">
            <h3 className="section-title">Perfil de sesión</h3>
            <div className="profile-grid">
              <p><b>Email:</b> {user?.email || 'Sin email'}</p>
              <p><b>Rol (profiles):</b> {userRole || 'user'}</p>
              <p><b>Vista aplicada:</b> {roleView}</p>
              <p><b>Perfil cargado por:</b> {profileSource}</p>
              <p><b>User ID:</b> {user?.id || '-'}</p>
            </div>
          </div>

          {roleView === 'admin' && <DashboardAdmin />}
          {roleView === 'user' && <BusquedaUsuario user={user} />}
          {roleView === 'afiliado' && <PerfilAfiliado user={user} profile={profile} />}

          {!['admin', 'user', 'afiliado'].includes(roleView || '') && (
            <div className="section">
              <p className="muted">
                No se reconoce el rol de este usuario. Configura el campo `role` en la tabla `profiles`.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App