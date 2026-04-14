import { useState, useEffect } from 'react'
import { supabase } from './supabase'

function App() {
  const [user, setUser] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Check if user is already logged in
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUser(user)
        // For demo purposes, check if email contains 'admin' to determine role
        setUserRole(user.email.includes('admin') ? 'admin' : 'user')
      }
    }
    checkUser()
  }, [])

  const login = async () => {
    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    if (error) {
      alert(error.message)
    } else {
      setUser(data.user)
      // For demo purposes, check if email contains 'admin' to determine role
      setUserRole(data.user.email.includes('admin') ? 'admin' : 'user')
    }
    setLoading(false)
  }

  const logout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setUserRole(null)
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Iniciar Sesión
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Accede a tu cuenta de afiliados
            </p>
          </div>
          <form className="mt-8 space-y-6" onSubmit={(e) => { e.preventDefault(); login(); }}>
            <input type="hidden" name="remember" value="true" />
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <label htmlFor="email-address" className="sr-only">
                  Correo electrónico
                </label>
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="Correo electrónico"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="password" className="sr-only">
                  Contraseña
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="Contraseña"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {loading ? 'Cargando...' : 'Iniciar Sesión'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  return <Sistema user={user} userRole={userRole} onLogout={logout} />
}

function Sistema({ user, userRole, onLogout }) {
  const [activeTab, setActiveTab] = useState(userRole === 'admin' ? 'dashboard' : 'crear')
  const [stats, setStats] = useState({ total: 0, nuevos: 0 })

  // Form states
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    documento: '',
    fecha_ingreso: '',
    telefono: '',
    email: '',
    direccion: ''
  })

  const [busqueda, setBusqueda] = useState('')
  const [resultado, setResultado] = useState(null)
  const [loading, setLoading] = useState(false)

  // Load dashboard stats
  useEffect(() => {
    if (activeTab === 'dashboard' && userRole === 'admin') {
      loadStats()
    }
  }, [activeTab])

  const loadStats = async () => {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')

      if (error) throw error

      const total = data.length
      const nuevos = data.filter(cliente => {
        const fechaIngreso = new Date(cliente.fecha_ingreso)
        const haceUnMes = new Date()
        haceUnMes.setMonth(haceUnMes.getMonth() - 1)
        return fechaIngreso > haceUnMes
      }).length

      setStats({ total, nuevos })
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const guardar = async () => {
    setLoading(true)
    const { error } = await supabase.from('clientes').insert([form])
    if (error) {
      alert(error.message)
    } else {
      alert('Afiliado guardado exitosamente')
      setForm({
        nombre: '',
        apellido: '',
        documento: '',
        fecha_ingreso: '',
        telefono: '',
        email: '',
        direccion: ''
      })
      if (userRole === 'admin') {
        loadStats() // Refresh stats
      }
    }
    setLoading(false)
  }

  const buscar = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('documento', busqueda)
      .single()

    if (error) {
      alert('Afiliado no encontrado')
      setResultado(null)
    } else {
      setResultado(data)
    }
    setLoading(false)
  }

  const tabs = [
    ...(userRole === 'admin' ? [{ id: 'dashboard', name: 'Dashboard', icon: '📊' }] : []),
    { id: 'crear', name: 'Crear Afiliado', icon: '➕' },
    { id: 'consultar', name: 'Consultar Afiliado', icon: '🔍' }
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <h1 className="text-3xl font-bold text-gray-900">Sistema de Afiliados</h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {userRole === 'admin' ? '👑 Administrador' : '👤 Usuario'}: {user.email}
              </span>
              <button
                onClick={onLogout}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Navigation Tabs */}
          <div className="mb-8">
            <nav className="flex space-x-8" aria-label="Tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          {activeTab === 'dashboard' && userRole === 'admin' && (
            <Dashboard stats={stats} />
          )}

          {activeTab === 'crear' && (
            <CrearAfiliado
              form={form}
              handleChange={handleChange}
              guardar={guardar}
              loading={loading}
            />
          )}

          {activeTab === 'consultar' && (
            <ConsultarAfiliado
              busqueda={busqueda}
              setBusqueda={setBusqueda}
              buscar={buscar}
              resultado={resultado}
              loading={loading}
            />
          )}
        </div>
      </main>
    </div>
  )
}

