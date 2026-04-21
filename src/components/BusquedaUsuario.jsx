/**
 * BusquedaUsuario.jsx
 * Layout legacy empresarial — 3 columnas + tabs superiores.
 * Pestaña "Consultas" funcional. Afiliados y Pagos: visuales.
 * Sin dependencia de cliente_id — búsqueda global por documento.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabase'
import { registrarLogConsulta } from '../api/afiliados'

const TABS = ['Afiliados', 'Pagos', 'Consultas', 'Reportes Mensuales']
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default function BusquedaUsuario() {
  const { user } = useAuth()
  const [tabActiva, setTabActiva] = useState('Consultas')

  // ── Estado búsqueda ──────────────────────────────────────────
  const [documento, setDocumento]           = useState('')
  const [clientes, setClientes]             = useState([])
  const [buscando, setBuscando]             = useState(false)
  const [buscado, setBuscado]               = useState(false)   // ¿se hizo al menos 1 búsqueda?

  // ── Estado beneficiarios ─────────────────────────────────────
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null)
  const [beneficiarios, setBeneficiarios]   = useState([])
  const [benefLoading, setBenefLoading]     = useState(false)
  const [formBenef, setFormBenef]           = useState({ nombre: '', apellido: '', documento: '' })
  const [guardando, setGuardando]           = useState(false)
  const [benefMsg, setBenefMsg]             = useState(null)   // { type, text }

  // ── Buscar afiliados ─────────────────────────────────────────
  const buscarAfiliado = useCallback(async (e) => {
    if (e) e.preventDefault()
    const term = documento.trim()
    if (!term) return

    setBuscando(true)
    setBuscado(true)
    setClienteSeleccionado(null)
    setBeneficiarios([])
    setBenefMsg(null)

    if (user?.id) registrarLogConsulta(user.id, term)

    const { data, error } = await supabase
      .from('clientes')
      .select('id, nombre, apellido, documento, fecha_ingreso')
      .ilike('documento', `%${term}%`)
      .order('apellido')
      .limit(50)

    setClientes(error ? [] : (data ?? []))
    setBuscando(false)
  }, [documento, user?.id])

  // ── Cargar beneficiarios de un cliente ───────────────────────
  const cargarBeneficiarios = useCallback(async (clienteId) => {
    setBenefLoading(true)
    setBenefMsg(null)
    const { data, error } = await supabase
      .from('beneficiarios')
      .select('id, nombre, apellido, documento')
      .eq('cliente_id', clienteId)
      .order('id', { ascending: false })

    setBeneficiarios(error ? [] : (data ?? []))
    setBenefLoading(false)
  }, [])

  function seleccionarCliente(cliente) {
    const mismo = clienteSeleccionado?.id === cliente.id
    setClienteSeleccionado(mismo ? null : cliente)
    setBeneficiarios([])
    setBenefMsg(null)
    setFormBenef({ nombre: '', apellido: '', documento: '' })
    if (!mismo) cargarBeneficiarios(cliente.id)
  }

  // ── Agregar beneficiario ─────────────────────────────────────
  async function agregarBeneficiario(e) {
    e.preventDefault()
    if (!clienteSeleccionado) return
    const nombre = formBenef.nombre.trim()
    if (!nombre) { setBenefMsg({ type: 'error', text: 'El nombre es obligatorio.' }); return }

    setGuardando(true)
    setBenefMsg(null)

    const { error } = await supabase
      .from('beneficiarios')
      .insert([{
        cliente_id: clienteSeleccionado.id,
        nombre,
        apellido:  formBenef.apellido.trim()  || '',
        documento: formBenef.documento.trim() || '',
      }])

    if (error) {
      setBenefMsg({ type: 'error', text: 'Error al guardar: ' + error.message })
    } else {
      setBenefMsg({ type: 'ok', text: 'Beneficiario agregado.' })
      setFormBenef({ nombre: '', apellido: '', documento: '' })
      cargarBeneficiarios(clienteSeleccionado.id)
    }
    setGuardando(false)
  }

  // ────────────────────────────────────────────────────────────
  return (
    <div style={s.root}>

      {/* ── TABS ── */}
      <div style={s.tabBar}>
        {TABS.map(tab => (
          <button
            key={tab}
            style={{ ...s.tab, ...(tabActiva === tab ? s.tabActiva : {}) }}
            onClick={() => setTabActiva(tab)}
            type="button"
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── CONTENIDO (solo Consultas es funcional) ── */}
      <div style={s.content}>

        {/* ── COLUMNA 1: Afiliados (visual) ── */}
        <div style={s.col}>
          <div style={{ ...s.colTitle, color: '#2563eb' }}>Afiliados</div>
          <p style={s.hint}>Registro de afiliados del sistema.</p>
          {['Cédula','Nombre','Apellido','Fecha Ingreso'].map(lbl => (
            <div key={lbl} style={s.fieldGroup}>
              <label style={s.label}>{lbl}:</label>
              <input style={s.input} disabled />
            </div>
          ))}
          <button style={{ ...s.btn, ...s.btnBlue }} disabled>Agregar Afiliado</button>
        </div>

        {/* ── COLUMNA 2: Pagos (visual) ── */}
        <div style={s.col}>
          <div style={{ ...s.colTitle, color: '#16a34a' }}>Pagos</div>
          {['Cédula','Año','Valor Pago'].map(lbl => (
            <div key={lbl} style={s.fieldGroup}>
              <label style={s.label}>{lbl}:</label>
              <input style={s.input} disabled />
            </div>
          ))}
          <div style={s.fieldGroup}>
            <label style={s.label}>Mes:</label>
            <select style={s.input} disabled>
              {MESES.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <button style={{ ...s.btn, ...s.btnGreen }} disabled>Registrar Pago</button>
        </div>

        {/* ── COLUMNA 3: Consultas (FUNCIONAL) ── */}
        <div style={{ ...s.col, ...s.colWide }}>
          <div style={{ ...s.colTitle, color: '#ea580c' }}>Consultas</div>

          {/* Formulario de búsqueda */}
          <form onSubmit={buscarAfiliado}>
            <label style={s.label}>Buscar por Cédula:</label>
            <input
              style={{ ...s.input, marginBottom: 6 }}
              placeholder="Documento (búsqueda parcial)"
              value={documento}
              onChange={e => setDocumento(e.target.value)}
              autoFocus
            />
            <button
              style={{ ...s.btn, ...s.btnOrange, width: '100%' }}
              type="submit"
              disabled={buscando || !documento.trim()}
            >
              {buscando ? 'Buscando…' : 'Buscar Afiliado'}
            </button>
          </form>

          {/* Tabla de resultados */}
          <div style={{ marginTop: 14 }}>
            <div style={s.tableLabel}>Tabla</div>
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr style={s.thead}>
                    <th style={s.th}>Nombre</th>
                    <th style={s.th}>Apellido</th>
                    <th style={s.th}>Documento</th>
                    <th style={s.th}>Fecha ingreso</th>
                    <th style={s.th}></th>
                  </tr>
                </thead>
                <tbody>
                  {buscando ? (
                    <tr><td colSpan="5" style={s.tdEmpty}>Buscando…</td></tr>
                  ) : !buscado ? (
                    <tr><td colSpan="5" style={s.tdEmpty}>Ingresa un documento y presiona Buscar.</td></tr>
                  ) : clientes.length === 0 ? (
                    <tr><td colSpan="5" style={s.tdEmpty}>Sin coincidencias</td></tr>
                  ) : clientes.map(c => (
                    <tr
                      key={c.id}
                      style={{
                        ...s.tr,
                        background: clienteSeleccionado?.id === c.id ? '#dbeafe' : undefined,
                        cursor: 'pointer',
                      }}
                      onClick={() => seleccionarCliente(c)}
                    >
                      <td style={s.td}>{c.nombre}</td>
                      <td style={s.td}>{c.apellido}</td>
                      <td style={s.td}>{c.documento}</td>
                      <td style={s.td}>{c.fecha_ingreso ?? '—'}</td>
                      <td style={s.td}>
                        <button
                          style={s.btnSmall}
                          type="button"
                          onClick={e => { e.stopPropagation(); seleccionarCliente(c) }}
                        >
                          {clienteSeleccionado?.id === c.id ? 'Ocultar' : 'Ver'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Panel de beneficiarios */}
          <div style={s.benefPanel}>
            <div style={s.benefTitle}>
              Beneficiarios
              {clienteSeleccionado && (
                <span style={{ fontWeight: 400, fontSize: 13, color: '#6b7280', marginLeft: 8 }}>
                  — {clienteSeleccionado.nombre} {clienteSeleccionado.apellido}
                </span>
              )}
            </div>

            {!clienteSeleccionado ? (
              <p style={s.hint}>Selecciona un afiliado de la tabla para ver sus beneficiarios.</p>
            ) : benefLoading ? (
              <p style={s.hint}>Cargando…</p>
            ) : beneficiarios.length === 0 ? (
              <p style={s.hint}>No hay beneficiarios registrados.</p>
            ) : (
              <ul style={s.benefList}>
                {beneficiarios.map(b => (
                  <li key={b.id} style={s.benefItem}>
                    <strong>{b.nombre}</strong> {b.apellido}
                    {b.documento ? <span style={{ color: '#6b7280' }}> · {b.documento}</span> : ''}
                  </li>
                ))}
              </ul>
            )}

            {/* Formulario agregar beneficiario */}
            {clienteSeleccionado && (
              <form onSubmit={agregarBeneficiario} style={{ marginTop: 10 }}>
                <div style={s.tableLabel}>Agregar beneficiario</div>

                {benefMsg && (
                  <div style={{
                    ...s.msg,
                    background: benefMsg.type === 'ok' ? '#f0fdf4' : '#fef2f2',
                    color:      benefMsg.type === 'ok' ? '#15803d' : '#dc2626',
                    borderColor:benefMsg.type === 'ok' ? '#86efac' : '#fca5a5',
                  }}>
                    {benefMsg.text}
                  </div>
                )}

                <input
                  style={{ ...s.input, marginBottom: 6 }}
                  placeholder="Nombre *"
                  value={formBenef.nombre}
                  onChange={e => setFormBenef(f => ({ ...f, nombre: e.target.value }))}
                />
                <input
                  style={{ ...s.input, marginBottom: 6 }}
                  placeholder="Apellido"
                  value={formBenef.apellido}
                  onChange={e => setFormBenef(f => ({ ...f, apellido: e.target.value }))}
                />
                <input
                  style={{ ...s.input, marginBottom: 8 }}
                  placeholder="Documento"
                  value={formBenef.documento}
                  onChange={e => setFormBenef(f => ({ ...f, documento: e.target.value }))}
                />
                <button
                  style={{ ...s.btn, ...s.btnBlue }}
                  type="submit"
                  disabled={guardando}
                >
                  {guardando ? 'Guardando…' : 'Agregar beneficiario'}
                </button>
              </form>
            )}
          </div>

        </div>{/* fin col Consultas */}
      </div>{/* fin content */}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// ESTILOS — inline para no tocar App.css
// ════════════════════════════════════════════════════════════════
const s = {
  root: {
    fontFamily: 'Segoe UI, Tahoma, Arial, sans-serif',
    fontSize: 13,
    color: '#1f2937',
  },
  // Tabs
  tabBar: {
    display: 'flex',
    borderBottom: '2px solid #cbd5e1',
    marginBottom: 0,
  },
  tab: {
    padding: '7px 18px',
    border: '1px solid #cbd5e1',
    borderBottom: 'none',
    background: '#e5e7eb',
    cursor: 'pointer',
    fontSize: 13,
    borderRadius: '4px 4px 0 0',
    marginRight: 2,
    color: '#374151',
  },
  tabActiva: {
    background: '#fff',
    borderBottom: '2px solid #fff',
    marginBottom: -2,
    fontWeight: 600,
    color: '#111827',
  },
  // Layout 3 columnas
  content: {
    display: 'flex',
    gap: 0,
    border: '1px solid #cbd5e1',
    borderTop: 'none',
    background: '#f1f5f9',
    minHeight: 500,
  },
  col: {
    flex: '0 0 220px',
    padding: '14px 16px',
    borderRight: '1px solid #cbd5e1',
    background: '#f8fafc',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  colWide: {
    flex: 1,
    borderRight: 'none',
  },
  colTitle: {
    fontWeight: 700,
    fontSize: 14,
    marginBottom: 6,
  },
  // Campos
  fieldGroup: {
    marginBottom: 8,
  },
  label: {
    display: 'block',
    fontSize: 12,
    color: '#4b5563',
    marginBottom: 3,
    fontWeight: 500,
  },
  input: {
    width: '100%',
    padding: '5px 8px',
    border: '1px solid #9ca3af',
    borderRadius: 3,
    fontSize: 13,
    background: '#fff',
    boxSizing: 'border-box',
    color: '#111827',
  },
  hint: {
    fontSize: 12,
    color: '#6b7280',
    margin: '0 0 8px',
  },
  // Botones
  btn: {
    padding: '7px 0',
    width: '100%',
    border: 'none',
    borderRadius: 4,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 4,
    letterSpacing: 0.2,
  },
  btnBlue:   { background: '#2563eb', color: '#fff' },
  btnGreen:  { background: '#16a34a', color: '#fff' },
  btnOrange: { background: '#ea580c', color: '#fff' },
  btnSmall: {
    padding: '3px 10px',
    fontSize: 12,
    border: '1px solid #9ca3af',
    borderRadius: 3,
    background: '#fff',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  // Tabla
  tableLabel: {
    fontWeight: 600,
    fontSize: 13,
    marginBottom: 6,
    color: '#374151',
  },
  tableWrap: {
    overflowX: 'auto',
    border: '1px solid #cbd5e1',
    borderRadius: 4,
    background: '#fff',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 12,
  },
  thead: {
    background: '#e5e7eb',
  },
  th: {
    padding: '6px 10px',
    textAlign: 'left',
    fontWeight: 600,
    borderBottom: '1px solid #cbd5e1',
    whiteSpace: 'nowrap',
    color: '#374151',
  },
  tr: {
    borderBottom: '1px solid #f3f4f6',
  },
  td: {
    padding: '5px 10px',
    whiteSpace: 'nowrap',
  },
  tdEmpty: {
    padding: '14px 10px',
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 12,
  },
  // Beneficiarios
  benefPanel: {
    marginTop: 16,
    padding: 12,
    border: '1px solid #cbd5e1',
    borderRadius: 4,
    background: '#fff',
  },
  benefTitle: {
    fontWeight: 600,
    fontSize: 13,
    marginBottom: 8,
    color: '#374151',
  },
  benefList: {
    margin: '0 0 8px',
    padding: '0 0 0 16px',
    listStyle: 'disc',
  },
  benefItem: {
    padding: '3px 0',
    fontSize: 13,
    color: '#1f2937',
  },
  msg: {
    fontSize: 12,
    padding: '6px 10px',
    border: '1px solid',
    borderRadius: 4,
    marginBottom: 8,
  },
}