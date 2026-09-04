import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { Search, Phone } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useViewAs } from '@/contexts/ViewAsContext'
import { Layout } from '@/components/layout/Layout'
import { DrawerLead } from '@/components/pipeline/DrawerLead'
import { cn, getTipoBadgeColor, getTipoLabel } from '@/lib/utils'
import { calcularSLAFase, formatarSLALabel, FASE_LABELS, SUBETAPA_LABELS } from '@/lib/pipeline'
import type { Contact, FasePipeline } from '@/types/database'

type Filter   = 'todos' | 'ativos' | 'sla_vencido' | 'sem_resposta'
type ViewMode = 'kanban' | 'lista'

const FASES_KANBAN: { key: FasePipeline; label: string; accent: string }[] = [
  { key: 'CONTATO_INICIAL', label: 'Contato Inicial', accent: 'border-blue-500/40 text-blue-400' },
  { key: 'QUALIFICACAO',    label: 'Qualificação',    accent: 'border-purple-500/40 text-purple-400' },
  { key: 'AULAS',           label: 'Aulas',           accent: 'border-yellow-500/40 text-yellow-400' },
  { key: 'POS_AULA',        label: 'Pós-Aula',        accent: 'border-menta-light/40 text-menta-light' },
]

function IconList() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="3" width="14" height="2" rx="1" fill="currentColor"/>
      <rect x="1" y="7" width="14" height="2" rx="1" fill="currentColor"/>
      <rect x="1" y="11" width="14" height="2" rx="1" fill="currentColor"/>
    </svg>
  )
}


function IconKanban() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="4" height="14" rx="1.5" fill="currentColor"/>
      <rect x="6" y="1" width="4" height="9"  rx="1.5" fill="currentColor"/>
      <rect x="11" y="1" width="4" height="12" rx="1.5" fill="currentColor"/>
    </svg>
  )
}

function KanbanCard({ contact, onClick }: { contact: Contact; onClick: (c: Contact) => void }) {
  const sla = calcularSLAFase(contact)
  const subetapa = contact.subetapa_qualificacao ?? contact.subetapa_contato ?? contact.subetapa_encaminhamento ?? contact.subetapa_batismo
  const subLabel = subetapa ? (SUBETAPA_LABELS[subetapa] ?? subetapa) : null

  return (
    <button
      onClick={() => onClick(contact)}
      className={cn(
        'w-full text-left bg-card border rounded-xl p-3 transition-all hover:border-menta-light/30 hover:bg-muted/10 space-y-2',
        sla === 'over' ? 'border-red-500/30 bg-red-500/5' : 'border-border',
      )}
    >
      <div className="flex items-start gap-2">
        <div className={cn(
          'w-2 h-2 rounded-full flex-shrink-0 mt-1',
          sla === 'over' ? 'bg-red-500' : sla === 'warn' ? 'bg-yellow-400' : 'bg-menta-light',
        )} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-offwhite truncate">{contact.nome}</p>
          {subLabel && (
            <p className="text-xs text-muted-foreground font-medium mt-0.5 truncate">{subLabel}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full font-medium', getTipoBadgeColor(contact.tipo))}>
          {getTipoLabel(contact.tipo)}
        </span>
        {sla === 'over' && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-red-500/15 text-red-400">SLA vencido</span>
        )}
        {contact.inscricao_confirmada && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium bg-menta-light/15 text-menta-light border border-menta-light/20">Inscrita</span>
        )}
      </div>
    </button>
  )
}

