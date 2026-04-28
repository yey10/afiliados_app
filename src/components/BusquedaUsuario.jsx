/**
 * BusquedaUsuario.jsx — rol USER (versión final)
 * - PAGO_EMPTY declarado correctamente
 * - Panel de detalle completo del afiliado seleccionado
 * - Eliminar beneficiarios con confirmación
 * - Campos type="date" con calendario nativo
 * - Fecha/hora completa en historial de pagos
 * - Búsqueda ordenada por fecha_ingreso desc
 * - Observaciones visibles en panel de detalle
 */
import { useState, useCallback } from 'react'
import { useAuth }  from '../context/AuthContext'
import { supabase } from '../supabase'
import {
  registrarLogConsulta, registrarPago, fetchPagosPorCliente,
  eliminarBeneficiario, updateObservaciones,
  formatCOP, formatFechaHora, formatFecha,
  MESES_NOMBRES, buscarClientes,
} from '../api/afiliados'
import logoImg from '../assets/logo.jpeg'

const TABS  = ['Afiliados', 'Pagos', 'Consultas']
const MESES = MESES_NOMBRES.slice(1).map((n, i) => ({ nombre: n, valor: i + 1 }))

// ✅ PAGO_EMPTY declarado correctamente (antes faltaba → crash)
const PAGO_EMPTY = {
  documento: '',
  año:       String(new Date().getFullYear()),
  mes:       new Date().getMonth() + 1,
  valor:     '',
}

const PAGO_INICIAL_EMPTY = {
  año:   String(new Date().getFullYear()),
  mes:   new Date().getMonth() + 1,
  valor: '',
}

const FORM_EMPTY = {
  nombre: '', apellido: '', documento: '', fecha_ingreso: '',
  fecha_nacimiento: '', telefono: '', correo: '', direccion: '', asesor: '',
}

// ── Msg helper ────────────────────────────────────────────────────
function Msg({ msg, onClose }) {
  if (!msg) return null
  const ok = msg.type === 'ok'
  return (
    <div style={{ ...S.msg, background: ok ? '#f0fdf4' : '#fef2f2', color: ok ? '#15803d' : '#dc2626', borderColor: ok ? '#86efac' : '#fca5a5' }}>
      <span>{ok ? '✓ ' : '✕ '}{msg.text}</span>
      {onClose && <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 700 }}>✕</button>}
    </div>
  )
}

// ── Badge de estado ───────────────────────────────────────────────
function EstadoBadge({ estado }) {
  const activo = (estado ?? 'activo') === 'activo'
  return (
    <span style={{ ...S.badge, background: activo ? '#d1fae5' : '#fee2e2', color: activo ? '#166534' : '#b91c1c' }}>
      {activo ? '● Activo' : '○ Inactivo'}
    </span>
  )
}

