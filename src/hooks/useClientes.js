/**
 * hooks/useClientes.js
 * Búsqueda de clientes por documento — sin dependencia de rol ni cliente_id.
 * Cualquier empleado autenticado puede buscar.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase'

export function useClientes() {
  const [clientes, setClientes] = useState([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [busqueda, setBusqueda] = useState('')

  const debounceRef = useRef(null)
  const [busquedaDebounced, setBusquedaDebounced] = useState('')

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setBusquedaDebounced(busqueda), 350)
    return () => clearTimeout(debounceRef.current)
  }, [busqueda])

  const buscar = useCallback(async (patron) => {
    const term = (patron ?? busquedaDebounced).trim()

    // Sin término: limpiar resultados (no traer toda la tabla)
    if (!term) {
      setClientes([])
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    const { data, error: err } = await supabase
      .from('clientes')
      .select('id, nombre, apellido, documento, fecha_ingreso')
      .ilike('documento', `%${term}%`)
      .order('apellido')
      .limit(50)

    if (err) {
      setError(err.message)
      setClientes([])
    } else {
      setClientes(data ?? [])
    }

    setLoading(false)
  }, [busquedaDebounced])

  // Disparar búsqueda automática al cambiar el término debounced
  useEffect(() => { buscar() }, [buscar])

  return { clientes, loading, error, busqueda, setBusqueda, buscar }
}