/**
 * api/afiliados.js
 * Capa de acceso a datos — TODAS las llamadas a Supabase centralizadas aquí.
 */
import { supabase } from '../supabase'

// ═══════════════════════════════════════════════════════════════════
// HELPERS EXPORTADOS
// ═══════════════════════════════════════════════════════════════════

export function formatCOP(valor) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', maximumFractionDigits: 0
  }).format(Number(valor) || 0)
}

export const MESES_NOMBRES = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio',
                               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
export const MESES_CORTOS  = ['','Ene','Feb','Mar','Abr','May','Jun',
                               'Jul','Ago','Sep','Oct','Nov','Dic']

// ═══════════════════════════════════════════════════════════════════
// CLIENTES (afiliados)
// ═══════════════════════════════════════════════════════════════════

export async function existeDocumentoCliente(documento) {
  const { data, error } = await supabase
    .from('clientes')
    .select('id')
    .eq('documento', documento.trim())
    .maybeSingle()
  if (error) return { exists: false, error }
  return { exists: !!data, error: null }
}

export async function insertCliente({
  nombre, apellido, documento, fecha_ingreso,
  fecha_nacimiento, telefono, correo, direccion, asesor
}) {
  const { data, error } = await supabase
    .from('clientes')
    .insert([{
      nombre:           nombre.trim(),
      apellido:         apellido?.trim()         ?? '',
      documento:        documento.trim(),
      fecha_ingreso:    fecha_ingreso             || null,
      fecha_nacimiento: fecha_nacimiento          || null,
      telefono:         telefono?.trim()          || null,
      correo:           correo?.trim()            || null,
      direccion:        direccion?.trim()         || null,
      asesor:           asesor?.trim()            || null,
      estado:           'activo',
    }])
    .select()
    .single()
  return { data, error }
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

// ═══════════════════════════════════════════════════════════════════
// BENEFICIARIOS
// ═══════════════════════════════════════════════════════════════════

export async function fetchBeneficiariosPorCliente(clienteId) {
  const { data, error } = await supabase
    .from('beneficiarios')
    .select('id, cliente_id, nombre, apellido, documento')
    .eq('cliente_id', clienteId)
    .order('id', { ascending: false })
  return { data: data ?? [], error }
}

export async function insertBeneficiario({ cliente_id, nombre, apellido, documento }) {
  const { data, error } = await supabase
    .from('beneficiarios')
    .insert([{
      cliente_id,
      nombre:    nombre.trim(),
      apellido:  apellido?.trim()  ?? '',
      documento: documento?.trim() ?? '',
    }])
    .select()
    .single()
  return { data, error }
}

// ═══════════════════════════════════════════════════════════════════
// PAGOS
// ═══════════════════════════════════════════════════════════════════

export async function registrarPago({ documento, mes, año, valor, registradoPor }) {
  const { data: cliente, error: errCli } = await supabase
    .from('clientes')
    .select('id')
    .eq('documento', documento.trim())
    .maybeSingle()

  if (errCli) return { data: null, error: errCli }
  if (!cliente) return { data: null, error: { message: `No existe un afiliado con documento "${documento}".` } }

  const payload = {
    cliente_id: cliente.id,
    mes:        Number(mes),    // SIEMPRE número 1-12, nunca texto
    año:        Number(año),
    valor:      Number(valor),
    fecha_pago: new Date().toISOString(),
  }
  if (registradoPor) payload.registrado_por = registradoPor

  const { data, error } = await supabase
    .from('pagos')
    .insert([payload])
    .select('id, cliente_id, mes, año, valor, fecha_pago')
    .single()

  return { data, error }
}

export async function fetchPagosPorCliente(clienteId) {
  const { data, error } = await supabase
    .from('pagos')
    .select('id, mes, año, valor, fecha_pago')
    .eq('cliente_id', clienteId)
    .order('año',  { ascending: false })
    .order('mes',  { ascending: false })
  return { data: data ?? [], error }
}

// ═══════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════

function estaEnMora(pagos = []) {
  if (!pagos.length) return true
  const ultimo = [...pagos]
    .map(p => ({ ...p, año: Number(p.año), mes: Number(p.mes) }))
    .sort((a, b) => b.año - a.año || b.mes - a.mes)[0]
  const ahora  = new Date()
  const diffMes = (ahora.getFullYear() - ultimo.año) * 12 + (ahora.getMonth() + 1 - ultimo.mes)
  return diffMes >= 2
}

export async function fetchDashboardData() {
  const [clientesRes, pagosRes, benefRes] = await Promise.all([
    supabase.from('clientes').select('id, nombre, apellido, documento, estado, fecha_ingreso, telefono, correo, asesor'),
    supabase.from('pagos').select('id, cliente_id, valor, año, mes, fecha_pago'),
    supabase.from('beneficiarios').select('id, cliente_id, nombre, apellido, documento'),
  ])

  const firstError = clientesRes.error ?? pagosRes.error ?? benefRes.error
  if (firstError) return { stats: null, usuarios: [], error: firstError }

  const pagosPorCliente = new Map()
  ;(pagosRes.data ?? []).forEach(p => {
    const arr = pagosPorCliente.get(p.cliente_id) ?? []
    arr.push(p)
    pagosPorCliente.set(p.cliente_id, arr)
  })

  const benefPorCliente = new Map()
  ;(benefRes.data ?? []).forEach(b => {
    const arr = benefPorCliente.get(b.cliente_id) ?? []
    arr.push(b)
    benefPorCliente.set(b.cliente_id, arr)
  })

  const usuarios = (clientesRes.data ?? []).map(cliente => {
    const pagos             = pagosPorCliente.get(cliente.id) ?? []
    const beneficiarios     = benefPorCliente.get(cliente.id) ?? []
    const enMora            = estaEnMora(pagos)
    const estado            = (cliente.estado ?? 'activo').toLowerCase()
    const totalPagosValor   = pagos.reduce((s, p) => s + Number(p.valor), 0)

    const ultimoPago = [...pagos]
      .map(p => ({ ...p, año: Number(p.año), mes: Number(p.mes) }))
      .sort((a, b) => b.año - a.año || b.mes - a.mes)[0]

    const ultimoPagoText = ultimoPago
      ? `${MESES_CORTOS[ultimoPago.mes]} ${ultimoPago.año}`
      : 'Sin pagos'

    return { ...cliente, pagos, beneficiarios, beneficiariosCount: beneficiarios.length, enMora, estado, ultimoPagoText, totalPagosValor }
  })

  usuarios.sort((a, b) => {
    if (a.enMora !== b.enMora) return a.enMora ? -1 : 1
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

// ═══════════════════════════════════════════════════════════════════
// LOGS
// ═══════════════════════════════════════════════════════════════════

export function registrarLogConsulta(userId, documento) {
  supabase
    .from('logs_consultas')
    .insert([{ user_id: userId, documento: documento ?? '', fecha: new Date().toISOString() }])
    .then(({ error }) => { if (error) console.warn('[log consulta]', error.message) })
}