// ── Panel de detalle del afiliado seleccionado ────────────────────
function PanelDetalle({ cliente, ultimoPagoText }) {
  if (!cliente) return null
  const filas = [
    ['Documento',       cliente.documento],
    ['Estado',          <EstadoBadge estado={cliente.estado} />],
    ['Teléfono',        cliente.telefono],
    ['Correo',          cliente.correo],
    ['Dirección',       cliente.direccion],
    ['Asesor',          cliente.asesor],
    ['F. ingreso',      formatFecha(cliente.fecha_ingreso)],
    ['F. nacimiento',   formatFecha(cliente.fecha_nacimiento)],
    ['Último pago',     ultimoPagoText],
  ].filter(([, v]) => v && v !== '—')

  return (
    <div style={S.detallePanel}>
      <div style={S.detalleTitulo}>📋 {cliente.nombre} {cliente.apellido}</div>
      <div style={S.detalleGrid}>
        {filas.map(([lbl, val]) => (
          <div key={lbl}>
            <div style={S.detLbl}>{lbl}</div>
            <div style={S.detVal}>{val}</div>
          </div>
        ))}
      </div>
      {cliente.observaciones && (
        <div style={{ marginTop: 10 }}>
          <div style={S.detLbl}>Observaciones</div>
          <div style={{ ...S.detVal, whiteSpace: 'pre-wrap', background: '#f8fafc', padding: '6px 8px', borderRadius: 4, border: '1px solid #e2e8f0', marginTop: 2 }}>
            {cliente.observaciones}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Beneficiarios con eliminar ────────────────────────────────────
function PanelBeneficiarios({ clienteSel, beneficiarios, benefLoading, onRecargar }) {
  const [formB,    setFormB]    = useState({ nombre: '', apellido: '', documento: '' })
  const [guardando,setGuardando]= useState(false)
  const [elimId,   setElimId]   = useState(null)
  const [msg,      setMsg]      = useState(null)

  async function agregar(e) {
    e.preventDefault()
    if (!clienteSel) return
    const nombre = formB.nombre.trim()
    if (!nombre) { setMsg({ type: 'error', text: 'Nombre obligatorio.' }); return }
    setGuardando(true); setMsg(null)
    const { error } = await supabase.from('beneficiarios').insert([{
      cliente_id: clienteSel.id,
      nombre, apellido: formB.apellido.trim() || '', documento: formB.documento.trim() || '',
    }])
    setGuardando(false)
    if (error) setMsg({ type: 'error', text: 'Error: ' + error.message })
    else { setMsg({ type: 'ok', text: 'Beneficiario agregado.' }); setFormB({ nombre: '', apellido: '', documento: '' }); onRecargar() }
  }

  async function eliminar(id, nombre) {
    if (!window.confirm(`¿Eliminar a ${nombre}?`)) return
    setElimId(id)
    const { error } = await eliminarBeneficiario(id)
    setElimId(null)
    if (error) setMsg({ type: 'error', text: 'Error al eliminar: ' + error.message })
    else { setMsg({ type: 'ok', text: 'Beneficiario eliminado.' }); onRecargar() }
  }

  return (
    <div style={S.benefPanel}>
      <div style={S.benefTitle}>
        👥 Beneficiarios
        {clienteSel && <span style={{ fontWeight: 400, color: '#6b7280', marginLeft: 6 }}>— {clienteSel.nombre} {clienteSel.apellido}</span>}
        {beneficiarios.length > 0 && <span style={{ ...S.badge, background: '#dbeafe', color: '#1d4ed8', marginLeft: 6 }}>{beneficiarios.length}</span>}
      </div>

      <Msg msg={msg} onClose={() => setMsg(null)} />

      {!clienteSel ? (
        <p style={S.hint}>Selecciona un afiliado para ver sus beneficiarios.</p>
      ) : benefLoading ? (
        <p style={S.hint}>Cargando…</p>
      ) : beneficiarios.length === 0 ? (
        <p style={{ ...S.hint, color: '#d97706' }}>⚠ Sin beneficiarios registrados.</p>
      ) : (
        <div style={S.benefCards}>
          {beneficiarios.map(b => (
            <div key={b.id} style={S.benefCard}>
              <div style={S.benefAvatar}>{(b.nombre?.[0] ?? '?').toUpperCase()}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{b.nombre} {b.apellido}</div>
                {b.documento && <div style={{ fontSize: 11, color: '#6b7280' }}>CC {b.documento}</div>}
              </div>
              <button type="button"
                style={{ background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: 3, padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}
                onClick={() => eliminar(b.id, b.nombre)} disabled={elimId === b.id} title="Eliminar">
                {elimId === b.id ? '…' : '✕'}
              </button>
            </div>
          ))}
        </div>
      )}

      {clienteSel && (
        <form onSubmit={agregar} style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #e2e8f0' }}>
          <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6, color: '#374151' }}>➕ Agregar beneficiario</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[{ k: 'nombre', p: 'Nombre *' }, { k: 'apellido', p: 'Apellido' }, { k: 'documento', p: 'Documento' }].map(({ k, p }) => (
              <input key={k} style={{ ...S.input, flex: '1 1 110px' }} placeholder={p}
                value={formB[k]} onChange={e => setFormB(f => ({ ...f, [k]: e.target.value }))} disabled={guardando} />
            ))}
          </div>
          <button style={{ ...S.btn, ...S.btnBlue, marginTop: 6 }} type="submit" disabled={guardando || !formB.nombre.trim()}>
            {guardando ? 'Guardando…' : 'Agregar beneficiario'}
          </button>
        </form>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
export default function BusquedaUsuario() {
  const { user } = useAuth()
  const [tabActiva, setTabActiva] = useState('Consultas')

  // ── TAB: AFILIADOS ────────────────────────────────────────────
  const [form,          setForm]          = useState(FORM_EMPTY)
  const [formLoading,   setFormLoading]   = useState(false)
  const [formMsg,       setFormMsg]       = useState(null)
  const [pagoInicial,   setPagoInicial]   = useState(PAGO_INICIAL_EMPTY)

  async function crearAfiliado(e) {
    e.preventDefault(); setFormMsg(null)
    const nombre = form.nombre.trim(), documento = form.documento.trim()
    const valorInicial = parseFloat(pagoInicial.valor)

    if (!nombre || !documento) {
      setFormMsg({ type: 'error', text: 'Nombre y documento son obligatorios.' }); return
    }
    if (!pagoInicial.año || !pagoInicial.mes || !pagoInicial.valor) {
      setFormMsg({ type: 'error', text: 'El primer pago inicial es obligatorio.' }); return
    }
    if (isNaN(valorInicial) || valorInicial <= 0) {
      setFormMsg({ type: 'error', text: 'El valor del pago inicial debe ser un número mayor a 0.' }); return
    }

    setFormLoading(true)

    const { data: dup } = await supabase.from('clientes').select('id').eq('documento', documento).maybeSingle()
    if (dup) { setFormMsg({ type: 'error', text: 'Ya existe un afiliado con ese documento.' }); setFormLoading(false); return }

    const { data: clienteCreado, error } = await supabase.from('clientes').insert([{
      nombre, apellido: form.apellido.trim() || '', documento,
      fecha_ingreso:    form.fecha_ingreso             || null,
      fecha_nacimiento: form.fecha_nacimiento          || null,
      telefono:         form.telefono.trim()           || null,
      correo:           form.correo.trim()             || null,
      direccion:        form.direccion.trim()          || null,
      asesor:           form.asesor.trim()             || null,
      estado: 'activo',
    }]).select('id').single()

    if (error) {
      setFormLoading(false)
      setFormMsg({ type: 'error', text: error.message })
      return
    }

    const { error: pagoError } = await registrarPago({
      documento,
      mes: Number(pagoInicial.mes),
      año: Number(pagoInicial.año),
      valor: valorInicial,
      registradoPor: user?.id,
    })

    setFormLoading(false)
    if (pagoError) {
      if (clienteCreado?.id) {
        await supabase.from('clientes').delete().eq('id', clienteCreado.id)
      }
      setFormMsg({ type: 'error', text: 'No se pudo registrar el pago inicial: ' + pagoError.message })
      return
    }

    setFormMsg({ type: 'ok', text: 'Afiliado y pago inicial registrados correctamente.' })
    setForm(FORM_EMPTY)
    setPagoInicial(PAGO_INICIAL_EMPTY)
  }

  // ── TAB: PAGOS ────────────────────────────────────────────────
  const [pago,        setPago]        = useState(PAGO_EMPTY)
  const [pagoLoading, setPagoLoading] = useState(false)
  const [pagoMsg,     setPagoMsg]     = useState(null)
  const [histPagos,   setHistPagos]   = useState([])
  const [clientePSel, setClientePSel] = useState(null)

  async function handleRegistrarPago(e) {
    e.preventDefault(); setPagoMsg(null)
    const { documento, año, mes, valor } = pago
    if (!documento.trim() || !año || !valor) { setPagoMsg({ type: 'error', text: 'Todos los campos son obligatorios.' }); return }
    const valorNum = parseFloat(valor)
    if (isNaN(valorNum) || valorNum <= 0) { setPagoMsg({ type: 'error', text: 'El valor debe ser mayor a 0.' }); return }
    setPagoLoading(true)
    const { data, error } = await registrarPago({ documento: documento.trim(), mes: Number(mes), año: Number(año), valor: valorNum, registradoPor: user?.id })
    setPagoLoading(false)
    if (error) setPagoMsg({ type: 'error', text: error.message })
    else {
      setPagoMsg({ type: 'ok', text: 'Pago registrado correctamente.' })
      const { data: hist } = await fetchPagosPorCliente(data.cliente_id)
      setHistPagos(hist ?? []); setClientePSel(documento.trim())
      setPago(p => ({ ...PAGO_EMPTY, documento: p.documento }))
    }
  }

  // ── TAB: CONSULTAS ────────────────────────────────────────────
  const [docBusq,       setDocBusq]       = useState('')
  const [clientes,      setClientes]      = useState([])
  const [buscando,      setBuscando]      = useState(false)
  const [buscado,       setBuscado]       = useState(false)
  const [clienteSel,    setClienteSel]    = useState(null)
  const [beneficiarios, setBeneficiarios] = useState([])
  const [benefLoading,  setBenefLoading]  = useState(false)
  const [ultimoPagoSel, setUltimoPagoSel] = useState('Sin pagos')

  const buscar = useCallback(async (e) => {
    if (e) e.preventDefault()
    const term = docBusq.trim(); if (!term) return
    setBuscando(true); setBuscado(true); setClienteSel(null); setBeneficiarios([])
    if (user?.id) registrarLogConsulta(user.id, term)
    // buscarClientes ordena por fecha_ingreso desc → apellido
    const { data } = await buscarClientes(term)
    setClientes(data); setBuscando(false)
  }, [docBusq, user?.id])

  const cargarBenef = useCallback(async (clienteId) => {
    setBenefLoading(true)
    const { data } = await supabase.from('beneficiarios').select('id, nombre, apellido, documento').eq('cliente_id', clienteId).order('id', { ascending: false })
    setBeneficiarios(data ?? []); setBenefLoading(false)
  }, [])

  const cargarUltimoPago = useCallback(async (clienteId) => {
    const { data } = await fetchPagosPorCliente(clienteId)
    if (!data?.length) { setUltimoPagoSel('Sin pagos'); return }
    const u = data[0]
    setUltimoPagoSel(`${MESES_NOMBRES[Number(u.mes)]} ${u.año} — ${formatCOP(u.valor)}`)
  }, [])

  function seleccionar(c) {
    const mismo = clienteSel?.id === c.id
    setClienteSel(mismo ? null : c)
    setBeneficiarios([]); setUltimoPagoSel('Sin pagos')
    if (!mismo) { cargarBenef(c.id); cargarUltimoPago(c.id) }
  }

  // ── RENDER ────────────────────────────────────────────────────
  return (
    <div style={S.root}>

      <div style={S.header}>
        <img src={logoImg} alt="Logo" style={S.logo} />
      </div>

      <div style={S.tabBar}>
        {TABS.map(t => (
          <button key={t} type="button"
            style={{ ...S.tab, ...(tabActiva === t ? S.tabActiva : {}) }}
            onClick={() => setTabActiva(t)}>{t}</button>
        ))}
      </div>

      <div style={S.content}>

        {/* COL 1: AFILIADOS */}
        <div style={{ ...S.col, display: tabActiva !== 'Afiliados' ? 'none' : 'flex' }}>
          <div style={{ ...S.colTitle, color: '#2563eb' }}>Nuevo Afiliado</div>
          <p style={S.hint}>Registrar un afiliado nuevo.</p>
          {[
            { lbl: 'Cédula *',        key: 'documento' },
            { lbl: 'Nombre *',        key: 'nombre' },
            { lbl: 'Apellido',        key: 'apellido' },
            { lbl: 'Teléfono',        key: 'telefono' },
            { lbl: 'Correo',          key: 'correo', type: 'email' },
            { lbl: 'Dirección',       key: 'direccion' },
            { lbl: 'Asesor',          key: 'asesor' },
            { lbl: 'F. Nacimiento',   key: 'fecha_nacimiento', type: 'date' },
            { lbl: 'F. Ingreso',      key: 'fecha_ingreso',    type: 'date' },
          ].map(({ lbl, key, type }) => (
            <div key={key} style={S.fieldGroup}>
              <label style={S.lbl}>{lbl}:</label>
              <input style={S.input} type={type || 'text'} value={form[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} disabled={formLoading} />
            </div>
          ))}

          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed #cbd5e1' }}>
            <div style={{ ...S.lbl, marginBottom: 6, fontWeight: 700, color: '#111827' }}>Pago inicial obligatorio</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 110px', minWidth: 120 }}>
                <label style={S.lbl}>Año:</label>
                <input style={S.input} type="number" min="2000" max="2100" value={pagoInicial.año}
                  onChange={e => setPagoInicial(p => ({ ...p, año: e.target.value }))} disabled={formLoading} />
              </div>
              <div style={{ flex: '1 1 120px', minWidth: 120 }}>
                <label style={S.lbl}>Mes:</label>
                <select style={S.input} value={pagoInicial.mes}
                  onChange={e => setPagoInicial(p => ({ ...p, mes: Number(e.target.value) }))} disabled={formLoading}>
                  {MESES.map(m => <option key={m.valor} value={m.valor}>{m.nombre}</option>)}
                </select>
              </div>
              <div style={{ flex: '1 1 160px', minWidth: 140 }}>
                <label style={S.lbl}>Valor inicial (COP):</label>
                <input style={S.input} type="number" min="0" step="1000" placeholder="0" value={pagoInicial.valor}
                  onChange={e => setPagoInicial(p => ({ ...p, valor: e.target.value }))} disabled={formLoading} />
                {pagoInicial.valor && Number(pagoInicial.valor) > 0 && (
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{formatCOP(pagoInicial.valor)}</div>
                )}
              </div>
            </div>
          </div>

          <Msg msg={formMsg} onClose={() => setFormMsg(null)} />
          <button style={{ ...S.btn, ...S.btnBlue }} type="button" onClick={crearAfiliado} disabled={formLoading}>
            {formLoading ? 'Guardando…' : 'Agregar Afiliado'}
          </button>
        </div>

        {/* COL 2: PAGOS */}
        <div style={{ ...S.col, display: tabActiva !== 'Pagos' ? 'none' : 'flex' }}>
          <div style={{ ...S.colTitle, color: '#16a34a' }}>Registrar Pago</div>
          <p style={S.hint}>El pago queda vinculado al afiliado automáticamente.</p>

          <div style={S.fieldGroup}>
            <label style={S.lbl}>Cédula del afiliado:</label>
            <input style={S.input} placeholder="Documento exacto" value={pago.documento}
              onChange={e => setPago(p => ({ ...p, documento: e.target.value }))} disabled={pagoLoading} />
          </div>
          <div style={S.fieldGroup}>
            <label style={S.lbl}>Año:</label>
            <input style={S.input} type="number" min="2000" max="2100" value={pago.año}
              onChange={e => setPago(p => ({ ...p, año: e.target.value }))} disabled={pagoLoading} />
          </div>
          <div style={S.fieldGroup}>
            <label style={S.lbl}>Mes:</label>
            <select style={S.input} value={pago.mes}
              onChange={e => setPago(p => ({ ...p, mes: Number(e.target.value) }))} disabled={pagoLoading}>
              {MESES.map(m => <option key={m.valor} value={m.valor}>{m.nombre}</option>)}
            </select>
          </div>
          <div style={S.fieldGroup}>
            <label style={S.lbl}>Valor (COP):</label>
            <input style={S.input} type="number" min="0" step="1000" placeholder="0" value={pago.valor}
              onChange={e => setPago(p => ({ ...p, valor: e.target.value }))} disabled={pagoLoading} />
            {pago.valor && Number(pago.valor) > 0 && (
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{formatCOP(pago.valor)}</div>
            )}
          </div>

          <Msg msg={pagoMsg} onClose={() => setPagoMsg(null)} />
          <button style={{ ...S.btn, ...S.btnGreen }} type="button" onClick={handleRegistrarPago} disabled={pagoLoading}>
            {pagoLoading ? 'Registrando…' : 'Registrar Pago'}
          </button>

          {histPagos.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={S.tableLabel}>Historial — {clientePSel}</div>
              <div style={S.tableWrap}>
                <table style={S.table}>
                  <thead><tr style={S.thead}>
                    <th style={S.th}>Mes</th><th style={S.th}>Año</th>
                    <th style={S.th}>Valor</th><th style={S.th}>Fecha y hora</th>
                  </tr></thead>
                  <tbody>
                    {histPagos.map(p => (
                      <tr key={p.id} style={S.tr}>
                        <td style={S.td}>{MESES_NOMBRES[p.mes] ?? p.mes}</td>
                        <td style={S.td}>{p.año}</td>
                        <td style={S.td}>{formatCOP(p.valor)}</td>
                        <td style={S.td}>{formatFechaHora(p.fecha_pago)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* COL 3: CONSULTAS */}
        <div style={{ ...S.col, ...S.colWide, display: tabActiva !== 'Consultas' ? 'none' : 'flex' }}>
          <div style={{ ...S.colTitle, color: '#ea580c' }}>Consultas</div>

          <form onSubmit={buscar}>
            <label style={S.lbl}>Buscar por Cédula:</label>
            <input style={{ ...S.input, marginBottom: 6 }} placeholder="Búsqueda parcial…"
              value={docBusq} onChange={e => setDocBusq(e.target.value)} />
            <button style={{ ...S.btn, ...S.btnOrange }} type="submit" disabled={buscando || !docBusq.trim()}>
              {buscando ? 'Buscando…' : 'Buscar Afiliado'}
            </button>
          </form>

          <div style={{ marginTop: 12 }}>
            <div style={S.tableLabel}>Resultados {buscado && `(${clientes.length})`}</div>
            <div style={S.tableWrap}>
              <table style={S.table}>
                <thead><tr style={S.thead}>
                  {['Nombre', 'Documento', 'F. Ingreso', 'Estado', ''].map(h => <th key={h} style={S.th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {buscando ? <tr><td colSpan="5" style={S.tdEmpty}>Buscando…</td></tr>
                  : !buscado ? <tr><td colSpan="5" style={S.tdEmpty}>Ingresa un documento y presiona Buscar.</td></tr>
                  : clientes.length === 0 ? <tr><td colSpan="5" style={S.tdEmpty}>Sin coincidencias.</td></tr>
                  : clientes.map(c => (
                    <tr key={c.id} style={{ ...S.tr, background: clienteSel?.id === c.id ? '#dbeafe' : undefined, cursor: 'pointer' }}
                      onClick={() => seleccionar(c)}>
                      <td style={S.td}><strong>{c.nombre}</strong> {c.apellido}</td>
                      <td style={S.td}>{c.documento}</td>
                      <td style={S.td}>{formatFecha(c.fecha_ingreso)}</td>
                      <td style={S.td}><EstadoBadge estado={c.estado} /></td>
                      <td style={S.td}>
                        <button style={S.btnSmall} type="button" onClick={ev => { ev.stopPropagation(); seleccionar(c) }}>
                          {clienteSel?.id === c.id ? 'Ocultar' : 'Ver'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Panel detalle */}
          {clienteSel && (
            <PanelDetalle cliente={clienteSel} ultimoPagoText={ultimoPagoSel} />
          )}

          {/* Beneficiarios */}
          <PanelBeneficiarios
            clienteSel={clienteSel}
            beneficiarios={beneficiarios}
            benefLoading={benefLoading}
            onRecargar={() => clienteSel && cargarBenef(clienteSel.id)}
          />
        </div>

        {tabActiva === 'Afiliados' && <div style={{ ...S.col, ...S.colWide }} />}
        {tabActiva === 'Pagos'     && <div style={{ ...S.col, ...S.colWide }} />}

      </div>
    </div>
  )
}

// ── Estilos (idénticos al DashboardAdmin para consistencia) ───────
const S = {
  root: { fontFamily: 'Segoe UI, Tahoma, Arial, sans-serif', fontSize: 13, color: '#1f2937' },
  header: { width: '100%', padding: '12px 0', background: '#f8fafc', borderBottom: '1px solid #cbd5e1' },
  logo: { width: '100%', height: 'auto', maxHeight: 120, objectFit: 'contain' },
  tabBar: { display: 'flex', borderBottom: '2px solid #cbd5e1' },
  tab: { padding: '7px 18px', border: '1px solid #cbd5e1', borderBottom: 'none', background: '#e5e7eb', cursor: 'pointer', fontSize: 13, borderRadius: '4px 4px 0 0', marginRight: 2, color: '#374151' },
  tabActiva: { background: '#fff', borderBottom: '2px solid #fff', marginBottom: -2, fontWeight: 600, color: '#111827' },
  content: { display: 'flex', border: '1px solid #cbd5e1', borderTop: 'none', background: '#f1f5f9', minHeight: 500 },
  col: { flex: '0 0 230px', padding: '14px 16px', borderRight: '1px solid #cbd5e1', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 2 },
  colWide: { flex: 1, borderRight: 'none' },
  colTitle: { fontWeight: 700, fontSize: 14, marginBottom: 8 },
  fieldGroup: { marginBottom: 8 },
  lbl: { display: 'block', fontSize: 12, color: '#4b5563', marginBottom: 3, fontWeight: 500 },
  input: { width: '100%', padding: '5px 8px', border: '1px solid #9ca3af', borderRadius: 3, fontSize: 13, background: '#fff', boxSizing: 'border-box', color: '#111827' },
  hint: { fontSize: 12, color: '#6b7280', margin: '0 0 8px' },
  btn: { padding: '7px 0', width: '100%', border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 4 },
  btnBlue:   { background: '#2563eb', color: '#fff' },
  btnGreen:  { background: '#16a34a', color: '#fff' },
  btnOrange: { background: '#ea580c', color: '#fff' },
  btnSmall: { padding: '3px 10px', fontSize: 12, border: '1px solid #9ca3af', borderRadius: 3, background: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' },
  tableLabel: { fontWeight: 600, fontSize: 12, marginBottom: 5, color: '#374151' },
  tableWrap: { overflowX: 'auto', border: '1px solid #cbd5e1', borderRadius: 4, background: '#fff' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  thead: { background: '#e5e7eb' },
  th: { padding: '7px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #cbd5e1', whiteSpace: 'nowrap', color: '#374151' },
  tr: { borderBottom: '1px solid #f3f4f6' },
  td: { padding: '6px 10px', verticalAlign: 'middle', whiteSpace: 'nowrap' },
  tdEmpty: { padding: '16px', textAlign: 'center', color: '#9ca3af', fontSize: 12 },
  msg: { fontSize: 12, padding: '6px 10px', border: '1px solid', borderRadius: 4, marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  badge: { display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: '#e2e8f0', color: '#1f2937' },
  detallePanel: { margin: '10px 0 0', padding: '12px 14px', border: '1px solid #bfdbfe', borderRadius: 6, background: '#eff6ff' },
  detalleTitulo: { fontWeight: 700, fontSize: 13, color: '#1d4ed8', marginBottom: 10 },
  detalleGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '8px 16px' },
  detLbl: { fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 },
  detVal: { fontSize: 13, color: '#111827', fontWeight: 500, marginTop: 1 },
  benefPanel: { marginTop: 12, padding: 12, border: '1px solid #cbd5e1', borderRadius: 4, background: '#fff' },
  benefTitle: { fontWeight: 600, fontSize: 13, marginBottom: 10, color: '#374151', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  benefCards: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  benefCard: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, background: '#f8fafc', minWidth: 160, flex: '1 1 160px', fontSize: 13 },
  benefAvatar: { width: 28, height: 28, borderRadius: '50%', background: '#2563eb', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 },
}
