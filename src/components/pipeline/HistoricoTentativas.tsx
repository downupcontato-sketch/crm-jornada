import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import type { LeadHistorico } from '@/types/database'

const TIPO_META: Record<string, { label: string; cor: string; dot: string }> = {
  AVANCO_ETAPA:     { label: 'Avanço',        cor: 'text-menta-light',       dot: 'bg-menta-light' },
  PRESENCA:         { label: 'Presença',       cor: 'text-emerald-400',       dot: 'bg-emerald-400' },
  PERDA:            { label: 'Perda',          cor: 'text-red-400',           dot: 'bg-red-400' },
  REENCAMINHAMENTO: { label: 'Reencaminh.',    cor: 'text-yellow-400',        dot: 'bg-yellow-400' },
  CONTATO:          { label: 'Contato',        cor: 'text-blue-400',          dot: 'bg-blue-400' },
  EDICAO:           { label: 'Edição',         cor: 'text-muted-foreground',  dot: 'bg-muted-foreground' },
  REATRIBUICAO:     { label: 'Reatribuição',   cor: 'text-sky-400',           dot: 'bg-sky-400' },
  REPORTE:          { label: 'Reporte',        cor: 'text-amber-400',         dot: 'bg-amber-400' },
}

type HistoricoRow = LeadHistorico & { profiles: { nome: string } | null }

interface EventoUnificado {
  id: string
  tipo: string
  descricao: string
  autor: string | null
  created_at: string
}

export function HistoricoTentativas({ contactId }: { contactId: string }) {
  const { data: historico = [], isLoading: loadingHist } = useQuery({
    queryKey: ['lead-historico', contactId],
    queryFn: async () => {
      const { data } = await supabase
        .from('lead_historico')
        .select('*,profiles(nome)')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false })
        .limit(30)
      return (data ?? []) as HistoricoRow[]
    },
  })

  const { data: atribuicoes = [], isLoading: loadingAtrib } = useQuery({
    queryKey: ['lead-atribuicoes', contactId],
    queryFn: async () => {
      const { data } = await supabase
        .from('atribuicoes')
        .select('id,tipo,motivo,created_at,voluntario_id,profiles!atribuicoes_voluntario_id_fkey(nome)')
        .eq('contact_id', contactId)
        .in('tipo', ['REDISTRIBUICAO_SLA', 'MANUAL'])
        .order('created_at', { ascending: false })
      return (data ?? []) as {
        id: string; tipo: string; motivo: string | null; created_at: string
        voluntario_id: string; profiles: { nome: string } | null
      }[]
    },
  })

  const isLoading = loadingHist || loadingAtrib

  const eventos: EventoUnificado[] = [
    ...historico.map(h => ({
      id: h.id,
      tipo: h.tipo,
      descricao: h.descricao,
      autor: h.profiles?.nome ?? null,
      created_at: h.created_at,
    })),
    ...atribuicoes.map(a => ({
      id: `atrib-${a.id}`,
      tipo: 'REATRIBUICAO',
      descricao: `Reatribuído para ${a.profiles?.nome ?? 'voluntário'}${a.motivo ? ` — ${a.motivo}` : ''}`,
      autor: null,
      created_at: a.created_at,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  if (isLoading) {
    return <div className="flex items-center justify-center py-6"><div className="w-5 h-5 border-2 border-menta-light border-t-transparent rounded-full animate-spin" /></div>
  }

  if (!eventos.length) {
    return <p className="text-xs text-muted-foreground/50 text-center py-4">Nenhum registro ainda.</p>
  }

  return (
    <div className="space-y-0">
      {eventos.map((ev, i) => {
        const meta = TIPO_META[ev.tipo] ?? { label: ev.tipo, cor: 'text-muted-foreground', dot: 'bg-muted-foreground/40' }
        const isLast = i === eventos.length - 1
        return (
          <div key={ev.id} className="flex gap-3">
            <div className="flex flex-col items-center flex-shrink-0">
              <div className={cn('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', meta.dot)} />
              {!isLast && <div className="w-px flex-1 bg-border/40 my-1" />}
            </div>
            <div className={cn('flex-1 pb-3 min-w-0', isLast && 'pb-0')}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn('text-[11px] font-semibold', meta.cor)}>{meta.label}</span>
                <span className="text-[10px] text-muted-foreground/60">
                  {format(new Date(ev.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                </span>
                {ev.autor && (
                  <span className="text-[10px] text-muted-foreground/50">· {ev.autor.split(' ')[0]}</span>
                )}
              </div>
              {ev.descricao && (
                <p className="text-xs text-muted-foreground mt-0.5">{ev.descricao}</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
