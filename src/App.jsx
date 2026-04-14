import { useState } from 'react'
import { supabase } from './supabase'

function App() {
  const [user, setUser] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const login = async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    if (error) alert(error.message)
    else setUser(data.user)
  }

  if (!user) {
    return (
      <div>
        <h2>Login</h2>
        <input placeholder="Email" onChange={e => setEmail(e.target.value)} />
        <input type="password" placeholder="Password" onChange={e => setPassword(e.target.value)} />
        <button onClick={login}>Entrar</button>
      </div>
    )
  }

  return <Sistema />
}

function Sistema() {
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    documento: '',
    fecha_ingreso: ''
  })

  const [busqueda, setBusqueda] = useState('')
  const [resultado, setResultado] = useState(null)

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const guardar = async () => {
    const { error } = await supabase.from('clientes').insert([form])
    if (error) alert(error.message)
    else alert('Afiliado guardado')
  }

  const buscar = async () => {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('documento', busqueda)
      .single()

    if (error) alert('No encontrado')
    else setResultado(data)
  }

  return (
    <div>
      <h2>Afiliados</h2>

      <input name="nombre" placeholder="Nombre" onChange={handleChange} />
      <input name="apellido" placeholder="Apellido" onChange={handleChange} />
      <input name="documento" placeholder="Cédula" onChange={handleChange} />
      <input name="fecha_ingreso" type="date" onChange={handleChange} />

      <button onClick={guardar}>Agregar Afiliado</button>

      <hr />

      <h2>Consulta</h2>
      <input placeholder="Cédula" onChange={e => setBusqueda(e.target.value)} />
      <button onClick={buscar}>Buscar</button>

      {resultado && (
        <div>
          <p>{resultado.nombre} {resultado.apellido}</p>
          <p>{resultado.documento}</p>
        </div>
      )}
    </div>
  )
}

export default App