import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { cn, getGrupoLabel } from '@/lib/utils'
import { calcularSLAFase, FASE_LABELS } from '@/lib/pipeline'
import { FASE_SLUG } from '@/lib/pipelineRoutes'
import { CardFaseExecutivo } from './CardFaseExecutivo'
import type { Contact, ContactGrupo, FasePipeline } from '@/types/database'

const FASES_ATIVAS: FasePipeline[] = ['CONTATO_INICIAL', 'QUALIFICACAO', 'AULAS', 'POS_AULA']
const GRUPOS: ContactGrupo[] = ['rise', 'flow', 'vox', 'ek', 'zion_geral']

export function PipelineExecutivo() {
  const { profile, canSeeAllContacts } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [grupoFiltro, setGrupoFiltro] = useState<ContactGrupo | 'todos'>('todos')
  const [mostrarInativos, setMostrarInativos] = useState(false)

  const { data: contacts = [], isLoading, error } = useQuery({
    queryKey: ['pipeline-exec', grupoFiltro, mostrarInativos],
    queryFn: async () => {
      let q = supabase.from('contacts').select('*')
        .in('fase_pipeline', FASES_ATIVAS)
        .in('status', mostrarInativos ? ['ativo', 'inativo'] : ['ativo'])
        .order('updated_at', { ascending: true })
      if (grupoFiltro !== 'todos') q = q.eq('grupo', grupoFiltro)
      else if (!canSeeAllContacts && profile?.grupo) q = q.eq('grupo', profile.grupo)
      const { data, error } = await q
      if (error) throw error
      return data as Contact[]
    },
  })

  const { data: volMap = {} } = useQuery({
    queryKey: ['vol-map'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id,nome').eq('nivel','voluntario')
      const map: Record<string, string> = {}
      for (const p of data ?? []) map[p.id] = p.nome
      return map
    },
    staleTime: 5 * 60 * 1000,
  })

  const porFase = FASES_ATIVAS.reduce((acc, f) => {
    acc[f] = contacts.filter(c => c.fase_pipeline === f)
    return acc
  }, {} as Record<FasePipeline, Contact[]>)

  // KPIs globais
  const totalAtivos     = contacts.length
  const totalUrgentes   = contacts.filter(c => calcularSLAFase(c) === 'over').length
  const totalAtencao    = contacts.filter(c => calcularSLAFase(c) === 'warn').length
  const batismoAgendado = contacts.filter(c => c.subetapa_batismo === 'BATISMO_AGENDADO').length

  return (
    <div>
      {/* Filtros */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
        {canSeeAllContacts && (
          <div className="flex gap-1.5 flex-wrap">
            {(['todos', ...GRUPOS] as const).map(g => (
              <button key={g} onClick={() => setGrupoFiltro(g)}
                className={cn('text-xs px-3 py-1.5 rounded-lg border transition-all font-medium',
                  grupoFiltro === g
                    ? 'bg-menta-light/15 border-menta-light/40 text-menta-light'
                    : 'border-border text-muted-foreground hover:text-foreground'
                )}>
                {g === 'todos' ? 'Todos' : getGrupoLabel(g)}
              </button>
            ))}
          </div>
        )}
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer ml-auto">
          <input type="checkbox" checked={mostrarInativos} onChange={e => setMostrarInativos(e.target.checked)}
            className="rounded border-border" />
          Mostrar inativos
        </label>
      </div>

      {/* KPI Row */}
      {!isLoading && !error && (
        <div className="grid grid-cols-4 gap-3 mb-5">
          <div className="bg-card border border-border rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-offwhite">{totalAtivos}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Total ativo</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-red-400">{totalUrgentes}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Urgentes</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-yellow-400">{totalAtencao}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Atenção</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-menta-light">{batismoAgendado}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Batismo agend.</p>
          </div>
        </div>
      )}

      {/* Conteúdo */}
      {error ? (
        <div className="text-center py-16 text-red-400 text-sm flex items-center justify-center gap-2">
          <AlertTriangle size={16} /> Erro ao carregar: {(error as Error).message}
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-menta-light border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {FASES_ATIVAS.map(f => (
            <CardFaseExecutivo
              key={f}
              fase={f}
              contacts={porFase[f] ?? []}
              active={false}
              onClick={() => navigate(`/pipeline/${FASE_SLUG[f]}`)}
            />
          ))}
        </div>
      )}

    </div>
  )
}
