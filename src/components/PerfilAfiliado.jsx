import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

function PerfilAfiliado({ user, profile }) {
  const [loading, setLoading] = useState(false)
  const [cliente, setCliente] = useState(null)
  const [beneficiarios, setBeneficiarios] = useState([])
  const [formBeneficiario, setFormBeneficiario] = useState({
    nombre: '',
    parentesco: '',
    documento: ''
  })

  useEffect(() => {
    cargarPerfilAfiliado()
  }, [user?.id])

  const cargarPerfilAfiliado = async () => {
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
      .select('*')
      .eq('cliente_id', clienteData.id)
      .order('created_at', { ascending: false })

    setBeneficiarios(dataBenef || [])
    setLoading(false)
  }

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
        parentesco: formBeneficiario.parentesco.trim(),
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
      parentesco: '',
      documento: ''
    })
    await cargarPerfilAfiliado()
    setLoading(false)
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
                {(item.nombre || 'Sin nombre')} - {(item.parentesco || 'Sin parentesco')}
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
            name="parentesco"
            placeholder="Parentesco"
            value={formBeneficiario.parentesco}
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
