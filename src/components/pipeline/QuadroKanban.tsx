import { useMemo, useState, type ReactNode } from 'react'
import { Search } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { cn, getGrupoLabel, getTipoLabel } from '@/lib/utils'
import { diasNaEtapa, moverVida, situacaoPrazo, type DefColuna } from '@/lib/quadro'
import { DrawerLead } from './DrawerLead'
import type { Contact, ContactGrupo } from '@/types/database'

const GRUPOS: ContactGrupo[] = ['rise', 'flow', 'vox', 'ek', 'zion_geral']
const SEM = '__sem'

const COR_PRAZO = {
  ok: 'text-muted-foreground',
  atencao: 'text-yellow-400',
  atrasada: 'text-red-400',
} as const

const BORDA_PRAZO = {
  ok: 'border-l-transparent',
  atencao: 'border-l-yellow-400',
  atrasada: 'border-l-red-500',
} as const

interface Props<T extends string> {
  colunas: DefColuna<T>[]
  contacts: Contact[]
  nomes: Record<string, string>
  colunaDe: (c: Contact) => T | null
  /** Campos a gravar para ir à coluna; null = esse movimento é feito pela ficha. */
  campos: (c: Contact, destino: T) => Partial<Contact> | null
  avisoMovimento?: string
  /** Botão extra no topo da coluna (ex.: link de check-in das aulas). */
  acaoColuna?: (id: T) => ReactNode
  /** Conteúdo extra abaixo do card (ex.: aulas sem registro). */
  rodapeCard?: (c: Contact) => ReactNode
  onAtualizado: () => void
}

