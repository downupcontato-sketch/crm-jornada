import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { UserPlus, LogOut } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

export default function Culto() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  const { data: visitantesHoje, isLoading } = useQuery({
    queryKey: ['visitantes-hoje'],
    queryFn: async () => {
      const hoje = new Date()
      hoje.setHours(0, 0, 0, 0)
      const { count, error } = await supabase
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', hoje.toISOString())
      if (error) throw error
      return count ?? 0
    },
    refetchInterval: 30000,
  })

  return (
    <div className="min-h-screen bg-petroleo flex flex-col items-center justify-between px-4 py-10">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-menta-dark/10 blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />

      {/* Top: Logo */}
      <div className="flex flex-col items-center gap-3 relative">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-menta-light to-menta-dark flex items-center justify-center shadow-lg">
          <span className="text-petroleo font-bold text-2xl">Z</span>
        </div>
        <p className="text-muted-foreground text-sm tracking-widest uppercase">Zion Church</p>
      </div>

      {/* Center: Title + Card + Button */}
      <div className="flex flex-col items-center gap-6 w-full max-w-sm relative">
        <h1 className="text-3xl font-bold text-menta-light text-center">Linha de Frente</h1>

        {/* Counter card */}
        <div className="zion-card w-full text-center py-8">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Visitantes registrados hoje
          </p>
          {isLoading ? (
            <div className="flex justify-center">
              <div className="w-8 h-8 border-2 border-menta-light border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <p className="text-6xl font-bold text-menta-light">{visitantesHoje}</p>
          )}
        </div>

        {/* CTA Button */}
        <button
          onClick={() => navigate('/cadastro')}
          className="zion-btn-primary w-full flex items-center justify-center gap-2 text-base py-4"
        >
          <UserPlus size={20} />
          + Registrar Visitante
        </button>
      </div>

      {/* Footer: user info + logout */}
      <div className="flex flex-col items-center gap-3 relative">
        {profile && (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-menta-dark flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-semibold text-menta-light">
                {profile.nome.charAt(0).toUpperCase()}
              </span>
            </div>
            <p className="text-sm font-medium text-offwhite">{profile.nome}</p>
          </div>
        )}
        <button
          onClick={signOut}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-red-400 transition-colors px-3 py-2 rounded-lg hover:bg-red-400/5"
        >
          <LogOut size={16} />
          Sair
        </button>
      </div>
    </div>
  )
}
