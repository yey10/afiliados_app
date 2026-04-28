/**
 * api/afiliados.js — capa de datos completa
 * Versión producción final con: pago inicial obligatorio, gestión de asesores,
 * observaciones, estado afiliado, ordenamiento, timestamps completos.
 */
import { supabase } from '../supabase'

// ═══════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════

export function formatCOP(valor) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0,
  }).format(Number(valor) || 0)
}

export function formatFechaHora(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  const pad = n => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatFecha(dateStr) {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

/** Genera una contraseña aleatoria segura de 10 caracteres */
export function generarPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!'
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export const MESES_NOMBRES = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio',
                               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
export const MESES_CORTOS  = ['','Ene','Feb','Mar','Abr','May','Jun',
                               'Jul','Ago','Sep','Oct','Nov','Dic']

// ═══════════════════════════════════════════
// CLIENTES
// ═══════════════════════════════════════════

export const CLIENTE_SELECT =
  'id, nombre, apellido, documento, estado, fecha_ingreso, fecha_nacimiento, telefono, correo, direccion, asesor, observaciones'

/**
 * Crea un afiliado Y su pago inicial en una transacción lógica.
 * Si el pago falla → se elimina el cliente (rollback manual).
 */
export async function crearAfiliadoConPago({
  nombre, apellido, documento, fecha_ingreso, fecha_nacimiento,
  telefono, correo, direccion, asesor, observaciones,
  pagoMes, pagoAño, pagoValor, registradoPor,
}) {
  // 1. Crear cliente
  const { data: cliente, error: errCli } = await supabase
    .from('clientes')
    .insert([{
      nombre:           nombre.trim(),
      apellido:         apellido?.trim()      ?? '',
      documento:        documento.trim(),
      fecha_ingreso:    fecha_ingreso          || null,
      fecha_nacimiento: fecha_nacimiento       || null,
      telefono:         telefono?.trim()       || null,
      correo:           correo?.trim()         || null,
      direccion:        direccion?.trim()      || null,
      asesor:           asesor?.trim()         || null,
      observaciones:    observaciones?.trim()  || null,
      estado:           'activo',
    }])
    .select(CLIENTE_SELECT)
    .single()

  if (errCli) return { data: null, error: errCli }

  // 2. Registrar pago inicial
  const payload = {
    cliente_id: cliente.id,
    mes:        Number(pagoMes),
    año:        Number(pagoAño),
    valor:      Number(pagoValor),
    fecha_pago: new Date().toISOString(),
  }
  if (registradoPor) payload.registrado_por = registradoPor

  const { error: errPago } = await supabase
    .from('pagos')
    .insert([payload])

  if (errPago) {
    // Rollback: eliminar cliente recién creado
    await supabase.from('clientes').delete().eq('id', cliente.id)
    return { data: null, error: { message: `Pago inicial falló (afiliado no creado): ${errPago.message}` } }
  }

  return { data: cliente, error: null }
}

export async function updateObservaciones(clienteId, observaciones) {
  return supabase
    .from('clientes')
    .update({ observaciones: observaciones?.trim() || null })
    .eq('id', clienteId)
    .select('id, observaciones')
    .single()
}

export async function toggleEstadoCliente(id, estadoActual) {
  const nuevoEstado = estadoActual === 'activo' ? 'inactivo' : 'activo'
  const { data, error } = await supabase
    .from('clientes')
    .update({ estado: nuevoEstado })
    .eq('id', id)
    .select('id, estado')
    .single()
  return { data, error, nuevoEstado }
}

export async function eliminarCliente(id) {
  await supabase.from('beneficiarios').delete().eq('cliente_id', id)
  await supabase.from('pagos').delete().eq('cliente_id', id)
  const { error } = await supabase.from('clientes').delete().eq('id', id)
  return { error }
}

export async function buscarClientes(term) {
  const { data, error } = await supabase
    .from('clientes')
    .select(CLIENTE_SELECT)
    .ilike('documento', `%${term}%`)
    .order('fecha_ingreso', { ascending: false, nullsFirst: false })
    .order('apellido')
    .limit(50)
  return { data: data ?? [], error }
}

// ═══════════════════════════════════════════
// BENEFICIARIOS
// ═══════════════════════════════════════════

export async function fetchBeneficiariosPorCliente(clienteId) {
  const { data, error } = await supabase
    .from('beneficiarios')
    .select('id, cliente_id, nombre, apellido, documento')
    .eq('cliente_id', clienteId)
    .order('id', { ascending: false })
  return { data: data ?? [], error }
}

export async function insertBeneficiario({ cliente_id, nombre, apellido, documento }) {
  return supabase
    .from('beneficiarios')
    .insert([{ cliente_id, nombre: nombre.trim(), apellido: apellido?.trim() ?? '', documento: documento?.trim() ?? '' }])
    .select()
    .single()
}

export async function eliminarBeneficiario(id) {
  const { error } = await supabase.from('beneficiarios').delete().eq('id', id)
  return { error }
}

// ═══════════════════════════════════════════
// PAGOS
// ═══════════════════════════════════════════

/** Registra un pago buscando cliente_id por documento */
export async function registrarPago({ documento, mes, año, valor, registradoPor }) {
  const { data: cliente, error: errCli } = await supabase
    .from('clientes').select('id').eq('documento', documento.trim()).maybeSingle()

  if (errCli) return { data: null, error: errCli }
  if (!cliente) return { data: null, error: { message: `No existe un afiliado con documento "${documento}".` } }

  const payload = {
    cliente_id: cliente.id,
    mes:        Number(mes),
    año:        Number(año),
    valor:      Number(valor),
    fecha_pago: new Date().toISOString(),
  }
  if (registradoPor) payload.registrado_por = registradoPor

  const { data, error } = await supabase
    .from('pagos').insert([payload]).select('id, cliente_id, mes, año, valor, fecha_pago').single()

  return { data, error }
}

/** Registra pago directamente con cliente_id (para pagos adicionales desde el perfil) */
export async function registrarPagoDirecto({ clienteId, mes, año, valor, registradoPor }) {
  const payload = {
    cliente_id: clienteId,
    mes:        Number(mes),
    año:        Number(año),
    valor:      Number(valor),
    fecha_pago: new Date().toISOString(),
  }
  if (registradoPor) payload.registrado_por = registradoPor

  return supabase.from('pagos').insert([payload]).select('id, cliente_id, mes, año, valor, fecha_pago').single()
}

export async function fetchPagosPorCliente(clienteId) {
  const { data, error } = await supabase
    .from('pagos').select('id, mes, año, valor, fecha_pago')
    .eq('cliente_id', clienteId).order('fecha_pago', { ascending: false })
  return { data: data ?? [], error }
}

// ═══════════════════════════════════════════
// ASESORES (tabla: profiles, role='asesor')
// ═══════════════════════════════════════════

export async function fetchAsesores() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, nombre, activo, created_at')
    .eq('role', 'asesor')
    .order('created_at', { ascending: false })
  return { data: data ?? [], error }
}

/**
 * Crea un asesor usando la función RPC que llama a auth.admin.createUser
 * (requiere una función SQL en Supabase con SECURITY DEFINER)
 */
export async function crearAsesor({ email, password, nombre }) {
  const { data, error } = await supabase.rpc('admin_crear_asesor', {
    p_email:    email.trim().toLowerCase(),
    p_password: password,
    p_nombre:   nombre?.trim() ?? '',
  })
  return { data, error }
}

export async function cambiarPasswordAsesor(asesorId, newPassword) {
  const { data, error } = await supabase.rpc('admin_cambiar_password', {
    p_user_id:  asesorId,
    p_password: newPassword,
  })
  return { data, error }
}

export async function toggleActivoAsesor(asesorId, activoActual) {
  const nuevoActivo = !activoActual
  const { data, error } = await supabase
    .from('profiles')
    .update({ activo: nuevoActivo })
    .eq('id', asesorId)
    .select('id, activo')
    .single()
  return { data, error, nuevoActivo }
}

export async function eliminarAsesor(asesorId) {
  // Primero desactivar en profiles
  await supabase.from('profiles').update({ activo: false }).eq('id', asesorId)
  // Luego eliminar via RPC (auth.admin.deleteUser requiere service_role)
  const { error } = await supabase.rpc('admin_eliminar_usuario', { p_user_id: asesorId })
  return { error }
}

// ═══════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════

function estaEnMora(pagos = []) {
  if (!pagos.length) return true
  const sorted = [...pagos].sort((a, b) => new Date(b.fecha_pago) - new Date(a.fecha_pago))
  const ultimo = sorted[0]
  const diffMes = (new Date().getFullYear() - Number(ultimo.año)) * 12
    + (new Date().getMonth() + 1 - Number(ultimo.mes))
  return diffMes >= 2
}

export async function fetchDashboardData() {
  const [clientesRes, pagosRes, benefRes] = await Promise.all([
    supabase.from('clientes').select(CLIENTE_SELECT),
    supabase.from('pagos').select('id, cliente_id, valor, año, mes, fecha_pago'),
    supabase.from('beneficiarios').select('id, cliente_id, nombre, apellido, documento'),
  ])

  const firstError = clientesRes.error ?? pagosRes.error ?? benefRes.error
  if (firstError) return { stats: null, usuarios: [], error: firstError }

  const pagosPorCliente = new Map()
  ;(pagosRes.data ?? []).forEach(p => {
    const arr = pagosPorCliente.get(p.cliente_id) ?? []; arr.push(p)
    pagosPorCliente.set(p.cliente_id, arr)
  })

  const benefPorCliente = new Map()
  ;(benefRes.data ?? []).forEach(b => {
    const arr = benefPorCliente.get(b.cliente_id) ?? []; arr.push(b)
    benefPorCliente.set(b.cliente_id, arr)
  })

  const usuarios = (clientesRes.data ?? []).map(cliente => {
    const pagos           = pagosPorCliente.get(cliente.id) ?? []
    const beneficiarios   = benefPorCliente.get(cliente.id) ?? []
    const enMora          = estaEnMora(pagos)
    const estado          = (cliente.estado ?? 'activo').toLowerCase()
    const totalPagosValor = pagos.reduce((s, p) => s + Number(p.valor), 0)
    const pagosSorted     = [...pagos].sort((a, b) => new Date(b.fecha_pago) - new Date(a.fecha_pago))
    const ultimoPago      = pagosSorted[0]
    const ultimoPagoText  = ultimoPago
      ? `${MESES_CORTOS[Number(ultimoPago.mes)]} ${ultimoPago.año}`
      : 'Sin pagos'

    return { ...cliente, pagos: pagosSorted, beneficiarios, beneficiariosCount: beneficiarios.length, enMora, estado, ultimoPagoText, totalPagosValor }
  })

  usuarios.sort((a, b) => {
    if (a.enMora !== b.enMora) return a.enMora ? -1 : 1
    const fa = a.fecha_ingreso ? new Date(a.fecha_ingreso) : new Date(0)
    const fb = b.fecha_ingreso ? new Date(b.fecha_ingreso) : new Date(0)
    if (fb - fa !== 0) return fb - fa
    return (a.apellido ?? '').localeCompare(b.apellido ?? '')
  })

  const stats = {
    total:            usuarios.length,
    pagos:            pagosRes.data?.length ?? 0,
    enMora:           usuarios.filter(u => u.enMora).length,
    conBeneficiarios: usuarios.filter(u => u.beneficiariosCount > 0).length,
    activos:          usuarios.filter(u => u.estado === 'activo').length,
    inactivos:        usuarios.filter(u => u.estado !== 'activo').length,
    totalRecaudado:   (pagosRes.data ?? []).reduce((s, p) => s + Number(p.valor), 0),
  }

  return { stats, usuarios, error: null }
}

// ═══════════════════════════════════════════
// LOGS
// ═══════════════════════════════════════════

export function registrarLogConsulta(userId, documento) {
  supabase.from('logs_consultas')
    .insert([{ user_id: userId, documento: documento ?? '', fecha: new Date().toISOString() }])
    .then(({ error }) => { if (error) console.warn('[log]', error.message) })
}
