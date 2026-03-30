import { useMemo, useState } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FASE_LABELS, SUBETAPA_LABELS, calcularSLAFase } from '@/lib/pipeline'
import { CardLeadLista } from './CardLeadLista'
import type { Contact, FasePipeline } from '@/types/database'

interface Props {
  fase: FasePipeline
  contacts: Contact[]
  onClose: () => void
  onCard: (c: Contact) => void
}

const PER_PAGE = 25

// ─── Chips por fase (mesmo padrão do PipelineVoluntario) ─────────────────────

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

const DEFAULT_CHIP: Partial<Record<FasePipeline, string>> = {
  CONTATO_INICIAL: 'TENTATIVA_1',
  QUALIFICACAO:    'CONVERSA',
  POS_AULA:        'enc:ENCAMINHADO',
}

function getContactChipKey(c: Contact, fase: FasePipeline): string {
  if (fase === 'CONTATO_INICIAL') return c.subetapa_contato ?? 'SEM_SUBETAPA'
  if (fase === 'QUALIFICACAO')    return c.subetapa_qualificacao ?? 'SEM_SUBETAPA'
  if (fase === 'POS_AULA') {
    // A contact can match both enc and bat chips — counted in both
    return '__multi__'
  }
  return 'AULAS'
}

function matchesChip(c: Contact, chipKey: string, fase: FasePipeline): boolean {
  if (fase === 'AULAS') return true
  if (fase === 'CONTATO_INICIAL') return c.subetapa_contato === chipKey
  if (fase === 'QUALIFICACAO')    return c.subetapa_qualificacao === chipKey
  if (fase === 'POS_AULA') {
    if (chipKey.startsWith('enc:')) return c.subetapa_encaminhamento === chipKey.slice(4)
    if (chipKey.startsWith('bat:')) return c.subetapa_batismo === chipKey.slice(4)
  }
  return false
}

function pageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const nums: (number | '...')[] = [1]
  if (current > 3) nums.push('...')
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) nums.push(i)
  if (current < total - 2) nums.push('...')
  nums.push(total)
  return nums
}

// ─── Componente ──────────────────────────────────────────────────────────────

export function DrillDownPanel({ fase, contacts, onClose, onCard }: Props) {
  const chips = CHIPS[fase] ?? []
  const [activeChip, setActiveChip] = useState<string | null>(DEFAULT_CHIP[fase] ?? null)
  const [page, setPage] = useState(1)

  // Ordenar todos por urgência
  const sorted = useMemo(() => {
    const ord = { over: 0, warn: 1, ok: 2 }
    return [...contacts].sort((a, b) => ord[calcularSLAFase(a)] - ord[calcularSLAFase(b)])
  }, [contacts])

  // Contagens por chip
  const contagemChip = useMemo(() => {
    const c: Record<string, number> = {}
    for (const contact of sorted) {
      if (fase === 'POS_AULA') {
        if (contact.subetapa_encaminhamento) {
          const k = `enc:${contact.subetapa_encaminhamento}`
          c[k] = (c[k] ?? 0) + 1
        }
        if (contact.subetapa_batismo) {
          const k = `bat:${contact.subetapa_batismo}`
          c[k] = (c[k] ?? 0) + 1
        }
      } else {
        const k = getContactChipKey(contact, fase)
        if (k !== '__multi__') c[k] = (c[k] ?? 0) + 1
      }
    }
    return c
  }, [sorted, fase])

  // Filtrar por chip ativo
  const filtered = useMemo(() => {
    if (!activeChip || fase === 'AULAS') return sorted
    return sorted.filter(c => matchesChip(c, activeChip, fase))
  }, [sorted, activeChip, fase])

  // Paginar
  const total = filtered.length
  const totalPages = Math.ceil(total / PER_PAGE)
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  function handleChipClick(key: string) {
    setActiveChip(activeChip === key ? null : key)
    setPage(1)
  }

  const urgentes = contacts.filter(c => calcularSLAFase(c) === 'over').length

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full sm:w-[440px] z-50 bg-card border-l border-border flex flex-col animate-slide-in-right overflow-hidden">

        {/* Header */}
        <div className="px-4 py-3.5 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between mb-0.5">
            <h2 className="text-sm font-semibold text-offwhite">{FASE_LABELS[fase]}</h2>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
              <X size={18} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground">{contacts.length} leads</p>
            {urgentes > 0 && (
              <span className="text-[10px] text-red-400 font-medium">⚠ {urgentes} urgente{urgentes !== 1 ? 's' : ''}</span>
            )}
          </div>
        </div>

        {/* Chips de subetapa */}
        {chips.length > 0 && (
          <div
            className="flex gap-2 px-4 py-2.5 border-b border-border overflow-x-auto flex-shrink-0 scrollbar-none"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {chips.map(chip => {
              const isActive = activeChip === chip.key
              const cnt = contagemChip[chip.key] ?? 0
              return (
                <button
                  key={chip.key}
                  onClick={() => handleChipClick(chip.key)}
                  style={{ flexShrink: 0 }}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all whitespace-nowrap',
                    isActive
                      ? 'bg-menta-light text-petroleo border-menta-light'
                      : 'bg-transparent text-muted-foreground border-border hover:text-foreground',
                  )}
                >
                  {chip.label}
                  <span className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded-full',
                    isActive ? 'bg-white/25' : 'bg-muted',
                    cnt === 0 && 'opacity-50',
                  )}>
                    {cnt}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* Lista */}
        <div className="flex-1 overflow-y-auto p-4">
          {paginated.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum lead nesta etapa.</p>
          ) : (
            <div className="space-y-1.5">
              {paginated.map(c => (
                <CardLeadLista key={c.id} contact={c} onClick={onCard} />
              ))}
            </div>
          )}

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 mt-2 border-t border-border">
              <span className="text-xs text-muted-foreground">
                {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, total)} de {total}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
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
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="w-7 h-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
