import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import { FASE_LABELS } from '@/lib/pipeline'
import { usePipelineParams } from '@/hooks/usePipelineParams'
import { CardLeadLista } from './CardLeadLista'
import { CardAulas } from './CardAulas'
import { DrawerLead } from './DrawerLead'
import { ModalPresenca } from './ModalPresenca'
import { ModalRegistroContato } from './ModalRegistroContato'
import type { Contact, FasePipeline } from '@/types/database'

const FASES_ATIVAS: FasePipeline[] = ['CONTATO_INICIAL', 'QUALIFICACAO', 'AULAS', 'POS_AULA']
const PER_PAGE = 25

// ─── Chips por fase ──────────────────────────────────────────────────────────

const CHIPS: Record<string, { key: string; label: string }[]> = {
  CONTATO_INICIAL: [
    { key: 'TENTATIVA_1',       label: '1ª tentativa' },
    { key: 'TENTATIVA_2',       label: '2ª tentativa' },
    { key: 'TENTATIVA_3',       label: '3ª tentativa' },
  ],
  QUALIFICACAO: [
    { key: 'CONVERSA',          label: 'Conversa' },
    { key: 'PERFIL_CONFIRMADO', label: 'Perfil confirmado' },
    { key: 'CONVITE_ENVIADO',   label: 'Convite enviado' },
    { key: 'AGUARDANDO_PROVER', label: 'PROVER pendente' },
    { key: 'PROVER_CONFIRMADO', label: 'PROVER confirmado' },
  ],
  // AULAS: sem chips
  POS_AULA: [
    { key: 'enc:ENCAMINHADO',           label: 'Encaminhado' },
    { key: 'enc:HANDS_OFF_CONFIRMADO',  label: 'Hands-off ✓' },
    { key: 'bat:DECIDIU_BATIZAR',       label: 'Decidiu batizar' },
    { key: 'bat:LISTA_ESPERA',          label: 'Lista de espera' },
    { key: 'bat:INSCRICAO_CONFIRMADA',  label: 'Inscrição confirmada' },
    { key: 'bat:AULA_BATISMO',          label: 'Aula de batismo' },
    { key: 'bat:CUMPRE_REQUISITOS',     label: 'Cumpre requisitos' },
    { key: 'bat:BATISMO_AGENDADO',      label: 'Agendado ✓' },
  ],
}

// Default chip ao entrar na fase
const DEFAULT_CHIP: Partial<Record<FasePipeline, string>> = {
  CONTATO_INICIAL: 'TENTATIVA_1',
  QUALIFICACAO:    'CONVERSA',
  POS_AULA:        'enc:ENCAMINHADO',
}

// Resolve subetapa efetiva (URL ou default)
function getEffective(fase: FasePipeline, subetapa: string | null): string | null {
  if (fase === 'AULAS') return null
  return subetapa ?? DEFAULT_CHIP[fase] ?? null
}

// Aplica filtro de subetapa à query Supabase
function applySubetapaFilter(
  q: ReturnType<typeof supabase.from>, fase: FasePipeline, sub: string | null,
) {
  if (!sub) return q
  if (fase === 'CONTATO_INICIAL') return (q as any).eq('subetapa_contato', sub)
  if (fase === 'QUALIFICACAO')    return (q as any).eq('subetapa_qualificacao', sub)
  if (fase === 'POS_AULA') {
    if (sub.startsWith('enc:')) return (q as any).eq('subetapa_encaminhamento', sub.slice(4))
    if (sub.startsWith('bat:')) return (q as any).eq('subetapa_batismo', sub.slice(4))
  }
  return q
}

// Gerador de páginas para paginação (janela ao redor da página atual)
function pageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const nums: (number | '...')[] = [1]
  if (current > 3) nums.push('...')
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) nums.push(i)
  if (current < total - 2) nums.push('...')
  nums.push(total)
  return nums
}

