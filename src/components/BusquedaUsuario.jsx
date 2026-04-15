import { useState } from 'react'
import { supabase } from '../supabase'

function BusquedaUsuario({ user }) {
  const [documento, setDocumento] = useState('')
  const [resultado, setResultado] = useState(null)
  const [beneficiarios, setBeneficiarios] = useState([])
  const [loading, setLoading] = useState(false)

  const registrarLog = async (doc) => {
    await supabase.from('logs_consultas').insert([
      {
        user_id: user.id,
        documento: doc,
        fecha: new Date().toISOString()
      }
    ])
  }

  const buscar = async (e) => {
    e.preventDefault()
    const doc = documento.trim()

    if (!doc) {
      alert('Ingresa un documento para buscar')
      return
    }

    setLoading(true)
    await registrarLog(doc)

    const { data, error } = await supabase
      .from('clientes')
      .select('id, nombre, apellido, documento, fecha_ingreso')
      .eq('documento', doc)
      .maybeSingle()

    if (error) {
      alert('Error en la búsqueda: ' + error.message)
      setResultado(null)
      setBeneficiarios([])
      setLoading(false)
      return
    }

    if (!data) {
      alert('No se encontró un afiliado con ese documento')
      setResultado(null)
      setBeneficiarios([])
      setLoading(false)
      return
    }

    setResultado(data)

    const { data: dataBenef, error: errorBenef } = await supabase
      .from('beneficiarios')
      .select('*')
      .eq('cliente_id', data.id)
      .order('created_at', { ascending: false })

    if (errorBenef) {
      setBeneficiarios([])
    } else {
      setBeneficiarios(dataBenef || [])
    }

    setLoading(false)
  }

  return (
    <div className="section">
      <h2 className="section-title">Consulta por documento</h2>
      <p className="muted">Solo puedes consultar un afiliado específico.</p>

      <form onSubmit={buscar}>
        <div className="search-wrap">
          <span className="search-icon" aria-hidden="true">🔍</span>
          <input
            className="input search-input"
            placeholder="Documento"
            value={documento}
            onChange={(e) => setDocumento(e.target.value)}
          />
        </div>
        <button className="button button-primary" type="submit" disabled={loading}>
          {loading ? 'Buscando...' : 'Buscar'}
        </button>
      </form>

      {resultado && (
        <div className="profile-card">
          <h3 className="section-title">Afiliado encontrado</h3>
          <p><b>Nombre:</b> {resultado.nombre}</p>
          <p><b>Apellido:</b> {resultado.apellido}</p>
          <p><b>Documento:</b> {resultado.documento}</p>
          <p><b>Fecha ingreso:</b> {resultado.fecha_ingreso}</p>

          <h4 className="subheading">Beneficiarios</h4>
          {beneficiarios.length === 0 ? (
            <p className="muted">No hay beneficiarios registrados.</p>
          ) : (
            <ul className="simple-list">
              {beneficiarios.map((item) => (
                <li key={item.id}>{(item.nombre || 'Sin nombre')} - {(item.parentesco || 'Sin parentesco')}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export default BusquedaUsuario
