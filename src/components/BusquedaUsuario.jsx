import { useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../supabase'
import { registrarLogConsulta } from '../api/afiliados'

const TABS = ['Afiliados', 'Pagos', 'Consultas']
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const FORM_EMPTY = { nombre: '', apellido: '', documento: '', fecha_ingreso: '' }

export default function BusquedaUsuario() {
  const { user } = useAuth()
  const [tabActiva, setTabActiva] = useState('Consultas')

  // ── AFILIADOS ────────────────────────────────────────────────
  const [form, setForm] = useState(FORM_EMPTY)
  const [formLoading, setFormLoading] = useState(false)
  const [formMsg, setFormMsg] = useState(null)

  async function crearAfiliado(e) {
    e.preventDefault()
    setFormMsg(null)

    const nombre = form.nombre.trim()
    const documento = form.documento.trim()

    if (!nombre || !documento) {
      setFormMsg({ type: 'error', text: 'Nombre y documento obligatorios' })
      return
    }

    setFormLoading(true)

    const { data: dup } = await supabase
      .from('clientes')
      .select('id')
      .eq('documento', documento)
      .maybeSingle()

    if (dup) {
      setFormMsg({ type: 'error', text: 'Ya existe ese documento' })
      setFormLoading(false)
      return
    }

    const { error } = await supabase.from('clientes').insert([{
      nombre,
      apellido: form.apellido,
      documento,
      fecha_ingreso: form.fecha_ingreso || null,
    }])

    if (error) {
      setFormMsg({ type: 'error', text: error.message })
    } else {
      setFormMsg({ type: 'ok', text: 'Afiliado creado' })
      setForm(FORM_EMPTY)
    }

    setFormLoading(false)
  }

  // ── PAGOS ────────────────────────────────────────────────────
  const [pago, setPago] = useState({ documento: '', año: '', mes: MESES[0], valor: '' })
  const [pagoMsg, setPagoMsg] = useState(null)
  const [guardandoPago, setGuardandoPago] = useState(false)

  async function registrarPago(e) {
    e.preventDefault()
    setPagoMsg(null)

    if (!pago.documento || !pago.año || !pago.valor) {
      setPagoMsg({ type: 'error', text: 'Todos los campos son obligatorios' })
      return
    }

    setGuardandoPago(true)

    const { data: cliente } = await supabase
      .from('clientes')
      .select('id')
      .eq('documento', pago.documento)
      .maybeSingle()

    if (!cliente) {
      setPagoMsg({ type: 'error', text: 'Cliente no existe' })
      setGuardandoPago(false)
      return
    }

    const { error } = await supabase.from('pagos').insert([{
      cliente_id: cliente.id,
      año: pago.año,
      mes: pago.mes,
      valor: pago.valor
    }])

    if (error) {
      setPagoMsg({ type: 'error', text: error.message })
    } else {
      setPagoMsg({ type: 'ok', text: 'Pago registrado' })
      setPago({ documento: '', año: '', mes: MESES[0], valor: '' })
    }

    setGuardandoPago(false)
  }

  // ── CONSULTAS ────────────────────────────────────────────────
  const [documento, setDocumento] = useState('')
  const [clientes, setClientes] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [buscado, setBuscado] = useState(false)

  const buscarAfiliado = useCallback(async (e) => {
    if (e) e.preventDefault()
    const term = documento.trim()
    if (!term) return
    
    setBuscando(true)
    setBuscado(true)

    if (user?.id) registrarLogConsulta(user.id, documento)

    const { data } = await supabase
      .from('clientes')
      .select('id, nombre, apellido, documento, fecha_ingreso')
      .ilike('documento', `%${documento}%`)
      .order('apellido').limit(50)

    setClientes(data || [])
    setBuscando(false)
  }, [documento, user])

  return (
    <div style={s.root}>
      {/* HEADER CON LOGO */}
      <div style={s.header}>
        <img src="../assets/logo.jpeg" alt="Logo" style={s.logo} />
      </div>

      {/* TABS */}
      <div style={s.tabBar}>
        {TABS.map(tab => (
          <button key={tab}
            style={{ ...s.tab, ...(tabActiva === tab ? s.tabActiva : {}) }}
            onClick={() => setTabActiva(tab)}
            type="button">
            {tab}
          </button>
        ))}
      </div>

      <div style={s.content}>

        {/* COL 1: AFILIADOS */}
        <div style={s.col}>
          <div style={{ ...s.colTitle, color: '#2563eb' }}>Afiliados</div>
          <p style={s.hint}>Crear nuevo afiliado en el sistema.</p>

          {[
            { lbl: 'Cédula',        key: 'documento' },
            { lbl: 'Nombre',        key: 'nombre' },
            { lbl: 'Apellido',      key: 'apellido' },
            { lbl: 'Fecha Ingreso', key: 'fecha_ingreso', type: 'date' },
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

          {formMsg && (
            <div style={{
              ...s.msg,
              background:  formMsg.type === 'ok' ? '#f0fdf4' : '#fef2f2',
              color:       formMsg.type === 'ok' ? '#15803d' : '#dc2626',
              borderColor: formMsg.type === 'ok' ? '#86efac' : '#fca5a5',
            }}>{formMsg.text}</div>
          )}

          <button style={{ ...s.btn, ...s.btnBlue }}
            onClick={crearAfiliado}
            disabled={formLoading}
            type="button">
            {formLoading ? 'Guardando…' : 'Agregar Afiliado'}
          </button>
        </div>

        {/* COL 2: PAGOS */}
        <div style={s.col}>
          <div style={{ ...s.colTitle, color: '#16a34a' }}>Pagos</div>
          <p style={s.hint}>Registrar un pago de afiliado.</p>

          {[
            { lbl: 'Cédula', key: 'documento' },
            { lbl: 'Año',    key: 'año' },
            { lbl: 'Valor',  key: 'valor' },
          ].map(({ lbl, key }) => (
            <div key={key} style={s.fieldGroup}>
              <label style={s.label}>{lbl}:</label>
              <input
                style={s.input}
                type={key === 'valor' ? 'number' : 'text'}
                placeholder={lbl}
                value={pago[key]}
                onChange={e => setPago(p => ({ ...p, [key]: e.target.value }))}
                disabled={guardandoPago}
              />
            </div>
          ))}

          <div style={s.fieldGroup}>
            <label style={s.label}>Mes:</label>
            <select
              style={s.input}
              value={pago.mes}
              onChange={e => setPago(p => ({ ...p, mes: e.target.value }))}
              disabled={guardandoPago}
            >
              {MESES.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>

          {pagoMsg && (
            <div style={{
              ...s.msg,
              background:  pagoMsg.type === 'ok' ? '#f0fdf4' : '#fef2f2',
              color:       pagoMsg.type === 'ok' ? '#15803d' : '#dc2626',
              borderColor: pagoMsg.type === 'ok' ? '#86efac' : '#fca5a5',
            }}>{pagoMsg.text}</div>
          )}

          <button style={{ ...s.btn, ...s.btnGreen }}
            onClick={registrarPago}
            disabled={guardandoPago}
            type="button">
            {guardandoPago ? 'Guardando…' : 'Registrar Pago'}
          </button>
        </div>

        {/* COL 3: CONSULTAS */}
        <div style={{ ...s.col, ...s.colWide }}>
          <div style={{ ...s.colTitle, color: '#ea580c' }}>Consultas</div>

          <form onSubmit={buscarAfiliado}>
            <label style={s.label}>Buscar por Cédula:</label>
            <input
              style={{ ...s.input, marginBottom: 6 }}
              placeholder="Documento (búsqueda parcial)"
              value={documento}
              onChange={e => setDocumento(e.target.value)}
            />
            <button style={{ ...s.btn, ...s.btnOrange, width: '100%' }}
              type="submit"
              disabled={buscando || !documento.trim()}>
              {buscando ? 'Buscando…' : 'Buscar Afiliado'}
            </button>
          </form>

          {/* Tabla */}
          <div style={{ marginTop: 14 }}>
            <div style={s.tableLabel}>Tabla</div>
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr style={s.thead}>
                    {['Nombre','Apellido','Documento','Fecha ingreso'].map(h => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {buscando ? (
                    <tr><td colSpan="4" style={s.tdEmpty}>Buscando…</td></tr>
                  ) : !buscado ? (
                    <tr><td colSpan="4" style={s.tdEmpty}>Ingresa un documento y presiona Buscar.</td></tr>
                  ) : clientes.length === 0 ? (
                    <tr><td colSpan="4" style={s.tdEmpty}>Sin coincidencias</td></tr>
                  ) : clientes.map(c => (
                    <tr key={c.id} style={s.tr}>
                      <td style={s.td}>{c.nombre}</td>
                      <td style={s.td}>{c.apellido}</td>
                      <td style={s.td}>{c.documento}</td>
                      <td style={s.td}>{c.fecha_ingreso ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

// Estilos compartidos (mismo objeto que DashboardAdmin)
const s = {
  root: { fontFamily: 'Segoe UI, Tahoma, Arial, sans-serif', fontSize: 13, color: '#1f2937' },
  header: { display: 'flex', justifyContent: 'center', padding: '10px', background: '#f8fafc', borderBottom: '1px solid #cbd5e1' },
  logo: { height: '50px', objectFit: 'contain' },
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
  tableLabel: { fontWeight: 600, fontSize: 13, marginBottom: 6, color: '#374151' },
  tableWrap: { overflowX: 'auto', border: '1px solid #cbd5e1', borderRadius: 4, background: '#fff' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  thead: { background: '#e5e7eb' },
  th: { padding: '6px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid #cbd5e1', whiteSpace: 'nowrap', color: '#374151' },
  tr: { borderBottom: '1px solid #f3f4f6' },
  td: { padding: '5px 10px', whiteSpace: 'nowrap' },
  tdEmpty: { padding: '14px 10px', textAlign: 'center', color: '#9ca3af', fontSize: 12 },
  msg: { fontSize: 12, padding: '6px 10px', border: '1px solid', borderRadius: 4, marginBottom: 8 },
}