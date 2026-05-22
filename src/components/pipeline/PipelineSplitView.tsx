import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Columns2, Maximize2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { cn, getGrupoLabel } from '@/lib/utils'
import { FASE_LABELS } from '@/lib/pipeline'
import { SLUG_FASE, FASE_SLUG } from '@/lib/pipelineRoutes'
import { PipelineLeadList } from './PipelineLeadList'
import { PipelineLeadDetail } from './PipelineLeadDetail'
import type { Contact, ContactGrupo, FasePipeline } from '@/types/database'

const FASES_ATIVAS: FasePipeline[] = ['CONTATO_INICIAL', 'QUALIFICACAO', 'AULAS', 'POS_AULA']
const GRUPOS: ContactGrupo[] = ['rise', 'flow', 'vox', 'ek', 'zion_geral']

export function PipelineSplitView() {
  const { etapa, id } = useParams<{ etapa: string; id: string }>()
  const navigate = useNavigate()
  const { profile, canSeeAllContacts } = useAuth()
  const qc = useQueryClient()

  const fase = etapa ? SLUG_FASE[etapa] : null
  const [splitMode, setSplitMode] = useState<'split' | 'full'>('split')
  const [grupoFiltro, setGrupoFiltro] = useState<ContactGrupo | 'todos'>('todos')
  const [volFiltro, setVolFiltro] = useState<string | null>(null)

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['pipeline-split', fase, grupoFiltro],
    queryFn: async () => {
      if (!fase) return []
      let q = supabase.from('contacts').select('*')
        .eq('fase_pipeline', fase)
        .eq('status', 'ativo')
        .order('updated_at', { ascending: true })
      if (grupoFiltro !== 'todos') q = q.eq('grupo', grupoFiltro)
      else if (!canSeeAllContacts && profile?.grupo) q = q.eq('grupo', profile.grupo)
      const { data, error } = await q
      if (error) throw error
      return data as Contact[]
    },
    enabled: !!fase,
  })

  const { data: volMap = {} } = useQuery({
    queryKey: ['vol-map'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id,nome').eq('nivel', 'voluntario')
      const map: Record<string, string> = {}
      for (const p of data ?? []) map[p.id] = p.nome
      return map
    },
    staleTime: 5 * 60 * 1000,
  })

  const selectedContact = id ? contacts.find(c => c.id === id) ?? null : null

  function handleUpdated(upd: Partial<Contact>) {
    qc.setQueryData(
      ['pipeline-split', fase, grupoFiltro],
      (old: Contact[] | undefined) => old?.map(c => c.id === id ? { ...c, ...upd } : c) ?? [],
    )
  }

  if (!fase || !FASES_ATIVAS.includes(fase)) {
    return (
      <div className="flex items-center justify-center h-60 text-muted-foreground text-sm">
        Etapa não encontrada.
      </div>
    )
  }

  const listHidden = splitMode === 'full' && !!selectedContact

  return (
    <div className="flex flex-col h-full -m-6">

      {/* ── Topbar ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card flex-shrink-0">
        <button onClick={() => navigate('/pipeline')}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={14} /> Pipeline
        </button>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-sm font-medium text-offwhite">{FASE_LABELS[fase]}</span>

        <div className="ml-auto flex items-center gap-2">
          {/* Filtro de grupo — só admin/líder */}
          {canSeeAllContacts && (
            <div className="flex gap-1 overflow-x-auto scrollbar-none">
              {(['todos', ...GRUPOS] as const).map(g => (
                <button key={g} onClick={() => setGrupoFiltro(g)}
                  className={cn(
                    'text-[11px] px-2.5 py-1 rounded-lg border transition-all font-medium flex-shrink-0',
                    grupoFiltro === g
                      ? 'bg-menta-light/15 border-menta-light/40 text-menta-light'
                      : 'border-border text-muted-foreground hover:text-foreground',
                  )}>
                  {g === 'todos' ? 'Todos' : getGrupoLabel(g)}
                </button>
              ))}
            </div>
          )}

          {/* Toggle split / full */}
          {selectedContact && (
            <div className="flex items-center gap-1 bg-muted/30 border border-border rounded-lg p-0.5">
              <button onClick={() => setSplitMode('split')}
                title="Split view"
                className={cn('p-1.5 rounded transition-all', splitMode === 'split' ? 'bg-card text-offwhite' : 'text-muted-foreground hover:text-foreground')}>
                <Columns2 size={14} />
              </button>
              <button onClick={() => setSplitMode('full')}
                title="Página completa"
                className={cn('p-1.5 rounded transition-all', splitMode === 'full' ? 'bg-card text-offwhite' : 'text-muted-foreground hover:text-foreground')}>
                <Maximize2 size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Fase tabs (outras fases) ── */}
      <div className="flex gap-1 px-4 py-2 border-b border-border bg-card/50 overflow-x-auto scrollbar-none flex-shrink-0">
        {FASES_ATIVAS.map(f => (
          <button key={f} onClick={() => navigate(`/pipeline/${FASE_SLUG[f]}`)}
            className={cn(
              'text-xs px-3 py-1.5 rounded-lg font-medium border transition-all flex-shrink-0',
              f === fase
                ? 'bg-menta-light/15 border-menta-light/40 text-menta-light'
                : 'border-border text-muted-foreground hover:text-foreground',
            )}>
            {FASE_LABELS[f]}
          </button>
        ))}
      </div>

      {/* ── Main split area ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Left: lead list */}
        {!listHidden && (
          <div className={cn(
            'border-r border-border flex-shrink-0 overflow-hidden',
            splitMode === 'split' || !selectedContact ? 'w-[300px]' : 'hidden',
          )}>
            <PipelineLeadList
              fase={fase}
              contacts={volFiltro ? contacts.filter(c => c.voluntario_atribuido_id === volFiltro) : contacts}
              isLoading={isLoading}
              volMap={volMap}
              volFiltro={volFiltro}
              onClearVolFiltro={() => setVolFiltro(null)}
            />
          </div>
        )}

        {/* Right: detail */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {selectedContact ? (
            <PipelineLeadDetail
              contact={selectedContact}
              onUpdated={handleUpdated}
              onFullPage={() => setSplitMode(m => m === 'full' ? 'split' : 'full')}
              volNome={selectedContact.voluntario_atribuido_id ? volMap[selectedContact.voluntario_atribuido_id] : undefined}
              onVolClick={volId => setVolFiltro(v => v === volId ? null : volId)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
              <Columns2 size={32} className="opacity-20" />
              <p className="text-sm">Selecione um lead na lista</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
