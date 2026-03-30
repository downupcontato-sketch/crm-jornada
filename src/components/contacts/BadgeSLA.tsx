import { cn } from '@/lib/utils'
import { differenceInHours, differenceInDays, differenceInMinutes } from 'date-fns'

interface BadgeSLAProps {
  dataDistribuicao: string | null
  dataPrimeiroContato: string | null
  compact?: boolean
  className?: string
}

function formatTempo(dataDistribuicao: string): string {
  const agora = new Date()
  const desde = new Date(dataDistribuicao)
  const minutos = differenceInMinutes(agora, desde)
  const horas = differenceInHours(agora, desde)
  const dias = differenceInDays(agora, desde)

  if (minutos < 60) return `${minutos}min`
  if (horas < 24) return `${horas}h`
  return `${dias}d`
}

export function BadgeSLA({ dataDistribuicao, dataPrimeiroContato, compact, className }: BadgeSLAProps) {
  // Sem distribuição: não mostrar SLA
  if (!dataDistribuicao) return null

  const horas = differenceInHours(new Date(), new Date(dataDistribuicao))
  const jaContatou = !!dataPrimeiroContato

  // Verde: já contatou OU < 24h
  if (jaContatou || horas < 24) {
    if (compact) return null // no compact mode, only show problems
    return (
      <span className={cn(
        'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium',
        'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20',
        className
      )}>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        {jaContatou ? 'Contatado' : `${formatTempo(dataDistribuicao)}`}
      </span>
    )
  }

  // Amarelo: 24–48h sem contato
  if (horas < 48) {
    return (
      <span className={cn(
        'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium',
        'bg-yellow-400/10 text-yellow-400 border border-yellow-400/20',
        className
      )}>
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
        {compact ? `${formatTempo(dataDistribuicao)} sem contato` : `Atenção: ${formatTempo(dataDistribuicao)} sem contato`}
      </span>
    )
  }

  // Vermelho pulsando: > 48h — SLA vencido
  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium',
      'bg-red-400/10 text-red-400 border border-red-400/20',
      className
    )}>
      <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
      {compact ? 'SLA vencido' : `SLA vencido — ${formatTempo(dataDistribuicao)} sem contato`}
    </span>
  )
}
