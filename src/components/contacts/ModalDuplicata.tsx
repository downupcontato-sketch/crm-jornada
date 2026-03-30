import { AlertTriangle, ExternalLink, GitMerge, UserCheck, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn, getTipoLabel, getStatusColor, formatPhone } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { ResultadoDedup } from '@/lib/distribuicao'

interface ModalDuplicataProps {
  resultado: ResultadoDedup
  onForceCriacao: () => void
  onMesclar: (leadExistenteId: string) => void
  onCancelar: () => void
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score === 100 ? 'bg-red-500/15 text-red-400 border-red-400/30' :
    score >= 90   ? 'bg-orange-500/15 text-orange-400 border-orange-400/30' :
                    'bg-yellow-500/15 text-yellow-400 border-yellow-400/30'

  const label =
    score === 100 ? 'Idêntico' :
    score >= 90   ? 'Muito similar' :
                    'Possível duplicata'

  return (
    <span className={cn('text-xs px-2.5 py-1 rounded-full border font-semibold', color)}>
      {label} ({score}%)
    </span>
  )
}

export function ModalDuplicata({
  resultado,
  onForceCriacao,
  onMesclar,
  onCancelar,
}: ModalDuplicataProps) {
  const lead = resultado.leadExistente!
  const score = resultado.score ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0">
      <div className="absolute inset-0 bg-black/75" onClick={onCancelar} />

      <div className="relative bg-card border border-border rounded-2xl w-full max-w-md p-5 animate-fade-in">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-yellow-400/15 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={18} className="text-yellow-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-offwhite">Possível Duplicata</h2>
              <p className="text-xs text-muted-foreground">Já existe um registro similar</p>
            </div>
          </div>
          <button onClick={onCancelar} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        {/* Lead existente */}
        <div className="bg-muted/50 border border-border rounded-xl p-4 mb-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-sm font-semibold text-offwhite">{lead.nome}</p>
              <p className="text-xs text-muted-foreground">{formatPhone(lead.telefone)}</p>
            </div>
            <ScoreBadge score={score} />
          </div>

          <div className="flex flex-wrap gap-2 mt-2">
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', getStatusColor(lead.status))}>
              {lead.status}
            </span>
            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
              Etapa {lead.etapa_atual}
            </span>
            {lead.voluntario && (
              <span className="text-xs bg-menta-dark/30 text-menta-light px-2 py-0.5 rounded-full">
                {lead.voluntario}
              </span>
            )}
          </div>

          <p className="text-xs text-muted-foreground/60 mt-2.5">
            Cadastrado {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true, locale: ptBR })}
          </p>

          <Link
            to={`/contato/${lead.id}`}
            target="_blank"
            className="flex items-center gap-1 text-xs text-menta-light hover:underline mt-2"
          >
            <ExternalLink size={11} />
            Ver cadastro completo
          </Link>
        </div>

        {/* Ações */}
        <p className="text-xs text-muted-foreground mb-3">O que deseja fazer?</p>

        <div className="space-y-2">
          {/* Opção 1: Usar o existente */}
          <button
            onClick={onCancelar}
            className="w-full flex items-center gap-3 p-3 rounded-xl border border-menta-dark/40 bg-menta-dark/10 hover:bg-menta-dark/20 text-left transition-all group"
          >
            <UserCheck size={18} className="text-menta-light flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-offwhite group-hover:text-menta-light transition-colors">
                Usar o registro existente
              </p>
              <p className="text-xs text-muted-foreground">Abrir o cadastro já existente</p>
            </div>
          </button>

          {/* Opção 2: Mesclar */}
          <button
            onClick={() => onMesclar(lead.id)}
            className="w-full flex items-center gap-3 p-3 rounded-xl border border-blue-400/30 bg-blue-400/5 hover:bg-blue-400/10 text-left transition-all group"
          >
            <GitMerge size={18} className="text-blue-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-offwhite group-hover:text-blue-400 transition-colors">
                Mesclar com o existente
              </p>
              <p className="text-xs text-muted-foreground">Unifica os dados e arquiva a duplicata</p>
            </div>
          </button>

          {/* Opção 3: Criar mesmo assim */}
          <button
            onClick={onForceCriacao}
            className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:border-muted text-left transition-all group"
          >
            <AlertTriangle size={18} className="text-yellow-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-muted-foreground group-hover:text-offwhite transition-colors">
                Criar mesmo assim
              </p>
              <p className="text-xs text-muted-foreground">Registros serão marcados como possíveis duplicatas</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
