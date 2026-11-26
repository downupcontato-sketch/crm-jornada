import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { FASE_LABELS } from '@/lib/pipeline'
import type { FasePipeline } from '@/types/database'

interface Checkin {
  id: string; aula: number; nome: string; telefone: string; motivo: string | null; created_at: string
  contact_id: string | null; contacts: { nome: string } | null
}
interface Vida { id: string; nome: string; telefone: string; fase_pipeline: FasePipeline }

export function useCheckinsPendentes() {
  const { isAdmin, isLider, isCoordenador } = useAuth()
  return useQuery({
    queryKey: ['checkins-pendentes'],
    enabled: isAdmin || isLider || isCoordenador,
    queryFn: async () => {
      const { data, error } = await supabase.from('checkins_aula')
        .select('id,aula,nome,telefone,motivo,created_at,contact_id,contacts(nome)')
        .eq('status', 'pendente').order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as Checkin[]
    },
    refetchInterval: 60_000,
  })
}

/** Check-ins que o sistema não conseguiu confirmar sozinho: a equipe vincula à vida certa. */
export function CheckinsPendentes({ onClose, onResolvido }: { onClose: () => void; onResolvido: () => void }) {
  const qc = useQueryClient()
  const { data: checkins = [], isLoading } = useCheckinsPendentes()
  const [busca, setBusca] = useState<Record<string, string>>({})
  const [resultados, setResultados] = useState<Record<string, Vida[]>>({})
  const [salvando, setSalvando] = useState<string | null>(null)

  async function buscar(ck: Checkin) {
    const termo = (busca[ck.id] ?? '').trim()
    if (!termo) return
    const dig = termo.replace(/\D/g, '')
    const filtro = dig.length >= 4
      ? `telefone_digits.like.%${dig.slice(-8)}%`
      : `nome.ilike.%${termo.replace(/[,()%]/g, ' ')}%`
    const { data } = await supabase.from('contacts').select('id,nome,telefone,fase_pipeline').or(filtro).limit(6)
    setResultados(r => ({ ...r, [ck.id]: (data ?? []) as Vida[] }))
  }

  async function confirmar(ck: Checkin, contactId: string) {
    setSalvando(ck.id)
    const { error } = await supabase.rpc('confirmar_checkin', { p_checkin_id: ck.id, p_contact_id: contactId })
    setSalvando(null)
    if (error) return toast.error(`Não foi possível confirmar: ${error.message}`)
    toast.success(`Presença na Aula ${ck.aula} confirmada`)
    qc.invalidateQueries({ queryKey: ['checkins-pendentes'] })
    onResolvido()
  }

  async function descartar(ck: Checkin) {
    setSalvando(ck.id)
    const { error } = await supabase.from('checkins_aula')
      .update({ status: 'descartado', resolvido_em: new Date().toISOString() }).eq('id', ck.id)
    setSalvando(null)
    if (error) return toast.error('Não foi possível descartar')
    qc.invalidateQueries({ queryKey: ['checkins-pendentes'] })
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <aside role="dialog" aria-label="Check-ins para confirmar"
        className="fixed right-0 top-0 h-full w-full sm:w-[480px] z-50 bg-card border-l border-border flex flex-col">
        <div className="px-5 py-4 border-b border-border flex items-center gap-3">
          <div>
            <h3 className="font-semibold text-offwhite">Check-ins para confirmar</h3>
            <p className="text-xs text-muted-foreground">O sistema não reconheceu a pessoa sozinho. Vincule à vida certa.</p>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="ml-auto text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {isLoading && <p className="text-sm text-muted-foreground text-center py-8">Carregando…</p>}
          {!isLoading && checkins.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum check-in pendente.</p>
          )}
          {checkins.map(ck => (
            <div key={ck.id} className="border border-border rounded-xl p-3 flex flex-col gap-2">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-offwhite">{ck.nome}</p>
                  <p className="text-xs text-muted-foreground">{ck.telefone} · Aula {ck.aula} · {format(new Date(ck.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}</p>
                  {ck.motivo && <p className="text-xs text-yellow-400 mt-1">{ck.motivo}</p>}
                </div>
                <button onClick={() => descartar(ck)} disabled={salvando === ck.id}
                  className="text-xs text-muted-foreground hover:text-red-400">Descartar</button>
              </div>

              {ck.contact_id && ck.contacts && (
                <button onClick={() => confirmar(ck, ck.contact_id!)} disabled={salvando === ck.id}
                  className="zion-btn-primary text-xs py-2">
                  Confirmar presença em {ck.contacts.nome}
                </button>
              )}

              <form className="flex gap-2" onSubmit={e => { e.preventDefault(); buscar(ck) }}>
                <div className="relative flex-1 min-w-0">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input className="zion-input text-xs pl-7 w-full" placeholder="Buscar outra vida por nome ou telefone"
                    value={busca[ck.id] ?? ''} onChange={e => setBusca(b => ({ ...b, [ck.id]: e.target.value }))} />
                </div>
                <button type="submit" className="text-xs px-3 rounded-lg border border-border hover:border-menta-light/50">Buscar</button>
              </form>
              {resultados[ck.id]?.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhuma vida encontrada. Cadastre em "Novo Cadastro" e busque de novo.</p>
              )}
              {resultados[ck.id]?.map(v => (
                <div key={v.id} className="flex items-center gap-2 text-xs bg-muted/20 rounded-lg px-2.5 py-2">
                  <span className="flex-1 min-w-0 truncate">{v.nome} · {v.telefone} · {FASE_LABELS[v.fase_pipeline] ?? v.fase_pipeline}</span>
                  <button onClick={() => confirmar(ck, v.id)} disabled={salvando === ck.id}
                    className="text-menta-light font-semibold hover:underline shrink-0">Confirmar</button>
                </div>
              ))}
            </div>
          ))}
        </div>
      </aside>
    </>
  )
}
