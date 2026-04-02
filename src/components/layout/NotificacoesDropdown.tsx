import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useBadges } from '@/hooks/useBadges'
import { useAuth } from '@/contexts/AuthContext'

export function NotificacoesDropdown() {
  const [open, setOpen] = useState(false)
  const { nivel, isAdmin, isCoordenador } = useAuth()
  const { badges, totalPendentes } = useBadges()
  const navigate = useNavigate()

  const podeAprovar = isAdmin || isCoordenador

  const notificacoes = [
    podeAprovar && badges.usuariosPendentes > 0 && {
      id: 'usuarios',
      label: `${badges.usuariosPendentes} usuário${badges.usuariosPendentes > 1 ? 's' : ''} aguardando aprovação`,
      href: '/usuarios',
      dot: 'bg-red-500',
    },
    (isAdmin || isCoordenador || nivel === 'lider') && badges.novosCadastros > 0 && {
      id: 'cadastros',
      label: `${badges.novosCadastros} cadastro${badges.novosCadastros > 1 ? 's' : ''} pendente${badges.novosCadastros > 1 ? 's' : ''} de aprovação`,
      href: '/gestao/leads',
      dot: 'bg-orange-500',
    },
    nivel !== 'linha_de_frente' && badges.slaVencidos > 0 && {
      id: 'sla',
      label: `${badges.slaVencidos} contato${badges.slaVencidos > 1 ? 's' : ''} com SLA vencido`,
      href: nivel === 'voluntario' ? '/meus-contatos' : '/pipeline',
      dot: 'bg-red-500',
    },
  ].filter(Boolean) as { id: string; label: string; href: string; dot: string }[]

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
      >
        <Bell size={18} />
        {totalPendentes > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {totalPendentes > 9 ? '9+' : totalPendentes}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-10 w-72 bg-card border border-border rounded-2xl shadow-xl z-40 overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <p className="text-sm font-medium text-offwhite">Notificações</p>
              {totalPendentes > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {totalPendentes > 9 ? '9+' : totalPendentes}
                </span>
              )}
            </div>

            {notificacoes.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-muted-foreground">Tudo em dia</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Nenhuma ação necessária</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {notificacoes.map(n => (
                  <button
                    key={n.id}
                    onClick={() => { setOpen(false); navigate(n.href) }}
                    className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/30 transition-colors text-left"
                  >
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${n.dot}`} />
                    <p className="text-sm text-offwhite leading-snug flex-1">{n.label}</p>
                    <span className="text-muted-foreground text-xs flex-shrink-0">→</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
