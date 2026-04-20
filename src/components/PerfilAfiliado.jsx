import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabase'

/** Vista alternativa si enlazas por documento sin cliente_id (no usada en App actual). */
function PerfilAfiliado({ user, profile }) {
  const [loading, setLoading] = useState(false)
  const [cliente, setCliente] = useState(null)
  const [beneficiarios, setBeneficiarios] = useState([])
  const [formBeneficiario, setFormBeneficiario] = useState({
    nombre: '',
    apellido: '',
    documento: ''
  })

  const cargarPerfilAfiliado = useCallback(async () => {
    setLoading(true)

    let clienteData = null
    if (profile?.cliente_id) {
      const { data } = await supabase
        .from('clientes')
        .select('id, nombre, apellido, documento, fecha_ingreso')
        .eq('id', profile.cliente_id)
        .maybeSingle()
      clienteData = data
    }

    if (!clienteData && profile?.documento) {
      const { data } = await supabase
        .from('clientes')
        .select('id, nombre, apellido, documento, fecha_ingreso')
        .eq('documento', profile.documento)
        .maybeSingle()
      clienteData = data
    }

    if (!clienteData) {
      setCliente(null)
      setBeneficiarios([])
      setLoading(false)
      return
    }

    setCliente(clienteData)

    const { data: dataBenef } = await supabase
      .from('beneficiarios')
      .select('id, cliente_id, nombre, apellido, documento')
      .eq('cliente_id', clienteData.id)
      .order('id', { ascending: false })

    setBeneficiarios(dataBenef || [])
    setLoading(false)
  }, [profile?.cliente_id, profile?.documento])

  useEffect(() => {
    cargarPerfilAfiliado()
  }, [user?.id, cargarPerfilAfiliado])

  const handleChange = (e) => {
    setFormBeneficiario({
      ...formBeneficiario,
      [e.target.name]: e.target.value
    })
  }

  const agregarBeneficiario = async (e) => {
    e.preventDefault()
    if (!cliente) return

    const nombre = formBeneficiario.nombre.trim()
    if (!nombre) {
      alert('El nombre del beneficiario es obligatorio')
      return
    }

    setLoading(true)
    const { error } = await supabase.from('beneficiarios').insert([
      {
        cliente_id: cliente.id,
        nombre,
        apellido: formBeneficiario.apellido.trim(),
        documento: formBeneficiario.documento.trim()
      }
    ])

    if (error) {
      alert('No se pudo agregar beneficiario: ' + error.message)
      setLoading(false)
      return
    }

    setFormBeneficiario({
      nombre: '',
      apellido: '',
      documento: ''
    })
    await cargarPerfilAfiliado()
  }

  return (
    <>
      <div className="section">
        <h2 className="section-title">Mi perfil</h2>
        {loading ? (
          <p className="muted">Cargando datos...</p>
        ) : !cliente ? (
          <p className="muted">No se encontró un perfil asociado a tu usuario.</p>
        ) : (
          <div className="profile-card">
            <p><b>Nombre:</b> {cliente.nombre}</p>
            <p><b>Apellido:</b> {cliente.apellido}</p>
            <p><b>Documento:</b> {cliente.documento}</p>
            <p><b>Fecha ingreso:</b> {cliente.fecha_ingreso}</p>
          </div>
        )}
      </div>

      <div className="section section-soft">
        <h3 className="section-title">Beneficiarios</h3>
        {beneficiarios.length === 0 ? (
          <p className="muted">No tienes beneficiarios registrados.</p>
        ) : (
          <ul className="simple-list">
            {beneficiarios.map((item) => (
              <li key={item.id}>
                {(item.nombre || 'Sin nombre')} {item.apellido || ''}
                {item.documento ? ` · ${item.documento}` : ''}
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={agregarBeneficiario} className="form-stack">
          <h4 className="subheading">Agregar beneficiario</h4>
          <input
            className="input"
            name="nombre"
            placeholder="Nombre"
            value={formBeneficiario.nombre}
            onChange={handleChange}
          />
          <input
            className="input"
            name="apellido"
            placeholder="Apellido"
            value={formBeneficiario.apellido}
            onChange={handleChange}
          />
          <input
            className="input"
            name="documento"
            placeholder="Documento"
            value={formBeneficiario.documento}
            onChange={handleChange}
          />
          <button className="button button-primary" type="submit" disabled={loading || !cliente}>
            {loading ? 'Guardando...' : 'Agregar beneficiario'}
          </button>
        </form>
      </div>
    </>
  )
}

export default PerfilAfiliado