// ─── Componente principal ────────────────────────────────────────────────────

export function PipelineVoluntario() {
  const { profile } = useAuth()
  const qc = useQueryClient()
  const { fase, subetapa, page, setFase, setSubetapa, setPage } = usePipelineParams()
  const [drawerContact, setDrawerContact] = useState<Contact | null>(null)
  const [modalPresenca, setModalPresenca] = useState<{ contact: Contact; aula: 1|2|3|4 } | null>(null)
  const [modalContato, setModalContato] = useState<Contact | null>(null)

  const effectiveSub = getEffective(fase, subetapa)

  // ── Query 1: metadata leve (contagens por fase e subetapa) ────────────────
  const { data: meta = [] } = useQuery({
    queryKey: ['pipeline-vol-meta', profile?.id],
    queryFn: async () => {
      if (!profile) return []
      const { data } = await supabase
        .from('contacts')
        .select('fase_pipeline, subetapa_contato, subetapa_qualificacao, subetapa_encaminhamento, subetapa_batismo')
        .in('fase_pipeline', FASES_ATIVAS)
        .eq('voluntario_atribuido_id', profile.id)
      return data ?? []
    },
    enabled: !!profile,
  })

  // Contagens derivadas da metadata
  const contagemFase = useMemo(() => {
    const c: Record<string, number> = {}
    for (const m of meta) c[m.fase_pipeline] = (c[m.fase_pipeline] ?? 0) + 1
    return c
  }, [meta])

  const contagemChip = useMemo(() => {
    const c: Record<string, number> = {}
    for (const m of meta) {
      if (m.fase_pipeline !== fase) continue
      if (fase === 'POS_AULA') {
        if (m.subetapa_encaminhamento) c[`enc:${m.subetapa_encaminhamento}`] = (c[`enc:${m.subetapa_encaminhamento}`] ?? 0) + 1
        if (m.subetapa_batismo)        c[`bat:${m.subetapa_batismo}`]        = (c[`bat:${m.subetapa_batismo}`]        ?? 0) + 1
      } else {
        const sub = m.subetapa_contato ?? m.subetapa_qualificacao ?? '_'
        c[sub] = (c[sub] ?? 0) + 1
      }
    }
    return c
  }, [meta, fase])

  // ── Query 2: lista paginada (com filtro de subetapa) ──────────────────────
  const { data: listData, isLoading, error } = useQuery({
    queryKey: ['pipeline-vol-list', profile?.id, fase, effectiveSub, page],
    queryFn: async () => {
      if (!profile) return { contacts: [], total: 0 }
      const from = (page - 1) * PER_PAGE
      let q = supabase.from('contacts')
        .select('*', { count: 'exact' })
        .eq('fase_pipeline', fase)
        .eq('voluntario_atribuido_id', profile.id)
        .order('updated_at', { ascending: true })
        .range(from, from + PER_PAGE - 1)
      q = applySubetapaFilter(q, fase, effectiveSub) as typeof q
      const { data, count, error } = await q
      if (error) throw error
      return { contacts: (data ?? []) as Contact[], total: count ?? 0 }
    },
    enabled: !!profile,
    placeholderData: prev => prev,
  })

  const contacts = listData?.contacts ?? []
  const total    = listData?.total ?? 0
  const totalPages = Math.ceil(total / PER_PAGE)

  function handleUpdated(id: string, upd: Partial<Contact>) {
    qc.invalidateQueries({ queryKey: ['pipeline-vol'] })
    if (drawerContact?.id === id)  setDrawerContact(c => c ? { ...c, ...upd } : c)
    if (modalContato?.id === id)   setModalContato(c => c ? { ...c, ...upd } : c)
  }

  const chips = CHIPS[fase] ?? []

  return (
    <div>
      {/* ── Tabs de fase ── */}
      <div className="flex gap-1 overflow-x-auto pb-1 mb-4 flex-shrink-0 scrollbar-none">
        {FASES_ATIVAS.map(f => {
          const count = contagemFase[f] ?? 0
          return (
            <button key={f} onClick={() => setFase(f)}
              className={cn('flex-shrink-0 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap border',
                fase === f
                  ? 'bg-menta-light/15 text-menta-light border-menta-light/30'
                  : 'text-muted-foreground hover:text-foreground border-border'
              )}>
              {FASE_LABELS[f]}
              {count > 0 && (
                <span className={cn('ml-1.5 text-xs px-1.5 py-0.5 rounded-full',
                  fase === f ? 'bg-menta-light/20' : 'bg-muted'
                )}>{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Chips de subetapa ── */}
      {chips.length > 0 && (
        <div
          className="flex gap-2 mb-3 overflow-x-auto pb-1 scrollbar-none"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {chips.map(chip => {
            const isActive = effectiveSub === chip.key
            const cnt = contagemChip[chip.key] ?? 0
            return (
              <button
                key={chip.key}
                onClick={() => { setSubetapa(chip.key); }}
                style={{ flexShrink: 0 }}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap',
                  isActive
                    ? 'bg-menta-light text-petroleo border-menta-light'
                    : 'bg-transparent text-muted-foreground border-border hover:text-foreground',
                )}
              >
                {chip.label}
                <span className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-full',
                  isActive ? 'bg-white/25' : 'bg-muted',
                )}>
                  {cnt}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* ── Conteúdo ── */}
      {error ? (
        <div className="text-center py-16 text-red-400 text-sm flex items-center justify-center gap-2">
          <AlertTriangle size={16} /> Erro: {(error as Error).message}
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-menta-light border-t-transparent rounded-full animate-spin" />
        </div>
      ) : contacts.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Nenhum lead nesta etapa.</div>
      ) : fase === 'AULAS' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {contacts.map(c => (
            <CardAulas
              key={c.id}
              contact={c}
              onClick={setDrawerContact}
              onAulaClick={(c, aula) => setModalPresenca({ contact: c, aula })}
            />
          ))}
        </div>
      ) : (
        /* CONTATO_INICIAL / QUALIFICACAO / POS_AULA — lista compacta */
        <div className="space-y-1.5">
          {contacts.map(c => (
            <div key={c.id} className="flex items-center gap-2">
              <CardLeadLista contact={c} onClick={setDrawerContact} />
              <button
                onClick={() => setModalContato(c)}
                className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full text-muted-foreground hover:text-menta-light hover:bg-menta-light/10 transition-all"
                title="Registrar contato"
              >
                <Plus size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Paginação ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 mt-2 border-t border-border">
          <span className="text-xs text-muted-foreground">
            {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, total)} de {total}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            {pageNumbers(page, totalPages).map((p, i) =>
              p === '...' ? (
                <span key={`e${i}`} className="px-1 text-xs text-muted-foreground">…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p as number)}
                  className={cn(
                    'w-7 h-7 text-xs rounded flex items-center justify-center transition-colors',
                    page === p
                      ? 'bg-menta-light/20 text-menta-light font-semibold'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {p}
                </button>
              )
            )}
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── Overlays ── */}
      {drawerContact && (
        <DrawerLead
          contact={drawerContact}
          onClose={() => setDrawerContact(null)}
          onUpdated={upd => handleUpdated(drawerContact.id, upd)}
        />
      )}
      {modalPresenca && (
        <ModalPresenca
          contact={modalPresenca.contact}
          aula={modalPresenca.aula}
          onClose={() => setModalPresenca(null)}
          onSaved={upd => handleUpdated(modalPresenca.contact.id, upd)}
        />
      )}
      {modalContato && (
        <ModalRegistroContato
          contact={modalContato}
          onClose={() => setModalContato(null)}
          onUpdated={upd => handleUpdated(modalContato.id, upd)}
        />
      )}
    </div>
  )
}
