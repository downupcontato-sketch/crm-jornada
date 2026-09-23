import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { calcularSLAFase, FASE_LABELS } from '@/lib/pipeline'
import { CardLeadLista } from './CardLeadLista'
import { FASE_SLUG } from '@/lib/pipelineRoutes'
import type { Contact, FasePipeline } from '@/types/database'

const CHIPS: Record<string, { key: string; label: string }[]> = {
  CONTATO_INICIAL: [
    { key: 'TENTATIVA_1', label: '1ª tentativa' },
    { key: 'TENTATIVA_2', label: '2ª tentativa' },
    { key: 'TENTATIVA_3', label: '3ª tentativa' },
  ],
  QUALIFICACAO: [
    { key: 'CONVERSA',          label: 'Conversa' },
    { key: 'PERFIL_CONFIRMADO', label: 'Perfil confirmado' },
    { key: 'CONVITE_ENVIADO',   label: 'Convite enviado' },
    { key: 'AGUARDANDO_PROVER', label: 'PROVER pendente' },
    { key: 'PROVER_CONFIRMADO', label: 'PROVER confirmado' },
  ],
  POS_AULA: [
    { key: 'enc:ENCAMINHADO',          label: 'Encaminhado' },
    { key: 'enc:HANDS_OFF_CONFIRMADO', label: 'Hands-off ✓' },
    { key: 'bat:DECIDIU_BATIZAR',      label: 'Decidiu batizar' },
    { key: 'bat:LISTA_ESPERA',         label: 'Lista de espera' },
    { key: 'bat:INSCRICAO_CONFIRMADA', label: 'Inscrição confirmada' },
    { key: 'bat:AULA_BATISMO',         label: 'Aula de batismo' },
    { key: 'bat:CUMPRE_REQUISITOS',    label: 'Cumpre requisitos' },
    { key: 'bat:BATISMO_AGENDADO',     label: 'Agendado ✓' },
  ],
}

const DEFAULT_CHIP: Partial<Record<FasePipeline, string>> = {
  CONTATO_INICIAL: 'TENTATIVA_1',
  QUALIFICACAO:    'CONVERSA',
  POS_AULA:        'enc:ENCAMINHADO',
}

// Lead sem subetapa (ou com valor fora dos chips) cai no chip padrão da fase.
// Antes ele não casava com nenhum chip e sumia da lista, mesmo contando no total.
function getChipKey(c: Contact, fase: FasePipeline): string {
  const validos = (CHIPS[fase] ?? []).map(ch => ch.key)
  if (fase === 'CONTATO_INICIAL' || fase === 'QUALIFICACAO') {
    const sub = fase === 'CONTATO_INICIAL' ? c.subetapa_contato : c.subetapa_qualificacao
    return sub && validos.includes(sub) ? sub : DEFAULT_CHIP[fase] ?? ''
  }
  return ''
}

function matchesChip(c: Contact, chipKey: string, fase: FasePipeline): boolean {
  if (fase === 'AULAS') return true
  if (fase === 'POS_AULA') {
    const semTrilha = !c.subetapa_encaminhamento && !c.subetapa_batismo
    if (chipKey === DEFAULT_CHIP.POS_AULA && semTrilha) return true
    if (chipKey.startsWith('enc:')) return c.subetapa_encaminhamento === chipKey.slice(4)
    if (chipKey.startsWith('bat:')) return c.subetapa_batismo === chipKey.slice(4)
    return false
  }
  return getChipKey(c, fase) === chipKey
}

