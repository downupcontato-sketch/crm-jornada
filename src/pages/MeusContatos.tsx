import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { Search, Phone } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Layout } from '@/components/layout/Layout'
import { ContactCard } from '@/components/contacts/ContactCard'
import { cn } from '@/lib/utils'
import { calcularSLAFase, formatarSLALabel, FASE_LABELS } from '@/lib/pipeline'
import type { Contact, ContactTipo } from '@/types/database'

type Filter   = 'todos' | 'ativos' | 'sla_vencido' | 'sem_resposta'
type ViewMode = 'lista' | 'cards'

const TIPO_LABEL: Record<ContactTipo, string> = {
  novo_nascimento: 'Novo Nasc.',
  reconciliacao:   'Reconcil.',
  visitante:       'Visitante',
}

const TIPO_COR: Record<ContactTipo, string> = {
  novo_nascimento: 'bg-teal-500/15 text-teal-400',
  reconciliacao:   'bg-amber-500/15 text-amber-400',
  visitante:       'bg-muted text-muted-foreground',
}

function IconList() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="3" width="14" height="2" rx="1" fill="currentColor"/>
      <rect x="1" y="7" width="14" height="2" rx="1" fill="currentColor"/>
      <rect x="1" y="11" width="14" height="2" rx="1" fill="currentColor"/>
    </svg>
  )
}

function IconCards() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor"/>
      <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor"/>
      <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor"/>
      <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor"/>
    </svg>
  )
}

export default function MeusContatos() {
  const { profile } = useAuth()
  const [search, setSearch]     = useState('')
  const [filter, setFilter]     = useState<Filter>('ativos')
  const [viewMode, setViewMode] = useState<ViewMode>('lista')

  useEffect(() => {
    const saved = localStorage.getItem('voluntario-view-mode') as ViewMode | null
    if (saved) setViewMode(saved)
  }, [])

  function toggleView(mode: ViewMode) {
    setViewMode(mode)
    localStorage.setItem('voluntario-view-mode', mode)
  }

  const { data: contacts, isLoading } = useQuery({
    queryKey: ['meus-contatos', profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('voluntario_atribuido_id', profile!.id)
        .eq('atribuido_por_coordenador', true)
        .order('updated_at', { ascending: true })
      if (error) throw error
      return data as Contact[]
    },
    enabled: !!profile?.id,
  })

  const filtered = contacts?.filter(c => {
    const ms = !search || c.nome.toLowerCase().includes(search.toLowerCase()) || c.telefone.includes(search)
    const mf = filter === 'ativos'     ? c.status === 'ativo'
             : filter === 'sla_vencido' ? calcularSLAFase(c) === 'over'
             : filter === 'sem_resposta'? c.status === 'sem_resposta'
             : true
    return ms && mf
  })

  const vencidos = contacts?.filter(c => calcularSLAFase(c) === 'over') ?? []
  const ativos   = contacts?.filter(c => c.status === 'ativo').length ?? 0
  const max      = profile?.max_contatos_ativos ?? 7

  return (
    <Layout title="Meus Contatos">

      {/* Alertas SLA — sempre acima */}
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

      {/* Cabeçalho com toggle */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-medium text-offwhite">Olá, {profile?.nome?.split(' ')[0]}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{ativos} de {max} contatos ativos</p>
        </div>
        <div className="flex items-center gap-1 bg-muted/30 border border-border rounded-xl p-1">
          <button
            onClick={() => toggleView('lista')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
              viewMode === 'lista'
                ? 'bg-card text-offwhite shadow-sm border border-border'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <IconList /> Lista
          </button>
          <button
            onClick={() => toggleView('cards')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
              viewMode === 'cards'
                ? 'bg-card text-offwhite shadow-sm border border-border'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <IconCards /> Cards
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

      {/* Filtros + busca */}
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

      {/* Conteúdo */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-menta-light border-t-transparent rounded-full animate-spin"/>
        </div>
      ) : !filtered?.length ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Nenhum contato encontrado.</div>
      ) : viewMode === 'lista' ? (
        <div className="zion-card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-petroleo/60 border-b border-border">
                <th className="text-left text-xs text-muted-foreground font-medium px-5 py-3">Nome</th>
                <th className="text-left text-xs text-muted-foreground font-medium px-4 py-3 hidden sm:table-cell">Etapa</th>
                <th className="text-left text-xs text-muted-foreground font-medium px-4 py-3">SLA</th>
                <th className="text-left text-xs text-muted-foreground font-medium px-4 py-3 hidden sm:table-cell">Tipo</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => {
                const sla = calcularSLAFase(c)
                return (
                  <tr key={c.id} className={cn(
                    'border-t border-border/50 transition-colors hover:bg-muted/10',
                    sla === 'over' ? 'bg-red-500/5' : i % 2 === 1 ? 'bg-muted/5' : '',
                  )}>
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
                      <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', TIPO_COR[c.tipo])}>
                        {TIPO_LABEL[c.tipo]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link to={`/contato/${c.id}`} className="text-xs text-menta-light hover:underline font-medium">
                        Ver →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(c => <ContactCard key={c.id} contact={c} />)}
        </div>
      )}
    </Layout>
  )
}
