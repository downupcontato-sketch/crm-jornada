import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Users, GitMerge, UserPlus, Settings, LogOut, Menu, X, Upload, ListFilter, BarChart2 } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useBadges } from '@/hooks/useBadges'
import { cn } from '@/lib/utils'
import { NotificacoesDropdown } from './NotificacoesDropdown'

const navItems = [
  { to: '/dashboard',           icon: <LayoutDashboard size={20} />, label: 'Dashboard',      roles: ['admin', 'lider'] },
  { to: '/dashboard/coordenador', icon: <LayoutDashboard size={20} />, label: 'Dashboard',    roles: ['coordenador'] },
  { to: '/pipeline',            icon: <GitMerge size={20} />,        label: 'Pipeline',       roles: ['admin', 'lider', 'coordenador'] },
  { to: '/meus-contatos',       icon: <Users size={20} />,           label: 'Meus Contatos',  roles: ['voluntario'] },
  { to: '/cadastro',            icon: <UserPlus size={20} />,        label: 'Novo Cadastro',  roles: ['admin', 'lider', 'coordenador', 'voluntario', 'linha_de_frente'] },
  { to: '/equipe',              icon: <Users size={20} />,           label: 'Minha Equipe',   roles: ['coordenador', 'admin', 'lider'] },
  { to: '/gestao/leads',        icon: <ListFilter size={20} />,      label: 'Gestão de Leads',roles: ['admin', 'lider', 'coordenador'] },
  { to: '/importacao',          icon: <Upload size={20} />,          label: 'Importar',       roles: ['admin', 'lider', 'coordenador'] },
  { to: '/usuarios',            icon: <Settings size={20} />,        label: 'Usuários',       roles: ['admin', 'coordenador'] },
  { to: '/relatorios',          icon: <BarChart2 size={20} />,       label: 'Relatórios',     roles: ['admin', 'lider'] },
]

export function Sidebar() {
  const { profile, signOut, nivel, isAdmin, isCoordenador } = useAuth()
  const [open, setOpen] = useState(false)
  const { badges, realtimeStatus } = useBadges()

  const visible = navItems.filter(i => nivel && i.roles.includes(nivel))

  // Status da conexão Realtime
  const rtDot = {
    connecting: 'bg-yellow-400',
    connected:  'bg-menta-light animate-pulse',
    error:      'bg-red-400',
  }[realtimeStatus]

  const rtLabel = {
    connecting: 'Conectando...',
    connected:  'Tempo real ativo',
    error:      'Sem conexão',
  }[realtimeStatus]

  const content = (
    <div className="flex flex-col h-full">
      {/* Header da sidebar */}
      <div className="px-4 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-menta-light to-menta-dark flex items-center justify-center flex-shrink-0">
            <span className="text-petroleo font-bold text-sm">Z</span>
          </div>
          <div>
            <p className="font-semibold text-sm text-offwhite">CRM Jornada</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Zion Church</p>
          </div>
        </div>
        <NotificacoesDropdown />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visible.map(item => (
          <NavLink key={item.to} to={item.to} onClick={() => setOpen(false)}
            className={({ isActive }) => cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
              isActive ? 'bg-menta-light/15 text-menta-light' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}>
            {item.icon}
            <span className="flex-1">{item.label}</span>

            {/* Badge: usuários pendentes */}
            {item.to === '/usuarios' && (isAdmin || isCoordenador) && badges.usuariosPendentes > 0 && (
              <Badge count={badges.usuariosPendentes} color="bg-red-500" />
            )}

            {/* Badge: SLA vencidos */}
            {(item.to === '/pipeline' || item.to === '/meus-contatos') && badges.slaVencidos > 0 && (
              <Badge count={badges.slaVencidos} color="bg-red-500" />
            )}

            {/* Badge: novos cadastros */}
            {item.to === '/gestao/leads' && badges.novosCadastros > 0 && (
              <Badge count={badges.novosCadastros} color="bg-orange-500" />
            )}
          </NavLink>
        ))}
      </nav>

      {/* Rodapé */}
      <div className="px-3 pb-3 border-t border-border pt-3 space-y-1">
        {/* Indicador Realtime */}
        <div className="flex items-center gap-1.5 px-3 py-1">
          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${rtDot}`} />
          <span className="text-[10px] text-muted-foreground">{rtLabel}</span>
        </div>

        {/* Usuário */}
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-menta-dark flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-semibold text-menta-light">{profile?.nome.charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-offwhite truncate">{profile?.nome}</p>
            <p className="text-[11px] text-muted-foreground truncate">{profile?.email}</p>
          </div>
        </div>
        <button onClick={signOut}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:text-red-400 hover:bg-red-400/5 rounded-lg transition-all">
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

function Badge({ count, color }: { count: number; color: string }) {
  return (
    <span className={`${color} text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1`}>
      {count > 9 ? '9+' : count}
    </span>
  )
}
