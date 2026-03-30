import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile, UserNivel } from '@/types/database'

interface AuthContextValue {
  user: User | null; session: Session | null; profile: Profile | null; loading: boolean; nivel: UserNivel | null
  isAdmin: boolean; isLider: boolean; isCoordenador: boolean; isVoluntario: boolean; isLinhaDeFrente: boolean
  isPendente: boolean
  canSeeAllContacts: boolean; canManageUsers: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchProfile(userId: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (data) setProfile(data as Profile)
  }

  async function refreshProfile() { if (user) await fetchProfile(user.id) }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session); setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id).finally(() => setLoading(false))
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session); setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setProfile(null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const nivel = profile?.nivel ?? null
  return (
    <AuthContext.Provider value={{
      user, session, profile, loading, nivel,
      isAdmin: nivel === 'admin', isLider: nivel === 'lider',
      isCoordenador: nivel === 'coordenador', isVoluntario: nivel === 'voluntario',
      isLinhaDeFrente: nivel === 'linha_de_frente',
      isPendente: profile?.status === 'pendente',
      canSeeAllContacts: nivel === 'admin' || nivel === 'lider',
      canManageUsers: nivel === 'admin',
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return { error }
      },
      signOut: async () => { await supabase.auth.signOut() },
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
