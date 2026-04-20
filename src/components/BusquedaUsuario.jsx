import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchBeneficiariosPorCliente,
  fetchClientes,
  insertBeneficiario,
  registrarLogConsulta
} from '../api/afiliados'
import { useAuth } from '../context/AuthContext'

function BusquedaUsuario() {
  const { user, profile, normalizedRole } = useAuth()

  const clienteId = profile?.cliente_id

  const [listLoading, setListLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [documentoBusqueda, setDocumentoBusqueda] = useState('')
  const [documentoDebounced, setDocumentoDebounced] = useState('')

  const [clientes, setClientes] = useState([])
  const [beneficiarios, setBeneficiarios] = useState([])
  const [benefLoading, setBenefLoading] = useState(false)

  const [formBeneficiario, setFormBeneficiario] = useState({
    nombre: '',
    apellido: '',
    documento: ''
  })

  const miCliente = clientes[0] || null

  useEffect(() => {
    const t = setTimeout(() => setDocumentoDebounced(documentoBusqueda), 320)
    return () => clearTimeout(t)
  }, [documentoBusqueda])

  const cargarClientes = useCallback(async (explicitPatron) => {
    if (!clienteId) {
      setClientes([])
      setListLoading(false)
      return
    }

    const patron = explicitPatron !== undefined ? explicitPatron : documentoDebounced

    setListLoading(true)
    const { data, error } = await fetchClientes({
      role: 'user',
      clienteId,
      documentoPatron: patron
    })
    if (error) {
      alert('Error al cargar tu afiliado: ' + error.message)
      setClientes([])
    } else {
      setClientes(data || [])
    }
    setListLoading(false)
  }, [clienteId, documentoDebounced])

  useEffect(() => {
    cargarClientes()
  }, [cargarClientes])

  const cargarBeneficiarios = useCallback(async (id) => {
    setBenefLoading(true)
    const { data, error } = await fetchBeneficiariosPorCliente(id)
    if (error) {
      alert('No se pudieron cargar beneficiarios: ' + error.message)
      setBeneficiarios([])
    } else {
      setBeneficiarios(data || [])
    }
    setBenefLoading(false)
  }, [])

  useEffect(() => {
    if (miCliente?.id) cargarBeneficiarios(miCliente.id)
    else setBeneficiarios([])
  }, [miCliente?.id, cargarBeneficiarios])

  const handleBuscar = async (e) => {
    e.preventDefault()
    const doc = documentoBusqueda.trim()
    if (!doc) {
      alert('Ingresa un documento para buscar')
      return
    }
    if (!user?.id) return

    setActionLoading(true)
    const { error: logErr } = await registrarLogConsulta(user.id, doc)
    if (logErr) console.warn('Log consulta:', logErr.message)
    await cargarClientes(doc)
    setActionLoading(false)
  }

  const handleChangeBenef = (e) => {
    setFormBeneficiario({ ...formBeneficiario, [e.target.name]: e.target.value })
  }

  const agregarBeneficiario = async (e) => {
    e.preventDefault()
    if (!miCliente) return

    const nombre = formBeneficiario.nombre.trim()
    if (!nombre) {
      alert('El nombre del beneficiario es obligatorio')
      return
    }

    setActionLoading(true)
    const { error } = await insertBeneficiario({
      cliente_id: miCliente.id,
      nombre,
      apellido: formBeneficiario.apellido.trim(),
      documento: formBeneficiario.documento.trim()
    })

    if (error) {
      alert('No se pudo agregar beneficiario: ' + error.message)
    } else {
      setFormBeneficiario({ nombre: '', apellido: '', documento: '' })
      await cargarBeneficiarios(miCliente.id)
    }
    setActionLoading(false)
  }

  const resumenLegacy = useMemo(() => ({
    cedula: miCliente?.documento || '',
    nombre: miCliente?.nombre || '',
    apellido: miCliente?.apellido || '',
    fechaIngreso: miCliente?.fecha_ingreso || ''
  }), [miCliente])

  return (
    <div className="legacy-layout">
      <div className="legacy-tabs" role="tablist" aria-label="Navegación de módulos">
        <button type="button" className="legacy-tab">Afiliados</button>
        <button type="button" className="legacy-tab">Pagos</button>
        <button type="button" className="legacy-tab active">Consultas</button>
        <button type="button" className="legacy-tab">Reportes Mensuales</button>
      </div>

      <div className="legacy-content">
        <div className="legacy-column">
          <h3 className="legacy-panel-title">Afiliados</h3>
          <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
            Tu registro (rol <b>{normalizedRole}</b>, solo lectura).
          </p>
          <label className="legacy-label">Cédula:</label>
          <input className="legacy-input" value={resumenLegacy.cedula} readOnly />
          <label className="legacy-label">Nombre:</label>
          <input className="legacy-input" value={resumenLegacy.nombre} readOnly />
          <label className="legacy-label">Apellido:</label>
          <input className="legacy-input" value={resumenLegacy.apellido} readOnly />
          <label className="legacy-label">Fecha Ingreso:</label>
          <input className="legacy-input" value={resumenLegacy.fechaIngreso} readOnly />
          <button className="legacy-button legacy-button-blue" type="button" disabled>
            Agregar Afiliado
          </button>
        </div>

        <div className="legacy-column">
          <h3 className="legacy-panel-title legacy-panel-title-green">Pagos</h3>
          <label className="legacy-label">Cédula:</label>
          <input className="legacy-input" disabled />
          <label className="legacy-label">Mes:</label>
          <select className="legacy-input" disabled>
            <option>Enero</option>
          </select>
          <label className="legacy-label">Año:</label>
          <input className="legacy-input" disabled />
          <label className="legacy-label">Valor Pago:</label>
          <input className="legacy-input" disabled />
          <button className="legacy-button legacy-button-green" type="button" disabled>
            Registrar Pago
          </button>
        </div>

        <div className="legacy-column legacy-column-wide">
          <h3 className="legacy-panel-title legacy-panel-title-orange">Consultas</h3>
          <form onSubmit={handleBuscar}>
            <label className="legacy-label">Buscar por Cédula (solo tu registro):</label>
            <input
              className="legacy-input"
              placeholder="Documento (búsqueda parcial)"
              value={documentoBusqueda}
              onChange={(e) => setDocumentoBusqueda(e.target.value)}
            />
            <p className="muted" style={{ fontSize: 12, margin: '0 0 8px' }}>
              La búsqueda usa coincidencia parcial y solo aplica sobre tu <code>cliente_id</code>.
            </p>
            <button className="legacy-button legacy-button-orange" type="submit" disabled={actionLoading || listLoading}>
              {actionLoading ? 'Buscando...' : 'Buscar Afiliado'}
            </button>
          </form>

          <div style={{ marginTop: 14 }}>
            <h4 className="subheading" style={{ marginTop: 0 }}>Tabla</h4>
            <div className={`table-wrapper ${listLoading ? 'table-loading' : 'table-loaded'}`}>
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
                  {listLoading ? (
                    <tr>
                      <td colSpan="4" className="empty-row">Cargando...</td>
                    </tr>
                  ) : clientes.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="empty-row">Sin coincidencias</td>
                    </tr>
                  ) : (
                    clientes.map((row) => (
                      <tr key={row.id}>
                        <td>{row.nombre}</td>
                        <td>{row.apellido}</td>
                        <td>{row.documento}</td>
                        <td>{row.fecha_ingreso}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="section section-soft" style={{ marginTop: 14, padding: 16 }}>
            <h4 className="subheading" style={{ marginTop: 0 }}>Beneficiarios</h4>
            {benefLoading ? (
              <p className="muted">Cargando beneficiarios...</p>
            ) : beneficiarios.length === 0 ? (
              <p className="muted">No hay beneficiarios registrados.</p>
            ) : (
              <ul className="simple-list">
                {beneficiarios.map((item) => (
                  <li key={item.id}>
                    {(item.nombre || '—')} {item.apellido || ''}
                    {item.documento ? ` · Doc: ${item.documento}` : ''}
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
                onChange={handleChangeBenef}
              />
              <input
                className="input"
                name="apellido"
                placeholder="Apellido"
                value={formBeneficiario.apellido}
                onChange={handleChangeBenef}
              />
              <input
                className="input"
                name="documento"
                placeholder="Documento"
                value={formBeneficiario.documento}
                onChange={handleChangeBenef}
              />
              <button className="button button-primary" type="submit" disabled={actionLoading || !miCliente}>
                {actionLoading ? 'Guardando...' : 'Agregar beneficiario'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BusquedaUsuario