function Dashboard({ stats }) {
  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">📊 Dashboard Administrativo</h2>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {/* Total Afiliados */}
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-3xl">👥</span>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium">Total Afiliados</h3>
                <p className="text-3xl font-bold">{stats.total}</p>
              </div>
            </div>
          </div>

          {/* Nuevos Afiliados */}
          <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-6 text-white">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-3xl">🆕</span>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium">Nuevos este mes</h3>
                <p className="text-3xl font-bold">{stats.nuevos}</p>
              </div>
            </div>
          </div>

          {/* Tasa de crecimiento */}
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-6 text-white">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-3xl">📈</span>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium">Tasa de Crecimiento</h3>
                <p className="text-3xl font-bold">
                  {stats.total > 0 ? Math.round((stats.nuevos / stats.total) * 100) : 0}%
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Gráfico de resumen */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Resumen del Sistema</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-600">Afiliados Activos</span>
              <span className="text-lg font-bold text-green-600">{stats.total}</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-600">Nuevos Afiliados</span>
              <span className="text-lg font-bold text-blue-600">{stats.nuevos}</span>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-600">Base de Datos</span>
              <span className="text-lg font-bold text-purple-600">Supabase</span>
            </div>
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-600">Estado del Sistema</span>
              <span className="text-lg font-bold text-green-600">✅ Operativo</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CrearAfiliado({ form, handleChange, guardar, loading }) {
  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">➕ Registrar Nuevo Afiliado</h2>
      <form onSubmit={(e) => { e.preventDefault(); guardar(); }} className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="nombre" className="block text-sm font-medium text-gray-700">
            Nombre
          </label>
          <input
            type="text"
            name="nombre"
            id="nombre"
            required
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            value={form.nombre}
            onChange={handleChange}
          />
        </div>
        <div>
          <label htmlFor="apellido" className="block text-sm font-medium text-gray-700">
            Apellido
          </label>
          <input
            type="text"
            name="apellido"
            id="apellido"
            required
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            value={form.apellido}
            onChange={handleChange}
          />
        </div>
        <div>
          <label htmlFor="documento" className="block text-sm font-medium text-gray-700">
            Cédula
          </label>
          <input
            type="text"
            name="documento"
            id="documento"
            required
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            value={form.documento}
            onChange={handleChange}
          />
        </div>
        <div>
          <label htmlFor="fecha_ingreso" className="block text-sm font-medium text-gray-700">
            Fecha de Ingreso
          </label>
          <input
            type="date"
            name="fecha_ingreso"
            id="fecha_ingreso"
            required
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            value={form.fecha_ingreso}
            onChange={handleChange}
          />
        </div>
        <div>
          <label htmlFor="telefono" className="block text-sm font-medium text-gray-700">
            Teléfono
          </label>
          <input
            type="tel"
            name="telefono"
            id="telefono"
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            value={form.telefono}
            onChange={handleChange}
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Correo Electrónico
          </label>
          <input
            type="email"
            name="email"
            id="email"
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            value={form.email}
            onChange={handleChange}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="direccion" className="block text-sm font-medium text-gray-700">
            Dirección
          </label>
          <textarea
            name="direccion"
            id="direccion"
            rows={3}
            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            value={form.direccion}
            onChange={handleChange}
          />
        </div>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {loading ? 'Guardando...' : 'Agregar Afiliado'}
          </button>
        </div>
      </form>
    </div>
  )
}

function ConsultarAfiliado({ busqueda, setBusqueda, buscar, resultado, loading }) {
  return (
    <div className="bg-white shadow rounded-lg p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">🔍 Consultar Afiliado</h2>
      <div className="flex space-x-4 mb-6">
        <input
          type="text"
          placeholder="Ingrese la cédula del afiliado"
          className="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />
        <button
          onClick={buscar}
          disabled={loading}
          className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {loading ? 'Buscando...' : 'Buscar'}
        </button>
      </div>

      {resultado && (
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-6 rounded-lg border border-indigo-200">
          <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <span className="mr-2">👤</span>
            Información del Afiliado
          </h3>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            <div className="bg-white p-4 rounded-md shadow-sm">
              <dt className="text-sm font-medium text-gray-500 mb-1">Nombre Completo</dt>
              <dd className="text-lg font-semibold text-gray-900">{resultado.nombre} {resultado.apellido}</dd>
            </div>
            <div className="bg-white p-4 rounded-md shadow-sm">
              <dt className="text-sm font-medium text-gray-500 mb-1">Cédula</dt>
              <dd className="text-lg font-semibold text-gray-900">{resultado.documento}</dd>
            </div>
            <div className="bg-white p-4 rounded-md shadow-sm">
              <dt className="text-sm font-medium text-gray-500 mb-1">Fecha de Ingreso</dt>
              <dd className="text-lg font-semibold text-gray-900">{resultado.fecha_ingreso}</dd>
            </div>
            <div className="bg-white p-4 rounded-md shadow-sm">
              <dt className="text-sm font-medium text-gray-500 mb-1">Teléfono</dt>
              <dd className="text-lg font-semibold text-gray-900">{resultado.telefono || 'No especificado'}</dd>
            </div>
            <div className="bg-white p-4 rounded-md shadow-sm">
              <dt className="text-sm font-medium text-gray-500 mb-1">Correo Electrónico</dt>
              <dd className="text-lg font-semibold text-gray-900">{resultado.email || 'No especificado'}</dd>
            </div>
            <div className="bg-white p-4 rounded-md shadow-sm sm:col-span-2">
              <dt className="text-sm font-medium text-gray-500 mb-1">Dirección</dt>
              <dd className="text-lg font-semibold text-gray-900">{resultado.direccion || 'No especificada'}</dd>
            </div>
          </dl>
        </div>
      )}

      {!resultado && !loading && busqueda && (
        <div className="text-center py-8">
          <span className="text-4xl mb-4 block">🔍</span>
          <p className="text-gray-500">No se encontró ningún afiliado con esa cédula.</p>
        </div>
      )}
    </div>
  )
}

export default App