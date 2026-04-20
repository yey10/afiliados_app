import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  existeDocumentoCliente,
  fetchBeneficiariosPorCliente,
  fetchClientes,
  insertBeneficiario,
  insertCliente
} from '../api/afiliados'

function DashboardAdmin() {
  const [listLoading, setListLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [modalAbierto, setModalAbierto] = useState(false)

  const [documentoFiltro, setDocumentoFiltro] = useState('')
  const [documentoFiltroDebounced, setDocumentoFiltroDebounced] = useState('')

  const [clientes, setClientes] = useState([])
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null)

  const [beneficiarios, setBeneficiarios] = useState([])
  const [benefLoading, setBenefLoading] = useState(false)

  const [formCliente, setFormCliente] = useState({
    nombre: '',
    apellido: '',
    documento: '',
    fecha_ingreso: '',
    user_id: ''
  })

  const [formBeneficiario, setFormBeneficiario] = useState({
    nombre: '',
    apellido: '',
    documento: ''
  })

  useEffect(() => {
    const t = setTimeout(() => setDocumentoFiltroDebounced(documentoFiltro), 320)
    return () => clearTimeout(t)
  }, [documentoFiltro])

  const cargarClientes = useCallback(async () => {
    setListLoading(true)
    const { data, error } = await fetchClientes({
      role: 'admin',
      clienteId: null,
      documentoPatron: documentoFiltroDebounced
    })
    if (error) {
      alert('Error al listar clientes: ' + error.message)
      setClientes([])
    } else {
      setClientes(data || [])
    }
    setListLoading(false)
  }, [documentoFiltroDebounced])

  useEffect(() => {
    cargarClientes()
  }, [cargarClientes])

  const cargarBeneficiarios = async (clienteId) => {
    setBenefLoading(true)
    const { data, error } = await fetchBeneficiariosPorCliente(clienteId)
    if (error) {
      alert('No se pudieron cargar beneficiarios: ' + error.message)
      setBeneficiarios([])
    } else {
      setBeneficiarios(data || [])
    }
    setBenefLoading(false)
  }

  const seleccionarCliente = async (cliente) => {
    setClienteSeleccionado(cliente)
    setFormBeneficiario({ nombre: '', apellido: '', documento: '' })
    await cargarBeneficiarios(cliente.id)
  }

  const handleChangeCliente = (e) => {
    setFormCliente({ ...formCliente, [e.target.name]: e.target.value })
  }

  const limpiarFormCliente = () => {
    setFormCliente({
      nombre: '',
      apellido: '',
      documento: '',
      fecha_ingreso: '',
      user_id: ''
    })
  }

  const guardarCliente = async () => {
    const nombreLimpio = formCliente.nombre.trim()
    const documentoLimpio = formCliente.documento.trim()

    if (!nombreLimpio || !documentoLimpio) {
      alert('Nombre y documento son obligatorios')
      return
    }

    setActionLoading(true)
    const { exists, error: errDup } = await existeDocumentoCliente(documentoLimpio)
    if (errDup) {
      alert('Error al validar documento: ' + errDup.message)
      setActionLoading(false)
      return
    }
    if (exists) {
      alert('Ya existe un afiliado con ese documento')
      setActionLoading(false)
      return
    }

    const userIdTrim = formCliente.user_id.trim()
    const payload = {
      nombre: nombreLimpio,
      apellido: formCliente.apellido.trim(),
      documento: documentoLimpio,
      fecha_ingreso: formCliente.fecha_ingreso.trim() || null,
      user_id: userIdTrim || null
    }

    const { error } = await insertCliente(payload)
    if (error) {
      alert('Error al crear afiliado: ' + error.message)
    } else {
      limpiarFormCliente()
      setModalAbierto(false)
      await cargarClientes()
    }
    setActionLoading(false)
  }

  const handleChangeBenef = (e) => {
    setFormBeneficiario({ ...formBeneficiario, [e.target.name]: e.target.value })
  }

  const agregarBeneficiario = async (e) => {
    e.preventDefault()
    if (!clienteSeleccionado) return

    const nombre = formBeneficiario.nombre.trim()
    if (!nombre) {
      alert('El nombre del beneficiario es obligatorio')
      return
    }

    setActionLoading(true)
    const { error } = await insertBeneficiario({
      cliente_id: clienteSeleccionado.id,
      nombre,
      apellido: formBeneficiario.apellido.trim(),
      documento: formBeneficiario.documento.trim()
    })

    if (error) {
      alert('No se pudo agregar beneficiario: ' + error.message)
    } else {
      setFormBeneficiario({ nombre: '', apellido: '', documento: '' })
      await cargarBeneficiarios(clienteSeleccionado.id)
      await cargarClientes()
    }
    setActionLoading(false)
  }

  const filaActiva = useMemo(
    () => clientes.find((c) => c.id === clienteSeleccionado?.id),
    [clientes, clienteSeleccionado]
  )

  return (
    <>
      <div className="section">
        <div className="actions-row">
          <button className="button button-primary" type="button" onClick={() => setModalAbierto(true)}>
            Crear Afiliado
          </button>
        </div>

        <div className="filters-grid">
          <input
            className="input"
            placeholder="Buscar por documento (coincidencia parcial)"
            value={documentoFiltro}
            onChange={(e) => setDocumentoFiltro(e.target.value)}
            disabled={listLoading}
          />
        </div>

        <div className={`table-wrapper ${listLoading ? 'table-loading' : 'table-loaded'}`}>
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Apellido</th>
                <th>Documento</th>
                <th>Fecha ingreso</th>
                <th>User ID</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {listLoading ? (
                <tr>
                  <td colSpan="6" className="empty-row">Cargando...</td>
                </tr>
              ) : clientes.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty-row">Sin resultados</td>
                </tr>
              ) : (
                clientes.map((item, index) => (
                  <tr
                    key={item.id}
                    className="data-row"
                    style={{ animationDelay: `${index * 40}ms` }}
                  >
                    <td>{item.nombre}</td>
                    <td>{item.apellido}</td>
                    <td>{item.documento}</td>
                    <td>{item.fecha_ingreso}</td>
                    <td>{item.user_id || '—'}</td>
                    <td>
                      <button
                        className="button button-ghost button-xs"
                        type="button"
                        onClick={() => seleccionarCliente(item)}
                      >
                        Ver / beneficiarios
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
            Beneficiarios — {filaActiva?.nombre} {filaActiva?.apellido}
          </h3>

          {benefLoading ? (
            <p className="muted">Cargando beneficiarios...</p>
          ) : beneficiarios.length === 0 ? (
            <p className="muted">Este afiliado no tiene beneficiarios registrados.</p>
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
            <button className="button button-primary" type="submit" disabled={actionLoading}>
              {actionLoading ? 'Guardando...' : 'Agregar beneficiario'}
            </button>
          </form>
        </div>
      )}

      {modalAbierto && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="section-title no-margin">Crear Afiliado</h2>
              <button
                className="close-button"
                type="button"
                onClick={() => {
                  limpiarFormCliente()
                  setModalAbierto(false)
                }}
                disabled={actionLoading}
                aria-label="Cerrar modal"
              >
                X
              </button>
            </div>

            <input
              className="input"
              name="nombre"
              placeholder="Nombre"
              value={formCliente.nombre}
              onChange={handleChangeCliente}
            />
            <input
              className="input"
              name="apellido"
              placeholder="Apellido"
              value={formCliente.apellido}
              onChange={handleChangeCliente}
            />
            <input
              className="input"
              name="documento"
              placeholder="Documento (único)"
              value={formCliente.documento}
              onChange={handleChangeCliente}
            />
            <input
              className="input"
              type="date"
              name="fecha_ingreso"
              value={formCliente.fecha_ingreso}
              onChange={handleChangeCliente}
            />
            <input
              className="input"
              name="user_id"
              placeholder="user_id (UUID de auth, opcional)"
              value={formCliente.user_id}
              onChange={handleChangeCliente}
            />

            <div className="actions-row no-bottom">
              <button className="button button-primary" type="button" onClick={guardarCliente} disabled={actionLoading}>
                {actionLoading ? 'Guardando...' : 'Agregar Afiliado'}
              </button>
              <button
                className="button button-ghost"
                type="button"
                onClick={() => {
                  limpiarFormCliente()
                  setModalAbierto(false)
                }}
                disabled={actionLoading}
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
