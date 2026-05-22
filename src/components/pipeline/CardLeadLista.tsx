import { Phone } from 'lucide-react'
import { cn, getTipoLabel, getTipoBadgeColor } from '@/lib/utils'
import { calcularSLAFase, slaBordaCor, slaTextoCor, formatarSLALabel } from '@/lib/pipeline'
import { SUBETAPA_LABELS } from '@/lib/pipeline'
import type { Contact } from '@/types/database'

const TIPO_AVATAR: Record<string, string> = {
  novo_nascimento: 'bg-menta-light/20 text-menta-light',
  reconciliacao:   'bg-purple-500/20 text-purple-400',
  visitante:       'bg-blue-500/20 text-blue-400',
}

interface Props {
  contact: Contact
  onClick: (c: Contact) => void
  volNome?: string
  isSelected?: boolean
}

export function CardLeadLista({ contact, onClick, volNome, isSelected }: Props) {
  const sla = calcularSLAFase(contact)
  const sub = contact.subetapa_contato ?? contact.subetapa_qualificacao ??
    contact.subetapa_encaminhamento ?? contact.subetapa_batismo
  const avatarCls = TIPO_AVATAR[contact.tipo] ?? 'bg-muted text-muted-foreground'

  return (
    <button
      onClick={() => onClick(contact)}
      className={cn(
        'w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all border-l-2',
        isSelected
          ? 'bg-menta-light/10 border-menta-light/40 border-l-menta-light'
          : cn('bg-card/60 hover:bg-card border-border', slaBordaCor(sla)),
      )}
    >
      {/* Avatar por tipo */}
      <div className={cn('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0', avatarCls)}>
        <span className="text-xs font-bold">
          {contact.nome.charAt(0).toUpperCase()}
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-offwhite truncate">{contact.nome}</p>
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0', getTipoBadgeColor(contact.tipo))}>
            {getTipoLabel(contact.tipo)}
          </span>
          {contact.dado_reportado && (
            <span className="text-[10px] text-amber-400 flex-shrink-0" title="Dado incorreto reportado">⚑</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {sub && (
            <span className="text-[10px] text-muted-foreground">
              {SUBETAPA_LABELS[sub] ?? sub}
            </span>
          )}
          <span className={cn('text-[10px] font-medium', slaTextoCor(sla))}>
            {formatarSLALabel(contact)}
          </span>
          {volNome && (
            <span className="text-[10px] text-muted-foreground/60 ml-auto flex-shrink-0">
              {volNome.split(' ')[0]}
            </span>
          )}
        </div>
      </div>

      {/* WhatsApp rápido */}
      <a
        href={`https://wa.me/55${contact.telefone.replace(/\D/g, '')}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={e => e.stopPropagation()}
        className="w-7 h-7 flex items-center justify-center rounded-full text-emerald-400/60 hover:text-emerald-400 hover:bg-emerald-400/10 transition-all flex-shrink-0"
      >
        <Phone size={13} />
      </a>
    </button>
  )
}
