import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import { buscarTodos } from '@/lib/queries/buscarTodos'
import { COORDINATOR_CONTACT_FILTER } from '@/lib/queries/filters'
import { COLUNAS_JORNADA, camposParaColunaJornada, colunaJornada } from '@/lib/quadro'
import { QuadroKanban } from './QuadroKanban'
import { PipelineLider } from './PipelineLider'
import type { Contact, ContactStatus, FasePipeline } from '@/types/database'

/** Vidas do quadro, com a mesma regra de visibilidade do pipeline: coordenador vê o próprio grupo, só as distribuídas. */
export function useVidasQuadro(chave: string, fases: FasePipeline[], status?: ContactStatus[], ou?: string) {
  const { profile, canSeeAllContacts } = useAuth()
  const qc = useQueryClient()
  const queryKey = ['quadro', chave, canSeeAllContacts, profile?.grupo]
  const vidas = useQuery({
    queryKey,
    queryFn: () => buscarTodos<Contact>((de, ate) => {
      let q = supabase.from('contacts').select('*').in('fase_pipeline', fases)
      if (status) q = q.in('status', status)
      if (ou) q = q.or(ou)
      if (!canSeeAllContacts) {
        if (profile?.grupo) q = q.eq('grupo', profile.grupo)
        q = q.eq('atribuido_por_coordenador', COORDINATOR_CONTACT_FILTER.atribuido_por_coordenador)
      }
      return q.order('id', { ascending: true }).range(de, ate)
    }),
  })
  const nomes = useQuery({
    queryKey: ['quadro-nomes'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id,nome')
      return Object.fromEntries((data ?? []).map(p => [p.id, p.nome])) as Record<string, string>
    },
    staleTime: 5 * 60 * 1000,
  })
  return { vidas, nomes: nomes.data ?? {}, recarregar: () => qc.invalidateQueries({ queryKey: ['quadro'] }) }
}

export function EstadoQuadro({ isLoading, error }: { isLoading: boolean; error: unknown }) {
  if (error) return (
    <div className="text-center py-16 text-red-400 text-sm flex items-center justify-center gap-2">
      <AlertTriangle size={16} /> Erro ao carregar: {(error as Error).message}
    </div>
  )
  if (isLoading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-8 h-8 border-2 border-menta-light border-t-transparent rounded-full animate-spin" />
    </div>
  )
  return null
}

export function PipelineQuadro() {
  const [visao, setVisao] = useState<'quadro' | 'voluntario'>('quadro')
  const { vidas, nomes, recarregar } = useVidasQuadro('jornada', ['CONTATO_INICIAL', 'QUALIFICACAO', 'AULAS', 'POS_AULA'], ['ativo'])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex bg-card border border-border rounded-lg p-1 self-start">
        {([['quadro', 'Quadro'], ['voluntario', 'Por voluntário']] as const).map(([v, label]) => (
          <button key={v} onClick={() => setVisao(v)} aria-pressed={visao === v}
            className={cn('text-xs font-semibold px-3 py-1.5 rounded-md transition-all',
              visao === v ? 'bg-menta-light text-petroleo' : 'text-muted-foreground hover:text-foreground')}>
            {label}
          </button>
        ))}
      </div>
      {visao === 'voluntario' && <PipelineLider />}
      {visao === 'quadro' && <EstadoQuadro isLoading={vidas.isLoading} error={vidas.error} />}
      {visao === 'quadro' && !vidas.isLoading && !vidas.error && (
        <QuadroKanban colunas={COLUNAS_JORNADA} contacts={vidas.data ?? []} nomes={nomes}
          colunaDe={colunaJornada} campos={camposParaColunaJornada} onAtualizado={recarregar}
          avisoMovimento="As aulas 2, 3 e 4 avançam quando a presença é registrada na ficha da vida." />
      )}
    </div>
  )
}
