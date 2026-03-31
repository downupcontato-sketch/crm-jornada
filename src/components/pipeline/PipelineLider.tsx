import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import { calcularSLAFase, FASE_LABELS } from '@/lib/pipeline'
import { DrillDownPanel } from './DrillDownPanel'
import { DrawerLead } from './DrawerLead'
import type { Contact, FasePipeline, Profile } from '@/types/database'

const FASES_ATIVAS: FasePipeline[] = ['CONTATO_INICIAL', 'QUALIFICACAO', 'AULAS', 'POS_AULA']

interface CellSelection { voluntarioId: string | null; fase: FasePipeline }

function slaColor(contacts: Contact[]): string {
  if (!contacts.length) return ''
  if (contacts.some(c => calcularSLAFase(c) === 'over')) return 'text-red-400 bg-red-400/10 border-red-500/30'
  if (contacts.some(c => calcularSLAFase(c) === 'warn')) return 'text-yellow-400 bg-yellow-400/10 border-yellow-500/30'
  return 'text-emerald-400 bg-emerald-400/10 border-emerald-500/30'
}

export function PipelineLider() {
  const { profile, canSeeAllContacts } = useAuth()
  const qc = useQueryClient()
  const [selected, setSelected] = useState<CellSelection | null>(null)
  const [drawerContact, setDrawerContact] = useState<Contact | null>(null)

  const { data: contacts = [], isLoading: loadingContacts, error } = useQuery({
    queryKey: ['pipeline-lider-contacts', profile?.grupo],
    queryFn: async () => {
      let q = supabase.from('contacts').select('*')
        .in('fase_pipeline', FASES_ATIVAS)
        .order('updated_at', { ascending: true })
      if (!canSeeAllContacts && profile?.grupo) q = q.eq('grupo', profile.grupo)
      else if (profile?.grupo) q = q.eq('grupo', profile.grupo)
      const { data, error } = await q
      if (error) throw error
      return data as Contact[]
    },
  })

  const { data: voluntarios = [], isLoading: loadingVols } = useQuery({
    queryKey: ['pipeline-lider-vols', profile?.grupo],
    queryFn: async () => {
      let q = supabase.from('profiles')
        .select('id,nome,nivel,grupo')
        .in('nivel', ['voluntario', 'coordenador'])
        .eq('status', 'ativo')
      if (profile?.grupo) q = q.eq('grupo', profile.grupo)
      const { data } = await q
      return (data ?? []) as Pick<Profile, 'id' | 'nome' | 'nivel' | 'grupo'>[]
    },
    enabled: !!profile,
  })

  const isLoading = loadingContacts || loadingVols

  // Group contacts by voluntario_atribuido_id × fase_pipeline
  const porVolFase = useMemo(() => {
    const map = new Map<string | null, Map<FasePipeline, Contact[]>>()
    // Pre-populate with null (sem atribuição)
    map.set(null, new Map(FASES_ATIVAS.map(f => [f, []])))
    for (const vol of voluntarios) {
      map.set(vol.id, new Map(FASES_ATIVAS.map(f => [f, []])))
    }
    for (const c of contacts) {
      const vid = c.voluntario_atribuido_id
      if (!map.has(vid)) map.set(vid, new Map(FASES_ATIVAS.map(f => [f, []])))
      map.get(vid)!.get(c.fase_pipeline)!.push(c)
    }
    return map
  }, [contacts, voluntarios])

  // KPIs
  const totalAtivos = contacts.length
  const totalUrgentes = contacts.filter(c => calcularSLAFase(c) === 'over').length
  const totalAtencao = contacts.filter(c => calcularSLAFase(c) === 'warn').length
  const batismoAgendado = contacts.filter(c => c.subetapa_batismo === 'BATISMO_AGENDADO').length

  function handleUpdated(id: string, upd: Partial<Contact>) {
    const key = ['pipeline-lider-contacts', profile?.grupo]
    qc.setQueryData(key, (old: Contact[] | undefined) =>
      old?.map(c => c.id === id ? { ...c, ...upd } : c) ?? []
    )
    if (drawerContact?.id === id) setDrawerContact(c => c ? { ...c, ...upd } : c)
  }

  // Compute selected contacts for DrillDown
  const drillContacts = useMemo(() => {
    if (!selected) return []
    return porVolFase.get(selected.voluntarioId)?.get(selected.fase) ?? []
  }, [selected, porVolFase])

  // Rows: volunteers + "Sem atribuição" row if has contacts
  const semAtribuicao = porVolFase.get(null)
  const temSemAtrib = FASES_ATIVAS.some(f => (semAtribuicao?.get(f)?.length ?? 0) > 0)

  function handleCellClick(voluntarioId: string | null, fase: FasePipeline, count: number) {
    if (!count) return
    if (selected?.voluntarioId === voluntarioId && selected?.fase === fase) {
      setSelected(null)
    } else {
      setSelected({ voluntarioId, fase })
    }
  }

  return (
    <div>
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

      {error ? (
        <div className="text-center py-16 text-red-400 text-sm flex items-center justify-center gap-2">
          <AlertTriangle size={16} /> Erro ao carregar: {(error as Error).message}
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-menta-light border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="zion-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2.5 px-3 text-xs text-muted-foreground font-medium w-44">
                  <div className="flex items-center gap-1.5"><Users size={13} /> Voluntário</div>
                </th>
                {FASES_ATIVAS.map(f => (
                  <th key={f} className="text-center py-2.5 px-2 text-xs text-muted-foreground font-medium">
                    {FASE_LABELS[f]}
                  </th>
                ))}
                <th className="text-center py-2.5 px-2 text-xs text-muted-foreground font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {voluntarios.map(vol => {
                const faseMap = porVolFase.get(vol.id)!
                const rowTotal = FASES_ATIVAS.reduce((sum, f) => sum + (faseMap.get(f)?.length ?? 0), 0)
                return (
                  <tr key={vol.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="py-2.5 px-3">
                      <div>
                        <p className="text-xs font-medium text-offwhite truncate max-w-[160px]">{vol.nome}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">{vol.nivel}</p>
                      </div>
                    </td>
                    {FASES_ATIVAS.map(f => {
                      const cs = faseMap.get(f) ?? []
                      const count = cs.length
                      const isActive = selected?.voluntarioId === vol.id && selected?.fase === f
                      return (
                        <td key={f} className="py-2.5 px-2 text-center">
                          <button
                            onClick={() => handleCellClick(vol.id, f, count)}
                            disabled={!count}
                            className={cn(
                              'min-w-[36px] px-2 py-0.5 rounded border text-xs font-semibold transition-all',
                              count === 0
                                ? 'text-muted-foreground/30 border-transparent cursor-default'
                                : isActive
                                  ? 'ring-2 ring-menta-light ' + slaColor(cs)
                                  : slaColor(cs) + ' hover:opacity-80',
                            )}
                          >
                            {count || '—'}
                          </button>
                        </td>
                      )
                    })}
                    <td className="py-2.5 px-2 text-center text-xs font-medium text-muted-foreground">
                      {rowTotal || '—'}
                    </td>
                  </tr>
                )
              })}

              {/* Sem atribuição */}
              {temSemAtrib && (
                <tr className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="py-2.5 px-3">
                    <p className="text-xs font-medium text-muted-foreground italic">Sem atribuição</p>
                  </td>
                  {FASES_ATIVAS.map(f => {
                    const cs = semAtribuicao?.get(f) ?? []
                    const count = cs.length
                    const isActive = selected?.voluntarioId === null && selected?.fase === f
                    return (
                      <td key={f} className="py-2.5 px-2 text-center">
                        <button
                          onClick={() => handleCellClick(null, f, count)}
                          disabled={!count}
                          className={cn(
                            'min-w-[36px] px-2 py-0.5 rounded border text-xs font-semibold transition-all',
                            count === 0
                              ? 'text-muted-foreground/30 border-transparent cursor-default'
                              : isActive
                                ? 'ring-2 ring-menta-light ' + slaColor(cs)
                                : slaColor(cs) + ' hover:opacity-80',
                          )}
                        >
                          {count || '—'}
                        </button>
                      </td>
                    )
                  })}
                  <td className="py-2.5 px-2 text-center text-xs font-medium text-muted-foreground">
                    {FASES_ATIVAS.reduce((s, f) => s + (semAtribuicao?.get(f)?.length ?? 0), 0) || '—'}
                  </td>
                </tr>
              )}

              {/* Totais por fase */}
              <tr className="bg-muted/10">
                <td className="py-2.5 px-3 text-xs font-semibold text-muted-foreground">Total</td>
                {FASES_ATIVAS.map(f => {
                  const count = contacts.filter(c => c.fase_pipeline === f).length
                  return (
                    <td key={f} className="py-2.5 px-2 text-center text-xs font-semibold text-offwhite">
                      {count}
                    </td>
                  )
                })}
                <td className="py-2.5 px-2 text-center text-xs font-semibold text-menta-light">{contacts.length}</td>
              </tr>
            </tbody>
          </table>

          {voluntarios.length === 0 && !temSemAtrib && (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum voluntário ou lead encontrado no seu grupo.</p>
          )}
        </div>
      )}

      {/* DrillDown Panel */}
      {selected && (
        <DrillDownPanel
          fase={selected.fase}
          contacts={drillContacts}
          onClose={() => setSelected(null)}
          onCard={c => { setDrawerContact(c); setSelected(null) }}
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