export default function MeusContatos() {
  const { profile } = useAuth()
  const { viewingAs, clearViewingAs } = useViewAs()
  const targetId = viewingAs?.id ?? profile?.id
  const qc = useQueryClient()
  const [search, setSearch]         = useState('')
  const [filter, setFilter]         = useState<Filter>('ativos')
  const [viewMode, setViewMode]     = useState<ViewMode>('kanban')
  const [drawerContact, setDrawerContact] = useState<Contact | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('voluntario-view-mode') as ViewMode | null
    if (saved === 'kanban' || saved === 'lista') setViewMode(saved)
  }, [])

  function toggleView(mode: ViewMode) {
    setViewMode(mode)
    localStorage.setItem('voluntario-view-mode', mode)
  }

  const { data: contacts, isLoading } = useQuery({
    queryKey: ['meus-contatos', targetId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('voluntario_atribuido_id', targetId!)
        .eq('atribuido_por_coordenador', true)
        .order('updated_at', { ascending: true })
      if (error) throw error
      return data as Contact[]
    },
    enabled: !!targetId,
  })

  const filtered = contacts?.filter(c => {
    const digitos = search.replace(/\D/g, '')
    const ms = !search
      || c.nome.toLowerCase().includes(search.toLowerCase())
      || (digitos.length >= 3 && c.telefone.replace(/\D/g, '').includes(digitos))
    const mf = filter === 'ativos'      ? c.status === 'ativo'
             : filter === 'sla_vencido' ? calcularSLAFase(c) === 'over'
             : filter === 'sem_resposta'? c.status === 'sem_resposta'
             : true
    return ms && mf
  }) ?? []

  const vencidos = contacts?.filter(c => calcularSLAFase(c) === 'over') ?? []
  const ativos   = contacts?.filter(c => c.status === 'ativo').length ?? 0
  const max      = profile?.max_contatos_ativos ?? 7

  function openDrawer(c: Contact) {
    setDrawerContact(c)
  }

  function handleUpdated(upd: Partial<Contact>) {
    if (drawerContact) {
      setDrawerContact({ ...drawerContact, ...upd })
    }
    qc.invalidateQueries({ queryKey: ['meus-contatos', targetId] })
  }

  return (
    <Layout title={viewingAs ? `Visão: ${viewingAs.nome.split(' ')[0]}` : 'Meus Contatos'}>

      {/* Banner "Ver como" */}
      {viewingAs && (
        <div className="flex items-center justify-between bg-amber-400/10 border border-amber-400/30 rounded-xl px-4 py-2.5 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-sm text-amber-400 font-medium">
              Visualizando como <strong>{viewingAs.nome}</strong> — modo leitura
            </span>
          </div>
          <button
            onClick={clearViewingAs}
            className="text-xs text-amber-400/70 hover:text-amber-400 border border-amber-400/30 hover:border-amber-400/60 px-2.5 py-1 rounded-lg transition-all"
          >
            Sair
          </button>
        </div>
      )}

      {/* Alertas SLA */}
      {vencidos.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <p className="text-sm font-medium text-red-400">
              {vencidos.length} contato{vencidos.length > 1 ? 's' : ''} com SLA vencido — contate agora!
            </p>
          </div>
          <div className="space-y-2">
            {vencidos.map(c => (
              <div key={c.id} className="flex items-center justify-between bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-offwhite">{c.nome}</p>
                  <p className="text-xs text-red-400 mt-0.5">{formatarSLALabel(c)}</p>
                </div>
                <a
                  href={`https://wa.me/55${c.telefone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-2.5 py-1.5 rounded-lg hover:bg-emerald-500/25 transition-all font-medium"
                >
                  <Phone size={12} /> WhatsApp
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cabeçalho com toggle de view */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-medium text-offwhite">Olá, {profile?.nome?.split(' ')[0]}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{ativos} de {max} contatos ativos</p>
        </div>
        <div className="flex items-center gap-1 bg-muted/30 border border-border rounded-xl p-1">
          <button
            onClick={() => toggleView('kanban')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
              viewMode === 'kanban' ? 'bg-card text-offwhite shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <IconKanban /> Kanban
          </button>
          <button
            onClick={() => toggleView('lista')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
              viewMode === 'lista' ? 'bg-card text-offwhite shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <IconList /> Lista
          </button>
        </div>
      </div>

      {/* Barra de capacidade */}
      <div className="flex gap-1.5 mb-4">
        {Array.from({ length: max }).map((_, i) => (
          <div
            key={i}
            className={cn('flex-1 h-2 rounded-full transition-all', i < ativos ? 'bg-menta-light' : 'bg-muted/40')}
          />
        ))}
      </div>

      {/* Filtros + busca — ocultos no kanban (usa todos) */}
      {viewMode !== 'kanban' && (
        <>
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
            <input type="search" placeholder="Buscar por nome ou telefone..." className="zion-input pl-9" value={search} onChange={e => setSearch(e.target.value)}/>
          </div>
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
            {(['todos', 'ativos', 'sla_vencido', 'sem_resposta'] as const).map(opt => (
              <button key={opt} onClick={() => setFilter(opt)}
                className={cn('flex-shrink-0 text-xs px-3 py-1.5 rounded-lg border transition-all font-medium',
                  filter === opt ? 'bg-menta-light/15 border-menta-light/40 text-menta-light' : 'border-border text-muted-foreground'
                )}>
                {{ todos: 'Todos', ativos: 'Ativos', sla_vencido: 'SLA Vencido', sem_resposta: 'Sem Resposta' }[opt]}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Conteúdo */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-menta-light border-t-transparent rounded-full animate-spin"/>
        </div>
      ) : viewMode === 'kanban' ? (
        /* ── Kanban ── */
        <div className="overflow-x-auto -mx-4 px-4">
          <div className="flex gap-3 min-w-max pb-4">
            {FASES_KANBAN.map(fase => {
              const leads = (contacts ?? []).filter(c => c.fase_pipeline === fase.key && c.status === 'ativo')
              const [accentBorder, accentText] = fase.accent.split(' ')
              return (
                <div key={fase.key} className="w-60 flex-shrink-0 flex flex-col gap-2">
                  {/* Cabeçalho da coluna */}
                  <div className={cn('flex items-center justify-between px-3 py-2 rounded-xl border bg-muted/10', accentBorder)}>
                    <span className={cn('text-xs font-semibold', accentText)}>{fase.label}</span>
                    <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-muted/30', accentText)}>
                      {leads.length}
                    </span>
                  </div>
                  {/* Cards */}
                  <div className="space-y-2 min-h-[120px]">
                    {leads.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border/40 h-20 flex items-center justify-center">
                        <p className="text-[10px] text-muted-foreground/50">Nenhum lead</p>
                      </div>
                    ) : leads.map(c => (
                      <KanbanCard key={c.id} contact={c} onClick={openDrawer} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : !filtered.length ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Nenhum contato encontrado.</div>
      ) : (
        /* ── Lista ── */
        <div className="zion-card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-petroleo/60 border-b border-border">
                <th className="text-left text-xs text-muted-foreground font-medium px-5 py-3">Nome</th>
                <th className="text-left text-xs text-muted-foreground font-medium px-4 py-3 hidden sm:table-cell">Etapa</th>
                <th className="text-left text-xs text-muted-foreground font-medium px-4 py-3">SLA</th>
                <th className="text-left text-xs text-muted-foreground font-medium px-4 py-3 hidden sm:table-cell">Tipo</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => {
                const sla = calcularSLAFase(c)
                return (
                  <tr
                    key={c.id}
                    onClick={() => openDrawer(c)}
                    className={cn(
                      'border-t border-border/50 transition-colors cursor-pointer hover:bg-muted/15',
                      sla === 'over' ? 'bg-red-500/5' : i % 2 === 1 ? 'bg-muted/5' : '',
                    )}
                  >
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className={cn('w-2 h-2 rounded-full flex-shrink-0',
                          sla === 'over' ? 'bg-red-500' : sla === 'warn' ? 'bg-yellow-400' : 'bg-menta-light'
                        )} />
                        <span className="text-sm font-medium text-offwhite">{c.nome}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 hidden sm:table-cell">
                      <span className="text-xs text-muted-foreground">{FASE_LABELS[c.fase_pipeline]}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      {sla === 'over'
                        ? <span className="text-xs text-red-400 font-medium">Vencido</span>
                        : <span className="text-xs text-muted-foreground">{formatarSLALabel(c)}</span>
                      }
                    </td>
                    <td className="px-4 py-2.5 hidden sm:table-cell">
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', getTipoBadgeColor(c.tipo))}>
                        {getTipoLabel(c.tipo)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* DrawerLead */}
      {drawerContact && (
        <DrawerLead
          contact={drawerContact}
          onClose={() => setDrawerContact(null)}
          onUpdated={handleUpdated}
        />
      )}
    </Layout>
  )
}
