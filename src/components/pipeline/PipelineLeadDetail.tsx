import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Phone, MessageSquare, ChevronRight, Maximize2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { cn, formatPhone, getGrupoLabel, getTipoBadgeColor, getTipoLabel } from '@/lib/utils'
import {
  avancarSubetapa, pularParaConversa, ativarTrilhaBatismo,
  calcularSLAFase, calcularFrequencia, proximaSubetapaLabel,
  FASE_LABELS, SUBETAPA_LABELS,
} from '@/lib/pipeline'
import { Spinner, ContatoInicialSection, QualificacaoSection } from './DrawerLead'
import { JornadaStepper } from './JornadaStepper'
import { HistoricoTentativas } from './HistoricoTentativas'
import { ModalPerda } from './ModalPerda'
import { ModalRegistroContato } from './ModalRegistroContato'
import type { Contact } from '@/types/database'

interface Props {
  contact: Contact
  onUpdated: (upd: Partial<Contact>) => void
  onFullPage?: () => void
  volNome?: string
}

const TIPO_AVATAR: Record<string, string> = {
  novo_nascimento: 'bg-menta-light/20 text-menta-light',
  reconciliacao:   'bg-purple-500/20 text-purple-400',
  visitante:       'bg-blue-500/20 text-blue-400',
}

const STATUS_BADGE: Record<string, string> = {
  ativo:        'bg-emerald-500/15 text-emerald-400',
  sem_resposta: 'bg-red-500/15 text-red-400',
  inativo:      'bg-gray-500/15 text-gray-400',
  arquivado:    'bg-gray-500/15 text-gray-400',
}

