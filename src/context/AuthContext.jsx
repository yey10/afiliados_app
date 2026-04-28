/**
 * AuthContext.jsx
 * - Verifica campo `activo` en profiles antes de permitir login
 * - isAdmin / isAsesor basado en role
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../supabase'

const AuthContext = createContext(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}

export function AuthProvider({ children }) {
  const [user,        setUser]        = useState(null)
  const [profile,     setProfile]     = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [authLoading, setAuthLoading] = useState(false)
  const profileFetchedFor = useRef(null)

  const fetchProfile = useCallback(async (userId) => {
    if (profileFetchedFor.current === userId) return
    profileFetchedFor.current = userId
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, role, nombre, activo, cliente_id, documento')
        .eq('id', userId)
        .maybeSingle()
      if (error) { console.error('[AuthContext] fetchProfile:', error.message); setProfile(null); return }
      setProfile(data ?? null)
    } catch (err) {
      console.error('[AuthContext] fetchProfile unexpected:', err); setProfile(null)
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!isMounted) return
        const currentUser = session?.user ?? null
        setUser(currentUser)
        if (currentUser) fetchProfile(currentUser.id)
      } catch (err) { console.error('[AuthContext] init:', err) }
      finally { if (isMounted) setLoading(false) }
    }
    init()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return
      const currentUser = session?.user ?? null
      setUser(currentUser)
      if (currentUser) fetchProfile(currentUser.id)
      else { profileFetchedFor.current = null; setProfile(null) }
    })
    return () => { isMounted = false; subscription.unsubscribe() }
  }, [fetchProfile])

  const login = useCallback(async (email, password) => {
    setAuthLoading(true)
    profileFetchedFor.current = null
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error

      // Verificar que el usuario esté activo
      const { data: prof } = await supabase
        .from('profiles').select('activo, role').eq('id', data.user.id).maybeSingle()

      if (prof && prof.activo === false) {
        await supabase.auth.signOut()
        return { success: false, error: 'Tu cuenta está desactivada. Contacta al administrador.' }
      }

      return { success: true }
    } catch (err) {
      console.error('[AuthContext] login:', err.message)
      return { success: false, error: err.message }
    } finally { setAuthLoading(false) }
  }, [])

  const logout = useCallback(async () => {
    setAuthLoading(true)
    profileFetchedFor.current = null
    await supabase.auth.signOut()
    setUser(null); setProfile(null); setAuthLoading(false)
  }, [])

  const role     = (profile?.role ?? 'asesor').toLowerCase()
  const isAdmin  = role === 'admin'
  const isAsesor = role === 'asesor' || role === 'user'
  // legacy: isUser sigue funcionando para BusquedaUsuario
  const isUser   = isAsesor

  const value = useMemo(() => ({
    user, profile, loading, authLoading,
    role, isAdmin, isAsesor, isUser,
    login, logout,
  }), [user, profile, loading, authLoading, role, isAdmin, isAsesor, isUser, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
