import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { calcularSLAFase, FASE_LABELS } from '@/lib/pipeline'
import type { Contact, FasePipeline } from '@/types/database'

interface Props {
  fase: FasePipeline
  contacts: Contact[]
  active: boolean
  onClick: () => void
}

export function CardFaseExecutivo({ fase, contacts, active, onClick }: Props) {
  const total = contacts.length
  const urgentes = contacts.filter(c => calcularSLAFase(c) === 'over').length
  const atencao  = contacts.filter(c => calcularSLAFase(c) === 'warn').length

  // Stats especiais por fase
  const extras: { label: string; value: number; cor: string }[] = []
  if (fase === 'AULAS') {
    const semPresenca = contacts.filter(c =>
      c.presenca_aula1 === null && c.presenca_aula2 === null
    ).length
    if (semPresenca > 0) extras.push({ label: 'Sem presença', value: semPresenca, cor: 'text-yellow-400' })
  }
  if (fase === 'POS_AULA') {
    const semTrilha = contacts.filter(c => !c.subetapa_batismo && !c.subetapa_encaminhamento).length
    if (semTrilha > 0) extras.push({ label: 'Sem trilha', value: semTrilha, cor: 'text-orange-400' })
    const agendados = contacts.filter(c => c.subetapa_batismo === 'BATISMO_AGENDADO').length
    if (agendados > 0) extras.push({ label: 'Batismo agendado', value: agendados, cor: 'text-menta-light' })
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-4 rounded-xl border transition-all',
        active
          ? 'bg-menta-light/10 border-menta-light/40'
          : 'bg-card border-border hover:border-border/80 hover:bg-card/80',
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <p className={cn('text-sm font-semibold', active ? 'text-menta-light' : 'text-offwhite')}>
          {FASE_LABELS[fase]}
        </p>
        {urgentes > 0 && (
          <div className="flex items-center gap-1 bg-red-500/15 text-red-400 px-1.5 py-0.5 rounded-full">
            <AlertTriangle size={10} />
            <span className="text-[10px] font-bold">{urgentes}</span>
          </div>
        )}
      </div>

      <p className="text-3xl font-bold text-offwhite mb-3">{total}</p>

      <div className="space-y-1">
        {urgentes > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">SLA vencido</span>
            <span className="text-red-400 font-medium">{urgentes}</span>
          </div>
        )}
        {atencao > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Atenção</span>
            <span className="text-yellow-400 font-medium">{atencao}</span>
          </div>
        )}
        {extras.map(e => (
          <div key={e.label} className="flex justify-between text-xs">
            <span className="text-muted-foreground">{e.label}</span>
            <span className={cn('font-medium', e.cor)}>{e.value}</span>
          </div>
        ))}
      </div>
    </button>
  )
}
