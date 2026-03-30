import { cn, getTipoBadgeColor, getTipoLabel } from '@/lib/utils'
import { calcularSLAFase, slaBordaCor, calcularFrequencia } from '@/lib/pipeline'
import type { Contact } from '@/types/database'

interface Props {
  contact: Contact
  onClick: (c: Contact) => void
  onAulaClick: (c: Contact, aula: 1|2|3|4) => void
}

export function CardAulas({ contact: c, onClick, onAulaClick }: Props) {
  const sla = calcularSLAFase(c)
  const { presentes, total, atingiuMinimo } = calcularFrequencia(c)
  const aulas = [
    { n: 1 as const, tipo: 'P', presenca: c.presenca_aula1 },
    { n: 2 as const, tipo: 'Z', presenca: c.presenca_aula2 },
    { n: 3 as const, tipo: 'Z', presenca: c.presenca_aula3 },
    { n: 4 as const, tipo: 'Z', presenca: c.presenca_aula4 },
  ]
  const proxima = aulas.find(a => a.presenca === null)

  return (
    <div
      onClick={() => onClick(c)}
      className={cn(
        'bg-card border border-border border-l-4 rounded-lg p-3 cursor-pointer hover:border-menta-light/40 transition-all',
        slaBordaCor(sla)
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-medium text-offwhite truncate flex-1">{c.nome}</p>
        <span className={cn(
          'text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0',
          total > 0
            ? atingiuMinimo ? 'bg-emerald-500/20 text-emerald-400'
              : presentes <= 1 ? 'bg-red-500/20 text-red-400'
              : 'bg-yellow-500/20 text-yellow-400'
            : 'bg-muted text-muted-foreground'
        )}>
          {presentes}/{total > 0 ? total : 4}
        </span>
      </div>

      {/* Bolinhas de presença */}
      <div className="flex gap-1.5 mb-2">
        {aulas.map(a => (
          <button
            key={a.n}
            onClick={e => { e.stopPropagation(); onAulaClick(c, a.n) }}
            title={`Aula ${a.n} (${a.tipo === 'P' ? 'Presencial' : 'Zoom'}) — clique para registrar`}
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all hover:scale-110',
              a.presenca === true  && 'bg-emerald-500/20 border-emerald-500 text-emerald-400',
              a.presenca === false && 'bg-red-500/20 border-red-500 text-red-400',
              a.presenca === null && a.n === proxima?.n && 'bg-menta-light/10 border-menta-light text-menta-light animate-pulse',
              a.presenca === null && a.n !== proxima?.n && 'bg-muted/30 border-border text-muted-foreground',
            )}
          >
            {a.presenca === true ? '✓' : a.presenca === false ? '✗' : a.tipo}
          </button>
        ))}
      </div>

      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', getTipoBadgeColor(c.tipo))}>
        {getTipoLabel(c.tipo)}
      </span>
    </div>
  )
}
