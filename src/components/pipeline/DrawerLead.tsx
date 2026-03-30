import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { X, Phone, MessageSquare, ChevronRight, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { cn, formatPhone, getGrupoLabel, getTipoLabel, getTipoBadgeColor } from '@/lib/utils'
import {
  avancarSubetapa, ativarTrilhaBatismo, calcularFrequencia, calcularSLAFase,
  proximaSubetapaLabel, trilhaProgresso, FASE_LABELS,
} from '@/lib/pipeline'
import { ModalPerda } from './ModalPerda'
import type { Contact, LeadHistorico } from '@/types/database'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface Props {
  contact: Contact
  onClose: () => void
  onUpdated: (upd: Partial<Contact>) => void
}

const TIPO_HIST: Record<string, { label: string; cor: string }> = {
  AVANCO_ETAPA:    { label: 'Avanço',        cor: 'text-menta-light' },
  PRESENCA:        { label: 'Presença',       cor: 'text-emerald-400' },
  PERDA:           { label: 'Perda',          cor: 'text-red-400' },
  REENCAMINHAMENTO:{ label: 'Reencaminh.',    cor: 'text-yellow-400' },
  CONTATO:         { label: 'Contato',        cor: 'text-blue-400' },
  EDICAO:          { label: 'Edição',         cor: 'text-muted-foreground' },
}

export function DrawerLead({ contact: initial, onClose, onUpdated }: Props) {
  const { profile } = useAuth()
  const qc = useQueryClient()
  const [contact, setContact] = useState(initial)
  const [advancing, setAdvancing] = useState(false)
  const [showPerda, setShowPerda] = useState(false)

  const sla = calcularSLAFase(contact)
  const freq = calcularFrequencia(contact)
  const progresso = trilhaProgresso(contact)
  const podeAvancar = !['AULAS','BATIZADO','PERDIDO','REENCAMINHADO'].includes(contact.fase_pipeline) ||
    (contact.fase_pipeline === 'POS_AULA' && (contact.subetapa_encaminhamento || contact.subetapa_batismo))

  const { data: historico } = useQuery({
    queryKey: ['lead-historico', contact.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('lead_historico')
        .select('*,profiles(nome)')
        .eq('contact_id', contact.id)
        .order('created_at', { ascending: false })
        .limit(20)
      return (data ?? []) as (LeadHistorico & { profiles: { nome: string } | null })[]
    },
  })

  async function handleAvancar() {
    if (!profile) return
    setAdvancing(true)
    try {
      const upd = await avancarSubetapa(contact, profile.id)
      if (upd) {
        const novo = { ...contact, ...upd }
        setContact(novo as Contact)
        onUpdated(upd)
        qc.invalidateQueries({ queryKey: ['lead-historico', contact.id] })
        toast.success('Etapa avançada!')
      }
    } catch {
      toast.error('Erro ao avançar etapa')
    } finally {
      setAdvancing(false)
    }
  }

  async function handleBatismo() {
    if (!profile) return
    try {
      await ativarTrilhaBatismo(contact, profile.id)
      const upd = { subetapa_batismo: 'DECIDIU_BATIZAR' as const }
      setContact({ ...contact, ...upd })
      onUpdated(upd)
      qc.invalidateQueries({ queryKey: ['lead-historico', contact.id] })
      toast.success('Trilha de batismo ativada!')
    } catch {
      toast.error('Erro ao ativar trilha')
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full sm:w-[500px] z-50 bg-card border-l border-border flex flex-col animate-slide-in-right overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-offwhite truncate">{contact.nome}</h2>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', getTipoBadgeColor(contact.tipo))}>
                {getTipoLabel(contact.tipo)}
              </span>
              <span className="text-xs text-muted-foreground">{FASE_LABELS[contact.fase_pipeline]}</span>
              <span className={cn('text-xs font-medium', {
                ok: 'text-emerald-400', warn: 'text-yellow-400', over: 'text-red-400'
              }[sla])}>
                SLA {sla === 'ok' ? '✓' : sla === 'warn' ? '⚠' : '⚠⚠'}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 flex-shrink-0"><X size={20}/></button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Botão Avançar */}
          {podeAvancar && (
            <div className="px-5 pt-4">
              <button
                onClick={handleAvancar}
                disabled={advancing}
                className="w-full zion-btn-primary flex items-center justify-center gap-2 text-sm py-3"
              >
                {advancing ? (
                  <div className="w-4 h-4 border-2 border-petroleo border-t-transparent rounded-full animate-spin"/>
                ) : (
                  <><ChevronRight size={16}/>{proximaSubetapaLabel(contact)}</>
                )}
              </button>
            </div>
          )}

          {/* Ativar batismo (POS_AULA sem trilha) */}
          {contact.fase_pipeline === 'POS_AULA' && !contact.subetapa_batismo && (
            <div className="px-5 pt-3">
              <button
                onClick={handleBatismo}
                className="w-full py-2 rounded-lg text-sm font-medium bg-purple-500/10 text-purple-400 border border-purple-500/30 hover:bg-purple-500/20 transition-all"
              >
                ✝ Registrar decisão de batismo
              </button>
            </div>
          )}

          {/* Aulas — frequência */}
          {contact.fase_pipeline === 'AULAS' && (
            <div className="px-5 pt-4">
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-2">Frequência nas Aulas</p>
                <div className="flex gap-2 mb-1">
                  {[1,2,3,4].map(n => {
                    const presenca = contact[`presenca_aula${n}` as keyof Contact] as boolean | null
                    return (
                      <div key={n} className={cn(
                        'flex-1 h-8 rounded-lg flex items-center justify-center text-xs font-bold border',
                        presenca === true  && 'bg-emerald-500/20 border-emerald-500 text-emerald-400',
                        presenca === false && 'bg-red-500/20 border-red-500 text-red-400',
                        presenca === null  && 'bg-muted/30 border-border text-muted-foreground',
                      )}>
                        {presenca === true ? '✓' : presenca === false ? '✗' : n}
                      </div>
                    )
                  })}
                </div>
                <p className={cn('text-xs text-center', freq.atingiuMinimo ? 'text-emerald-400' : freq.presentes <= 1 ? 'text-red-400' : 'text-yellow-400')}>
                  {freq.presentes}/{freq.total} presenças{freq.total === 4 ? (freq.atingiuMinimo ? ' ✓ Mínimo atingido' : ' ✗ Insuficiente') : ''}
                </p>
              </div>
            </div>
          )}

          {/* Trilha de progresso */}
          <div className="px-5 pt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Progresso</p>
            <div className="space-y-1">
              {progresso.map((no, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className={cn('w-4 h-4 rounded-full flex-shrink-0 border-2 flex items-center justify-center', {
                    done:    'bg-menta-light border-menta-light',
                    current: 'bg-transparent border-menta-light',
                    pending: 'bg-transparent border-border',
                  }[no.status])}>
                    {no.status === 'done' && <div className="w-1.5 h-1.5 bg-petroleo rounded-full"/>}
                    {no.status === 'current' && <div className="w-1.5 h-1.5 bg-menta-light rounded-full animate-pulse"/>}
                  </div>
                  <span className={cn('text-xs', {
                    done:    'text-muted-foreground line-through',
                    current: 'text-offwhite font-medium',
                    pending: 'text-muted-foreground/50',
                  }[no.status])}>
                    {no.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Info do lead */}
          <div className="px-5 pt-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dados</p>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Telefone</span>
                <span className="text-offwhite">{formatPhone(contact.telefone)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Grupo</span>
                <span className="text-offwhite">{getGrupoLabel(contact.grupo)}</span>
              </div>
              {contact.observacoes && (
                <div>
                  <span className="text-muted-foreground">Obs:</span>
                  <p className="text-offwhite text-xs mt-0.5">{contact.observacoes}</p>
                </div>
              )}
            </div>
          </div>

          {/* WhatsApp */}
          <div className="px-5 pt-4">
            <a
              href={`https://wa.me/55${contact.telefone.replace(/\D/g,'')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-medium text-emerald-400 bg-emerald-400/10 border border-emerald-400/30 hover:bg-emerald-400/20 transition-all"
            >
              <Phone size={14}/>Abrir WhatsApp
            </a>
          </div>

          {/* Histórico */}
          <div className="px-5 pt-4 pb-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Histórico</p>
            {!historico?.length ? (
              <p className="text-xs text-muted-foreground/50 text-center py-4">Nenhum registro ainda.</p>
            ) : (
              <div className="space-y-2">
                {historico.map(h => {
                  const meta = TIPO_HIST[h.tipo] ?? { label: h.tipo, cor: 'text-muted-foreground' }
                  return (
                    <div key={h.id} className="flex gap-2 text-xs">
                      <span className={cn('font-medium flex-shrink-0', meta.cor)}>{meta.label}</span>
                      <span className="text-muted-foreground flex-1">{h.descricao}</span>
                      <span className="text-muted-foreground/50 flex-shrink-0">
                        {format(new Date(h.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer — Botão de perda */}
        {!['BATIZADO','PERDIDO','REENCAMINHADO'].includes(contact.fase_pipeline) && (
          <div className="px-5 py-3 border-t border-border flex-shrink-0">
            <button
              onClick={() => setShowPerda(true)}
              className="flex items-center gap-1.5 text-xs text-red-400/60 hover:text-red-400 transition-colors"
            >
              <AlertTriangle size={12}/>Registrar perda…
            </button>
          </div>
        )}
      </div>

      {showPerda && (
        <ModalPerda
          contact={contact}
          onClose={() => setShowPerda(false)}
          onSaved={() => {
            onUpdated({})
            qc.invalidateQueries({ queryKey: ['pipeline'] })
          }}
        />
      )}
    </>
  )
}
