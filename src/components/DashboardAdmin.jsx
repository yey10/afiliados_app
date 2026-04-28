/**
 * DashboardAdmin.jsx — producción final
 * Tabs: Afiliados | Pagos | Consultas | Asesores
 * - Pago inicial obligatorio al crear afiliado
 * - Gestión de asesores con contraseña
 * - Activar/desactivar asesores
 * - Modal detalle + observaciones
 * - Eliminar beneficiarios
 * - Badges mora/estado
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../supabase'
import {
  fetchDashboardData, crearAfiliadoConPago, registrarPago, fetchPagosPorCliente,
  toggleEstadoCliente, eliminarCliente, eliminarBeneficiario,
  updateObservaciones, formatCOP, formatFechaHora, formatFecha,
  MESES_NOMBRES, MESES_CORTOS, registrarLogConsulta, buscarClientes,
  fetchAsesores, crearAsesor, cambiarPasswordAsesor, toggleActivoAsesor,
  eliminarAsesor, generarPassword,
} from '../api/afiliados'
import { useAuth } from '../context/AuthContext'
import logoImg from '../assets/logo.jpeg'

const TABS = ['Afiliados', 'Pagos', 'Consultas', 'Asesores']
const MESES = MESES_NOMBRES.slice(1).map((n, i) => ({ nombre: n, valor: i + 1 }))

const FORM_AFIL_EMPTY = {
  nombre: '', apellido: '', documento: '', fecha_ingreso: '',
  fecha_nacimiento: '', telefono: '', correo: '', direccion: '', asesor: '', observaciones: '',
  pagoMes: String(new Date().getMonth() + 1),
  pagoAño: String(new Date().getFullYear()),
  pagoValor: '',
}
const PAGO_EMPTY = {
  documento: '', año: String(new Date().getFullYear()), mes: new Date().getMonth() + 1, valor: '',
}
const ASESOR_FORM_EMPTY = { nombre: '', email: '', password: '' }

// ── Helpers UI ────────────────────────────────────────────────────
function Msg({ msg, onClose }) {
  if (!msg) return null
  const ok = msg.type === 'ok'
  return (
    <div style={{ ...S.msg, background: ok ? '#f0fdf4' : '#fef2f2', color: ok ? '#15803d' : '#dc2626', borderColor: ok ? '#86efac' : '#fca5a5' }}>
      <span>{ok ? '✓ ' : '✕ '}{msg.text}</span>
      {onClose && <button onClick={onClose} style={{ background:'none',border:'none',cursor:'pointer',color:'inherit',fontWeight:700,marginLeft:8 }}>✕</button>}
    </div>
  )
}

function EstadoBadge({ estado }) {
  const activo = (estado ?? 'activo') === 'activo'
  return <span style={{ ...S.badge, background: activo ? '#d1fae5' : '#fee2e2', color: activo ? '#166534' : '#b91c1c' }}>{activo ? '● Activo' : '○ Inactivo'}</span>
}

function MoraBadge({ enMora }) {
  return <span style={{ ...S.badge, background: enMora ? '#fff7ed' : '#f0fdf4', color: enMora ? '#c2410c' : '#166534' }}>{enMora ? '⚠ Mora' : '✓ Al día'}</span>
}

function ActivoBadge({ activo }) {
  return <span style={{ ...S.badge, background: activo ? '#d1fae5' : '#fee2e2', color: activo ? '#166534' : '#b91c1c' }}>{activo ? '● Activo' : '○ Inactivo'}</span>
}

function Modal({ title, onClose, children, width = 540 }) {
  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={{ ...S.modal, maxWidth: width }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <div style={{ fontWeight:700, fontSize:15, color:'#111827' }}>{title}</div>
          <button onClick={onClose} style={{ background:'none',border:'none',fontSize:18,cursor:'pointer',color:'#6b7280' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Modal detalle afiliado ────────────────────────────────────────
function ModalDetalle({ cliente, ultimoPagoText, onClose, onSaveObs }) {
  const [obs, setObs]     = useState(cliente.observaciones ?? '')
  const [saving, setSaving]= useState(false)
  const [obsMsg, setObsMsg]= useState(null)

  async function guardarObs() {
    setSaving(true); setObsMsg(null)
    const { error } = await updateObservaciones(cliente.id, obs)
    setSaving(false)
    if (error) setObsMsg({ type:'error', text:'Error: '+error.message })
    else { setObsMsg({ type:'ok', text:'Observaciones guardadas.' }); onSaveObs?.(obs) }
  }

  const filas = [
    ['Nombre',      `${cliente.nombre} ${cliente.apellido}`],
    ['Documento',   cliente.documento],
    ['Estado',      <EstadoBadge estado={cliente.estado} />],
    ['Teléfono',    cliente.telefono],
    ['Correo',      cliente.correo],
    ['Dirección',   cliente.direccion],
    ['Asesor',      cliente.asesor],
    ['F. ingreso',  formatFecha(cliente.fecha_ingreso)],
    ['F. nacimiento',formatFecha(cliente.fecha_nacimiento)],
    ['Último pago', ultimoPagoText],
  ].filter(([,v]) => v && v !== '—')

  return (
    <Modal title="Detalle del afiliado" onClose={onClose} width={560}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px 20px', marginBottom:12 }}>
        {filas.map(([lbl,val]) => (
          <div key={lbl}><div style={S.detLbl}>{lbl}</div><div style={S.detVal}>{val}</div></div>
        ))}
      </div>
      <div>
        <div style={S.detLbl}>Observaciones</div>
        <textarea value={obs} onChange={e=>setObs(e.target.value)} rows={3}
          style={{...S.input,resize:'vertical',fontFamily:'inherit'}}
          placeholder="Notas internas…" />
        <Msg msg={obsMsg} onClose={()=>setObsMsg(null)} />
        <button style={{...S.btn,...S.btnBlue,marginTop:6}} onClick={guardarObs} disabled={saving} type="button">
          {saving?'Guardando…':'Guardar observaciones'}
        </button>
      </div>
    </Modal>
  )
}

// ── Panel beneficiarios con eliminar ─────────────────────────────
function PanelBenef({ clienteSel, beneficiarios, benefLoading, onRecargar }) {
  const [formB,     setFormB]    = useState({nombre:'',apellido:'',documento:''})
  const [guardando, setGuardando]= useState(false)
  const [elimId,    setElimId]   = useState(null)
  const [msg,       setMsg]      = useState(null)

  async function agregar(e) {
    e.preventDefault()
    if (!clienteSel) return
    const nombre = formB.nombre.trim()
    if (!nombre) { setMsg({type:'error',text:'Nombre obligatorio.'}); return }
    setGuardando(true); setMsg(null)
    const { error } = await supabase.from('beneficiarios').insert([{
      cliente_id: clienteSel.id, nombre,
      apellido: formB.apellido.trim()||'', documento: formB.documento.trim()||'',
    }])
    setGuardando(false)
    if (error) setMsg({type:'error',text:'Error: '+error.message})
    else { setMsg({type:'ok',text:'Beneficiario agregado.'}); setFormB({nombre:'',apellido:'',documento:''}); onRecargar() }
  }

  async function eliminar(id, nombre) {
    if (!window.confirm(`¿Eliminar a ${nombre}?`)) return
    setElimId(id)
    const { error } = await eliminarBeneficiario(id)
    setElimId(null)
    if (error) setMsg({type:'error',text:'Error: '+error.message})
    else { setMsg({type:'ok',text:'Eliminado.'}); onRecargar() }
  }

  return (
    <div style={S.benefPanel}>
      <div style={S.benefTitle}>
        👥 Beneficiarios
        {clienteSel && <span style={{fontWeight:400,color:'#6b7280',marginLeft:6}}>— {clienteSel.nombre} {clienteSel.apellido}</span>}
        {beneficiarios.length>0 && <span style={{...S.badge,background:'#dbeafe',color:'#1d4ed8',marginLeft:6}}>{beneficiarios.length}</span>}
      </div>
      <Msg msg={msg} onClose={()=>setMsg(null)} />
      {!clienteSel ? <p style={S.hint}>Selecciona un afiliado.</p>
      : benefLoading ? <p style={S.hint}>Cargando…</p>
      : beneficiarios.length===0 ? <p style={{...S.hint,color:'#d97706'}}>⚠ Sin beneficiarios.</p>
      : (
        <div style={S.benefCards}>
          {beneficiarios.map(b=>(
            <div key={b.id} style={S.benefCard}>
              <div style={S.benefAvatar}>{(b.nombre?.[0]??'?').toUpperCase()}</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:600}}>{b.nombre} {b.apellido}</div>
                {b.documento && <div style={{fontSize:11,color:'#6b7280'}}>CC {b.documento}</div>}
              </div>
              <button type="button" onClick={()=>eliminar(b.id,b.nombre)} disabled={elimId===b.id}
                style={{background:'#fee2e2',color:'#b91c1c',border:'none',borderRadius:3,padding:'2px 7px',fontSize:11,cursor:'pointer'}}>
                {elimId===b.id?'…':'✕'}
              </button>
            </div>
          ))}
        </div>
      )}
      {clienteSel && (
        <form onSubmit={agregar} style={{marginTop:8,paddingTop:8,borderTop:'1px dashed #e2e8f0'}}>
          <div style={{fontWeight:600,fontSize:12,marginBottom:5,color:'#374151'}}>➕ Agregar beneficiario</div>
          <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
            {[{k:'nombre',p:'Nombre *'},{k:'apellido',p:'Apellido'},{k:'documento',p:'Documento'}].map(({k,p})=>(
              <input key={k} style={{...S.input,flex:'1 1 100px'}} placeholder={p}
                value={formB[k]} onChange={e=>setFormB(f=>({...f,[k]:e.target.value}))} disabled={guardando} />
            ))}
          </div>
          <button style={{...S.btn,...S.btnBlue,marginTop:5}} type="submit" disabled={guardando||!formB.nombre.trim()}>
            {guardando?'Guardando…':'Agregar beneficiario'}
          </button>
        </form>
      )}
    </div>
  )
}

// ── Fila inline expandible de beneficiarios (tabla dashboard) ─────
function BenefRowInline({ beneficiarios }) {
  return (
    <tr>
      <td colSpan="10" style={{...S.td,background:'#f0f9ff',paddingLeft:36,fontSize:12}}>
        {beneficiarios.length===0
          ? <span style={{color:'#9ca3af'}}>Sin beneficiarios.</span>
          : <><strong>Beneficiarios: </strong>{beneficiarios.map((b,i)=>(
              <span key={b.id}>{b.nombre} {b.apellido}{b.documento?` (${b.documento})`:''}{i<beneficiarios.length-1?' · ':''}</span>
            ))}</>
        }
      </td>
    </tr>
  )
}

// ── Sección Asesores ──────────────────────────────────────────────
function SeccionAsesores() {
  const [asesores,     setAsesores]     = useState([])
  const [cargando,     setCargando]     = useState(false)
  const [form,         setForm]         = useState(ASESOR_FORM_EMPTY)
  const [creando,      setCreando]      = useState(false)
  const [msg,          setMsg]          = useState(null)
  const [pwdModal,     setPwdModal]     = useState(null) // { id, nombre }
  const [nuevaPwd,     setNuevaPwd]     = useState('')
  const [pwdMsg,       setPwdMsg]       = useState(null)
  const [cambiandoPwd, setCambiandoPwd] = useState(false)
  const [showPwd,      setShowPwd]      = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    const { data, error } = await fetchAsesores()
    setCargando(false)
    if (error) setMsg({type:'error',text:'Error cargando asesores: '+error.message})
    else setAsesores(data)
  }, [])

  useEffect(()=>{ cargar() },[cargar])

  async function crearNuevo(e) {
    e.preventDefault(); setMsg(null)
    const {nombre,email,password} = form
    if (!email.trim()||!password.trim()) { setMsg({type:'error',text:'Email y contraseña son obligatorios.'}); return }
    if (password.length<6) { setMsg({type:'error',text:'La contraseña debe tener al menos 6 caracteres.'}); return }
    setCreando(true)
    const { error } = await crearAsesor({email,password,nombre})
    setCreando(false)
    if (error) setMsg({type:'error',text:'Error: '+error.message})
    else { setMsg({type:'ok',text:`Asesor ${email} creado correctamente.`}); setForm(ASESOR_FORM_EMPTY); cargar() }
  }

  async function handleCambiarPwd() {
    if (!pwdModal||!nuevaPwd.trim()) return
    if (nuevaPwd.length<6) { setPwdMsg({type:'error',text:'Mínimo 6 caracteres.'}); return }
    setCambiandoPwd(true); setPwdMsg(null)
    const { error } = await cambiarPasswordAsesor(pwdModal.id, nuevaPwd)
    setCambiandoPwd(false)
    if (error) setPwdMsg({type:'error',text:'Error: '+error.message})
    else { setPwdMsg({type:'ok',text:'Contraseña actualizada.'}); setTimeout(()=>{ setPwdModal(null); setNuevaPwd(''); setPwdMsg(null) },1500) }
  }

  async function handleToggleActivo(a) {
    const { error } = await toggleActivoAsesor(a.id, a.activo)
    if (error) setMsg({type:'error',text:'Error: '+error.message})
    else cargar()
  }

  async function handleEliminar(a) {
    if (!window.confirm(`¿Eliminar asesor ${a.email}? Esta acción es permanente.`)) return
    const { error } = await eliminarAsesor(a.id)
    if (error) setMsg({type:'error',text:'Error: '+error.message})
    else { setMsg({type:'ok',text:'Asesor eliminado.'}); cargar() }
  }

  return (
    <div style={{padding:'14px 16px'}}>
      {pwdModal && (
        <Modal title={`Contraseña — ${pwdModal.nombre||pwdModal.email}`} onClose={()=>{setPwdModal(null);setNuevaPwd('');setPwdMsg(null)}} width={400}>
          <p style={{fontSize:13,color:'#374151',marginBottom:10}}>Ingresa la nueva contraseña para este asesor.</p>
          <div style={{position:'relative',marginBottom:8}}>
            <input style={{...S.input,paddingRight:80}} type={showPwd?'text':'password'}
              placeholder="Nueva contraseña" value={nuevaPwd} onChange={e=>setNuevaPwd(e.target.value)} />
            <button type="button" onClick={()=>setShowPwd(v=>!v)}
              style={{position:'absolute',right:40,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:11,color:'#6b7280'}}>
              {showPwd?'Ocultar':'Mostrar'}
            </button>
            <button type="button" onClick={()=>setNuevaPwd(generarPassword())}
              style={{position:'absolute',right:4,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:11,color:'#2563eb'}}>
              ⟳Gen
            </button>
          </div>
          {nuevaPwd&&<div style={{fontSize:11,color:'#6b7280',marginBottom:6,fontFamily:'monospace',background:'#f8fafc',padding:'4px 8px',borderRadius:3}}>{nuevaPwd}</div>}
          <Msg msg={pwdMsg} />
          <div style={{display:'flex',gap:8,marginTop:8}}>
            <button style={{...S.btnSmall,background:'#e5e7eb',color:'#374151'}} onClick={()=>{setPwdModal(null);setNuevaPwd('');setPwdMsg(null)}} type="button">Cancelar</button>
            <button style={{...S.btnSmall,...S.btnBlue}} onClick={handleCambiarPwd} disabled={cambiandoPwd||!nuevaPwd.trim()} type="button">
              {cambiandoPwd?'Cambiando…':'Cambiar contraseña'}
            </button>
            <button type="button" onClick={()=>{navigator.clipboard.writeText(nuevaPwd);setPwdMsg({type:'ok',text:'Copiada al portapapeles.'})}}
              style={{...S.btnSmall,background:'#eff6ff',color:'#1d4ed8',marginLeft:'auto'}} disabled={!nuevaPwd}>
              📋 Copiar
            </button>
          </div>
        </Modal>
      )}

      <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>

        {/* Formulario crear asesor */}
        <div style={{flex:'0 0 260px',minWidth:220}}>
          <div style={{fontWeight:700,fontSize:14,color:'#7c3aed',marginBottom:10}}>➕ Nuevo Asesor</div>
          <Msg msg={msg} onClose={()=>setMsg(null)} />

          {[{lbl:'Nombre',k:'nombre'},{lbl:'Email *',k:'email',type:'email'},{lbl:'Contraseña *',k:'password',type:'password'}].map(({lbl,k,type})=>(
            <div key={k} style={S.fieldGroup}>
              <label style={S.lbl}>{lbl}:</label>
              <div style={{position:'relative'}}>
                <input style={{...S.input,paddingRight:k==='password'?60:8}}
                  type={k==='password'&&showPwd?'text':(type||'text')}
                  value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} disabled={creando} />
                {k==='password'&&(
                  <button type="button" onClick={()=>{ const p=generarPassword(); setForm(f=>({...f,password:p})) }}
                    style={{position:'absolute',right:4,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:10,color:'#7c3aed'}}>
                    ⟳Gen
                  </button>
                )}
              </div>
              {k==='password'&&form.password&&(
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:2}}>
                  <div style={{fontSize:10,color:'#6b7280',fontFamily:'monospace'}}>{form.password}</div>
                  <button type="button" onClick={()=>navigator.clipboard.writeText(form.password)}
                    style={{fontSize:10,color:'#7c3aed',background:'none',border:'none',cursor:'pointer'}}>📋</button>
                </div>
              )}
            </div>
          ))}

          <button style={{...S.btn,background:'#7c3aed',color:'#fff'}} type="button" onClick={crearNuevo} disabled={creando}>
            {creando?'Creando…':'Crear Asesor'}
          </button>
        </div>

        {/* Lista de asesores */}
        <div style={{flex:1,minWidth:300}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
            <div style={{fontWeight:700,fontSize:14,color:'#374151'}}>Asesores registrados</div>
            <button style={{...S.btnSmall,background:'#eff6ff',color:'#1d4ed8'}} type="button" onClick={cargar} disabled={cargando}>
              {cargando?'…':'↺ Refrescar'}
            </button>
          </div>
          <div style={S.tableWrap}>
            <table style={S.table}>
              <thead><tr style={S.thead}>
                {['Nombre','Email','Estado','Acciones'].map(h=><th key={h} style={S.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {cargando ? <tr><td colSpan="4" style={S.tdEmpty}>Cargando…</td></tr>
                : asesores.length===0 ? <tr><td colSpan="4" style={S.tdEmpty}>Sin asesores registrados.</td></tr>
                : asesores.map(a=>(
                  <tr key={a.id} style={S.tr}>
                    <td style={S.td}>{a.nombre||'—'}</td>
                    <td style={S.td}>{a.email}</td>
                    <td style={S.td}><ActivoBadge activo={a.activo!==false} /></td>
                    <td style={{...S.td,whiteSpace:'nowrap',display:'flex',gap:4}}>
                      <button type="button" onClick={()=>handleToggleActivo(a)}
                        style={{...S.btnSmall,background:a.activo!==false?'#fef3c7':'#d1fae5',color:a.activo!==false?'#92400e':'#166534',border:'none'}}>
                        {a.activo!==false?'Desactivar':'Activar'}
                      </button>
                      <button type="button" onClick={()=>{setPwdModal({id:a.id,nombre:a.nombre||a.email});setNuevaPwd('');setPwdMsg(null)}}
                        style={{...S.btnSmall,background:'#eff6ff',color:'#1d4ed8',border:'none'}}>
                        🔑 Clave
                      </button>
                      <button type="button" onClick={()=>handleEliminar(a)}
                        style={{...S.btnSmall,background:'#fee2e2',color:'#b91c1c',border:'none'}}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={{fontSize:11,color:'#9ca3af',marginTop:6}}>
            💡 Los asesores inactivos no pueden iniciar sesión. Eliminar un asesor es permanente e irreversible.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────
export default function DashboardAdmin() {
  const { user } = useAuth()
  const [tabActiva, setTabActiva] = useState('Consultas')

  // ── DASHBOARD ─────────────────────────────────────────────────
  const STATS0 = {total:0,pagos:0,enMora:0,conBeneficiarios:0,activos:0,inactivos:0,totalRecaudado:0}
  const [dashStats,    setDashStats]    = useState(STATS0)
  const [usuarios,     setUsuarios]     = useState([])
  const [cargando,     setCargando]     = useState(false)
  const [dashErr,      setDashErr]      = useState(null)
  const [filtroEstado, setFiltroEstado] = useState('Todos')
  const [filtroNombre, setFiltroNombre] = useState('')
  const [sortBy,       setSortBy]       = useState('nombre')
  const [sortDir,      setSortDir]      = useState('asc')
  const [expandidos,   setExpandidos]   = useState(new Set())
  const [eliminandoId, setEliminandoId] = useState(null)
  const [confirmElim,  setConfirmElim]  = useState(null)
  const [accionMsg,    setAccionMsg]    = useState(null)
  const [modalDetalle, setModalDetalle] = useState(null)

  const cargarDashboard = useCallback(async () => {
    setCargando(true); setDashErr(null)
    const { stats, usuarios, error } = await fetchDashboardData()
    setCargando(false)
    if (error) { setDashErr('Error: '+error.message); return }
    setDashStats(stats); setUsuarios(usuarios)
  }, [])

  useEffect(() => { cargarDashboard() }, [cargarDashboard])

  const usuariosFiltrados = useMemo(() => {
    let lista = usuarios
    if (filtroEstado==='En mora') lista=lista.filter(u=>u.enMora)
    else if (filtroEstado!=='Todos') lista=lista.filter(u=>u.estado===filtroEstado.toLowerCase())
    if (filtroNombre.trim()) {
      const t = filtroNombre.trim().toLowerCase()
      lista = lista.filter(u=>u.nombre?.toLowerCase().includes(t)||u.apellido?.toLowerCase().includes(t)||u.documento?.toLowerCase().includes(t))
    }
    return lista
  }, [usuarios, filtroEstado, filtroNombre])

  function toggleExpandir(id) {
    setExpandidos(prev=>{ const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n })
  }

  function handleSort(key) {
    if (sortBy === key) setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    else { setSortBy(key); setSortDir('asc') }
  }

  const getSortValue = useCallback((u, key) => {
    switch (key) {
      case 'nombre': return `${u.nombre ?? ''} ${u.apellido ?? ''}`.trim().toLowerCase()
      case 'documento': return (u.documento ?? '').toLowerCase()
      case 'fecha_ingreso': return u.fecha_ingreso ? new Date(u.fecha_ingreso).getTime() : 0
      case 'ultimoPagoText': {
        const text = u.ultimoPagoText ?? ''
        if (!text || text === 'Sin pagos') return Number.MIN_SAFE_INTEGER
        const [mes, año] = text.split(' — ')[0].split(' ')
        const index = MESES_NOMBRES.indexOf(mes)
        return Number(año) * 100 + (index >= 0 ? index : 0)
      }
      case 'totalPagosValor': return Number(u.totalPagosValor) || 0
      case 'enMora': return u.enMora ? 1 : 0
      case 'beneficiariosCount': return Number(u.beneficiariosCount) || 0
      case 'estado': return (u.estado ?? '').toLowerCase()
      default: return ''
    }
  }, [])

  const usuariosOrdenados = useMemo(() => {
    const lista = usuariosFiltrados.slice()
    lista.sort((a, b) => {
      const va = getSortValue(a, sortBy)
      const vb = getSortValue(b, sortBy)
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return lista
  }, [usuariosFiltrados, sortBy, sortDir, getSortValue])

  async function handleToggleEstado(u) {
    setAccionMsg(null)
    const { error, nuevoEstado } = await toggleEstadoCliente(u.id, u.estado)
    if (error) setAccionMsg({type:'error',text:'Error: '+error.message})
    else { setAccionMsg({type:'ok',text:`${u.nombre} ahora está ${nuevoEstado}.`}); cargarDashboard() }
  }

  async function handleEliminar() {
    if (!confirmElim) return
    setEliminandoId(confirmElim.id); setConfirmElim(null)
    const { error } = await eliminarCliente(confirmElim.id)
    setEliminandoId(null)
    if (error) setAccionMsg({type:'error',text:'Error al eliminar: '+error.message})
    else { setAccionMsg({type:'ok',text:'Afiliado eliminado.'}); cargarDashboard() }
  }

  // ── TAB: AFILIADOS (con pago inicial obligatorio) ─────────────
  const [formAfil,    setFormAfil]    = useState(FORM_AFIL_EMPTY)
  const [afilLoading, setAfilLoading] = useState(false)
  const [afilMsg,     setAfilMsg]     = useState(null)

  async function crearAfiliado(e) {
    e.preventDefault(); setAfilMsg(null)
    const nombre = formAfil.nombre.trim(), documento = formAfil.documento.trim()
    if (!nombre||!documento) { setAfilMsg({type:'error',text:'Nombre y documento son obligatorios.'}); return }
    if (!formAfil.pagoValor||Number(formAfil.pagoValor)<=0) {
      setAfilMsg({type:'error',text:'El valor del pago inicial es obligatorio.'}); return
    }

    setAfilLoading(true)
    const { data: dup } = await supabase.from('clientes').select('id').eq('documento',documento).maybeSingle()
    if (dup) { setAfilMsg({type:'error',text:'Ya existe un afiliado con ese documento.'}); setAfilLoading(false); return }

    const { data, error } = await crearAfiliadoConPago({
      nombre, apellido: formAfil.apellido.trim()||'', documento,
      fecha_ingreso:    formAfil.fecha_ingreso    ||null,
      fecha_nacimiento: formAfil.fecha_nacimiento ||null,
      telefono:         formAfil.telefono.trim()  ||null,
      correo:           formAfil.correo.trim()    ||null,
      direccion:        formAfil.direccion.trim() ||null,
      asesor:           formAfil.asesor.trim()    ||null,
      observaciones:    formAfil.observaciones.trim()||null,
      pagoMes:          Number(formAfil.pagoMes),
      pagoAño:          Number(formAfil.pagoAño),
      pagoValor:        Number(formAfil.pagoValor),
      registradoPor:    user?.id,
    })

    setAfilLoading(false)
    if (error) setAfilMsg({type:'error',text:error.message})
    else {
      setAfilMsg({type:'ok',text:`Afiliado ${nombre} creado con pago inicial de ${new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(formAfil.pagoValor)}.`})
      setFormAfil(FORM_AFIL_EMPTY)
      cargarDashboard()
    }
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
    if (!documento.trim()||!año||!valor) { setPagoMsg({type:'error',text:'Todos los campos son obligatorios.'}); return }
    const valorNum = parseFloat(valor)
    if (isNaN(valorNum)||valorNum<=0) { setPagoMsg({type:'error',text:'El valor debe ser mayor a 0.'}); return }
    setPagoLoading(true)
    const { data, error } = await registrarPago({documento:documento.trim(),mes:Number(mes),año:Number(año),valor:valorNum,registradoPor:user?.id})
    setPagoLoading(false)
    if (error) setPagoMsg({type:'error',text:error.message})
    else {
      setPagoMsg({type:'ok',text:'Pago registrado correctamente.'})
      const { data: hist } = await fetchPagosPorCliente(data.cliente_id)
      setHistPagos(hist??[]); setClientePSel(documento.trim())
      setPago(p=>({...PAGO_EMPTY,documento:p.documento}))
      cargarDashboard()
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
    const { data } = await buscarClientes(term)
    setClientes(data); setBuscando(false)
  }, [docBusq, user?.id])

  const cargarBenef = useCallback(async (id) => {
    setBenefLoading(true)
    const { data } = await supabase.from('beneficiarios').select('id,nombre,apellido,documento').eq('cliente_id',id).order('id',{ascending:false})
    setBeneficiarios(data??[]); setBenefLoading(false)
  }, [])

  const cargarUltimoPago = useCallback(async (id) => {
    const { data } = await fetchPagosPorCliente(id)
    if (!data?.length) { setUltimoPagoSel('Sin pagos'); return }
    const u = data[0]
    setUltimoPagoSel(`${MESES_NOMBRES[Number(u.mes)]} ${u.año} — ${formatCOP(u.valor)}`)
  }, [])

  function seleccionar(c) {
    const mismo = clienteSel?.id===c.id
    setClienteSel(mismo?null:c); setBeneficiarios([]); setUltimoPagoSel('Sin pagos')
    if (!mismo) { cargarBenef(c.id); cargarUltimoPago(c.id) }
  }

  // ── RENDER ────────────────────────────────────────────────────
  return (
    <div style={S.root}>

      {/* Modales globales */}
      {confirmElim && (
        <Modal title="¿Eliminar afiliado?" onClose={()=>setConfirmElim(null)} width={380}>
          <p style={{fontSize:13,color:'#374151',marginBottom:16}}>Se eliminará a <strong>{confirmElim.nombre}</strong> junto con sus beneficiarios y pagos. Irreversible.</p>
          <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
            <button style={{...S.btnSmall,background:'#e5e7eb',color:'#374151'}} onClick={()=>setConfirmElim(null)}>Cancelar</button>
            <button style={{...S.btnSmall,background:'#dc2626',color:'#fff'}} onClick={handleEliminar}>Sí, eliminar</button>
          </div>
        </Modal>
      )}
      {modalDetalle && (
        <ModalDetalle cliente={modalDetalle} ultimoPagoText={modalDetalle.ultimoPagoText??'Sin pagos'}
          onClose={()=>setModalDetalle(null)}
          onSaveObs={obs=>setUsuarios(prev=>prev.map(u=>u.id===modalDetalle.id?{...u,observaciones:obs}:u))} />
      )}

      {/* Logo */}
      <div style={S.header}><img src={logoImg} alt="Logo" style={S.logo} /></div>

      {/* ── KPIs ────────────────────────────────────────────── */}
      <div style={S.dashRoot}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,flexWrap:'wrap',gap:8}}>
          <div>
            <div style={{fontSize:16,fontWeight:700,color:'#111827'}}>Panel de Control</div>
            <div style={{fontSize:12,color:'#64748b'}}>Resumen en tiempo real</div>
          </div>
          <button style={{...S.btnSmall,...S.btnBlue}} onClick={cargarDashboard} disabled={cargando} type="button">
            {cargando?'Actualizando…':'↺ Refrescar'}
          </button>
        </div>

        {dashErr && <Msg msg={{type:'error',text:dashErr}} />}
        {accionMsg && <div style={{marginBottom:8}}><Msg msg={accionMsg} onClose={()=>setAccionMsg(null)} /></div>}

        <div style={S.cardsRow}>
          {[
            {label:'Afiliados',       value:dashStats.total},
            {label:'Pagos',           value:dashStats.pagos},
            {label:'En mora',         value:dashStats.enMora,  danger:true},
            {label:'Con beneficiarios',value:dashStats.conBeneficiarios},
            {label:'Activos',         value:dashStats.activos, ok:true},
            {label:'Inactivos',       value:dashStats.inactivos},
            {label:'Total recaudado', value:formatCOP(dashStats.totalRecaudado), isStr:true},
          ].map(({label,value,danger,ok,isStr})=>(
            <div key={label} style={{...S.card,borderTop:danger?'3px solid #ef4444':ok?'3px solid #22c55e':'3px solid #e2e8f0'}}>
              <div style={S.cardLbl}>{label}</div>
              <div style={{fontSize:isStr?14:26,fontWeight:700,color:danger?'#dc2626':ok?'#16a34a':'#111827'}}>
                {cargando?'…':value}
              </div>
            </div>
          ))}
        </div>

        {/* Filtros + tabla */}
        <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center',marginBottom:8}}>
          <div>
            <label style={S.lbl}>Estado</label>
            <select style={{...S.input,width:140}} value={filtroEstado} onChange={e=>setFiltroEstado(e.target.value)}>
              <option>Todos</option><option>Activo</option><option>Inactivo</option><option>En mora</option>
            </select>
          </div>
          <div style={{flex:1,minWidth:180}}>
            <label style={S.lbl}>Buscar</label>
            <input style={S.input} placeholder="Nombre, apellido o documento…" value={filtroNombre} onChange={e=>setFiltroNombre(e.target.value)} />
          </div>
          <div style={{fontSize:12,color:'#64748b',alignSelf:'flex-end',paddingBottom:2}}>{usuariosFiltrados.length} / {dashStats.total}</div>
        </div>

        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead><tr style={S.thead}>
              {[
              { label:'', key:null },
              { label:'Nombre', key:'nombre' },
              { label:'Documento', key:'documento' },
              { label:'Ingreso', key:'fecha_ingreso' },
              { label:'Último pago', key:'ultimoPagoText' },
              { label:'Total pagado', key:'totalPagosValor' },
              { label:'Mora', key:'enMora' },
              { label:'Benef.', key:'beneficiariosCount' },
              { label:'Estado', key:'estado' },
              { label:'Acciones', key:null },
            ].map(h => (
              <th key={h.label} style={S.th}>
                {h.key ? (
                  <button type="button" style={S.sortHeaderBtn} onClick={() => handleSort(h.key)}>
                    {h.label} <span style={{fontSize:10}}>{sortBy === h.key ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}</span>
                  </button>
                ) : h.label}
              </th>
            ))}
            </tr></thead>
            <tbody>
              {usuariosOrdenados.length===0
                ? <tr><td colSpan="10" style={S.tdEmpty}>{cargando?'Cargando…':'Sin registros.'}</td></tr>
                : usuariosOrdenados.map(u=>(
                  <>
                    <tr key={u.id} style={{...S.tr,background:u.enMora?'#fff7f0':undefined}}>
                      <td style={{...S.td,width:24,padding:'4px 2px'}}>
                        {u.beneficiariosCount>0&&(
                          <button type="button" style={{...S.btnIcon,color:expandidos.has(u.id)?'#2563eb':'#9ca3af'}} onClick={()=>toggleExpandir(u.id)}>
                            {expandidos.has(u.id)?'▾':'▸'}
                          </button>
                        )}
                      </td>
                      <td style={S.td}>
                        <button type="button" onClick={()=>setModalDetalle(u)}
                          style={{background:'none',border:'none',cursor:'pointer',color:'#2563eb',fontWeight:600,fontSize:12,textDecoration:'underline',padding:0}}>
                          {u.nombre} {u.apellido}
                        </button>
                      </td>
                      <td style={S.td}>{u.documento}</td>
                      <td style={S.td}>{formatFecha(u.fecha_ingreso)}</td>
                      <td style={S.td}>{u.ultimoPagoText}</td>
                      <td style={S.td}>{formatCOP(u.totalPagosValor)}</td>
                      <td style={S.td}><MoraBadge enMora={u.enMora} /></td>
                      <td style={{...S.td,textAlign:'center'}}><span style={S.badge}>{u.beneficiariosCount}</span></td>
                      <td style={S.td}><EstadoBadge estado={u.estado} /></td>
                      <td style={{...S.td,whiteSpace:'nowrap'}}>
                        <button type="button" onClick={()=>handleToggleEstado(u)}
                          style={{...S.btnSmall,background:u.estado==='activo'?'#fef3c7':'#d1fae5',color:u.estado==='activo'?'#92400e':'#166534',border:'none',marginRight:4}}>
                          {u.estado==='activo'?'Desactivar':'Activar'}
                        </button>
                        <button type="button" onClick={()=>setConfirmElim({id:u.id,nombre:`${u.nombre} ${u.apellido}`})}
                          style={{...S.btnSmall,background:'#fee2e2',color:'#b91c1c',border:'none'}} disabled={eliminandoId===u.id}>
                          {eliminandoId===u.id?'…':'Eliminar'}
                        </button>
                      </td>
                    </tr>
                    {expandidos.has(u.id)&&<BenefRowInline key={`b${u.id}`} beneficiarios={u.beneficiarios} />}
                  </>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* ── TABS ─────────────────────────────────────────────── */}
      <div style={S.tabBar}>
        {TABS.map(t=>(
          <button key={t} type="button"
            style={{...S.tab,...(tabActiva===t?S.tabActiva:{})}}
            onClick={()=>setTabActiva(t)}>
            {t==='Asesores'?'👤 '+t:t}
          </button>
        ))}
      </div>

      <div style={S.content}>

        {/* COL 1: AFILIADOS */}
        <div style={{...S.col,display:tabActiva!=='Afiliados'?'none':'flex'}}>
          <div style={{...S.colTitle,color:'#2563eb'}}>Nuevo Afiliado</div>
          <p style={{...S.hint,background:'#eff6ff',padding:'6px 8px',borderRadius:4,color:'#1d4ed8',marginBottom:10}}>
            ⚠️ El pago inicial es obligatorio al crear un afiliado.
          </p>

          {/* Campos del afiliado */}
          {[
            {lbl:'Cédula *',        key:'documento'},
            {lbl:'Nombre *',        key:'nombre'},
            {lbl:'Apellido',        key:'apellido'},
            {lbl:'Teléfono',        key:'telefono'},
            {lbl:'Correo',          key:'correo',           type:'email'},
            {lbl:'Dirección',       key:'direccion'},
            {lbl:'Asesor',          key:'asesor'},
            {lbl:'F. Nacimiento',   key:'fecha_nacimiento', type:'date'},
            {lbl:'F. Ingreso',      key:'fecha_ingreso',    type:'date'},
          ].map(({lbl,key,type})=>(
            <div key={key} style={S.fieldGroup}>
              <label style={S.lbl}>{lbl}:</label>
              <input style={S.input} type={type||'text'} value={formAfil[key]}
                onChange={e=>setFormAfil(f=>({...f,[key]:e.target.value}))} disabled={afilLoading} />
            </div>
          ))}

          {/* Observaciones */}
          <div style={S.fieldGroup}>
            <label style={S.lbl}>Observaciones:</label>
            <textarea style={{...S.input,resize:'vertical',fontFamily:'inherit'}} rows={2}
              value={formAfil.observaciones}
              onChange={e=>setFormAfil(f=>({...f,observaciones:e.target.value}))} disabled={afilLoading} />
          </div>

          {/* Pago inicial */}
          <div style={{borderTop:'2px solid #e2e8f0',paddingTop:10,marginTop:4}}>
            <div style={{fontWeight:700,fontSize:12,color:'#16a34a',marginBottom:6}}>💰 Pago inicial (obligatorio)</div>
            <div style={S.fieldGroup}>
              <label style={S.lbl}>Mes:</label>
              <select style={S.input} value={formAfil.pagoMes}
                onChange={e=>setFormAfil(f=>({...f,pagoMes:e.target.value}))} disabled={afilLoading}>
                {MESES.map(m=><option key={m.valor} value={m.valor}>{m.nombre}</option>)}
              </select>
            </div>
            <div style={S.fieldGroup}>
              <label style={S.lbl}>Año:</label>
              <input style={S.input} type="number" min="2000" max="2100"
                value={formAfil.pagoAño} onChange={e=>setFormAfil(f=>({...f,pagoAño:e.target.value}))} disabled={afilLoading} />
            </div>
            <div style={S.fieldGroup}>
              <label style={S.lbl}>Valor (COP) *:</label>
              <input style={S.input} type="number" min="1" step="1000" placeholder="0"
                value={formAfil.pagoValor} onChange={e=>setFormAfil(f=>({...f,pagoValor:e.target.value}))} disabled={afilLoading} />
              {formAfil.pagoValor&&Number(formAfil.pagoValor)>0&&(
                <div style={{fontSize:11,color:'#16a34a',marginTop:2}}>{formatCOP(formAfil.pagoValor)}</div>
              )}
            </div>
          </div>

          <Msg msg={afilMsg} onClose={()=>setAfilMsg(null)} />
          <button style={{...S.btn,...S.btnBlue}} type="button" onClick={crearAfiliado} disabled={afilLoading}>
            {afilLoading?'Creando afiliado y pago…':'Crear Afiliado + Pago Inicial'}
          </button>
        </div>

        {/* COL 2: PAGOS */}
        <div style={{...S.col,display:tabActiva!=='Pagos'?'none':'flex'}}>
          <div style={{...S.colTitle,color:'#16a34a'}}>Registrar Pago</div>
          <p style={S.hint}>Pagos adicionales de afiliados existentes.</p>

          <div style={S.fieldGroup}>
            <label style={S.lbl}>Cédula del afiliado:</label>
            <input style={S.input} placeholder="Documento exacto" value={pago.documento}
              onChange={e=>setPago(p=>({...p,documento:e.target.value}))} disabled={pagoLoading} />
          </div>
          <div style={S.fieldGroup}>
            <label style={S.lbl}>Año:</label>
            <input style={S.input} type="number" min="2000" max="2100" value={pago.año}
              onChange={e=>setPago(p=>({...p,año:e.target.value}))} disabled={pagoLoading} />
          </div>
          <div style={S.fieldGroup}>
            <label style={S.lbl}>Mes:</label>
            <select style={S.input} value={pago.mes}
              onChange={e=>setPago(p=>({...p,mes:Number(e.target.value)}))} disabled={pagoLoading}>
              {MESES.map(m=><option key={m.valor} value={m.valor}>{m.nombre}</option>)}
            </select>
          </div>
          <div style={S.fieldGroup}>
            <label style={S.lbl}>Valor (COP):</label>
            <input style={S.input} type="number" min="0" step="1000" placeholder="0" value={pago.valor}
              onChange={e=>setPago(p=>({...p,valor:e.target.value}))} disabled={pagoLoading} />
            {pago.valor&&Number(pago.valor)>0&&<div style={{fontSize:11,color:'#6b7280',marginTop:2}}>{formatCOP(pago.valor)}</div>}
          </div>

          <Msg msg={pagoMsg} onClose={()=>setPagoMsg(null)} />
          <button style={{...S.btn,...S.btnGreen}} type="button" onClick={handleRegistrarPago} disabled={pagoLoading}>
            {pagoLoading?'Registrando…':'Registrar Pago'}
          </button>

          {histPagos.length>0&&(
            <div style={{marginTop:14}}>
              <div style={S.tableLabel}>Historial — {clientePSel}</div>
              <div style={S.tableWrap}>
                <table style={S.table}>
                  <thead><tr style={S.thead}>
                    <th style={S.th}>Mes</th><th style={S.th}>Año</th>
                    <th style={S.th}>Valor</th><th style={S.th}>Fecha y hora</th>
                  </tr></thead>
                  <tbody>
                    {histPagos.map(p=>(
                      <tr key={p.id} style={S.tr}>
                        <td style={S.td}>{MESES_NOMBRES[p.mes]??p.mes}</td>
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
        <div style={{...S.col,...S.colWide,display:tabActiva!=='Consultas'?'none':'flex'}}>
          <div style={{...S.colTitle,color:'#ea580c'}}>Consultas</div>

          <form onSubmit={buscar}>
            <label style={S.lbl}>Buscar por Cédula:</label>
            <input style={{...S.input,marginBottom:6}} placeholder="Búsqueda parcial…"
              value={docBusq} onChange={e=>setDocBusq(e.target.value)} />
            <button style={{...S.btn,...S.btnOrange}} type="submit" disabled={buscando||!docBusq.trim()}>
              {buscando?'Buscando…':'Buscar Afiliado'}
            </button>
          </form>

          <div style={{marginTop:12}}>
            <div style={S.tableLabel}>Resultados {buscado&&`(${clientes.length})`}</div>
            <div style={S.tableWrap}>
              <table style={S.table}>
                <thead><tr style={S.thead}>
                  {['Nombre','Documento','F. Ingreso','Estado',''].map(h=><th key={h} style={S.th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {buscando?<tr><td colSpan="5" style={S.tdEmpty}>Buscando…</td></tr>
                  :!buscado?<tr><td colSpan="5" style={S.tdEmpty}>Ingresa un documento y presiona Buscar.</td></tr>
                  :clientes.length===0?<tr><td colSpan="5" style={S.tdEmpty}>Sin coincidencias.</td></tr>
                  :clientes.map(c=>(
                    <tr key={c.id} style={{...S.tr,background:clienteSel?.id===c.id?'#dbeafe':undefined,cursor:'pointer'}} onClick={()=>seleccionar(c)}>
                      <td style={S.td}><strong>{c.nombre}</strong> {c.apellido}</td>
                      <td style={S.td}>{c.documento}</td>
                      <td style={S.td}>{formatFecha(c.fecha_ingreso)}</td>
                      <td style={S.td}><EstadoBadge estado={c.estado} /></td>
                      <td style={S.td}><button style={S.btnSmall} type="button" onClick={ev=>{ev.stopPropagation();seleccionar(c)}}>{clienteSel?.id===c.id?'Ocultar':'Ver'}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Panel detalle inline */}
          {clienteSel&&(
            <div style={{...S.detallePanel,marginTop:10}}>
              <div style={S.detalleTitulo}>📋 {clienteSel.nombre} {clienteSel.apellido}</div>
              <div style={S.detalleGrid}>
                {[
                  ['Documento',    clienteSel.documento],
                  ['Estado',       <EstadoBadge estado={clienteSel.estado} />],
                  ['Teléfono',     clienteSel.telefono],
                  ['Correo',       clienteSel.correo],
                  ['Dirección',    clienteSel.direccion],
                  ['Asesor',       clienteSel.asesor],
                  ['F. ingreso',   formatFecha(clienteSel.fecha_ingreso)],
                  ['F. nacimiento',formatFecha(clienteSel.fecha_nacimiento)],
                  ['Último pago',  ultimoPagoSel],
                ].filter(([,v])=>v&&v!=='—').map(([lbl,val])=>(
                  <div key={lbl}><div style={S.detLbl}>{lbl}</div><div style={S.detVal}>{val}</div></div>
                ))}
              </div>
              {clienteSel.observaciones&&(
                <div style={{marginTop:10}}>
                  <div style={S.detLbl}>Observaciones</div>
                  <div style={{...S.detVal,whiteSpace:'pre-wrap',background:'#f8fafc',padding:'6px 8px',borderRadius:4,border:'1px solid #e2e8f0'}}>
                    {clienteSel.observaciones}
                  </div>
                </div>
              )}
            </div>
          )}

          <PanelBenef clienteSel={clienteSel} beneficiarios={beneficiarios} benefLoading={benefLoading}
            onRecargar={()=>clienteSel&&cargarBenef(clienteSel.id)} />
        </div>

        {/* COL 4: ASESORES */}
        <div style={{...S.col,...S.colWide,display:tabActiva!=='Asesores'?'none':'flex'}}>
          <SeccionAsesores />
        </div>

        {/* Placeholder para layout */}
        {tabActiva==='Afiliados'&&<div style={{...S.col,...S.colWide}} />}
        {tabActiva==='Pagos'&&<div style={{...S.col,...S.colWide}} />}

      </div>
    </div>
  )
}

// ── Estilos ───────────────────────────────────────────────────────
const S = {
  root: {fontFamily:'Segoe UI,Tahoma,Arial,sans-serif',fontSize:13,color:'#1f2937'},
  header: {width:'100%',padding:'12px 0',background:'#f8fafc',borderBottom:'1px solid #cbd5e1'},
  logo: {width:'100%',height:'auto',maxHeight:120,objectFit:'contain'},
  dashRoot: {margin:'14px 0',padding:'14px 16px',background:'#f8fafc',border:'1px solid #d1d5db',borderRadius:10},
  cardsRow: {display:'flex',flexWrap:'wrap',gap:8,marginBottom:12},
  card: {flex:'1 1 120px',minWidth:110,padding:'10px 12px',borderRadius:8,border:'1px solid #e2e8f0',background:'#fff'},
  cardLbl: {fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:.5,marginBottom:3},
  tabBar: {display:'flex',borderBottom:'2px solid #cbd5e1'},
  tab: {padding:'7px 16px',border:'1px solid #cbd5e1',borderBottom:'none',background:'#e5e7eb',cursor:'pointer',fontSize:13,borderRadius:'4px 4px 0 0',marginRight:2,color:'#374151'},
  tabActiva: {background:'#fff',borderBottom:'2px solid #fff',marginBottom:-2,fontWeight:600,color:'#111827'},
  content: {display:'flex',border:'1px solid #cbd5e1',borderTop:'none',background:'#f1f5f9',minHeight:500},
  col: {flex:'0 0 230px',padding:'14px 16px',borderRight:'1px solid #cbd5e1',background:'#f8fafc',display:'flex',flexDirection:'column',gap:2},
  colWide: {flex:1,borderRight:'none'},
  colTitle: {fontWeight:700,fontSize:14,marginBottom:8},
  fieldGroup: {marginBottom:7},
  lbl: {display:'block',fontSize:12,color:'#4b5563',marginBottom:3,fontWeight:500},
  input: {width:'100%',padding:'5px 8px',border:'1px solid #9ca3af',borderRadius:3,fontSize:13,background:'#fff',boxSizing:'border-box',color:'#111827'},
  hint: {fontSize:12,color:'#6b7280',margin:'0 0 8px'},
  btn: {padding:'7px 0',width:'100%',border:'none',borderRadius:4,fontSize:13,fontWeight:600,cursor:'pointer',marginTop:4},
  btnBlue:   {background:'#2563eb',color:'#fff'},
  btnGreen:  {background:'#16a34a',color:'#fff'},
  btnOrange: {background:'#ea580c',color:'#fff'},
  btnSmall:  {padding:'3px 9px',fontSize:11,border:'1px solid #d1d5db',borderRadius:3,background:'#fff',cursor:'pointer',whiteSpace:'nowrap'},
  sortHeaderBtn: {background:'none',border:'none',padding:0,cursor:'pointer',fontSize:12,color:'#111827',fontWeight:600,display:'inline-flex',alignItems:'center',gap:4},
  btnIcon:   {background:'none',border:'none',cursor:'pointer',fontSize:14,padding:'0 2px',fontWeight:700},
  tableLabel:{fontWeight:600,fontSize:12,marginBottom:4,color:'#374151'},
  tableWrap: {overflowX:'auto',border:'1px solid #cbd5e1',borderRadius:4,background:'#fff'},
  table:     {width:'100%',borderCollapse:'collapse',fontSize:12},
  thead:     {background:'#e5e7eb'},
  th:        {padding:'6px 10px',textAlign:'left',fontWeight:600,borderBottom:'1px solid #cbd5e1',whiteSpace:'nowrap',color:'#374151'},
  tr:        {borderBottom:'1px solid #f3f4f6'},
  td:        {padding:'5px 10px',verticalAlign:'middle',whiteSpace:'nowrap'},
  tdEmpty:   {padding:'16px',textAlign:'center',color:'#9ca3af',fontSize:12},
  msg:       {fontSize:12,padding:'6px 10px',border:'1px solid',borderRadius:4,marginBottom:6,display:'flex',justifyContent:'space-between',alignItems:'center'},
  badge:     {display:'inline-flex',alignItems:'center',padding:'2px 8px',borderRadius:999,fontSize:11,fontWeight:600,background:'#e2e8f0',color:'#1f2937'},
  detallePanel: {padding:'12px 14px',border:'1px solid #bfdbfe',borderRadius:6,background:'#eff6ff'},
  detalleTitulo:{fontWeight:700,fontSize:13,color:'#1d4ed8',marginBottom:8},
  detalleGrid:  {display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:'6px 14px'},
  detLbl: {fontSize:10,color:'#64748b',textTransform:'uppercase',letterSpacing:.5,fontWeight:600},
  detVal: {fontSize:13,color:'#111827',fontWeight:500,marginTop:1},
  benefPanel: {marginTop:10,padding:12,border:'1px solid #cbd5e1',borderRadius:4,background:'#fff'},
  benefTitle: {fontWeight:600,fontSize:13,marginBottom:8,color:'#374151',display:'flex',alignItems:'center',gap:4,flexWrap:'wrap'},
  benefCards: {display:'flex',flexWrap:'wrap',gap:7,marginBottom:8},
  benefCard:  {display:'flex',alignItems:'center',gap:7,padding:'5px 8px',border:'1px solid #e2e8f0',borderRadius:6,background:'#f8fafc',minWidth:150,flex:'1 1 150px',fontSize:12},
  benefAvatar:{width:26,height:26,borderRadius:'50%',background:'#2563eb',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,flexShrink:0},
  overlay: {position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000},
  modal:   {background:'#fff',borderRadius:12,padding:'20px 24px',width:'90%',boxShadow:'0 8px 40px rgba(0,0,0,0.18)'},
}
