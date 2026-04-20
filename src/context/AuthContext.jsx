import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react'
import { supabase } from '../supabase'

const AuthContext = createContext(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }
  return ctx
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)

  const [loading, setLoading] = useState(true)
  const [authLoading, setAuthLoading] = useState(false)

  // 🔹 Obtener perfil desde Supabase
const fetchProfile = useCallback(async (userId) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle() // 🔥 IMPORTANTE

    if (error) throw error

    setProfile(data || null)
  } catch (err) {
    console.error('Error cargando perfil:', err.message)
    setProfile(null)
  }
}, [])

  // 🔹 Inicializar sesión
useEffect(() => {
  let isMounted = true

  const initSession = async () => {
    try {
      const {
        data: { session }
      } = await supabase.auth.getSession()

      const currentUser = session?.user ?? null

      if (!isMounted) return

      setUser(currentUser)

      // 🔥 NO BLOQUEAR EL LOADING
      if (currentUser) {
        fetchProfile(currentUser.id) // SIN await
      }
    } catch (err) {
      console.error('Error inicializando sesión:', err.message)
    } finally {
      if (isMounted) setLoading(false) // 🔥 SIEMPRE SE EJECUTA
    }
  }

  initSession()

  const { data: listener } = supabase.auth.onAuthStateChange(
    async (_event, session) => {
      const currentUser = session?.user ?? null

      setUser(currentUser)

      if (currentUser) {
        fetchProfile(currentUser.id)
      } else {
        setProfile(null)
      }
    }
  )

  return () => {
    isMounted = false
    listener.subscription.unsubscribe()
  }
}, [fetchProfile])

  // 🔹 Login
  const login = useCallback(async (email, password) => {
    setAuthLoading(true)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) throw error

      setUser(data.user)
      await fetchProfile(data.user.id)

      return { success: true }
    } catch (err) {
      console.error('Error login:', err.message)
      return { success: false, error: err.message }
    } finally {
      setAuthLoading(false)
    }
  }, [fetchProfile])

  // 🔹 Registro (IMPORTANTE para tu caso)
  const register = useCallback(async (email, password) => {
    setAuthLoading(true)

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password
      })

      if (error) throw error

      const userId = data.user.id

      // 🔹 Crear perfil automáticamente
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([
          {
            id: userId,
            email,
            role: 'user'
          }
        ])

      if (profileError) throw profileError

      return { success: true }
    } catch (err) {
      console.error('Error register:', err.message)
      return { success: false, error: err.message }
    } finally {
      setAuthLoading(false)
    }
  }, [])

  // 🔹 Logout
  const logout = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }, [])

  // 🔹 Helpers de roles
  const role = (profile?.role || 'user').toLowerCase()

  const isAdmin = role === 'admin'
  const isUser = role === 'user'

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      authLoading,

      role,
      isAdmin,
      isUser,

      login,
      register,
      logout
    }),
    [user, profile, loading, authLoading, role, isAdmin, isUser, login, register, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}