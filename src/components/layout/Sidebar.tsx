import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Users, GitMerge, UserPlus, Settings, LogOut, Menu, X, Upload, ListFilter } from 'lucide-react'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/dashboard', icon: <LayoutDashboard size={20} />, label: 'Dashboard', roles: ['admin', 'lider'] },
  { to: '/dashboard/coordenador', icon: <LayoutDashboard size={20} />, label: 'Dashboard', roles: ['coordenador'] },
  { to: '/pipeline', icon: <GitMerge size={20} />, label: 'Pipeline', roles: ['admin', 'lider', 'coordenador'] },
  { to: '/meus-contatos', icon: <Users size={20} />, label: 'Meus Contatos', roles: ['voluntario'] },
  { to: '/cadastro', icon: <UserPlus size={20} />, label: 'Novo Cadastro', roles: ['admin', 'lider', 'coordenador', 'voluntario', 'linha_de_frente'] },
  { to: '/equipe', icon: <Users size={20} />, label: 'Minha Equipe', roles: ['coordenador', 'admin', 'lider'] },
  { to: '/gestao/leads', icon: <ListFilter size={20} />, label: 'Gestão de Leads', roles: ['admin', 'lider', 'coordenador'] },
  { to: '/importacao', icon: <Upload size={20} />, label: 'Importar', roles: ['admin', 'lider', 'coordenador'] },
  { to: '/usuarios', icon: <Settings size={20} />, label: 'Usuários', roles: ['admin', 'coordenador'] },
]

export function Sidebar() {
  const { profile, signOut, nivel, isAdmin, isCoordenador, isVoluntario } = useAuth()
  const [open, setOpen] = useState(false)

  const { data: pendentesCount } = useQuery({
    queryKey: ['pendentes-count', profile?.id],
    queryFn: async () => {
      let query = supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'pendente')
      if (isCoordenador && !isAdmin) {
        query = query.eq('grupo', profile?.grupo ?? '').eq('nivel', 'linha_de_frente')
      }
      const { count } = await query
      return count ?? 0
    },
    enabled: isAdmin || isCoordenador,
    refetchInterval: 60000,
  })

  const { data: slaUrgentesCount } = useQuery({
    queryKey: ['sla-urgentes-count', profile?.id, nivel],
    queryFn: async () => {
      let q = supabase.from('contacts').select('id,updated_at,fase_pipeline,voluntario_atribuido_id,grupo', { count: 'exact' })
        .eq('status', 'ativo')
        .in('fase_pipeline', ['CONTATO_INICIAL', 'QUALIFICACAO', 'AULAS', 'POS_AULA'])
      if (nivel === 'voluntario') q = q.eq('voluntario_atribuido_id', profile?.id ?? '')
      else if ((nivel === 'coordenador' || nivel === 'lider') && profile?.grupo) q = q.eq('grupo', profile.grupo)
      const { data } = await q
      if (!data) return 0
      const { calcularSLAFase } = await import('@/lib/pipeline')
      return data.filter(c => calcularSLAFase(c as any) === 'over').length
    },
    enabled: !!profile && (isAdmin || isCoordenador || nivel === 'lider' || isVoluntario),
    refetchInterval: 5 * 60 * 1000,
  })

  const { data: novosCadastrosCount } = useQuery({
    queryKey: ['novos-cadastros-count', profile?.id],
    queryFn: async () => {
      let query = supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('status', 'pendente_aprovacao')
      if (isCoordenador && !isAdmin && profile?.grupo) {
        query = query.eq('grupo', profile.grupo)
      }
      const { count } = await query
      return count ?? 0
    },
    enabled: isAdmin || isCoordenador || nivel === 'lider',
    refetchInterval: 60000,
  })

  const visible = navItems.filter(i => nivel && i.roles.includes(nivel))

  const content = (
    <div className="flex flex-col h-full">
      <div className="px-6 py-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-menta-light to-menta-dark flex items-center justify-center flex-shrink-0">
            <span className="text-petroleo font-bold text-sm">Z</span>
          </div>
          <div>
            <p className="font-semibold text-sm text-offwhite">CRM Jornada</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Zion Church</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visible.map(item => (
          <NavLink key={item.to} to={item.to} onClick={() => setOpen(false)}
            className={({ isActive }) => cn('flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
              isActive ? 'bg-menta-light/15 text-menta-light' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}>
            {item.icon}
            <span className="flex-1">{item.label}</span>
            {item.to === '/usuarios' && !!pendentesCount && (
              <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {pendentesCount}
              </span>
            )}
            {(item.to === '/pipeline' || item.to === '/meus-contatos') && !!slaUrgentesCount && (
              <span className="bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {slaUrgentesCount > 9 ? '9+' : slaUrgentesCount}
              </span>
            )}
            {item.to === '/gestao/leads' && !!novosCadastrosCount && (
              <span className="bg-orange-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                {novosCadastrosCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="px-3 py-4 border-t border-border">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="w-8 h-8 rounded-full bg-menta-dark flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-semibold text-menta-light">{profile?.nome.charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-offwhite truncate">{profile?.nome}</p>
            <p className="text-[11px] text-muted-foreground truncate">{profile?.email}</p>
          </div>
        </div>
        <button onClick={signOut} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:text-red-400 hover:bg-red-400/5 rounded-lg transition-all">
          <LogOut size={16} />Sair
        </button>
      </div>
    </div>
  )

  return (
    <>
      <button className="fixed top-4 left-4 z-50 lg:hidden bg-card border border-border rounded-lg p-2" onClick={() => setOpen(!open)}>
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>
      {open && <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={cn('fixed left-0 top-0 h-full w-64 bg-card border-r border-border z-40 transition-transform duration-300 lg:translate-x-0', open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0')}>
        {content}
      </aside>
    </>
  )
}
