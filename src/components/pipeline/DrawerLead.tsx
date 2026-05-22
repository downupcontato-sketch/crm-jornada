import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { X, Phone, ChevronRight, ChevronLeft, AlertTriangle, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { cn, formatPhone, getGrupoLabel, getTipoLabel, getTipoBadgeColor } from '@/lib/utils'
import {
  avancarSubetapa, pularParaConversa, ativarTrilhaBatismo, calcularFrequencia,
  calcularSLAFase, calcularTimerResposta, proximaSubetapaLabel, trilhaProgresso,
  FASE_LABELS, SUBETAPA_LABELS,
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

function Spinner() {
  return <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
}

function ContatoInicialSection({
  contact, waSent, advancing, onWa, onRespondeu, onNaoRespondeuAvancar, onArquivar,
}: {
  contact: Contact
  waSent: boolean
  advancing: boolean
  onWa: () => void
  onRespondeu: () => void
  onNaoRespondeuAvancar: () => void
  onArquivar: () => void
}) {
  const [subOpcao, setSubOpcao] = useState<null | 'sim' | 'nao'>(null)
  const timer = calcularTimerResposta(contact)
  const isTentativa2 = contact.subetapa_contato === 'TENTATIVA_2'
  const tentativas = contact.tentativas_contato ?? 0

  // State A: no first WA sent yet
  if (!contact.data_primeiro_contato && !isTentativa2) {
    return (
      <div className="px-5 pt-4 space-y-3">
        <button
          onClick={onWa}
          disabled={advancing || waSent}
          className={cn(
            'w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium border transition-all',
            waSent
              ? 'text-emerald-300 bg-emerald-400/20 border-emerald-400/50'
              : 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30 hover:bg-emerald-400/20',
          )}
        >
          <Phone size={14} />
          {waSent ? '✓ WhatsApp enviado' : 'Enviar WhatsApp'}
        </button>
        {waSent && (
          <p className="text-xs text-muted-foreground text-center">
            Tentativa registrada. Aguarde a resposta e volte aqui.
          </p>
        )}
      </div>
    )
  }

  // State C: TENTATIVA_2, WA not yet sent for 2nd attempt
  if (isTentativa2 && tentativas < 2) {
    return (
      <div className="px-5 pt-4 space-y-3">
        <div className="bg-yellow-400/10 border border-yellow-400/20 rounded-lg px-3 py-2 text-xs text-yellow-400">
          2ª tentativa — sem resposta na primeira
        </div>
        <button
          onClick={onWa}
          disabled={advancing || waSent}
          className={cn(
            'w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium border transition-all',
            waSent
              ? 'text-emerald-300 bg-emerald-400/20 border-emerald-400/50'
              : 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30 hover:bg-emerald-400/20',
          )}
        >
          <Phone size={14} />
          {waSent ? '✓ 2º WhatsApp enviado' : 'Enviar 2º WhatsApp'}
        </button>
        {waSent && (
          <p className="text-xs text-muted-foreground text-center">
            2ª tentativa registrada. Volte após receber a resposta.
          </p>
        )}
      </div>
    )
  }

  // State B / D: WA sent, awaiting "Houve resposta?"
  return (
    <div className="px-5 pt-4 space-y-3">
      {timer && (
        <div className={cn(
          'flex items-center gap-2 rounded-lg px-3 py-2 text-xs border',
          timer === 'feedback_pendente'
            ? 'bg-orange-400/10 border-orange-400/20 text-orange-400'
            : 'bg-blue-400/10 border-blue-400/20 text-blue-400',
        )}>
          <Clock size={12} />
          {timer === 'feedback_pendente'
            ? 'Feedback pendente — mais de 48h desde o 1º contato'
            : 'Aguardando resposta — dentro do prazo'}
        </div>
      )}

      <p className="text-sm font-medium text-offwhite">Houve resposta?</p>

      <div className="flex gap-2">
        <button
          onClick={() => setSubOpcao('sim')}
          className={cn(
            'flex-1 py-2.5 rounded-lg text-sm font-medium border transition-all',
            subOpcao === 'sim'
              ? 'bg-menta-light/20 border-menta-light text-menta-light'
              : 'border-border text-muted-foreground hover:text-offwhite hover:border-foreground/30',
          )}
        >
          Sim ✓
        </button>
        <button
          onClick={() => setSubOpcao('nao')}
          className={cn(
            'flex-1 py-2.5 rounded-lg text-sm font-medium border transition-all',
            subOpcao === 'nao'
              ? 'bg-red-400/15 border-red-400/40 text-red-400'
              : 'border-border text-muted-foreground hover:text-offwhite hover:border-foreground/30',
          )}
        >
          Não
        </button>
      </div>

      {subOpcao === 'sim' && (
        <button
          onClick={onRespondeu}
          disabled={advancing}
          className="w-full zion-btn-primary flex items-center justify-center gap-2 py-3 text-sm"
        >
          {advancing ? <Spinner /> : <><ChevronRight size={16} /> Avançar para conversa</>}
        </button>
      )}

      {subOpcao === 'nao' && !isTentativa2 && (
        <div className="space-y-2">
          <button
            onClick={onNaoRespondeuAvancar}
            disabled={advancing}
            className="w-full py-2.5 rounded-lg text-sm font-medium border border-border text-muted-foreground hover:text-offwhite hover:border-foreground/30 transition-all flex items-center justify-center gap-2"
          >
            {advancing ? <Spinner /> : '2ª Tentativa →'}
          </button>
          <button
            onClick={onArquivar}
            className="w-full py-2 text-xs text-red-400/60 hover:text-red-400 transition-colors"
          >
            Arquivar — sem resposta
          </button>
        </div>
      )}

      {subOpcao === 'nao' && isTentativa2 && (
        <div className="space-y-2">
          <div className="bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2 text-xs text-red-400">
            Sem resposta após 2 tentativas — registrar perda
          </div>
          <button
            onClick={onArquivar}
            disabled={advancing}
            className="w-full py-2.5 rounded-lg text-sm font-medium bg-red-400/15 border border-red-400/30 text-red-400 hover:bg-red-400/25 transition-all"
          >
            Registrar perda — sem resposta
          </button>
        </div>
      )}
    </div>
  )
}

function QualificacaoSection({
  contact, advancing, onAvancar, onEnviarConvite, onNaoQualificada, onInscricaoConfirmada,
}: {
  contact: Contact
  advancing: boolean
  onAvancar: () => void
  onEnviarConvite: (dataEnvio: string) => Promise<void>
  onNaoQualificada: () => void
  onInscricaoConfirmada: () => void
}) {
  const [resposta, setResposta] = useState<null | 'sim' | 'nao'>(null)
  const [dataEnvio, setDataEnvio] = useState('')
  const subetapa = contact.subetapa_qualificacao

  // CONVERSA — "Tem perfil?"
  if (subetapa === 'CONVERSA') {
    return (
      <div className="px-5 pt-4 space-y-3">
        <p className="text-sm font-medium text-offwhite">Esta pessoa tem perfil?</p>
        <div className="flex gap-2">
          <button
            onClick={() => setResposta('sim')}
            className={cn(
              'flex-1 py-2.5 rounded-lg text-sm font-medium border transition-all',
              resposta === 'sim'
                ? 'bg-menta-light/20 border-menta-light text-menta-light'
                : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-offwhite',
            )}
          >
            Sim
          </button>
          <button
            onClick={() => setResposta('nao')}
            className={cn(
              'flex-1 py-2.5 rounded-lg text-sm font-medium border transition-all',
              resposta === 'nao'
                ? 'bg-red-400/15 border-red-400/40 text-red-400'
                : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-offwhite',
            )}
          >
            Não
          </button>
        </div>
        {resposta === 'sim' && (
          <button
            onClick={onAvancar}
            disabled={advancing}
            className="w-full zion-btn-primary flex items-center justify-center gap-2 py-3 text-sm"
          >
            {advancing ? <Spinner /> : <><ChevronRight size={16} /> Confirmar perfil</>}
          </button>
        )}
        {resposta === 'nao' && (
          <button
            onClick={onNaoQualificada}
            className="w-full py-2.5 rounded-lg text-sm font-medium bg-red-400/15 border border-red-400/30 text-red-400 hover:bg-red-400/25 transition-all"
          >
            Registrar perda — sem perfil
          </button>
        )}
      </div>
    )
  }

  // PERFIL_CONFIRMADO — date input for data_envio_convite
  if (subetapa === 'PERFIL_CONFIRMADO') {
    return (
      <div className="px-5 pt-4 space-y-3">
        <div>
          <p className="text-sm font-medium text-offwhite mb-1">Envio do convite PROVER</p>
          <p className="text-xs text-muted-foreground">Quando foi enviado o link de inscrição?</p>
        </div>
        <input
          type="datetime-local"
          value={dataEnvio}
          onChange={e => setDataEnvio(e.target.value)}
          className="w-full bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-offwhite focus:outline-none focus:border-menta-light/50"
        />
        <button
          onClick={() => dataEnvio && onEnviarConvite(dataEnvio)}
          disabled={advancing || !dataEnvio}
          className="w-full zion-btn-primary flex items-center justify-center gap-2 py-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {advancing ? <Spinner /> : <><ChevronRight size={16} /> Registrar envio do convite</>}
        </button>
      </div>
    )
  }

  // CONVITE_ENVIADO — inscrição confirmada
  if (subetapa === 'CONVITE_ENVIADO') {
    const dataEnvioExistente = contact.data_envio_convite
    return (
      <div className="px-5 pt-4 space-y-3">
        {dataEnvioExistente && (
          <div className="text-xs text-muted-foreground">
            Convite enviado em{' '}
            {format(new Date(dataEnvioExistente), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
          </div>
        )}
        <button
          onClick={onInscricaoConfirmada}
          disabled={advancing}
          className="w-full zion-btn-primary flex items-center justify-center gap-2 py-3 text-sm"
        >
          {advancing ? <Spinner /> : <><ChevronRight size={16} /> Inscrição confirmada ✓</>}
        </button>
      </div>
    )
  }

  // AGUARDANDO_PROVER, PROVER_CONFIRMADO — standard advance
  return (
    <div className="px-5 pt-4">
      <button
        onClick={onAvancar}
        disabled={advancing}
        className="w-full zion-btn-primary flex items-center justify-center gap-2 text-sm py-3"
      >
        {advancing ? <Spinner /> : <><ChevronRight size={16} />Avançar para: {proximaSubetapaLabel(contact)}</>}
      </button>
    </div>
  )
}

export function DrawerLead({ contact: initial, onClose, onUpdated }: Props) {
  const { profile } = useAuth()
  const qc = useQueryClient()
  const [contact, setContact] = useState(initial)
  const [advancing, setAdvancing] = useState(false)
  const [showPerda, setShowPerda] = useState(false)
  const [waSent, setWaSent] = useState(false)

  const sla = calcularSLAFase(contact)
  const freq = calcularFrequencia(contact)
  const progresso = trilhaProgresso(contact)

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

  async function handleConversa() {
    if (!profile) return
    setAdvancing(true)
    try {
      const upd = await pularParaConversa(contact, profile.id)
      const novo = { ...contact, ...upd }
      setContact(novo as Contact)
      onUpdated(upd)
      qc.invalidateQueries({ queryKey: ['lead-historico', contact.id] })
      toast.success('Avançado para Conversa!')
    } catch {
      toast.error('Erro ao avançar etapa')
    } finally {
      setAdvancing(false)
    }
  }

  async function handleWhatsApp() {
    const waUrl = `https://wa.me/55${contact.telefone.replace(/\D/g, '')}`
    window.open(waUrl, '_blank')
    if (!profile) return
    try {
      const agora = new Date().toISOString()
      const upd: Partial<Contact> = {
        tentativas_contato: (contact.tentativas_contato ?? 0) + 1,
        updated_at: agora,
      }
      if (!contact.data_primeiro_contato) {
        upd.data_primeiro_contato = agora
        upd.sla_status = 'ok'
      }
      await supabase.from('interactions').insert({
        contact_id: contact.id,
        voluntario_id: profile.id,
        tipo: 'whatsapp',
        resultado: 'nao_atendeu',
        observacao: 'Tentativa via botão WhatsApp',
        etapa_antes: contact.etapa_atual,
        etapa_depois: null,
      })
      await supabase.from('contacts').update(upd).eq('id', contact.id)
      const novo = { ...contact, ...upd }
      setContact(novo as Contact)
      onUpdated(upd)
      qc.invalidateQueries({ queryKey: ['lead-historico', contact.id] })
      setWaSent(true)
      setTimeout(() => setWaSent(false), 60000)
      toast.success('Tentativa registrada!')
    } catch {
      toast.error('Erro ao registrar tentativa')
    }
  }

  async function handleEnviarConvite(dataEnvioLocal: string) {
    if (!profile) return
    setAdvancing(true)
    try {
      const upd: Partial<Contact> = {
        data_envio_convite: new Date(dataEnvioLocal).toISOString(),
        subetapa_qualificacao: 'CONVITE_ENVIADO',
        updated_at: new Date().toISOString(),
      }
      await supabase.from('contacts').update(upd).eq('id', contact.id)
      await supabase.from('lead_historico').insert({
        contact_id: contact.id,
        voluntario_id: profile.id,
        tipo: 'AVANCO_ETAPA',
        descricao: `Convite PROVER enviado em ${format(new Date(dataEnvioLocal), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}`,
      })
      const novo = { ...contact, ...upd }
      setContact(novo as Contact)
      onUpdated(upd)
      qc.invalidateQueries({ queryKey: ['lead-historico', contact.id] })
      toast.success('Convite registrado!')
    } catch {
      toast.error('Erro ao registrar convite')
    } finally {
      setAdvancing(false)
    }
  }

  async function handleInscricaoConfirmada() {
    if (!profile) return
    setAdvancing(true)
    try {
      const upd = await avancarSubetapa(contact, profile.id)
      if (upd) {
        const novo = { ...contact, ...upd }
        setContact(novo as Contact)
        onUpdated(upd)
        qc.invalidateQueries({ queryKey: ['lead-historico', contact.id] })
        toast.success('Inscrição confirmada!')
      }
    } catch {
      toast.error('Erro ao confirmar inscrição')
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

  const subetapaAtual = contact.subetapa_qualificacao ?? contact.subetapa_contato ?? contact.subetapa_encaminhamento ?? contact.subetapa_batismo
  const subetapaLabel = subetapaAtual ? (SUBETAPA_LABELS[subetapaAtual] ?? subetapaAtual) : undefined

  // Generic advance button: phases that don't have custom sections
  const podeAvancarGenerico =
    !['AULAS', 'BATIZADO', 'PERDIDO', 'REENCAMINHADO', 'CONTATO_INICIAL', 'QUALIFICACAO'].includes(contact.fase_pipeline) &&
    !(contact.fase_pipeline === 'POS_AULA' && (contact.subetapa_encaminhamento || contact.subetapa_batismo))

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full sm:w-[500px] z-50 bg-card border-l border-border flex flex-col animate-slide-in-right overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <button
              onClick={onClose}
              className="flex items-center gap-1 text-muted-foreground hover:text-offwhite transition-colors flex-shrink-0 mt-0.5"
            >
              <ChevronLeft size={18} />
              <span className="text-xs font-medium">Voltar</span>
            </button>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-offwhite truncate">{contact.nome}</h2>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', getTipoBadgeColor(contact.tipo))}>
                  {getTipoLabel(contact.tipo)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {subetapaLabel ?? FASE_LABELS[contact.fase_pipeline]}
                </span>
                {contact.fase_pipeline === 'CONTATO_INICIAL' && !contact.data_primeiro_contato && sla !== 'ok' && (
                  <span className={cn('text-xs font-medium', sla === 'over' ? 'text-red-400' : 'text-yellow-400')}>
                    SLA {sla === 'over' ? '⚠⚠' : '⚠'}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 flex-shrink-0">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* CONTATO_INICIAL — conditional question flow */}
          {contact.fase_pipeline === 'CONTATO_INICIAL' && (
            <ContatoInicialSection
              contact={contact}
              waSent={waSent}
              advancing={advancing}
              onWa={handleWhatsApp}
              onRespondeu={handleConversa}
              onNaoRespondeuAvancar={handleAvancar}
              onArquivar={() => setShowPerda(true)}
            />
          )}

          {/* QUALIFICACAO — conditional question flow */}
          {contact.fase_pipeline === 'QUALIFICACAO' && (
            <QualificacaoSection
              contact={contact}
              advancing={advancing}
              onAvancar={handleAvancar}
              onEnviarConvite={handleEnviarConvite}
              onNaoQualificada={() => setShowPerda(true)}
              onInscricaoConfirmada={handleInscricaoConfirmada}
            />
          )}

          {/* Generic advance button for other phases */}
          {podeAvancarGenerico && (
            <div className="px-5 pt-4">
              <button
                onClick={handleAvancar}
                disabled={advancing}
                className="w-full zion-btn-primary flex items-center justify-center gap-2 text-sm py-3"
              >
                {advancing ? <Spinner /> : <><ChevronRight size={16} />Avançar para: {proximaSubetapaLabel(contact)}</>}
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
                  {[1, 2, 3, 4].map(n => {
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
                  {freq.presentes}/{freq.total} presenças
                  {freq.total === 4 ? (freq.atingiuMinimo ? ' ✓ Mínimo atingido' : ' ✗ Insuficiente') : ''}
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
                    {no.status === 'done' && <div className="w-1.5 h-1.5 bg-petroleo rounded-full" />}
                    {no.status === 'current' && <div className="w-1.5 h-1.5 bg-menta-light rounded-full animate-pulse" />}
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

          {/* Dados do lead */}
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
              {contact.data_primeiro_contato && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">1º contato</span>
                  <span className="text-offwhite">
                    {format(new Date(contact.data_primeiro_contato), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
              )}
              {contact.observacoes && (
                <div>
                  <span className="text-muted-foreground">Obs:</span>
                  <p className="text-offwhite text-xs mt-0.5">{contact.observacoes}</p>
                </div>
              )}
            </div>
          </div>

          {/* WhatsApp direto — for phases after CONTATO_INICIAL */}
          {contact.fase_pipeline !== 'CONTATO_INICIAL' && (
            <div className="px-5 pt-4">
              <a
                href={`https://wa.me/55${contact.telefone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-medium border border-emerald-400/30 text-emerald-400 bg-emerald-400/10 hover:bg-emerald-400/20 transition-all"
              >
                <Phone size={14} />Abrir WhatsApp
              </a>
            </div>
          )}

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

        {/* Footer — Registrar perda */}
        {!['BATIZADO', 'PERDIDO', 'REENCAMINHADO'].includes(contact.fase_pipeline) && (
          <div className="px-5 py-3 border-t border-border flex-shrink-0">
            <button
              onClick={() => setShowPerda(true)}
              className="flex items-center gap-1.5 text-xs text-red-400/60 hover:text-red-400 transition-colors"
            >
              <AlertTriangle size={12} />Registrar perda…
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
