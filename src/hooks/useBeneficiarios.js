/**
 * hooks/useBeneficiarios.js
 */
import { useCallback, useEffect, useState } from 'react'
import { fetchBeneficiariosPorCliente, insertBeneficiario } from '../api/afiliados'

export function useBeneficiarios(clienteId) {
  const [beneficiarios, setBeneficiarios] = useState([])
  const [loading, setLoading]             = useState(false)
  const [saving, setSaving]               = useState(false)
  const [error, setError]                 = useState(null)

  const cargar = useCallback(async () => {
    if (!clienteId) { setBeneficiarios([]); return }
    setLoading(true)
    const { data, error: err } = await fetchBeneficiariosPorCliente(clienteId)
    if (err) setError(err.message)
    else { setBeneficiarios(data); setError(null) }
    setLoading(false)
  }, [clienteId])

  useEffect(() => { cargar() }, [cargar])

  const agregar = useCallback(async ({ nombre, apellido, documento }) => {
    if (!clienteId || !nombre?.trim()) return { error: 'Nombre requerido' }
    setSaving(true)
    const { error: err } = await insertBeneficiario({
      cliente_id: clienteId,
      nombre: nombre.trim(),
      apellido: apellido?.trim() ?? '',
      documento: documento?.trim() ?? ''
    })
    setSaving(false)
    if (err) return { error: err.message }
    await cargar()
    return { error: null }
  }, [clienteId, cargar])

  return { beneficiarios, loading, saving, error, agregar, recargar: cargar }
}