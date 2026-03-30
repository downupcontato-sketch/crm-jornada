import { Phone, Clock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn, formatRelativeTime, getGrupoLabel, getTipoLabel, getTipoBadgeColor, formatPhone } from '@/lib/utils'
import { BadgeSLA } from './BadgeSLA'
import type { Contact } from '@/types/database'

interface ContactCardProps {
  contact: Contact & { pipeline_stages?: { nome: string } }
  compact?: boolean
}

export function ContactCard({ contact, compact }: ContactCardProps) {
  return (
    <Link
      to={`/contato/${contact.id}`}
      className="block zion-card hover:border-menta-dark/50 transition-all group"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-offwhite text-sm truncate group-hover:text-menta-light transition-colors">
            {contact.nome}
          </h3>
          <div className="flex items-center gap-1 mt-0.5">
            <Phone size={11} className="text-muted-foreground flex-shrink-0" />
            <span className="text-xs text-muted-foreground">{formatPhone(contact.telefone)}</span>
          </div>
        </div>
        <BadgeSLA
          dataDistribuicao={contact.data_distribuicao}
          dataPrimeiroContato={contact.data_primeiro_contato}
          compact
        />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', getTipoBadgeColor(contact.tipo))}>
          {getTipoLabel(contact.tipo)}
        </span>
        <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
          {getGrupoLabel(contact.grupo)}
        </span>
        {contact.posicao_fila != null && (
          <span className="text-xs bg-yellow-400/10 text-yellow-400 px-2 py-0.5 rounded-full border border-yellow-400/20">
            Fila #{contact.posicao_fila}
          </span>
        )}
      </div>

      {!compact && (
        <div className="mt-2.5 pt-2.5 border-t border-border/50 flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock size={11} />
            <span>{formatRelativeTime(contact.updated_at)}</span>
          </div>
          {contact.pipeline_stages && (
            <span className="text-xs text-muted-foreground truncate max-w-[140px]">
              {contact.pipeline_stages.nome}
            </span>
          )}
        </div>
      )}
    </Link>
  )
}