export function QuadroKanban<T extends string>({
  colunas, contacts, nomes, colunaDe, campos, avisoMovimento, acaoColuna, rodapeCard, onAtualizado,
}: Props<T>) {
  const { profile } = useAuth()
  const [busca, setBusca] = useState('')
  const [resp, setResp] = useState('')
  const [cad, setCad] = useState('')
  const [grupos, setGrupos] = useState<Set<ContactGrupo>>(new Set())
  const [aberto, setAberto] = useState<Contact | null>(null)
  const [arrastando, setArrastando] = useState<Contact | null>(null)
  const [sobre, setSobre] = useState<T | null>(null)

  const prazoDe = useMemo(() => new Map(colunas.map(c => [c.id, c.prazoDias])), [colunas])
  const cadastrantes = useMemo(
    () => [...new Set(contacts.map(c => c.cadastrado_por_nome).filter(Boolean) as string[])].sort(),
    [contacts],
  )
  const responsaveis = useMemo(
    () => [...new Set(contacts.map(c => c.voluntario_atribuido_id).filter(Boolean) as string[])]
      .sort((a, b) => (nomes[a] ?? '').localeCompare(nomes[b] ?? '')),
    [contacts, nomes],
  )

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const digitos = busca.replace(/\D/g, '')
    return contacts.filter(c =>
      (!termo || c.nome.toLowerCase().includes(termo) || (digitos.length >= 3 && c.telefone.replace(/\D/g, '').includes(digitos)))
      && (!resp || (resp === SEM ? !c.voluntario_atribuido_id : c.voluntario_atribuido_id === resp))
      && (!cad || c.cadastrado_por_nome === cad)
      && (!grupos.size || grupos.has(c.grupo)))
  }, [contacts, busca, resp, cad, grupos])

  const porColuna = useMemo(() => {
    const m = new Map<T, Contact[]>(colunas.map(c => [c.id, []]))
    for (const c of visiveis) {
      const col = colunaDe(c)
      if (col) m.get(col)?.push(c)
    }
    // Quem está há mais tempo parado aparece primeiro.
    for (const lista of m.values()) lista.sort((a, b) => diasNaEtapa(b) - diasNaEtapa(a))
    return m
  }, [visiveis, colunas, colunaDe])

  const prazo = (c: Contact) => {
    const col = colunaDe(c)
    return situacaoPrazo(diasNaEtapa(c), col ? prazoDe.get(col) : undefined)
  }
  const atrasadas = visiveis.filter(c => prazo(c) === 'atrasada').length
  const semResp = visiveis.filter(c => !c.voluntario_atribuido_id).length

  async function soltar(destino: T) {
    const c = arrastando
    setArrastando(null); setSobre(null)
    if (!c || !profile) return
    const origem = colunaDe(c)
    if (origem === destino) return
    const upd = campos(c, destino)
    if (!upd) { toast.info(avisoMovimento ?? 'Esse movimento é feito pela ficha da vida.'); return }
    const nome = (id: T | null) => colunas.find(x => x.id === id)?.nome ?? '—'
    try {
      await moverVida(c, upd, nome(origem), nome(destino), profile.id)
      toast.success(`${c.nome.split(' ')[0]} foi para ${nome(destino)}`)
      onAtualizado()
    } catch {
      toast.error('Não foi possível mover. Tente pela ficha da vida.')
    }
  }

  function toggleGrupo(g: ContactGrupo) {
    setGrupos(s => { const n = new Set(s); if (n.has(g)) n.delete(g); else n.add(g); return n })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Resumo */}
      <div className="flex gap-5 text-xs text-muted-foreground tabular-nums flex-wrap">
        <span><b className="text-offwhite text-base">{visiveis.length}</b> vidas</span>
        <span><b className="text-red-400 text-base">{atrasadas}</b> passaram do prazo</span>
        <span><b className="text-offwhite text-base">{semResp}</b> sem responsável</span>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input className="zion-input pl-8 text-sm w-full" placeholder="Buscar por nome ou telefone…"
            value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <select className="zion-input text-sm" value={resp} onChange={e => setResp(e.target.value)} aria-label="Responsável">
          <option value="">Todos os responsáveis</option>
          <option value={SEM}>Sem responsável</option>
          {responsaveis.map(id => <option key={id} value={id}>{nomes[id] ?? 'Sem nome'}</option>)}
        </select>
        <select className="zion-input text-sm" value={cad} onChange={e => setCad(e.target.value)} aria-label="Cadastrado por">
          <option value="">Cadastrado por: todos</option>
          {cadastrantes.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <div className="flex gap-1.5 flex-wrap">
          {GRUPOS.map(g => (
            <button key={g} onClick={() => toggleGrupo(g)} aria-pressed={grupos.has(g)}
              className={cn('text-xs px-3 py-1.5 rounded-lg border font-medium transition-all',
                grupos.has(g) ? 'bg-menta-light/15 border-menta-light/40 text-menta-light'
                  : 'border-border text-muted-foreground hover:text-foreground')}>
              {getGrupoLabel(g)}
            </button>
          ))}
        </div>
      </div>

      {/* Colunas */}
      <div className="flex gap-3 overflow-x-auto pb-3 -mx-1 px-1">
        {colunas.map(col => {
          const lista = porColuna.get(col.id) ?? []
          return (
            <section key={col.id} aria-label={col.nome}
              onDragOver={e => { if (arrastando) { e.preventDefault(); setSobre(col.id) } }}
              onDragLeave={() => setSobre(s => (s === col.id ? null : s))}
              onDrop={e => { e.preventDefault(); soltar(col.id) }}
              className={cn('w-64 shrink-0 flex flex-col rounded-xl border bg-card/50 max-h-[calc(100vh-280px)] min-h-[200px]',
                sobre === col.id ? 'border-menta-light' : 'border-border')}>
              <div className="px-3 py-2.5 border-b border-border">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-offwhite">{col.nome}</h3>
                  <span className="ml-auto text-[11px] bg-muted rounded-full px-2 tabular-nums">{lista.length}</span>
                </div>
                {(col.desc || col.prazoDias) && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {[col.desc, col.prazoDias && `prazo ${col.prazoDias} dias`].filter(Boolean).join(' · ')}
                  </p>
                )}
                {acaoColuna?.(col.id)}
              </div>
              <div className="p-2 flex flex-col gap-2 overflow-y-auto">
                {lista.length === 0 && <p className="text-[11px] text-muted-foreground text-center py-4">Nenhuma vida aqui</p>}
                {lista.map(c => {
                  const dias = diasNaEtapa(c)
                  const p = situacaoPrazo(dias, col.prazoDias)
                  const responsavel = c.voluntario_atribuido_id ? nomes[c.voluntario_atribuido_id] : null
                  return (
                    <div key={c.id} className="flex flex-col gap-1">
                    <button draggable
                      onDragStart={e => { setArrastando(c); e.dataTransfer.effectAllowed = 'move' }}
                      onDragEnd={() => { setArrastando(null); setSobre(null) }}
                      onClick={() => setAberto(c)}
                      className={cn('text-left bg-card border border-border border-l-[3px] rounded-lg p-2.5 flex flex-col gap-1.5 hover:border-menta/60 transition-colors', BORDA_PRAZO[p])}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-offwhite truncate flex-1">{c.nome}</span>
                        <span className="text-[10px] font-bold text-menta-light">{getGrupoLabel(c.grupo)}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">{getTipoLabel(c.tipo)}</span>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className={cn('truncate flex-1', !responsavel && 'text-yellow-400/80')}>
                          {responsavel ?? 'Sem responsável'}
                        </span>
                        <span className={cn('font-semibold tabular-nums', COR_PRAZO[p])} title="Dias nesta etapa">{dias}d</span>
                      </div>
                    </button>
                    {rodapeCard?.(c)}
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>

      {aberto && (
        <DrawerLead contact={aberto} onClose={() => setAberto(null)}
          onUpdated={upd => { setAberto(a => (a ? { ...a, ...upd } : a)); onAtualizado() }} />
      )}
    </div>
  )
}
