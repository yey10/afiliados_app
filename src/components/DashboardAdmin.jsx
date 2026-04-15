import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase'

function DashboardAdmin() {
  const [loading, setLoading] = useState(false)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [afiliados, setAfiliados] = useState([])
  const [filtroNombre, setFiltroNombre] = useState('')
  const [filtroDocumento, setFiltroDocumento] = useState('')
  const [beneficiarios, setBeneficiarios] = useState([])
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null)
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    documento: '',
    fecha_ingreso: ''
  })

  useEffect(() => {
    listarAfiliados()
  }, [])

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

    const { error } = await supabase.from('clientes').insert([
      {
        ...form,
        nombre: nombreLimpio,
        documento: documentoLimpio
      }
    ])

    if (error) {
      alert('Error: ' + error.message)
    } else {
      limpiarFormulario()
      setModalAbierto(false)
      await listarAfiliados()
    }
    setLoading(false)
  }

  const verBeneficiarios = async (cliente) => {
    setClienteSeleccionado(cliente)
    const { data, error } = await supabase
      .from('beneficiarios')
      .select('*')
      .eq('cliente_id', cliente.id)
      .order('created_at', { ascending: false })

    if (error) {
      alert('No se pudieron cargar beneficiarios: ' + error.message)
      setBeneficiarios([])
      return
    }
    setBeneficiarios(data || [])
  }

  const afiliadosFiltrados = useMemo(() => {
    return afiliados.filter((item) => {
      const coincideNombre = `${item.nombre || ''} ${item.apellido || ''}`
        .toLowerCase()
        .includes(filtroNombre.toLowerCase())
      const coincideDocumento = (item.documento || '')
        .toLowerCase()
        .includes(filtroDocumento.toLowerCase())
      return coincideNombre && coincideDocumento
    })
  }, [afiliados, filtroNombre, filtroDocumento])

  return (
    <>
      <div className="section">
        <div className="actions-row">
          <button className="button button-primary" onClick={() => setModalAbierto(true)}>
            Crear Afiliado
          </button>
        </div>

        <div className="filters-grid">
          <input
            className="input"
            placeholder="Filtrar por nombre"
            value={filtroNombre}
            onChange={(e) => setFiltroNombre(e.target.value)}
          />
          <input
            className="input"
            placeholder="Filtrar por documento"
            value={filtroDocumento}
            onChange={(e) => setFiltroDocumento(e.target.value)}
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
                <th>Beneficiarios</th>
              </tr>
            </thead>
            <tbody>
              {afiliadosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="5" className="empty-row">Sin resultados</td>
                </tr>
              ) : (
                afiliadosFiltrados.map((item, index) => (
                  <tr
                    key={item.id}
                    className="data-row"
                    style={{ animationDelay: `${index * 40}ms` }}
                  >
                    <td>{item.nombre}</td>
                    <td>{item.apellido}</td>
                    <td>{item.documento}</td>
                    <td>{item.fecha_ingreso}</td>
                    <td>
                      <button className="button button-ghost button-xs" onClick={() => verBeneficiarios(item)}>
                        Ver
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {clienteSeleccionado && (
        <div className="section section-soft">
          <h3 className="section-title">
            Beneficiarios de {clienteSeleccionado.nombre} {clienteSeleccionado.apellido}
          </h3>
          {beneficiarios.length === 0 ? (
            <p className="muted">Este afiliado no tiene beneficiarios registrados.</p>
          ) : (
            <ul className="simple-list">
              {beneficiarios.map((item) => (
                <li key={item.id}>
                  {(item.nombre || 'Sin nombre')} - {(item.parentesco || 'Sin parentesco')}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

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
    </>
  )
}

export default DashboardAdmin
