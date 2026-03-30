import { useState, useMemo, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, Pencil, Archive, X, Users, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Layout } from '@/components/layout/Layout'
import { DrawerEdicaoLead } from '@/components/gestao/DrawerEdicaoLead'
import { ModalArquivar } from '@/components/gestao/ModalArquivar'
import { cn, getGrupoLabel, getTipoLabel, formatRelativeTime } from '@/lib/utils'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Contact, ContactGrupo, ContactStatus, ContactTipo } from '@/types/database'

// ─── Constantes ───────────────────────────────────────────────────────────────

const PER_PAGE = 25
const GRUPOS: ContactGrupo[] = ['rise','flow','vox','ek','zion_geral']

const STATUS_BADGE: Record<ContactStatus, { cls: string; label: string }> = {
  ativo:        { cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20', label: 'Ativo' },
  sem_resposta: { cls: 'bg-red-500/15 text-red-400 border-red-500/20',            label: 'Sem resposta' },
  encaminhado:  { cls: 'bg-blue-500/15 text-blue-400 border-blue-500/20',         label: 'Encaminhado' },
  arquivado:    { cls: 'bg-gray-500/15 text-gray-400 border-gray-500/20',         label: 'Arquivado' },
  batizado:     { cls: 'bg-menta-light/15 text-menta-light border-menta-light/20',label: 'Batizado' },
  reciclado:    { cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',   label: 'Reciclado' },
}

const TIPO_BADGE: Record<ContactTipo, { cls: string; label: string }> = {
  novo_nascimento: { cls: 'bg-menta-light/15 text-menta-light border-menta-light/20', label: 'Novo Nasc.' },
  reconciliacao:   { cls: 'bg-purple-500/15 text-purple-400 border-purple-500/20',    label: 'Reconciliação' },
  visitante:       { cls: 'bg-blue-500/15 text-blue-400 border-blue-500/20',          label: 'Visitante' },
}

type ContactComVol = Contact & { profiles?: { id: string; nome: string } | null }

interface Filtros { busca: string; grupo: string; status: string; tipo: string; page: number }

// ─── Componente principal ─────────────────────────────────────────────────────

export default function GestaoLeads() {
  const { profile, isAdmin, isLider, canSeeAllContacts } = useAuth()
  const qc = useQueryClient()

  const [filtros, setFiltros] = useState<Filtros>({ busca: '', grupo: '', status: '', tipo: '', page: 1 })
  const [buscaInput, setBuscaInput] = useState('')
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null)
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [leadEditando, setLeadEditando] = useState<ContactComVol | null>(null)
  const [leadArquivando, setLeadArquivando] = useState<ContactComVol[] | null>(null)

  // ─── Busca com debounce ──────────────────────────────────────────────────
  function onBuscaChange(v: string) {
    setBuscaInput(v)
    if (debounceTimer) clearTimeout(debounceTimer)
    const t = setTimeout(() => setFiltros(f => ({ ...f, busca: v, page: 1 })), 300)
    setDebounceTimer(t)
  }

  function setFiltro(key: keyof Filtros, value: string) {
    setFiltros(f => ({ ...f, [key]: value, page: 1 }))
    setSelecionados(new Set())
  }

  // ─── Query ───────────────────────────────────────────────────────────────
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['gestao-leads', filtros, profile?.grupo, profile?.nivel],
    queryFn: async () => {
      let q = supabase
        .from('contacts')
        .select('*,profiles!contacts_voluntario_atribuido_id_fkey(id,nome)', { count: 'exact' })
        .neq('status', 'arquivado')
        .order('created_at', { ascending: false })
        .range((filtros.page - 1) * PER_PAGE, filtros.page * PER_PAGE - 1)

      if (filtros.busca) {
        q = q.or(`nome.ilike.%${filtros.busca}%,telefone.ilike.%${filtros.busca}%`)
      }
      if (filtros.grupo) q = q.eq('grupo', filtros.grupo)
      if (filtros.status) q = q.eq('status', filtros.status)
      if (filtros.tipo) q = q.eq('tipo', filtros.tipo)

      // Coordenador só vê o próprio grupo
      if (profile?.nivel === 'coordenador' && profile.grupo) {
        q = q.eq('grupo', profile.grupo)
      }

      const { data: leads, count, error } = await q
      if (error) throw error
      return { leads: (leads ?? []) as ContactComVol[], total: count ?? 0 }
    },
    enabled: !!profile,
  })

  const leads = data?.leads ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

  // ─── Seleção ─────────────────────────────────────────────────────────────
  const todosIds = useMemo(() => leads.map(l => l.id), [leads])
  const todosSelecionados = selecionados.size > 0 && todosIds.every(id => selecionados.has(id))

  function toggleTodos() {
    if (todosSelecionados) setSelecionados(new Set())
    else setSelecionados(new Set(todosIds))
  }
  function toggleLead(id: string) {
    setSelecionados(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  // ─── Arquivar ─────────────────────────────────────────────────────────────
  async function arquivar(ids: string[], motivo: string) {
    const { error } = await supabase.from('contacts').update({ status: 'arquivado' as ContactStatus }).in('id', ids)
    if (error) { toast.error('Erro ao arquivar.'); return }
    toast.success(ids.length === 1 ? 'Lead arquivado.' : `${ids.length} leads arquivados.`)
    setSelecionados(new Set())
    setLeadArquivando(null)
    qc.invalidateQueries({ queryKey: ['gestao-leads'] })
  }

  // ─── Bulk: reatribuir ─────────────────────────────────────────────────────
  const [bulkVoluntario, setBulkVoluntario] = useState('')
  const [bulkStatus, setBulkStatus] = useState('')
  const [showBulkVol, setShowBulkVol] = useState(false)
  const [showBulkStatus, setShowBulkStatus] = useState(false)

  async function bulkReatribuir() {
    if (!bulkVoluntario) return
    const ids = Array.from(selecionados)
    const { error } = await supabase.from('contacts').update({ voluntario_atribuido_id: bulkVoluntario }).in('id', ids)
    if (error) { toast.error('Erro ao reatribuir.'); return }
    // Registra atribuições
    await supabase.from('atribuicoes').insert(ids.map(contact_id => ({
      contact_id, voluntario_id: bulkVoluntario, tipo: 'MANUAL',
      motivo: 'Reatribuição em massa via gestão de leads', criado_por: profile?.id ?? null,
    })))
    toast.success(`${ids.length} leads reatribuídos.`)
    setSelecionados(new Set()); setBulkVoluntario(''); setShowBulkVol(false)
    qc.invalidateQueries({ queryKey: ['gestao-leads'] })
  }

  async function bulkAlterarStatus() {
    if (!bulkStatus) return
    const ids = Array.from(selecionados)
    const { error } = await supabase.from('contacts').update({ status: bulkStatus as ContactStatus }).in('id', ids)
    if (error) { toast.error('Erro ao alterar status.'); return }
    toast.success(`${ids.length} leads atualizados.`)
    setSelecionados(new Set()); setBulkStatus(''); setShowBulkStatus(false)
    qc.invalidateQueries({ queryKey: ['gestao-leads'] })
  }

  // ─── Voluntários para bulk ────────────────────────────────────────────────
  const { data: voluntariosBulk } = useQuery({
    queryKey: ['voluntarios-bulk', profile?.grupo],
    queryFn: async () => {
      let q = supabase.from('profiles').select('id,nome,grupo').eq('nivel','voluntario').eq('ativo',true).order('nome')
      if (profile?.nivel === 'coordenador' && profile.grupo) q = q.eq('grupo', profile.grupo)
      const { data } = await q
      return data as { id: string; nome: string; grupo: string }[]
    },
    enabled: !!profile,
  })

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <Layout title="Gestão de Leads">

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className="zion-input pl-8 text-sm"
            placeholder="Buscar por nome ou telefone…"
            value={buscaInput}
            onChange={e => onBuscaChange(e.target.value)}
          />
        </div>
        <select className="zion-input text-sm" value={filtros.grupo} onChange={e => setFiltro('grupo', e.target.value)}>
          <option value="">Todos os grupos</option>
          {GRUPOS.map(g => <option key={g} value={g}>{getGrupoLabel(g)}</option>)}
        </select>
        <select className="zion-input text-sm" value={filtros.status} onChange={e => setFiltro('status', e.target.value)}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS_BADGE).filter(([k]) => k !== 'arquivado').map(([k, v]) =>
            <option key={k} value={k}>{v.label}</option>
          )}
        </select>
        <select className="zion-input text-sm" value={filtros.tipo} onChange={e => setFiltro('tipo', e.target.value)}>
          <option value="">Todos os tipos</option>
          {Object.entries(TIPO_BADGE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Barra bulk */}
      {selecionados.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 bg-menta-dark/20 border border-menta-dark/40 rounded-xl px-4 py-2.5">
          <span className="text-sm font-medium text-menta-light">{selecionados.size} selecionados</span>
          <div className="w-px h-4 bg-border mx-1" />

          {/* Reatribuir */}
          {showBulkVol ? (
            <div className="flex items-center gap-1.5">
              <select className="zion-input text-xs py-1 h-auto" value={bulkVoluntario} onChange={e => setBulkVoluntario(e.target.value)}>
                <option value="">Selecione voluntário…</option>
                {voluntariosBulk?.map(v => <option key={v.id} value={v.id}>{v.nome} ({getGrupoLabel(v.grupo)})</option>)}
              </select>
              <button onClick={bulkReatribuir} disabled={!bulkVoluntario} className="text-xs bg-menta-light/15 text-menta-light px-2 py-1 rounded-md hover:bg-menta-light/25 disabled:opacity-40">OK</button>
              <button onClick={() => setShowBulkVol(false)} className="text-xs text-muted-foreground hover:text-foreground px-1">✕</button>
            </div>
          ) : (
            <button onClick={() => { setShowBulkVol(true); setShowBulkStatus(false) }} className="text-xs text-muted-foreground hover:text-menta-light px-2 py-1 rounded-md border border-border hover:border-menta-light/40 transition-all">
              <Users size={12} className="inline mr-1"/>Reatribuir
            </button>
          )}

          {/* Alterar status */}
          {showBulkStatus ? (
            <div className="flex items-center gap-1.5">
              <select className="zion-input text-xs py-1 h-auto" value={bulkStatus} onChange={e => setBulkStatus(e.target.value)}>
                <option value="">Selecione status…</option>
                {Object.entries(STATUS_BADGE).filter(([k]) => k !== 'arquivado').map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <button onClick={bulkAlterarStatus} disabled={!bulkStatus} className="text-xs bg-menta-light/15 text-menta-light px-2 py-1 rounded-md hover:bg-menta-light/25 disabled:opacity-40">OK</button>
              <button onClick={() => setShowBulkStatus(false)} className="text-xs text-muted-foreground hover:text-foreground px-1">✕</button>
            </div>
          ) : (
            <button onClick={() => { setShowBulkStatus(true); setShowBulkVol(false) }} className="text-xs text-muted-foreground hover:text-menta-light px-2 py-1 rounded-md border border-border hover:border-menta-light/40 transition-all">
              Alterar status
            </button>
          )}

          <button
            onClick={() => setLeadArquivando(leads.filter(l => selecionados.has(l.id)))}
            className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded-md border border-red-500/20 hover:border-red-500/40 transition-all"
          >
            <Archive size={12} className="inline mr-1"/>Arquivar
          </button>

          <button onClick={() => setSelecionados(new Set())} className="ml-auto text-xs text-muted-foreground hover:text-foreground">
            <X size={14}/>
          </button>
        </div>
      )}

      {/* Contador */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-muted-foreground">{total} leads encontrados</p>
      </div>

      {/* Tabela */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-2 border-menta-light border-t-transparent rounded-full animate-spin"/></div>
      ) : leads.length === 0 ? (
        <div className="zion-card text-center py-12 text-muted-foreground text-sm">Nenhum lead encontrado.</div>
      ) : (
        <div className="zion-card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-3 py-3 w-9">
                    <input type="checkbox" checked={todosSelecionados} onChange={toggleTodos} className="rounded border-border accent-menta-light" />
                  </th>
                  <th className="text-left px-3 py-3 text-xs font-medium text-muted-foreground">Nome</th>
                  <th className="text-left px-3 py-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">Telefone</th>
                  <th className="text-left px-3 py-3 text-xs font-medium text-muted-foreground hidden md:table-cell">Tipo</th>
                  <th className="text-left px-3 py-3 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-3 py-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">Voluntário</th>
                  <th className="text-left px-3 py-3 text-xs font-medium text-muted-foreground hidden lg:table-cell">Entrada</th>
                  <th className="px-3 py-3 w-16"/>
                </tr>
              </thead>
              <tbody>
                {leads.map(lead => {
                  const sel = selecionados.has(lead.id)
                  const slaBadge = lead.sla_status === 'vencido'
                  return (
                    <tr key={lead.id} className={cn('border-b border-border/50 last:border-0 hover:bg-muted/10 transition-colors', sel && 'bg-menta-dark/10')}>
                      <td className="px-3 py-3">
                        <input type="checkbox" checked={sel} onChange={() => toggleLead(lead.id)} className="rounded border-border accent-menta-light" />
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-sm font-medium text-offwhite truncate max-w-[160px]">{lead.nome}</p>
                        {slaBadge && <span className="text-[10px] bg-red-400/10 text-red-400 px-1.5 py-0.5 rounded-full animate-pulse">SLA vencido</span>}
                      </td>
                      <td className="px-3 py-3 hidden sm:table-cell">
                        <span className="font-mono text-xs text-muted-foreground">{lead.telefone}</span>
                      </td>
                      <td className="px-3 py-3 hidden md:table-cell">
                        <span className={cn('text-[11px] px-2 py-0.5 rounded-full border font-medium', TIPO_BADGE[lead.tipo].cls)}>
                          {TIPO_BADGE[lead.tipo].label}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className={cn('text-[11px] px-2 py-0.5 rounded-full border font-medium', STATUS_BADGE[lead.status].cls)}>
                          {STATUS_BADGE[lead.status].label}
                        </span>
                      </td>
                      <td className="px-3 py-3 hidden lg:table-cell">
                        <span className="text-xs text-muted-foreground">{(lead as any).profiles?.nome ?? '—'}</span>
                      </td>
                      <td className="px-3 py-3 hidden lg:table-cell">
                        <span className="text-xs text-muted-foreground">{format(new Date(lead.created_at),'dd/MM/yy',{locale:ptBR})}</span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setLeadEditando(lead)} className="text-muted-foreground hover:text-menta-light p-1.5 rounded-md hover:bg-menta-light/10 transition-all">
                            <Pencil size={13}/>
                          </button>
                          <button onClick={() => setLeadArquivando([lead])} className="text-muted-foreground hover:text-red-400 p-1.5 rounded-md hover:bg-red-400/10 transition-all">
                            <Archive size={13}/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-muted-foreground">
            Página {filtros.page} de {totalPages} · {total} total
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setFiltros(f => ({ ...f, page: f.page - 1 }))}
              disabled={filtros.page === 1}
              className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground disabled:opacity-40 hover:bg-muted/20 transition-all"
            >
              <ChevronLeft size={15}/>
            </button>
            <button
              onClick={() => setFiltros(f => ({ ...f, page: f.page + 1 }))}
              disabled={filtros.page >= totalPages}
              className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground disabled:opacity-40 hover:bg-muted/20 transition-all"
            >
              <ChevronRight size={15}/>
            </button>
          </div>
        </div>
      )}

      {/* Drawer de edição */}
      {leadEditando && (
        <DrawerEdicaoLead
          contact={leadEditando}
          onClose={() => setLeadEditando(null)}
          onSaved={() => {
            setLeadEditando(null)
            qc.invalidateQueries({ queryKey: ['gestao-leads'] })
          }}
        />
      )}

      {/* Modal de arquivamento */}
      {leadArquivando && (
        <ModalArquivar
          nomes={leadArquivando.map(l => l.nome)}
          onCancelar={() => setLeadArquivando(null)}
          onConfirmar={async (motivo) => {
            await arquivar(leadArquivando.map(l => l.id), motivo)
          }}
        />
      )}
    </Layout>
  )
}
