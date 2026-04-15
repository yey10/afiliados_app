import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import './App.css'

function App() {
  const [user, setUser] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    documento: '',
    fecha_ingreso: ''
  })

  const [busqueda, setBusqueda] = useState('')
  const [afiliados, setAfiliados] = useState([])
  const [modalAbierto, setModalAbierto] = useState(false)

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser()
      if (data.user) setUser(data.user)
    }
    getUser()
  }, [])

  useEffect(() => {
    if (user) {
      listarAfiliados()
    }
  }, [user])

  const login = async () => {
    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) alert(error.message)
    else setUser(data.user)
    setLoading(false)
  }

  const logout = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const limpiarFormulario = () => {
    setForm({
      nombre: '',
      apellido: '',
      documento: '',
      fecha_ingreso: ''
    })
  }

  const listarAfiliados = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('clientes')
      .select('id, nombre, apellido, documento, fecha_ingreso')
      .order('fecha_ingreso', { ascending: false })

    if (error) {
      alert('Error al listar afiliados: ' + error.message)
      setAfiliados([])
    } else {
      setAfiliados(data || [])
    }

    setLoading(false)
  }

  const guardar = async () => {
    const nombreLimpio = form.nombre.trim()
    const documentoLimpio = form.documento.trim()

    if (!nombreLimpio || !documentoLimpio) {
      alert('Nombre y documento son obligatorios')
      return
    }

    setLoading(true)

    const { data: existente, error: errorDuplicado } = await supabase
      .from('clientes')
      .select('id')
      .eq('documento', documentoLimpio)
      .maybeSingle()

    if (errorDuplicado) {
      alert('Error al validar documento: ' + errorDuplicado.message)
      setLoading(false)
      return
    }

    if (existente) {
      alert('Ya existe un afiliado con ese documento')
      setLoading(false)
      return
    }

    const payload = {
      ...form,
      nombre: nombreLimpio,
      documento: documentoLimpio
    }

    const { error } = await supabase.from('clientes').insert([payload])

    if (error) {
      alert('Error: ' + error.message)
    } else {
      alert('Afiliado guardado')
      limpiarFormulario()
      setModalAbierto(false)
      await listarAfiliados()
    }

    setLoading(false)
  }

  const afiliadosFiltrados = afiliados.filter((item) =>
    (item.documento || '').toLowerCase().includes(busqueda.toLowerCase())
  )

  if (!user) {
    return (
      <div className="app-bg">
        <div className="app-shell login-shell">
          <h1 className="title">Sistema de Afiliados</h1>
          <p className="subtitle">Acceso al panel de gestión</p>

          <div className="panel">
            <h2 className="section-title">Login</h2>
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
            <button className="button button-primary button-full" onClick={login} disabled={loading}>
            {loading ? 'Cargando...' : 'Entrar'}
          </button>
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
              <p className="subtitle">Panel de control</p>
            </div>
            <button className="button button-ghost" onClick={logout}>Cerrar sesión</button>
          </div>

          <div className="section">
            <div className="actions-row">
              <button className="button button-primary" onClick={() => setModalAbierto(true)}>
                Crear Afiliado
              </button>
            </div>

            <div className="search-wrap">
              <span className="search-icon" aria-hidden="true">🔍</span>
              <input
                className="input search-input"
                placeholder="Buscar por documento"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>

            <div className={`table-wrapper ${loading ? 'table-loading' : 'table-loaded'}`}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Apellido</th>
                    <th>Documento</th>
                    <th>Fecha ingreso</th>
                  </tr>
                </thead>
                <tbody>
                  {afiliadosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="empty-row">Sin resultados</td>
                    </tr>
                  ) : (
                    afiliadosFiltrados.map((item, index) => (
                      <tr
                        key={item.id}
                        style={{ animationDelay: `${index * 50}ms` }}
                        className="data-row"
                      >
                        <td>{item.nombre}</td>
                        <td>{item.apellido}</td>
                        <td>{item.documento}</td>
                        <td>{item.fecha_ingreso}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {modalAbierto && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="section-title no-margin">Crear Afiliado</h2>
              <button
                className="close-button"
                onClick={() => {
                  limpiarFormulario()
                  setModalAbierto(false)
                }}
                disabled={loading}
                aria-label="Cerrar modal"
              >
                X
              </button>
            </div>

            <input className="input" name="nombre" placeholder="Nombre" value={form.nombre} onChange={handleChange} />
            <input className="input" name="apellido" placeholder="Apellido" value={form.apellido} onChange={handleChange} />
            <input className="input" name="documento" placeholder="Documento" value={form.documento} onChange={handleChange} />
            <input className="input" type="date" name="fecha_ingreso" value={form.fecha_ingreso} onChange={handleChange} />

            <div className="actions-row no-bottom">
              <button className="button button-primary" onClick={guardar} disabled={loading}>
                {loading ? 'Guardando...' : 'Agregar Afiliado'}
              </button>
              <button
                className="button button-ghost"
                onClick={() => {
                  limpiarFormulario()
                  setModalAbierto(false)
                }}
                disabled={loading}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App