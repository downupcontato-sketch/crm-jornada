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
}

type HistoricoRow = LeadHistorico & { profiles: { nome: string } | null }

export function HistoricoTentativas({ contactId }: { contactId: string }) {
  const { data: historico = [], isLoading } = useQuery({
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

  if (isLoading) {
    return <div className="flex items-center justify-center py-6"><div className="w-5 h-5 border-2 border-menta-light border-t-transparent rounded-full animate-spin" /></div>
  }

  if (!historico.length) {
    return <p className="text-xs text-muted-foreground/50 text-center py-4">Nenhum registro ainda.</p>
  }

  return (
    <div className="space-y-0">
      {historico.map((h, i) => {
        const meta = TIPO_META[h.tipo] ?? { label: h.tipo, cor: 'text-muted-foreground', dot: 'bg-muted-foreground/40' }
        const isLast = i === historico.length - 1
        return (
          <div key={h.id} className="flex gap-3">
            {/* Timeline connector */}
            <div className="flex flex-col items-center flex-shrink-0">
              <div className={cn('w-2 h-2 rounded-full mt-1.5 flex-shrink-0', meta.dot)} />
              {!isLast && <div className="w-px flex-1 bg-border/40 my-1" />}
            </div>
            {/* Content */}
            <div className={cn('flex-1 pb-3 min-w-0', isLast && 'pb-0')}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn('text-[11px] font-semibold', meta.cor)}>{meta.label}</span>
                <span className="text-[10px] text-muted-foreground/60">
                  {format(new Date(h.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                </span>
                {h.profiles?.nome && (
                  <span className="text-[10px] text-muted-foreground/50">· {h.profiles.nome.split(' ')[0]}</span>
                )}
              </div>
              {h.descricao && (
                <p className="text-xs text-muted-foreground mt-0.5">{h.descricao}</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
