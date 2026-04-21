/**
 * api/afiliados.js
 * Capa de acceso a datos — todas las llamadas a Supabase centralizadas aquí.
 * El modelo es: empleados consultan afiliados. Los afiliados NO son usuarios.
 */
import { supabase } from '../supabase'

// ─────────────────────────────────────────────────────────────────
// CLIENTES (afiliados)
// ─────────────────────────────────────────────────────────────────

export async function existeDocumentoCliente(documento) {
  const { data, error } = await supabase
    .from('clientes')
    .select('id')
    .eq('documento', documento.trim())
    .maybeSingle()

  if (error) return { exists: false, error }
  return { exists: !!data, error: null }
}

export async function insertCliente({ nombre, apellido, documento, fecha_ingreso }) {
  const { data, error } = await supabase
    .from('clientes')
    .insert([{ nombre, apellido: apellido || '', documento, fecha_ingreso: fecha_ingreso || null }])
    .select('id, nombre, apellido, documento, fecha_ingreso')
    .single()
  return { data, error }
}

// ─────────────────────────────────────────────────────────────────
// BENEFICIARIOS
// ─────────────────────────────────────────────────────────────────

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
    .insert([{ cliente_id, nombre, apellido: apellido || '', documento: documento || '' }])
    .select()
    .single()
  return { data, error }
}

// ─────────────────────────────────────────────────────────────────
// LOGS DE AUDITORÍA (fire-and-forget — no bloquea la UI)
// ─────────────────────────────────────────────────────────────────

export function registrarLogConsulta(userId, documento) {
  supabase
    .from('logs_consultas')
    .insert([{ user_id: userId, documento: documento || '', fecha: new Date().toISOString() }])
    .then(({ error }) => { if (error) console.warn('[log consulta]', error.message) })
}