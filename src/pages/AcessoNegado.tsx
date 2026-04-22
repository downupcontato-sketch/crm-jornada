import { useNavigate } from 'react-router-dom'
import { ShieldOff } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

const NIVEL_LABEL: Record<string, string> = {
  admin:          'Administrador',
  lider:          'Líder',
  coordenador:    'Coordenador',
  linha_de_frente:'Linha de Frente',
  voluntario:     'Voluntário',
}

function getRedirectPath(nivel: string | null, status: string | undefined): string {
  if (status === 'pendente') return '/aguardando-aprovacao'
  if (nivel === 'admin' || nivel === 'lider') return '/dashboard'
  if (nivel === 'coordenador') return '/pipeline'
  if (nivel === 'voluntario') return '/meus-contatos'
  if (nivel === 'linha_de_frente') return '/culto'
  return '/login'
}

export default function AcessoNegado() {
  const { profile, nivel } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-petroleo flex items-center justify-center px-4">
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-menta-dark/10 blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      <div className="w-full max-w-sm text-center relative">
        <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
          <ShieldOff size={28} className="text-red-400" />
        </div>
        <h1 className="text-2xl font-semibold text-offwhite mb-2">Acesso Negado</h1>
        <p className="text-muted-foreground text-sm mb-6">
          Você não tem permissão para acessar esta página.
        </p>

        {profile && (
          <div className="bg-card border border-border rounded-lg p-4 mb-6 text-left space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Usuário</span>
              <span className="text-offwhite">{profile.nome}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Email</span>
              <span className="text-offwhite truncate ml-4">{profile.email}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Nível</span>
              <span className="text-menta-light font-medium">
                {NIVEL_LABEL[nivel ?? ''] ?? nivel ?? '—'}
              </span>
            </div>
          </div>
        )}

        <button
          onClick={() => navigate(getRedirectPath(nivel, profile?.status), { replace: true })}
          className="zion-btn-primary w-full"
        >
          Ir para minha área
        </button>
      </div>
    </div>
  )
}
