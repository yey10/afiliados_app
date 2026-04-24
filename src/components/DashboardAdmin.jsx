/**
 * DashboardAdmin.jsx
 * Dashboard completo para rol admin.
 * - Tabla con toggle estado, eliminar, expandir beneficiarios
 * - Campos extendidos en formulario afiliado
 * - Pagos en formato COP
 * - Historial de pagos ordenado
 * - Mensajes claros de éxito/error/cargando
 * NO se modifican estilos base del objeto `s`.
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../supabase'
import {
  registrarLogConsulta,
  fetchDashboardData,
  registrarPago,
  fetchPagosPorCliente,
  toggleEstadoCliente,
  eliminarCliente,
  formatCOP,
  MESES_NOMBRES,
  MESES_CORTOS,
} from '../api/afiliados'
import { useAuth } from '../context/AuthContext'
import logoImg from '../assets/logo.jpeg'

const TABS = ['Afiliados', 'Pagos', 'Consultas']

const MESES = MESES_NOMBRES.slice(1).map((nombre, i) => ({ nombre, valor: i + 1 }))

const FORM_AFIL_EMPTY = {
  nombre: '', apellido: '', documento: '', fecha_ingreso: '',
  fecha_nacimiento: '', telefono: '', correo: '', direccion: '', asesor: '',
}
const PAGO_EMPTY = { documento: '', año: String(new Date().getFullYear()), mes: 1, valor: '' }

// ─── Msg helper ──────────────────────────────────────────────────
function Msg({ msg }) {
  if (!msg) return null
  const ok = msg.type === 'ok'
  return (
    <div style={{
      ...s.msg,
      background:  ok ? '#f0fdf4' : '#fef2f2',
      color:       ok ? '#15803d' : '#dc2626',
      borderColor: ok ? '#86efac' : '#fca5a5',
    }}>
      {ok ? '✓ ' : '✕ '}{msg.text}
    </div>
  )
}

// ─── Modal confirmación eliminar ─────────────────────────────────
function ConfirmModal({ nombre, onConfirm, onCancel }) {
  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, color: '#111827' }}>
          ¿Eliminar afiliado?
        </div>
        <p style={{ fontSize: 13, color: '#374151', marginBottom: 16 }}>
          Se eliminará a <strong>{nombre}</strong> junto con sus beneficiarios y pagos. Esta acción no se puede deshacer.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button style={{ ...s.btnSmall, background: '#e5e7eb', color: '#374151' }} onClick={onCancel}>Cancelar</button>
          <button style={{ ...s.btnSmall, background: '#dc2626', color: '#fff' }} onClick={onConfirm}>Sí, eliminar</button>
        </div>
      </div>
    </div>
  )
}

// ─── Fila expandible de beneficiarios ────────────────────────────
function BenefRow({ beneficiarios }) {
  if (!beneficiarios?.length) {
    return (
      <tr>
        <td colSpan="9" style={{ ...s.td, paddingLeft: 32, color: '#9ca3af', fontSize: 12, background: '#f9fafb' }}>
          Sin beneficiarios registrados.
        </td>
      </tr>
    )
  }
  return (
    <tr>
      <td colSpan="9" style={{ ...s.td, background: '#f0f9ff', paddingLeft: 32 }}>
        <div style={{ fontSize: 12, color: '#374151' }}>
          <strong>Beneficiarios:</strong>{' '}
          {beneficiarios.map((b, i) => (
            <span key={b.id}>
              {b.nombre} {b.apellido}{b.documento ? ` (${b.documento})` : ''}
              {i < beneficiarios.length - 1 ? ' · ' : ''}
            </span>
          ))}
        </div>
      </td>
    </tr>
  )
}

// ─────────────────────────────────────────────────────────────────
export default function DashboardAdmin() {
  const { user } = useAuth()
  const [tabActiva, setTabActiva] = useState('Consultas')

  // ══ DASHBOARD ════════════════════════════════════════════════════
  const STATS_INIT = { total: 0, pagos: 0, enMora: 0, conBeneficiarios: 0, activos: 0, inactivos: 0, totalRecaudado: 0 }
  const [dashStats,         setDashStats]         = useState(STATS_INIT)
  const [usuariosDashboard, setUsuariosDashboard] = useState([])
  const [cargandoDashboard, setCargandoDashboard] = useState(false)
  const [dashError,         setDashError]         = useState(null)
  const [filtroEstado,      setFiltroEstado]      = useState('Todos')
  const [expandidos,        setExpandidos]        = useState(new Set())
  const [eliminandoId,      setEliminandoId]      = useState(null)
  const [confirmElim,       setConfirmElim]       = useState(null) // { id, nombre }
  const [accionMsg,         setAccionMsg]         = useState(null)

  const cargarDashboard = useCallback(async () => {
    setCargandoDashboard(true)
    setDashError(null)
    const { stats, usuarios, error } = await fetchDashboardData()
    setCargandoDashboard(false)
    if (error) { setDashError('Error al cargar datos: ' + error.message); return }
    setDashStats(stats)
    setUsuariosDashboard(usuarios)
  }, [])

  useEffect(() => { cargarDashboard() }, [cargarDashboard])

  const usuariosFiltrados = useMemo(() => {
    if (filtroEstado === 'Todos')   return usuariosDashboard
    if (filtroEstado === 'En mora') return usuariosDashboard.filter(u => u.enMora)
    return usuariosDashboard.filter(u => u.estado === filtroEstado.toLowerCase())
  }, [usuariosDashboard, filtroEstado])

  function toggleExpandir(id) {
    setExpandidos(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleToggleEstado(u) {
    setAccionMsg(null)
    const { error, nuevoEstado } = await toggleEstadoCliente(u.id, u.estado)
    if (error) {
      setAccionMsg({ type: 'error', text: 'Error al cambiar estado: ' + error.message })
    } else {
      setAccionMsg({ type: 'ok', text: `${u.nombre} ahora está ${nuevoEstado}.` })
      cargarDashboard()
    }
  }

  async function handleEliminar() {
    if (!confirmElim) return
    setEliminandoId(confirmElim.id)
    setConfirmElim(null)
    const { error } = await eliminarCliente(confirmElim.id)
    setEliminandoId(null)
    if (error) {
      setAccionMsg({ type: 'error', text: 'Error al eliminar: ' + error.message })
    } else {
      setAccionMsg({ type: 'ok', text: 'Afiliado eliminado correctamente.' })
      cargarDashboard()
    }
  }

  // ══ TAB: AFILIADOS ═══════════════════════════════════════════════
  const [formAfil,    setFormAfil]    = useState(FORM_AFIL_EMPTY)
  const [afilLoading, setAfilLoading] = useState(false)
  const [afilMsg,     setAfilMsg]     = useState(null)

  async function crearAfiliado(e) {
    e.preventDefault()
    setAfilMsg(null)
    const nombre    = formAfil.nombre.trim()
    const documento = formAfil.documento.trim()
    if (!nombre || !documento) {
      setAfilMsg({ type: 'error', text: 'Nombre y documento son obligatorios.' })
      return
    }
    setAfilLoading(true)

    const { data: dup } = await supabase
      .from('clientes').select('id').eq('documento', documento).maybeSingle()

    if (dup) {
      setAfilMsg({ type: 'error', text: 'Ya existe un afiliado con ese documento.' })
      setAfilLoading(false)
      return
    }

    const { error } = await supabase.from('clientes').insert([{
      nombre,
      apellido:         formAfil.apellido.trim()         || '',
      documento,
      fecha_ingreso:    formAfil.fecha_ingreso            || null,
      fecha_nacimiento: formAfil.fecha_nacimiento         || null,
      telefono:         formAfil.telefono.trim()          || null,
      correo:           formAfil.correo.trim()            || null,
      direccion:        formAfil.direccion.trim()         || null,
      asesor:           formAfil.asesor.trim()            || null,
      estado:           'activo',
    }])

    if (error) {
      setAfilMsg({ type: 'error', text: 'Error al crear: ' + error.message })
    } else {
      setAfilMsg({ type: 'ok', text: 'Afiliado creado correctamente.' })
      setFormAfil(FORM_AFIL_EMPTY)
      cargarDashboard()
    }
    setAfilLoading(false)
  }

  // ══ TAB: PAGOS ═══════════════════════════════════════════════════
  const [pago,           setPago]           = useState(PAGO_EMPTY)
  const [pagoLoading,    setPagoLoading]    = useState(false)
  const [pagoMsg,        setPagoMsg]        = useState(null)
  const [historialPagos, setHistorialPagos] = useState([])
  const [clientePagoSel, setClientePagoSel] = useState(null)

  async function handleRegistrarPago(e) {
    e.preventDefault()
    setPagoMsg(null)
    const { documento, año, mes, valor } = pago
    if (!documento.trim() || !año || !valor) {
      setPagoMsg({ type: 'error', text: 'Todos los campos son obligatorios.' })
      return
    }
    const valorNum = parseFloat(valor)
    if (isNaN(valorNum) || valorNum <= 0) {
      setPagoMsg({ type: 'error', text: 'El valor debe ser un número positivo.' })
      return
    }
    setPagoLoading(true)
    const { data, error } = await registrarPago({
      documento:    documento.trim(),
      mes:          Number(mes),
      año:          Number(año),
      valor:        valorNum,
      registradoPor: user?.id,
    })
    setPagoLoading(false)

    if (error) {
      setPagoMsg({ type: 'error', text: error.message })
    } else {
      setPagoMsg({ type: 'ok', text: 'Pago registrado correctamente.' })
      const { data: hist } = await fetchPagosPorCliente(data.cliente_id)
      setHistorialPagos(hist ?? [])
      setClientePagoSel(documento.trim())
      setPago(p => ({ ...PAGO_EMPTY, documento: p.documento }))
      cargarDashboard()
    }
  }

  // ══ TAB: CONSULTAS ═══════════════════════════════════════════════
  const [docBusqueda,   setDocBusqueda]   = useState('')
  const [clientes,      setClientes]      = useState([])
  const [buscando,      setBuscando]      = useState(false)
  const [buscado,       setBuscado]       = useState(false)
  const [clienteSel,    setClienteSel]    = useState(null)
  const [beneficiarios, setBeneficiarios] = useState([])
  const [benefLoading,  setBenefLoading]  = useState(false)
  const [formBenef,     setFormBenef]     = useState({ nombre: '', apellido: '', documento: '' })
  const [guardando,     setGuardando]     = useState(false)
  const [benefMsg,      setBenefMsg]      = useState(null)

  const buscar = useCallback(async (e) => {
    if (e) e.preventDefault()
    const term = docBusqueda.trim()
    if (!term) return
    setBuscando(true)
    setBuscado(true)
    setClienteSel(null)
    setBeneficiarios([])
    setBenefMsg(null)
    if (user?.id) registrarLogConsulta(user.id, term)

    const { data, error } = await supabase
      .from('clientes')
      .select('id, nombre, apellido, documento, fecha_ingreso, telefono, correo, asesor')
      .ilike('documento', `%${term}%`)
      .order('apellido')
      .limit(50)

    setClientes(error ? [] : (data ?? []))
    setBuscando(false)
  }, [docBusqueda, user?.id])

  const cargarBeneficiarios = useCallback(async (clienteId) => {
    setBenefLoading(true)
    setBenefMsg(null)
    const { data } = await supabase
      .from('beneficiarios')
      .select('id, nombre, apellido, documento')
      .eq('cliente_id', clienteId)
      .order('id', { ascending: false })
    setBeneficiarios(data ?? [])
    setBenefLoading(false)
  }, [])

  function seleccionar(c) {
    const mismo = clienteSel?.id === c.id
    setClienteSel(mismo ? null : c)
    setBeneficiarios([])
    setBenefMsg(null)
    setFormBenef({ nombre: '', apellido: '', documento: '' })
    if (!mismo) cargarBeneficiarios(c.id)
  }

  async function agregarBenef(e) {
    e.preventDefault()
    if (!clienteSel) return
    const nombre = formBenef.nombre.trim()
    if (!nombre) { setBenefMsg({ type: 'error', text: 'Nombre obligatorio.' }); return }
    setGuardando(true)
    setBenefMsg(null)
    const { error } = await supabase.from('beneficiarios').insert([{
      cliente_id: clienteSel.id,
      nombre,
      apellido:   formBenef.apellido.trim()  || '',
      documento:  formBenef.documento.trim() || '',
    }])
    if (error) {
      setBenefMsg({ type: 'error', text: 'Error: ' + error.message })
    } else {
      setBenefMsg({ type: 'ok', text: 'Beneficiario agregado.' })
      setFormBenef({ nombre: '', apellido: '', documento: '' })
      cargarBeneficiarios(clienteSel.id)
      cargarDashboard()
    }
    setGuardando(false)
  }

  // ══ RENDER ═══════════════════════════════════════════════════════
  return (
    <div style={s.root}>

      {confirmElim && (
        <ConfirmModal
          nombre={confirmElim.nombre}
          onConfirm={handleEliminar}
          onCancel={() => setConfirmElim(null)}
        />
      )}

      {/* LOGO */}
      <div style={s.header}>
        <img src={logoImg} alt="Logo" style={s.logo} />
      </div>

      {/* ── DASHBOARD KPIs ─────────────────────────────────────── */}
      <div style={s.dashboardRoot}>
        <div style={s.dashboardTop}>
          <div>
            <div style={s.dashboardTitle}>Panel de Control</div>
            <div style={s.dashboardSubtitle}>Resumen avanzado de usuarios, pagos y moras.</div>
          </div>
          <button style={{ ...s.btnSmall, ...s.btnBlue }} type="button" onClick={cargarDashboard} disabled={cargandoDashboard}>
            {cargandoDashboard ? 'Actualizando…' : 'Refrescar datos'}
          </button>
        </div>

        {dashError && (
          <div style={{ ...s.msg, background: '#fef2f2', color: '#dc2626', borderColor: '#fca5a5', marginBottom: 12 }}>
            {dashError}
          </div>
        )}

        {accionMsg && (
          <div style={{ marginBottom: 10 }}>
            <Msg msg={accionMsg} />
          </div>
        )}

        {/* KPIs */}
        <div style={s.cardsRow}>
          {[
            { label: 'Usuarios',            value: dashStats.total,            hint: 'Total registrados' },
            { label: 'Pagos',               value: dashStats.pagos,            hint: 'Movimientos' },
            { label: 'En mora',             value: dashStats.enMora,           hint: '≥2 meses sin pagar' },
            { label: 'Con beneficiarios',   value: dashStats.conBeneficiarios, hint: 'Clientes con red' },
            { label: 'Activos / Inactivos', value: `${dashStats.activos} / ${dashStats.inactivos}`, hint: 'Estado actual' },
            { label: 'Total recaudado',     value: formatCOP(dashStats.totalRecaudado), hint: 'Suma de pagos' },
          ].map(({ label, value, hint }) => (
            <div key={label} style={s.card}>
              <div style={s.cardLabel}>{label}</div>
              <div style={{ ...s.cardValue, fontSize: label === 'Total recaudado' ? 16 : 28 }}>
                {cargandoDashboard ? '…' : value}
              </div>
              <div style={s.cardHint}>{hint}</div>
            </div>
          ))}
        </div>

        {/* Filtro */}
        <div style={s.filterRow}>
          <div>
            <label style={s.label}>Filtrar estado</label>
            <select style={{ ...s.input, width: 160 }} value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
              <option>Todos</option>
              <option>Activo</option>
              <option>Inactivo</option>
              <option>En mora</option>
            </select>
          </div>
          <div style={s.filterInfo}>
            {usuariosFiltrados.length} registros · {dashStats.total} totales
          </div>
        </div>

        {/* Tabla de usuarios */}
        <div style={s.tableWrap}>
          <table style={s.dashboardTable}>
            <thead>
              <tr style={s.thead}>
                {['', 'Nombre', 'Documento', 'Último pago', 'Total pagado', 'Mora', 'Beneficiarios', 'Estado', 'Acciones']
                  .map(h => <th key={h} style={s.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {usuariosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="9" style={s.tdEmpty}>
                    {cargandoDashboard ? 'Cargando…' : 'Sin registros para este filtro.'}
                  </td>
                </tr>
              ) : usuariosFiltrados.map(u => (
                <>
                  <tr
                    key={u.id}
                    style={{ ...s.tr, background: u.enMora ? '#fff7f0' : undefined }}
                  >
                    {/* Expandir */}
                    <td style={{ ...s.td, width: 32 }}>
                      {u.beneficiariosCount > 0 && (
                        <button
                          type="button"
                          style={{ ...s.btnIcon, color: expandidos.has(u.id) ? '#2563eb' : '#6b7280' }}
                          onClick={() => toggleExpandir(u.id)}
                          title={expandidos.has(u.id) ? 'Ocultar beneficiarios' : 'Ver beneficiarios'}
                        >
                          {expandidos.has(u.id) ? '▾' : '▸'}
                        </button>
                      )}
                    </td>
                    <td style={s.td}>{u.nombre} {u.apellido}</td>
                    <td style={s.td}>{u.documento}</td>
                    <td style={s.td}>{u.ultimoPagoText}</td>
                    <td style={s.td}>{formatCOP(u.totalPagosValor)}</td>
                    <td style={s.td}>
                      <span style={{ ...s.badge, ...(u.enMora ? s.badgeDanger : s.badgeSuccess) }}>
                        {u.enMora ? 'Sí' : 'No'}
                      </span>
                    </td>
                    <td style={s.td}>
                      <span style={s.badge}>{u.beneficiariosCount}</span>
                    </td>
                    <td style={s.td}>
                      <span style={{ ...s.badge, ...(u.estado === 'activo' ? s.badgeSuccess : s.badgeMuted) }}>
                        {u.estado}
                      </span>
                    </td>
                    <td style={{ ...s.td, display: 'flex', gap: 4 }}>
                      <button
                        type="button"
                        style={{ ...s.btnSmall, background: u.estado === 'activo' ? '#f59e0b' : '#16a34a', color: '#fff', padding: '3px 8px', fontSize: 11 }}
                        onClick={() => handleToggleEstado(u)}
                        title={u.estado === 'activo' ? 'Desactivar' : 'Activar'}
                      >
                        {u.estado === 'activo' ? 'Desactivar' : 'Activar'}
                      </button>
                      <button
                        type="button"
                        style={{ ...s.btnSmall, background: '#dc2626', color: '#fff', padding: '3px 8px', fontSize: 11 }}
                        onClick={() => setConfirmElim({ id: u.id, nombre: `${u.nombre} ${u.apellido}` })}
                        disabled={eliminandoId === u.id}
                        title="Eliminar afiliado"
                      >
                        {eliminandoId === u.id ? '…' : 'Eliminar'}
                      </button>
                    </td>
                  </tr>
                  {expandidos.has(u.id) && (
                    <BenefRow key={`benef-${u.id}`} beneficiarios={u.beneficiarios} />
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── TABS ──────────────────────────────────────────────────── */}
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

      <div style={s.content}>

        {/* ── COL 1: AFILIADOS ─────────────────────────────────────*/}
        <div style={{ ...s.col, display: tabActiva !== 'Afiliados' ? 'none' : 'flex' }}>
          <div style={{ ...s.colTitle, color: '#2563eb' }}>Afiliados</div>
          <p style={s.hint}>Crear nuevo afiliado en el sistema.</p>

          {[
            { lbl: 'Cédula *',         key: 'documento' },
            { lbl: 'Nombre *',         key: 'nombre' },
            { lbl: 'Apellido',         key: 'apellido' },
            { lbl: 'Teléfono',         key: 'telefono' },
            { lbl: 'Correo',           key: 'correo',           type: 'email' },
            { lbl: 'Dirección',        key: 'direccion' },
            { lbl: 'Asesor',           key: 'asesor' },
            { lbl: 'Fecha Nacimiento', key: 'fecha_nacimiento', type: 'date' },
            { lbl: 'Fecha Ingreso',    key: 'fecha_ingreso',    type: 'date' },
          ].map(({ lbl, key, type }) => (
            <div key={key} style={s.fieldGroup}>
              <label style={s.label}>{lbl}:</label>
              <input
                style={s.input}
                type={type || 'text'}
                value={formAfil[key]}
                onChange={e => setFormAfil(f => ({ ...f, [key]: e.target.value }))}
                disabled={afilLoading}
              />
            </div>
          ))}

          <Msg msg={afilMsg} />

          <button
            style={{ ...s.btn, ...s.btnBlue }}
            onClick={crearAfiliado}
            disabled={afilLoading}
            type="button"
          >
            {afilLoading ? 'Guardando…' : 'Agregar Afiliado'}
          </button>
        </div>

        {/* ── COL 2: PAGOS ─────────────────────────────────────────*/}
        <div style={{ ...s.col, display: tabActiva !== 'Pagos' ? 'none' : 'flex' }}>
          <div style={{ ...s.colTitle, color: '#16a34a' }}>Pagos</div>
          <p style={s.hint}>Registrar un pago mensual.</p>

          <div style={s.fieldGroup}>
            <label style={s.label}>Cédula del afiliado:</label>
            <input
              style={s.input}
              placeholder="Documento exacto"
              value={pago.documento}
              onChange={e => setPago(p => ({ ...p, documento: e.target.value }))}
              disabled={pagoLoading}
            />
          </div>

          <div style={s.fieldGroup}>
            <label style={s.label}>Año:</label>
            <input
              style={s.input}
              type="number"
              min="2000"
              max="2100"
              value={pago.año}
              onChange={e => setPago(p => ({ ...p, año: e.target.value }))}
              disabled={pagoLoading}
            />
          </div>

          <div style={s.fieldGroup}>
            <label style={s.label}>Mes:</label>
            <select
              style={s.input}
              value={pago.mes}
              onChange={e => setPago(p => ({ ...p, mes: Number(e.target.value) }))}
              disabled={pagoLoading}
            >
              {MESES.map(m => (
                <option key={m.valor} value={m.valor}>{m.nombre}</option>
              ))}
            </select>
          </div>

          <div style={s.fieldGroup}>
            <label style={s.label}>Valor del pago (COP):</label>
            <input
              style={s.input}
              type="number"
              min="0"
              step="1000"
              placeholder="0"
              value={pago.valor}
              onChange={e => setPago(p => ({ ...p, valor: e.target.value }))}
              disabled={pagoLoading}
            />
            {pago.valor && !isNaN(pago.valor) && Number(pago.valor) > 0 && (
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                {formatCOP(pago.valor)}
              </div>
            )}
          </div>

          <Msg msg={pagoMsg} />

          <button
            style={{ ...s.btn, ...s.btnGreen }}
            onClick={handleRegistrarPago}
            disabled={pagoLoading}
            type="button"
          >
            {pagoLoading ? 'Registrando…' : 'Registrar Pago'}
          </button>

          {/* Historial */}
          {historialPagos.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={s.tableLabel}>Historial — {clientePagoSel}</div>
              <div style={s.tableWrap}>
                <table style={s.table}>
                  <thead>
                    <tr style={s.thead}>
                      <th style={s.th}>Mes</th>
                      <th style={s.th}>Año</th>
                      <th style={s.th}>Valor</th>
                      <th style={s.th}>Fecha reg.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historialPagos.map(p => (
                      <tr key={p.id} style={s.tr}>
                        <td style={s.td}>{MESES_NOMBRES[p.mes] ?? p.mes}</td>
                        <td style={s.td}>{p.año}</td>
                        <td style={s.td}>{formatCOP(p.valor)}</td>
                        <td style={s.td}>{p.fecha_pago ? new Date(p.fecha_pago).toLocaleDateString('es-CO') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ── COL 3: CONSULTAS ─────────────────────────────────────*/}
        <div style={{ ...s.col, ...s.colWide, display: tabActiva !== 'Consultas' ? 'none' : 'flex' }}>
          <div style={{ ...s.colTitle, color: '#ea580c' }}>Consultas</div>

          <form onSubmit={buscar}>
            <label style={s.label}>Buscar por Cédula:</label>
            <input
              style={{ ...s.input, marginBottom: 6 }}
              placeholder="Documento (búsqueda parcial)"
              value={docBusqueda}
              onChange={e => setDocBusqueda(e.target.value)}
            />
            <button
              style={{ ...s.btn, ...s.btnOrange, width: '100%' }}
              type="submit"
              disabled={buscando || !docBusqueda.trim()}
            >
              {buscando ? 'Buscando…' : 'Buscar Afiliado'}
            </button>
          </form>

          <div style={{ marginTop: 14 }}>
            <div style={s.tableLabel}>Resultados</div>
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr style={s.thead}>
                    {['Nombre', 'Apellido', 'Documento', 'Fecha ingreso', 'Asesor', ''].map(h => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {buscando ? (
                    <tr><td colSpan="6" style={s.tdEmpty}>Buscando…</td></tr>
                  ) : !buscado ? (
                    <tr><td colSpan="6" style={s.tdEmpty}>Ingresa un documento y presiona Buscar.</td></tr>
                  ) : clientes.length === 0 ? (
                    <tr><td colSpan="6" style={s.tdEmpty}>Sin coincidencias para «{docBusqueda}»</td></tr>
                  ) : clientes.map(c => (
                    <tr
                      key={c.id}
                      style={{ ...s.tr, background: clienteSel?.id === c.id ? '#dbeafe' : undefined, cursor: 'pointer' }}
                      onClick={() => seleccionar(c)}
                    >
                      <td style={s.td}>{c.nombre}</td>
                      <td style={s.td}>{c.apellido}</td>
                      <td style={s.td}>{c.documento}</td>
                      <td style={s.td}>{c.fecha_ingreso ?? '—'}</td>
                      <td style={s.td}>{c.asesor ?? '—'}</td>
                      <td style={s.td}>
                        <button
                          style={s.btnSmall}
                          type="button"
                          onClick={ev => { ev.stopPropagation(); seleccionar(c) }}
                        >
                          {clienteSel?.id === c.id ? 'Ocultar' : 'Ver'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Panel beneficiarios */}
          <div style={s.benefPanel}>
            <div style={s.benefTitle}>
              Beneficiarios
              {clienteSel && (
                <span style={{ fontWeight: 400, fontSize: 13, color: '#6b7280', marginLeft: 8 }}>
                  — {clienteSel.nombre} {clienteSel.apellido}
                </span>
              )}
            </div>

            {!clienteSel ? (
              <p style={s.hint}>Selecciona un afiliado de la tabla.</p>
            ) : benefLoading ? (
              <p style={s.hint}>Cargando…</p>
            ) : beneficiarios.length === 0 ? (
              <p style={s.hint}>Sin beneficiarios registrados.</p>
            ) : (
              <ul style={s.benefList}>
                {beneficiarios.map(b => (
                  <li key={b.id} style={s.benefItem}>
                    <strong>{b.nombre}</strong> {b.apellido}
                    {b.documento && <span style={{ color: '#6b7280' }}> · {b.documento}</span>}
                  </li>
                ))}
              </ul>
            )}

            {clienteSel && (
              <form onSubmit={agregarBenef} style={{ marginTop: 10 }}>
                <div style={s.tableLabel}>Agregar beneficiario</div>
                <Msg msg={benefMsg} />
                {['nombre', 'apellido', 'documento'].map(key => (
                  <input
                    key={key}
                    style={{ ...s.input, marginBottom: 6 }}
                    placeholder={key.charAt(0).toUpperCase() + key.slice(1) + (key === 'nombre' ? ' *' : '')}
                    value={formBenef[key]}
                    onChange={e => setFormBenef(f => ({ ...f, [key]: e.target.value }))}
                    disabled={guardando}
                  />
                ))}
                <button style={{ ...s.btn, ...s.btnBlue }} type="submit" disabled={guardando}>
                  {guardando ? 'Guardando…' : 'Agregar beneficiario'}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Cols ocultos deben seguir en DOM para mantener layout - renderizar vacíos */}
        {tabActiva === 'Afiliados' && <div style={{ ...s.col, ...s.colWide }} />}
        {tabActiva === 'Pagos'     && <div style={{ ...s.col, ...s.colWide }} />}

      </div>
    </div>
  )
}

// ─── Estilos — base IDÉNTICA al original + nuevos ────────────────
const s = {
  root: { fontFamily: 'Segoe UI, Tahoma, Arial, sans-serif', fontSize: 13, color: '#1f2937' },
    header: { width: '100%', padding: '12px 0', background: '#f8fafc', borderBottom: '1px solid #cbd5e1',},
  logo: { width: '100%', height: 'auto', maxHeight: 120, objectFit: 'contain' },
  dashboardRoot: { margin: '16px 0', padding: '16px', background: '#f8fafc', border: '1px solid #d1d5db', borderRadius: 10 },
  dashboardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 },
  dashboardTitle: { fontSize: 18, fontWeight: 700, color: '#111827' },
  dashboardSubtitle: { fontSize: 13, color: '#475569', marginTop: 4 },
  cardsRow: { display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  card: { flex: '1 1 160px', minWidth: 160, padding: 16, borderRadius: 12, border: '1px solid #cbd5e1', background: '#fff', boxShadow: '0 1px 2px rgba(15,23,42,0.05)' },
  cardLabel: { fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
  cardValue: { fontSize: 28, fontWeight: 700, color: '#111827' },
  cardHint: { fontSize: 12, color: '#64748b', marginTop: 6 },
  filterRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 },
  filterInfo: { fontSize: 12, color: '#475569' },
  tabBar: { display: 'flex', borderBottom: '2px solid #cbd5e1', marginBottom: 0 },
  tab: { padding: '7px 18px', border: '1px solid #cbd5e1', borderBottom: 'none', background: '#e5e7eb', cursor: 'pointer', fontSize: 13, borderRadius: '4px 4px 0 0', marginRight: 2, color: '#374151' },
  tabActiva: { background: '#fff', borderBottom: '2px solid #fff', marginBottom: -2, fontWeight: 600, color: '#111827' },
  content: { display: 'flex', gap: 0, border: '1px solid #cbd5e1', borderTop: 'none', background: '#f1f5f9', minHeight: 500 },
  col: { flex: '0 0 240px', padding: '14px 16px', borderRight: '1px solid #cbd5e1', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 2 },
  colWide: { flex: 1, borderRight: 'none' },
  colTitle: { fontWeight: 700, fontSize: 14, marginBottom: 6 },
  fieldGroup: { marginBottom: 8 },
  label: { display: 'block', fontSize: 12, color: '#4b5563', marginBottom: 3, fontWeight: 500 },
  input: { width: '100%', padding: '5px 8px', border: '1px solid #9ca3af', borderRadius: 3, fontSize: 13, background: '#fff', boxSizing: 'border-box', color: '#111827' },
  hint: { fontSize: 12, color: '#6b7280', margin: '0 0 8px' },
  btn: { padding: '7px 0', width: '100%', border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 4, letterSpacing: 0.2 },
  btnBlue:   { background: '#2563eb', color: '#fff' },
  btnGreen:  { background: '#16a34a', color: '#fff' },
  btnOrange: { background: '#ea580c', color: '#fff' },
  btnSmall:  { padding: '7px 12px', fontSize: 12, border: 'none', borderRadius: 4, background: '#2563eb', color: '#fff', cursor: 'pointer' },
  btnIcon:   { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '0 4px', fontWeight: 700 },
  dashboardTable: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  tableLabel: { fontWeight: 600, fontSize: 13, marginBottom: 6, color: '#374151' },
  tableWrap: { overflowX: 'auto', border: '1px solid #cbd5e1', borderRadius: 4, background: '#fff' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  thead: { background: '#e5e7eb' },
  th: { padding: '8px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #cbd5e1', whiteSpace: 'nowrap', color: '#374151' },
  tr: { borderBottom: '1px solid #f3f4f6' },
  td: { padding: '8px 12px', whiteSpace: 'nowrap', verticalAlign: 'middle' },
  tdEmpty: { padding: '14px 10px', textAlign: 'center', color: '#9ca3af', fontSize: 12 },
  benefPanel: { marginTop: 16, padding: 12, border: '1px solid #cbd5e1', borderRadius: 4, background: '#fff' },
  benefTitle: { fontWeight: 600, fontSize: 13, marginBottom: 8, color: '#374151' },
  benefList: { margin: '0 0 8px', padding: '0 0 0 16px', listStyle: 'disc' },
  benefItem: { padding: '3px 0', fontSize: 13 },
  msg: { fontSize: 12, padding: '6px 10px', border: '1px solid', borderRadius: 4, marginBottom: 8 },
  badge: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '3px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: '#e2e8f0', color: '#1f2937' },
  badgeSuccess: { background: '#d1fae5', color: '#166534' },
  badgeDanger:  { background: '#fee2e2', color: '#b91c1c' },
  badgeMuted:   { background: '#f3f4f6', color: '#475569' },
  // Modal
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal:   { background: '#fff', borderRadius: 12, padding: 24, maxWidth: 380, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' },
}
