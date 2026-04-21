import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { supabase } from '../supabase'

const AuthContext = createContext(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)   // sesión inicial
  const [authLoading, setAuthLoading] = useState(false) // login / logout actions

  // Evitar fetchProfile duplicados cuando onAuthStateChange dispara
  // inmediatamente después de getSession
  const profileFetchedFor = useRef(null)

  // ─────────────────────────────────────────────
  // Fetch de perfil — con timeout de seguridad
  // ─────────────────────────────────────────────
  const fetchProfile = useCallback(async (userId) => {
    if (profileFetchedFor.current === userId) return // ya lo tenemos
    profileFetchedFor.current = userId

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, role, cliente_id, documento')
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        console.error('[AuthContext] fetchProfile error:', error.message)
        setProfile(null)
        return
      }
      setProfile(data ?? null)
    } catch (err) {
      console.error('[AuthContext] fetchProfile unexpected:', err)
      setProfile(null)
    }
  }, [])

  // ─────────────────────────────────────────────
  // Inicialización — getSession + listener
  // ─────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!isMounted) return

        const currentUser = session?.user ?? null
        setUser(currentUser)

        if (currentUser) {
          // No bloqueamos el loading esperando el perfil
          fetchProfile(currentUser.id)
        }
      } catch (err) {
        console.error('[AuthContext] init error:', err)
      } finally {
        // CRÍTICO: siempre desbloquear loading, sin importar qué pasó
        if (isMounted) setLoading(false)
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!isMounted) return
        const currentUser = session?.user ?? null
        setUser(currentUser)

        if (currentUser) {
          fetchProfile(currentUser.id)
        } else {
          profileFetchedFor.current = null
          setProfile(null)
        }
      }
    )

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [fetchProfile])

  // ─────────────────────────────────────────────
  // Acciones de autenticación
  // ─────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    setAuthLoading(true)
    profileFetchedFor.current = null // resetear cache al hacer login nuevo
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      // onAuthStateChange se encarga de setUser + fetchProfile
      return { success: true }
    } catch (err) {
      console.error('[AuthContext] login error:', err.message)
      return { success: false, error: err.message }
    } finally {
      setAuthLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    setAuthLoading(true)
    profileFetchedFor.current = null
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setAuthLoading(false)
  }, [])

  // Registro básico — el admin normalmente crea usuarios desde el dashboard de Supabase
  const register = useCallback(async (email, password) => {
    setAuthLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) throw error

      // Crear perfil base (role: 'user')
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([{ id: data.user.id, email, role: 'user' }])

      if (profileError) {
        console.error('[AuthContext] register — profile insert error:', profileError.message)
        // No bloqueamos el flujo; el perfil se puede crear después
      }

      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    } finally {
      setAuthLoading(false)
    }
  }, [])

  // ─────────────────────────────────────────────
  // Helpers de rol
  // ─────────────────────────────────────────────
  const role = (profile?.role ?? 'user').toLowerCase()
  const isAdmin = role === 'admin'
  const isUser  = role === 'user'

  const value = useMemo(() => ({
    user,
    profile,
    loading,
    authLoading,
    role,
    isAdmin,
    isUser,
    login,
    logout,
    register,
  }), [user, profile, loading, authLoading, role, isAdmin, isUser, login, logout, register])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}