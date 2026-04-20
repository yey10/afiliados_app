import { supabase } from '../supabase'

const CLIENTE_COLUMNS = 'id, nombre, apellido, documento, fecha_ingreso, user_id'

/**
 * Perfil del usuario autenticado (profiles.id = auth.users.id).
 */
export async function fetchProfileByUserId(userId) {
  return supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
}

/**
 * Lista clientes según rol.
 * - admin: todos, con filtro opcional por documento (ilike).
 * - user: solo la fila con id = clienteId, con filtro opcional por documento (ilike).
 */
export async function fetchClientes({ role, clienteId, documentoPatron = '' }) {
  const t = documentoPatron?.trim()

  if (role === 'admin') {
    let q = supabase
      .from('clientes')
      .select(CLIENTE_COLUMNS)
      .order('fecha_ingreso', { ascending: false })
    if (t) q = q.ilike('documento', `%${t}%`)
    const { data, error } = await q
    return { data: data ?? [], error }
  }

  if (!clienteId) {
    return { data: [], error: null }
  }

  let q = supabase.from('clientes').select(CLIENTE_COLUMNS).eq('id', clienteId)
  if (t) q = q.ilike('documento', `%${t}%`)

  const { data, error } = await q.maybeSingle()
  if (error) return { data: [], error }
  return { data: data ? [data] : [], error: null }
}

export async function existeDocumentoCliente(documento) {
  const { data, error } = await supabase
    .from('clientes')
    .select('id')
    .eq('documento', documento.trim())
    .maybeSingle()

  if (error) return { exists: false, error }
  return { exists: !!data, error: null }
}

export async function insertCliente(row) {
  return supabase.from('clientes').insert([row]).select().single()
}

export async function fetchBeneficiariosPorCliente(clienteId) {
  return supabase
    .from('beneficiarios')
    .select('id, cliente_id, nombre, apellido, documento')
    .eq('cliente_id', clienteId)
    .order('id', { ascending: false })
}

export async function insertBeneficiario(row) {
  return supabase.from('beneficiarios').insert([row]).select().single()
}

export async function registrarLogConsulta(userId, documento) {
  return supabase.from('logs_consultas').insert([
    {
      user_id: userId,
      documento: documento || '',
      fecha: new Date().toISOString()
    }
  ])
}