export function PipelineLeadDetail({ contact: initial, onUpdated, onFullPage, volNome }: Props) {
  const { profile } = useAuth()
  const qc = useQueryClient()
  const [contact, setContact] = useState(initial)
  const [advancing, setAdvancing] = useState(false)
  const [waSent, setWaSent] = useState(false)
  const [showPerda, setShowPerda] = useState(false)
  const [showRegistro, setShowRegistro] = useState(false)
  const [obs, setObs] = useState(contact.observacoes ?? '')
  const [savingObs, setSavingObs] = useState(false)

  const sla = calcularSLAFase(contact)
  const freq = calcularFrequencia(contact)

  function patch(upd: Partial<Contact>) {
    const novo = { ...contact, ...upd }
    setContact(novo as Contact)
    onUpdated(upd)
    qc.invalidateQueries({ queryKey: ['lead-historico', contact.id] })
  }

  async function handleWhatsApp() {
    window.open(`https://wa.me/55${contact.telefone.replace(/\D/g, '')}`, '_blank')
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
      patch(upd)
      setWaSent(true)
      setTimeout(() => setWaSent(false), 60000)
      toast.success('Tentativa registrada!')
    } catch {
      toast.error('Erro ao registrar tentativa')
    }
  }

  async function handleAvancar() {
    if (!profile) return
    setAdvancing(true)
    try {
      const upd = await avancarSubetapa(contact, profile.id)
      if (upd) { patch(upd); toast.success('Etapa avançada!') }
    } catch { toast.error('Erro ao avançar etapa') }
    finally { setAdvancing(false) }
  }

  async function handleConversa() {
    if (!profile) return
    setAdvancing(true)
    try {
      const upd = await pularParaConversa(contact, profile.id)
      patch(upd); toast.success('Avançado para Conversa!')
    } catch { toast.error('Erro ao avançar') }
    finally { setAdvancing(false) }
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
      patch(upd); toast.success('Convite registrado!')
    } catch { toast.error('Erro ao registrar convite') }
    finally { setAdvancing(false) }
  }

  async function handleInscricaoConfirmada() {
    if (!profile) return
    setAdvancing(true)
    try {
      const upd = await avancarSubetapa(contact, profile.id)
      if (upd) { patch(upd); toast.success('Inscrição confirmada!') }
    } catch { toast.error('Erro ao confirmar') }
    finally { setAdvancing(false) }
  }

  async function handleBatismo() {
    if (!profile) return
    try {
      await ativarTrilhaBatismo(contact, profile.id)
      patch({ subetapa_batismo: 'DECIDIU_BATIZAR' })
      toast.success('Trilha de batismo ativada!')
    } catch { toast.error('Erro ao ativar trilha') }
  }

  async function handleSaveObs() {
    setSavingObs(true)
    try {
      await supabase.from('contacts').update({ observacoes: obs }).eq('id', contact.id)
      patch({ observacoes: obs })
      toast.success('Anotação salva.')
    } catch { toast.error('Erro ao salvar') }
    finally { setSavingObs(false) }
  }

  const subetapa = contact.subetapa_qualificacao ?? contact.subetapa_contato ?? contact.subetapa_encaminhamento ?? contact.subetapa_batismo
  const subLabel = subetapa ? (SUBETAPA_LABELS[subetapa] ?? subetapa) : null
  const avatarCls = TIPO_AVATAR[contact.tipo] ?? 'bg-muted text-muted-foreground'
  const isFinal   = ['BATIZADO','PERDIDO','REENCAMINHADO'].includes(contact.fase_pipeline)

  const podeAvancarGenerico =
    !['AULAS','BATIZADO','PERDIDO','REENCAMINHADO','CONTATO_INICIAL','QUALIFICACAO'].includes(contact.fase_pipeline) &&
    !(contact.fase_pipeline === 'POS_AULA' && (contact.subetapa_encaminhamento || contact.subetapa_batismo))

  return (
    <div className="h-full overflow-y-auto bg-card">

      {/* ── Hero ── */}
      <div className="px-6 pt-6 pb-4 border-b border-border">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className={cn('w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 text-xl font-bold', avatarCls)}>
            {contact.nome.charAt(0).toUpperCase()}
          </div>
          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-lg font-semibold text-offwhite leading-tight">{contact.nome}</h2>
              {onFullPage && (
                <button onClick={onFullPage} title="Página completa"
                  className="text-muted-foreground hover:text-foreground p-1 flex-shrink-0 transition-colors">
                  <Maximize2 size={15} />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', getTipoBadgeColor(contact.tipo))}>
                {getTipoLabel(contact.tipo)}
              </span>
              <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', STATUS_BADGE[contact.status] ?? 'bg-muted text-muted-foreground')}>
                {contact.status}
              </span>
              <span className="text-xs text-muted-foreground">{FASE_LABELS[contact.fase_pipeline]}</span>
              {subLabel && <span className="text-xs text-muted-foreground/70">· {subLabel}</span>}
            </div>
            {volNome && (
              <p className="text-xs text-muted-foreground mt-1">Responsável: <span className="text-offwhite">{volNome}</span></p>
            )}
          </div>
        </div>

        {/* SLA warning */}
        {sla !== 'ok' && (
          <div className={cn('flex items-center gap-2 mt-3 px-3 py-2 rounded-lg text-xs border',
            sla === 'over' ? 'bg-red-400/10 border-red-400/20 text-red-400' : 'bg-yellow-400/10 border-yellow-400/20 text-yellow-400')}>
            <AlertTriangle size={12} />
            {sla === 'over' ? 'SLA vencido — contato urgente!' : 'SLA próximo do vencimento'}
          </div>
        )}
      </div>

      {/* ── Barra de ações ── */}
      <div className="flex items-center gap-2 px-6 py-3 border-b border-border overflow-x-auto scrollbar-none">
        <button onClick={handleWhatsApp}
          className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex-shrink-0',
            waSent ? 'bg-emerald-400/20 border-emerald-400/40 text-emerald-300' : 'bg-emerald-400/10 border-emerald-400/30 text-emerald-400 hover:bg-emerald-400/20')}>
          <Phone size={13} /> {waSent ? '✓ Enviado' : 'Ligar / WA'}
        </button>
        <button onClick={() => setShowRegistro(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all flex-shrink-0">
          <MessageSquare size={13} /> Registrar contato
        </button>
        {!isFinal && (
          <button onClick={handleAvancar} disabled={advancing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-menta-light/15 border border-menta-light/30 text-menta-light hover:bg-menta-light/25 transition-all flex-shrink-0 disabled:opacity-50">
            {advancing ? <Spinner /> : <ChevronRight size={13} />}
            Mover etapa
          </button>
        )}
      </div>

      {/* ── Conteúdo em grid ── */}
      <div className="px-6 py-5 grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Col 1 */}
        <div className="space-y-5">

          {/* Informações */}
          <section>
            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Informações</h3>
            <div className="bg-muted/20 border border-border rounded-xl divide-y divide-border">
              <Row label="Telefone" value={formatPhone(contact.telefone)} />
              <Row label="Grupo" value={getGrupoLabel(contact.grupo)} />
              {contact.sexo && <Row label="Sexo" value={contact.sexo} />}
              {contact.idade && <Row label="Idade" value={`${contact.idade} anos`} />}
              {contact.igreja_origem && <Row label="Igreja de origem" value={contact.igreja_origem} />}
              {contact.numero_pulseira && <Row label="Pulseira" value={contact.numero_pulseira} />}
              {contact.tentativas_contato != null && (
                <Row label="Tentativas" value={`${contact.tentativas_contato}x`} />
              )}
              {contact.data_primeiro_contato && (
                <Row label="1º contato" value={format(new Date(contact.data_primeiro_contato), "dd/MM/yy HH:mm", { locale: ptBR })} />
              )}
            </div>
          </section>

          {/* Jornada */}
          <section>
            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Jornada</h3>
            <JornadaStepper fasePipeline={contact.fase_pipeline} />
          </section>

          {/* Aulas — frequência */}
          {contact.fase_pipeline === 'AULAS' && (
            <section>
              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Frequência nas Aulas</h3>
              <div className="flex gap-2">
                {[1,2,3,4].map(n => {
                  const presenca = contact[`presenca_aula${n}` as keyof Contact] as boolean | null
                  return (
                    <div key={n} className={cn(
                      'flex-1 h-10 rounded-lg flex items-center justify-center text-sm font-bold border',
                      presenca === true  && 'bg-emerald-500/20 border-emerald-500 text-emerald-400',
                      presenca === false && 'bg-red-500/20 border-red-500 text-red-400',
                      presenca === null  && 'bg-muted/30 border-border text-muted-foreground',
                    )}>
                      {presenca === true ? '✓' : presenca === false ? '✗' : n}
                    </div>
                  )
                })}
              </div>
              <p className={cn('text-xs text-center mt-2', freq.atingiuMinimo ? 'text-emerald-400' : freq.presentes <= 1 ? 'text-red-400' : 'text-yellow-400')}>
                {freq.presentes}/{freq.total} presenças
                {freq.total === 4 ? (freq.atingiuMinimo ? ' ✓ Mínimo atingido' : ' ✗ Insuficiente') : ''}
              </p>
            </section>
          )}

          {/* Anotações */}
          <section>
            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Anotações</h3>
            <textarea
              value={obs}
              onChange={e => setObs(e.target.value)}
              placeholder="Adicionar observação sobre este lead..."
              rows={3}
              className="w-full bg-muted/20 border border-border rounded-xl px-3 py-2.5 text-sm text-offwhite placeholder:text-muted-foreground/40 resize-none focus:outline-none focus:border-menta-light/40 transition-colors"
            />
            <button
              onClick={handleSaveObs}
              disabled={savingObs || obs === (contact.observacoes ?? '')}
              className="mt-2 px-3 py-1.5 text-xs font-medium bg-menta-light/15 text-menta-light border border-menta-light/30 rounded-lg hover:bg-menta-light/25 transition-all disabled:opacity-40"
            >
              {savingObs ? 'Salvando…' : 'Salvar anotação'}
            </button>
          </section>
        </div>

        {/* Col 2 */}
        <div className="space-y-5">

          {/* Ações por fase */}
          {!isFinal && (
            <section>
              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Ação da etapa</h3>
              <div className="bg-muted/10 border border-border rounded-xl overflow-hidden">
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
                {podeAvancarGenerico && (
                  <div className="px-5 py-4">
                    <button onClick={handleAvancar} disabled={advancing}
                      className="w-full zion-btn-primary flex items-center justify-center gap-2 text-sm py-3">
                      {advancing ? <Spinner /> : <><ChevronRight size={16} />Avançar para: {proximaSubetapaLabel(contact)}</>}
                    </button>
                  </div>
                )}
                {contact.fase_pipeline === 'POS_AULA' && !contact.subetapa_batismo && (
                  <div className="px-5 py-3">
                    <button onClick={handleBatismo}
                      className="w-full py-2 rounded-lg text-sm font-medium bg-purple-500/10 text-purple-400 border border-purple-500/30 hover:bg-purple-500/20 transition-all">
                      ✝ Registrar decisão de batismo
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Histórico */}
          <section>
            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Histórico de interações</h3>
            <HistoricoTentativas contactId={contact.id} />
          </section>

          {/* Registrar perda */}
          {!isFinal && (
            <button onClick={() => setShowPerda(true)}
              className="flex items-center gap-1.5 text-xs text-red-400/50 hover:text-red-400 transition-colors">
              <AlertTriangle size={12} /> Registrar perda…
            </button>
          )}
        </div>
      </div>

      {/* Modals */}
      {showPerda && (
        <ModalPerda
          contact={contact}
          onClose={() => setShowPerda(false)}
          onSaved={() => { onUpdated({}); qc.invalidateQueries({ queryKey: ['pipeline-split'] }) }}
        />
      )}
      {showRegistro && (
        <ModalRegistroContato
          contact={contact}
          onClose={() => setShowRegistro(false)}
          onUpdated={upd => { patch(upd); qc.invalidateQueries({ queryKey: ['lead-historico', contact.id] }) }}
        />
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs text-offwhite font-medium">{value}</span>
    </div>
  )
}