// Busca por nome ou telefone (qualquer formatação), ignorando acentos.
function normalizar(txt: string): string {
  return txt.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function matchesBusca(c: Contact, busca: string): boolean {
  const termo = normalizar(busca)
  if (!termo) return true
  if (normalizar(c.nome ?? '').includes(termo)) return true
  const digitos = busca.replace(/\D/g, '')
  if (digitos.length < 3) return false
  const tel = (c.telefone ?? '').replace(/\D/g, '')
  const semDdi = digitos.replace(/^55(?=\d{10,11}$)/, '')
  return tel.includes(digitos) || tel.includes(semDdi)
}

const PER_PAGE = 30

interface Props {
  fase: FasePipeline
  contacts: Contact[]
  isLoading: boolean
  volMap?: Record<string, string>
  volFiltro?: string | null
  onClearVolFiltro?: () => void
}

export function PipelineLeadList({ fase, contacts, isLoading, volMap, volFiltro, onClearVolFiltro }: Props) {
  const navigate = useNavigate()
  const { id: selectedId } = useParams<{ id: string }>()

  const chips = CHIPS[fase] ?? []
  const [activeChip, setActiveChip] = useState<string | null>(DEFAULT_CHIP[fase] ?? null)
  const [page, setPage] = useState(1)
  const [busca, setBusca] = useState('')

  const sorted = useMemo(() => {
    const ord: Record<string, number> = { over: 0, warn: 1, ok: 2 }
    return [...contacts].sort((a, b) => ord[calcularSLAFase(a)] - ord[calcularSLAFase(b)])
  }, [contacts])

  const contagemChip = useMemo(() => {
    const map: Record<string, number> = {}
    for (const c of sorted) {
      if (fase === 'POS_AULA') {
        if (c.subetapa_encaminhamento) { const k = `enc:${c.subetapa_encaminhamento}`; map[k] = (map[k] ?? 0) + 1 }
        if (c.subetapa_batismo)        { const k = `bat:${c.subetapa_batismo}`;        map[k] = (map[k] ?? 0) + 1 }
        if (!c.subetapa_encaminhamento && !c.subetapa_batismo) { const k = DEFAULT_CHIP.POS_AULA!; map[k] = (map[k] ?? 0) + 1 }
      } else {
        const k = getChipKey(c, fase)
        if (k) map[k] = (map[k] ?? 0) + 1
      }
    }
    return map
  }, [sorted, fase])

  // Com busca ativa procura em todas as subetapas da fase, não só no chip selecionado.
  const filtered = useMemo(() => {
    if (busca.trim()) return sorted.filter(c => matchesBusca(c, busca))
    if (!activeChip || fase === 'AULAS') return sorted
    return sorted.filter(c => matchesChip(c, activeChip, fase))
  }, [sorted, activeChip, fase, busca])

  const totalPages = Math.ceil(filtered.length / PER_PAGE)
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const urgentes = contacts.filter(c => calcularSLAFase(c) === 'over').length

  function handleChip(key: string) {
    setActiveChip(prev => prev === key ? null : key)
    setPage(1)
  }

  function handleSelect(c: Contact) {
    navigate(`/pipeline/${FASE_SLUG[fase]}/lead/${c.id}`, { replace: true })
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-offwhite">{FASE_LABELS[fase]}</h2>
          {urgentes > 0 && (
            <span className="text-[10px] text-red-400 font-medium bg-red-400/10 px-2 py-0.5 rounded-full">
              ⚠ {urgentes}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{contacts.length} vidas</p>
        {volFiltro && volMap?.[volFiltro] && onClearVolFiltro && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="text-[10px] text-menta-light bg-menta-light/10 border border-menta-light/20 px-2 py-0.5 rounded-full">
              Voluntário: {volMap[volFiltro].split(' ')[0]}
            </span>
            <button onClick={onClearVolFiltro} className="text-[10px] text-muted-foreground hover:text-red-400 transition-colors">✕</button>
          </div>
        )}
      </div>

      {/* Busca */}
      <div className="px-3 py-2 border-b border-border flex-shrink-0">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className="zion-input pl-8 pr-7 text-xs w-full"
            placeholder="Buscar por nome ou telefone…"
            value={busca}
            onChange={e => { setBusca(e.target.value); setPage(1) }}
          />
          {busca && (
            <button onClick={() => { setBusca(''); setPage(1) }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Chips */}
      {chips.length > 0 && !busca.trim() && (
        <div className="flex gap-1.5 px-3 py-2 border-b border-border overflow-x-auto flex-shrink-0 scrollbar-none"
          style={{ WebkitOverflowScrolling: 'touch' }}>
          {chips.map(chip => {
            const isActive = activeChip === chip.key
            const cnt = contagemChip[chip.key] ?? 0
            return (
              <button key={chip.key} onClick={() => handleChip(chip.key)} style={{ flexShrink: 0 }}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all whitespace-nowrap',
                  isActive
                    ? 'bg-menta-light text-petroleo border-menta-light'
                    : 'bg-transparent text-muted-foreground border-border hover:text-foreground',
                )}>
                {chip.label}
                <span className={cn('text-[9px] px-1 py-0.5 rounded-full', isActive ? 'bg-white/25' : 'bg-muted', cnt === 0 && 'opacity-40')}>
                  {cnt}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-menta-light border-t-transparent rounded-full animate-spin" />
          </div>
        ) : paginated.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {busca.trim() ? 'Nenhuma vida encontrada nesta etapa.' : 'Nenhuma vida nesta etapa.'}
          </p>
        ) : paginated.map(c => (
          <CardLeadLista
            key={c.id}
            contact={c}
            onClick={handleSelect}
            isSelected={selectedId === c.id}
            volNome={c.voluntario_atribuido_id ? volMap?.[c.voluntario_atribuido_id] : undefined}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-border flex-shrink-0">
          <span className="text-[10px] text-muted-foreground">
            {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filtered.length)} / {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-30">
              <ChevronLeft size={12} />
            </button>
            <span className="text-xs text-muted-foreground">{page}/{totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-30">
              <ChevronRight size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
