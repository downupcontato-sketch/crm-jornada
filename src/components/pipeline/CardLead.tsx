import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn, getTipoBadgeColor, getTipoLabel } from '@/lib/utils'
import { calcularSLAFase, slaBordaCor, slaTextoCor, SUBETAPA_LABELS } from '@/lib/pipeline'
import type { Contact } from '@/types/database'

interface Props {
  contact: Contact
  onClick: (c: Contact) => void
}

export function CardLead({ contact: c, onClick }: Props) {
  const sla = calcularSLAFase(c)
  const sub = c.subetapa_contato ?? c.subetapa_qualificacao ?? c.subetapa_encaminhamento ?? c.subetapa_batismo
  const horasStr = formatDistanceToNow(new Date(c.updated_at), { locale: ptBR, addSuffix: false })

  return (
    <div
      onClick={() => onClick(c)}
      className={cn(
        'bg-card border border-border border-l-4 rounded-lg p-3 cursor-pointer hover:border-menta-light/40 transition-all group',
        slaBordaCor(sla)
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-sm font-medium text-offwhite truncate flex-1">{c.nome}</p>
        <span className={cn('text-[10px] font-mono flex-shrink-0', slaTextoCor(sla))}>
          {horasStr}
          {sla === 'over' && ' ⚠'}
        </span>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', getTipoBadgeColor(c.tipo))}>
          {getTipoLabel(c.tipo)}
        </span>
        {sub && (
          <span className="text-[10px] text-muted-foreground">
            {SUBETAPA_LABELS[sub] ?? sub}
          </span>
        )}
      </div>
      {c.voluntario_atribuido_id && (
        <p className="text-[10px] text-muted-foreground/60 mt-1 truncate">vol. atribuído</p>
      )}
    </div>
  )
}
