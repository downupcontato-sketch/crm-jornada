import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { cn, getGrupoLabel } from '@/lib/utils'
import { calcularSLAFase, FASE_LABELS } from '@/lib/pipeline'
import { CardFaseExecutivo } from './CardFaseExecutivo'
import { DrillDownPanel } from './DrillDownPanel'
import { DrawerLead } from './DrawerLead'
import type { Contact, ContactGrupo, FasePipeline } from '@/types/database'

const FASES_ATIVAS: FasePipeline[] = ['CONTATO_INICIAL', 'QUALIFICACAO', 'AULAS', 'POS_AULA']
const GRUPOS: ContactGrupo[] = ['rise', 'flow', 'vox', 'ek', 'zion_geral']

export function PipelineExecutivo() {
  const { profile, canSeeAllContacts } = useAuth()
  const qc = useQueryClient()
  const [grupoFiltro, setGrupoFiltro] = useState<ContactGrupo | 'todos'>('todos')
  const [drillFase, setDrillFase] = useState<FasePipeline | null>(null)
  const [drawerContact, setDrawerContact] = useState<Contact | null>(null)

  const { data: contacts = [], isLoading, error } = useQuery({
    queryKey: ['pipeline-exec', grupoFiltro],
    queryFn: async () => {
      let q = supabase.from('contacts').select('*')
        .in('fase_pipeline', FASES_ATIVAS)
        .order('updated_at', { ascending: true })
      if (grupoFiltro !== 'todos') q = q.eq('grupo', grupoFiltro)
      else if (!canSeeAllContacts && profile?.grupo) q = q.eq('grupo', profile.grupo)
      const { data, error } = await q
      if (error) throw error
      return data as Contact[]
    },
  })

  function handleUpdated(id: string, upd: Partial<Contact>) {
    qc.setQueryData(['pipeline-exec', grupoFiltro], (old: Contact[] | undefined) =>
      old?.map(c => c.id === id ? { ...c, ...upd } : c) ?? []
    )
    if (drawerContact?.id === id) setDrawerContact(c => c ? { ...c, ...upd } : c)
  }

  const porFase = FASES_ATIVAS.reduce((acc, f) => {
    acc[f] = contacts.filter(c => c.fase_pipeline === f)
    return acc
  }, {} as Record<FasePipeline, Contact[]>)

  // KPIs globais
  const totalAtivos  = contacts.length
  const totalUrgentes = contacts.filter(c => calcularSLAFase(c) === 'over').length
  const totalAtencao  = contacts.filter(c => calcularSLAFase(c) === 'warn').length
  const batismoAgendado = contacts.filter(c => c.subetapa_batismo === 'BATISMO_AGENDADO').length

  const drillContacts = drillFase ? (porFase[drillFase] ?? []) : []

  return (
    <div>
      {/* Filtro de grupo */}
      {canSeeAllContacts && (
        <div className="flex gap-1.5 flex-wrap mb-5">
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
              active={drillFase === f}
              onClick={() => setDrillFase(drillFase === f ? null : f)}
            />
          ))}
        </div>
      )}

      {/* DrillDown */}
      {drillFase && (
        <DrillDownPanel
          fase={drillFase}
          contacts={drillContacts}
          onClose={() => setDrillFase(null)}
          onCard={c => { setDrawerContact(c); setDrillFase(null) }}
        />
      )}

      {/* DrawerLead */}
      {drawerContact && (
        <DrawerLead
          contact={drawerContact}
          onClose={() => setDrawerContact(null)}
          onUpdated={upd => handleUpdated(drawerContact.id, upd)}
        />
      )}
    </div>
  )
}
