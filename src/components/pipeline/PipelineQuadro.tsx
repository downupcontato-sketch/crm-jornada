import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, QrCode, X } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import { buscarTodos } from '@/lib/queries/buscarTodos'
import { COORDINATOR_CONTACT_FILTER } from '@/lib/queries/filters'
import { COLUNAS_JORNADA, camposParaColunaJornada, colunaJornada } from '@/lib/quadro'
import { QuadroKanban } from './QuadroKanban'
import { PipelineLider } from './PipelineLider'
import type { Contact, ContactStatus, FasePipeline } from '@/types/database'

/** Vidas do quadro, com a mesma regra de visibilidade do pipeline: coordenador vê o próprio grupo, só as distribuídas. */
export function useVidasQuadro(chave: string, fases: FasePipeline[], status?: ContactStatus[], ou?: string) {
  const { profile, canSeeAllContacts } = useAuth()
  const qc = useQueryClient()
  const queryKey = ['quadro', chave, canSeeAllContacts, profile?.grupo]
  const vidas = useQuery({
    queryKey,
    queryFn: () => buscarTodos<Contact>((de, ate) => {
      let q = supabase.from('contacts').select('*').in('fase_pipeline', fases)
      if (status) q = q.in('status', status)
      if (ou) q = q.or(ou)
      if (!canSeeAllContacts) {
        if (profile?.grupo) q = q.eq('grupo', profile.grupo)
        q = q.eq('atribuido_por_coordenador', COORDINATOR_CONTACT_FILTER.atribuido_por_coordenador)
      }
      return q.order('id', { ascending: true }).range(de, ate)
    }),
  })
  const nomes = useQuery({
    queryKey: ['quadro-nomes'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id,nome')
      return Object.fromEntries((data ?? []).map(p => [p.id, p.nome])) as Record<string, string>
    },
    staleTime: 5 * 60 * 1000,
  })
  return { vidas, nomes: nomes.data ?? {}, recarregar: () => qc.invalidateQueries({ queryKey: ['quadro'] }) }
}

export function EstadoQuadro({ isLoading, error }: { isLoading: boolean; error: unknown }) {
  if (error) return (
    <div className="text-center py-16 text-red-400 text-sm flex items-center justify-center gap-2">
      <AlertTriangle size={16} /> Erro ao carregar: {(error as Error).message}
    </div>
  )
  if (isLoading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-8 h-8 border-2 border-menta-light border-t-transparent rounded-full animate-spin" />
    </div>
  )
  return null
}

function ModalCheckin({ aula, onClose }: { aula: number; onClose: () => void }) {
  const link = `${window.location.origin}/checkin/${aula}`
  async function copiar() {
    try { await navigator.clipboard.writeText(link); toast.success('Link copiado') }
    catch { toast.error('Não foi possível copiar. Selecione o link e copie.') }
  }
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <div role="dialog" aria-label={`Check-in da Aula ${aula}`}
        className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(22rem,calc(100vw-2rem))] bg-card border border-border rounded-2xl p-5 flex flex-col items-center gap-4">
        <div className="flex items-center w-full">
          <h3 className="font-semibold text-offwhite">Check-in · Aula {aula}</h3>
          <button onClick={onClose} aria-label="Fechar" className="ml-auto text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <div className="bg-white p-3 rounded-xl"><QRCodeSVG value={link} size={200} /></div>
        <p className="text-xs text-muted-foreground text-center">
          O aluno abre, informa nome e WhatsApp do cadastro e a presença é registrada.
        </p>
        <div className="flex gap-2 w-full">
          <input readOnly value={link} onFocus={e => e.target.select()} aria-label="Link de check-in"
            className="zion-input text-xs flex-1 min-w-0" />
          <button onClick={copiar} className="zion-btn-primary text-xs px-3 py-2">Copiar</button>
        </div>
      </div>
    </>
  )
}

export function PipelineQuadro() {
  const [visao, setVisao] = useState<'quadro' | 'voluntario'>('quadro')
  const [checkin, setCheckin] = useState<number | null>(null)
  const { vidas, nomes, recarregar } = useVidasQuadro('jornada', ['CONTATO_INICIAL', 'QUALIFICACAO', 'AULAS', 'POS_AULA'], ['ativo'])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex bg-card border border-border rounded-lg p-1 self-start">
        {([['quadro', 'Quadro'], ['voluntario', 'Por voluntário']] as const).map(([v, label]) => (
          <button key={v} onClick={() => setVisao(v)} aria-pressed={visao === v}
            className={cn('text-xs font-semibold px-3 py-1.5 rounded-md transition-all',
              visao === v ? 'bg-menta-light text-petroleo' : 'text-muted-foreground hover:text-foreground')}>
            {label}
          </button>
        ))}
      </div>
      {visao === 'voluntario' && <PipelineLider />}
      {visao === 'quadro' && <EstadoQuadro isLoading={vidas.isLoading} error={vidas.error} />}
      {visao === 'quadro' && !vidas.isLoading && !vidas.error && (
        <QuadroKanban colunas={COLUNAS_JORNADA} contacts={vidas.data ?? []} nomes={nomes}
          colunaDe={colunaJornada} campos={camposParaColunaJornada} onAtualizado={recarregar}
          avisoMovimento="As aulas 2, 3 e 4 avançam pelo check-in do aluno ou pela presença registrada na ficha."
          acaoColuna={id => id.startsWith('AULA_') && (
            <button onClick={() => setCheckin(Number(id.slice(5)))}
              className="mt-2 w-full flex items-center justify-center gap-1.5 text-[11px] font-semibold py-1.5 rounded-md border border-menta-light/40 text-menta-light hover:bg-menta-light/10">
              <QrCode size={13} /> Link de check-in
            </button>
          )} />
      )}
      {checkin && <ModalCheckin aula={checkin} onClose={() => setCheckin(null)} />}
    </div>
  )
}
