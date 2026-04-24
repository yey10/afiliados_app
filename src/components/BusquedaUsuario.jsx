/**
 * BusquedaUsuario.jsx — rol USER
 * Pagos funcionales con mes como número, valores en COP.
 */
import { useState, useCallback } from 'react'
import { useAuth }               from '../context/AuthContext'
import { supabase }              from '../supabase'
import {
  registrarLogConsulta,
  registrarPago,
  fetchPagosPorCliente,
  formatCOP,
  MESES_NOMBRES,
} from '../api/afiliados'
import logoImg from '../assets/logo.jpeg'

const TABS = ['Afiliados', 'Pagos', 'Consultas']

const MESES = MESES_NOMBRES.slice(1).map((nombre, i) => ({ nombre, valor: i + 1 }))

const FORM_EMPTY = {
  nombre: '',
  apellido: '',
  documento: '',
  fecha_ingreso: '',
  fecha_nacimiento: '',
  telefono: '',
  correo: '',
  direccion: '',
  asesor: '',
}

const PAGO_EMPTY = {
  documento: '',
  año: new Date().getFullYear(),
  mes: new Date().getMonth() + 1, // 1-12
  valor: '',
}

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

export default function BusquedaUsuario() {
  const { user } = useAuth()
  const [tabActiva, setTabActiva] = useState('Consultas')

  // ══ TAB: AFILIADOS ═══════════════════════════════════════════════
  const [form, setForm]               = useState(FORM_EMPTY)
  const [formLoading, setFormLoading] = useState(false)
  const [formMsg, setFormMsg]         = useState(null)

  async function crearAfiliado(e) {
    e.preventDefault()
    setFormMsg(null)
    const nombre = form.nombre.trim()
    const documento = form.documento.trim()

    if (!nombre || !documento) {
      setFormMsg({ type: 'error', text: 'Nombre y documento son obligatorios.' })
      return
    }

    setFormLoading(true)

    const { data: dup } = await supabase
      .from('clientes').select('id').eq('documento', documento).maybeSingle()

    if (dup) {
      setFormMsg({ type: 'error', text: 'Ya existe un afiliado con ese documento.' })
      setFormLoading(false)
      return
    }

    const { error } = await supabase.from('clientes').insert([{
      nombre,
      apellido:         form.apellido.trim()         || '',
      documento,
      fecha_ingreso:    form.fecha_ingreso            || null,
      fecha_nacimiento: form.fecha_nacimiento         || null,
      telefono:         form.telefono.trim()          || null,
      correo:           form.correo.trim()            || null,
      direccion:        form.direccion.trim()         || null,
      asesor:           form.asesor.trim()            || null,
      estado:           'activo',
    }])

    if (error) {
      setFormMsg({ type: 'error', text: error.message })
    } else {
      setFormMsg({ type: 'ok', text: 'Afiliado creado correctamente.' })
      setForm(FORM_EMPTY)
    }

    setFormLoading(false)
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
      mes:          Number(mes),    // SIEMPRE número 1-12
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

  const buscarAfiliado = useCallback(async (e) => {
    if (e) e.preventDefault()
    const term = docBusqueda.trim()
    if (!term) return
    setBuscando(true)
    setBuscado(true)
    setClienteSel(null)
    setBeneficiarios([])
    setBenefMsg(null)
    if (user?.id) registrarLogConsulta(user.id, term)

    const { data } = await supabase
      .from('clientes')
      .select('id, nombre, apellido, documento, fecha_ingreso')
      .ilike('documento', `%${term}%`)
      .order('apellido')
      .limit(50)

    setClientes(data ?? [])
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
    }
    setGuardando(false)
  }

  // ══ RENDER ═══════════════════════════════════════════════════════
  return (
    <div style={s.root}>

      {/* LOGO */}
      <div style={s.header}>
        <img src={logoImg} alt="Logo" style={s.logo} />
      </div>

      {/* TABS */}
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

        {/* COL 1: AFILIADOS */}
        <div style={s.col}>
          <div style={{ ...s.colTitle, color: '#2563eb' }}>Afiliados</div>
          <p style={s.hint}>Crear nuevo afiliado.</p>

          {[
            { lbl: 'Cédula *',        key: 'documento' },
            { lbl: 'Nombre *',        key: 'nombre' },
            { lbl: 'Apellido',        key: 'apellido' },
            { lbl: 'Teléfono',        key: 'telefono' },
            { lbl: 'Correo',          key: 'correo', type: 'email' },
            { lbl: 'Dirección',       key: 'direccion' },
            { lbl: 'Asesor',          key: 'asesor' },
            { lbl: 'Fecha Nacimiento',key: 'fecha_nacimiento', type: 'date' },
            { lbl: 'Fecha Ingreso',   key: 'fecha_ingreso', type: 'date' },
          ].map(({ lbl, key, type }) => (
            <div key={key} style={s.fieldGroup}>
              <label style={s.label}>{lbl}:</label>
              <input
                style={s.input}
                type={type || 'text'}
                value={form[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                disabled={formLoading}
              />
            </div>
          ))}

          <Msg msg={formMsg} />

          <button style={{ ...s.btn, ...s.btnBlue }} onClick={crearAfiliado} disabled={formLoading} type="button">
            {formLoading ? 'Guardando…' : 'Agregar Afiliado'}
          </button>
        </div>

        {/* COL 2: PAGOS */}
        <div style={s.col}>
          <div style={{ ...s.colTitle, color: '#16a34a' }}>Pagos</div>
          <p style={s.hint}>Registrar un pago mensual.</p>

          <div style={s.fieldGroup}>
            <label style={s.label}>Cédula del afiliado:</label>
            <input style={s.input} placeholder="Documento exacto" value={pago.documento}
              onChange={e => setPago(p => ({ ...p, documento: e.target.value }))} disabled={pagoLoading} />
          </div>

          <div style={s.fieldGroup}>
            <label style={s.label}>Año:</label>
            <input style={s.input} type="number" min="2000" max="2100" value={pago.año}
              onChange={e => setPago(p => ({ ...p, año: e.target.value }))} disabled={pagoLoading} />
          </div>

          <div style={s.fieldGroup}>
            <label style={s.label}>Mes:</label>
            <select style={s.input} value={pago.mes}
              onChange={e => setPago(p => ({ ...p, mes: Number(e.target.value) }))} disabled={pagoLoading}>
              {MESES.map(m => <option key={m.valor} value={m.valor}>{m.nombre}</option>)}
            </select>
          </div>

          <div style={s.fieldGroup}>
            <label style={s.label}>Valor del pago (COP):</label>
            <input style={s.input} type="number" min="0" step="1000" placeholder="0" value={pago.valor}
              onChange={e => setPago(p => ({ ...p, valor: e.target.value }))} disabled={pagoLoading} />
            {pago.valor && !isNaN(pago.valor) && Number(pago.valor) > 0 && (
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{formatCOP(pago.valor)}</div>
            )}
          </div>

          <Msg msg={pagoMsg} />

          <button style={{ ...s.btn, ...s.btnGreen }} onClick={handleRegistrarPago} disabled={pagoLoading} type="button">
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

        {/* COL 3: CONSULTAS */}
        <div style={{ ...s.col, ...s.colWide }}>
          <div style={{ ...s.colTitle, color: '#ea580c' }}>Consultas</div>

          <form onSubmit={buscarAfiliado}>
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
                    {['Nombre', 'Apellido', 'Documento', 'Fecha ingreso', ''].map(h => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {buscando ? (
                    <tr><td colSpan="5" style={s.tdEmpty}>Buscando…</td></tr>
                  ) : !buscado ? (
                    <tr><td colSpan="5" style={s.tdEmpty}>Ingresa un documento y presiona Buscar.</td></tr>
                  ) : clientes.length === 0 ? (
                    <tr><td colSpan="5" style={s.tdEmpty}>Sin coincidencias para «{docBusqueda}»</td></tr>
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
                      <td style={s.td}>
                        <button style={s.btnSmall} type="button"
                          onClick={ev => { ev.stopPropagation(); seleccionar(c) }}>
                          {clienteSel?.id === c.id ? 'Ocultar' : 'Ver'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Beneficiarios */}
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

      </div>
    </div>
  )
}

const s = {
  root: { fontFamily: 'Segoe UI, Tahoma, Arial, sans-serif', fontSize: 13, color: '#1f2937' },
  header: { width: '100%', padding: '12px 0', background: '#f8fafc', borderBottom: '1px solid #cbd5e1',},
  logo: { width: '100%', height: 'auto', maxHeight: 120, objectFit: 'contain' },
  tabBar: { display: 'flex', borderBottom: '2px solid #cbd5e1', marginBottom: 0 },
  tab: { padding: '7px 18px', border: '1px solid #cbd5e1', borderBottom: 'none', background: '#e5e7eb', cursor: 'pointer', fontSize: 13, borderRadius: '4px 4px 0 0', marginRight: 2, color: '#374151' },
  tabActiva: { background: '#fff', borderBottom: '2px solid #fff', marginBottom: -2, fontWeight: 600, color: '#111827' },
  content: { display: 'flex', gap: 0, border: '1px solid #cbd5e1', borderTop: 'none', background: '#f1f5f9', minHeight: 500 },
  col: { flex: '0 0 220px', padding: '14px 16px', borderRight: '1px solid #cbd5e1', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: 2 },
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
  btnSmall: { padding: '3px 10px', fontSize: 12, border: '1px solid #9ca3af', borderRadius: 3, background: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' },
  tableLabel: { fontWeight: 600, fontSize: 13, marginBottom: 6, color: '#374151' },
  tableWrap: { overflowX: 'auto', border: '1px solid #cbd5e1', borderRadius: 4, background: '#fff' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  thead: { background: '#e5e7eb' },
  th: { padding: '6px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #cbd5e1', whiteSpace: 'nowrap', color: '#374151' },
  tr: { borderBottom: '1px solid #f3f4f6' },
  td: { padding: '5px 10px', whiteSpace: 'nowrap' },
  tdEmpty: { padding: '14px 10px', textAlign: 'center', color: '#9ca3af', fontSize: 12 },
  benefPanel: { marginTop: 16, padding: 12, border: '1px solid #cbd5e1', borderRadius: 4, background: '#fff' },
  benefTitle: { fontWeight: 600, fontSize: 13, marginBottom: 8, color: '#374151' },
  benefList: { margin: '0 0 8px', padding: '0 0 0 16px', listStyle: 'disc' },
  benefItem: { padding: '3px 0', fontSize: 13 },
  msg: { fontSize: 12, padding: '6px 10px', border: '1px solid', borderRadius: 4, marginBottom: 8 },
}
