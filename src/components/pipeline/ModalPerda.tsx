import { useState } from 'react'
import { X, AlertTriangle, ArrowUpRight } from 'lucide-react'
import { toast } from 'sonner'
import { registrarPerda, redirecionarParaBatismo } from '@/lib/pipeline'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import { FASE_LABELS } from '@/lib/pipeline'
import type { Contact, FasePipeline, MotivoPerdaLead } from '@/types/database'

interface Props {
  contact: Contact
  onClose: () => void
  onSaved: () => void
}

// ─── Qualificação motivos ────────────────────────────────────────────────────

interface OpcaoDesqualificacao {
  value: MotivoPerdaLead
  label: string
  descricao: string
  tipo: 'perda' | 'redirecionamento'
}

const MOTIVOS_DESQUALIFICACAO: OpcaoDesqualificacao[] = [
  {
    value: 'JA_INTEGRADO',
    label: 'Já está integrado à Igreja',
    descricao: 'Já participa ativamente, não precisa das aulas introdutórias',
    tipo: 'perda',
  },
  {
    value: 'VISITANTE_OCASIONAL',
    label: 'Não é novo na fé',
    descricao: 'Cristão experiente, conteúdo das aulas não adequado para seu momento',
    tipo: 'perda',
  },
  {
    value: 'SEM_RESPOSTA_APOS_TENTATIVAS',
    label: 'Sem interesse',
    descricao: 'Após a conversa, demonstrou que não deseja prosseguir',
    tipo: 'perda',
  },
  {
    value: 'SEM_DISPONIBILIDADE',
    label: 'Sem disponibilidade de agenda',
    descricao: 'Tem interesse mas não consegue encaixar as aulas na rotina',
    tipo: 'perda',
  },
  {
    value: 'INDICADO_BATISMO',
    label: 'Indicação para Batismo',
    descricao: 'Perfil identificado para encaminhamento direto ao processo de batismo',
    tipo: 'redirecionamento',
  },
]

// ─── Outras fases ────────────────────────────────────────────────────────────

interface OpcaoMotivo {
  value: MotivoPerdaLead
  label: string
  sublabel: string
  reencaminha?: boolean
}

const MOTIVOS_AULAS: OpcaoMotivo[] = [
  { value: 'NAO_COMPARECEU_AULA_1',   label: 'Não compareceu à Aula 1',  sublabel: 'Faltou na primeira aula sem retorno' },
  { value: 'FREQUENCIA_INSUFICIENTE', label: 'Frequência insuficiente',   sublabel: 'Menos de 3 de 4 aulas concluídas' },
  { value: 'OUTROS',                  label: 'Outros',                    sublabel: 'Motivo não listado acima' },
]

const MOTIVOS_ENCAMINHAMENTO: OpcaoMotivo[] = [
  { value: 'NAO_ENTROU_LINK', label: 'Não entrou no link', sublabel: 'Não acessou o link enviado' },
  { value: 'OUTROS',          label: 'Outros',             sublabel: 'Motivo não listado acima' },
]

const MOTIVOS_BATISMO: OpcaoMotivo[] = [
  { value: 'NAO_DECIDIU_BATIZAR',           label: 'Não decidiu batizar',             sublabel: 'Ainda não se sente pronto',             reencaminha: true },
  { value: 'NAO_RESPONDEU_CONTATO_BATISMO', label: 'Sem resposta no contato batismo', sublabel: 'Não respondeu às tentativas de contato' },
  { value: 'NAO_COMPARECEU_AULA_BATISMO',   label: 'Não compareceu à aula',           sublabel: 'Faltou à aula de batismo',              reencaminha: true },
  { value: 'NAO_CUMPRE_REQUISITOS',         label: 'Não cumpre requisitos',           sublabel: 'Não atende os critérios para batismo',  reencaminha: true },
  { value: 'OUTROS',                        label: 'Outros',                          sublabel: 'Motivo não listado acima' },
]

// ─── Modal ───────────────────────────────────────────────────────────────────

export function ModalPerda({ contact, onClose, onSaved }: Props) {
  const { profile } = useAuth()
  const [motivo, setMotivo] = useState<MotivoPerdaLead | ''>('')
  const [observacao, setObservacao] = useState('')
  const [loading, setLoading] = useState(false)

  const fase = contact.fase_pipeline as FasePipeline
  const isQualificacao = fase === 'CONTATO_INICIAL' || fase === 'QUALIFICACAO'

  // ── Qualificação modal ──
  if (isQualificacao) {
    const opcaoSelecionada = MOTIVOS_DESQUALIFICACAO.find(o => o.value === motivo)
    const isRedirecionamento = opcaoSelecionada?.tipo === 'redirecionamento'

    async function confirmarDesqualificacao() {
      if (!profile || !motivo) return
      setLoading(true)
      try {
        if (motivo === 'INDICADO_BATISMO') {
          await redirecionarParaBatismo(contact, profile.id)
          toast.success('Lead redirecionado para o pipeline de Batismo')
        } else {
          await registrarPerda(contact, motivo as MotivoPerdaLead, observacao || null, profile.id)
          toast.success('Desqualificação registrada')
        }
        onSaved()
      } catch {
        toast.error('Erro ao registrar')
      } finally {
        setLoading(false)
        onClose()
      }
    }

    const faseLabel = FASE_LABELS[fase] ?? fase

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
        <div className="absolute inset-0 bg-black/70" onClick={onClose} />
        <div className="relative bg-card border border-border rounded-2xl w-full max-w-md p-6 animate-fade-in">

          {/* Header */}
          <div className="flex items-start justify-between mb-1">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-red-400/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={18} className="text-red-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-offwhite">Por que não seguirá para as Aulas?</h2>
                <p className="text-xs text-muted-foreground">
                  Conversa com <strong className="text-offwhite/80">{contact.nome}</strong> já confirmada ·{' '}
                  <span className="text-muted-foreground/70">{faseLabel}</span>
                </p>
              </div>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
          </div>

          {/* Radio cards — perda */}
          <div className="space-y-2 mt-4 mb-2">
            {MOTIVOS_DESQUALIFICACAO.filter(o => o.tipo === 'perda').map(opcao => {
              const sel = motivo === opcao.value
              return (
                <button
                  key={opcao.value}
                  type="button"
                  onClick={() => setMotivo(opcao.value)}
                  className={cn(
                    'w-full text-left px-3.5 py-3 rounded-xl border transition-all',
                    sel
                      ? 'border-red-400/50 bg-red-400/10'
                      : 'border-border bg-muted/10 hover:border-border/80 hover:bg-muted/20',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all',
                      sel ? 'border-red-400 bg-red-400' : 'border-border',
                    )}>
                      {sel && <div className="w-full h-full rounded-full scale-50 bg-white" />}
                    </div>
                    <div>
                      <p className={cn('text-sm font-medium', sel ? 'text-offwhite' : 'text-offwhite/80')}>{opcao.label}</p>
                      <p className="text-[11px] text-muted-foreground">{opcao.descricao}</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-2 my-3">
            <div className="flex-1 h-px bg-border/40" />
            <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">ou</span>
            <div className="flex-1 h-px bg-border/40" />
          </div>

          {/* Radio card — redirecionamento */}
          {MOTIVOS_DESQUALIFICACAO.filter(o => o.tipo === 'redirecionamento').map(opcao => {
            const sel = motivo === opcao.value
            return (
              <button
                key={opcao.value}
                type="button"
                onClick={() => setMotivo(opcao.value)}
                className={cn(
                  'w-full text-left px-3.5 py-3 rounded-xl border transition-all',
                  sel
                    ? 'border-emerald-400/50 bg-emerald-400/10'
                    : 'border-border bg-muted/10 hover:border-emerald-400/20 hover:bg-emerald-400/5',
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all',
                    sel ? 'border-emerald-400 bg-emerald-400' : 'border-border',
                  )}>
                    {sel && <div className="w-full h-full rounded-full scale-50 bg-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={cn('text-sm font-medium', sel ? 'text-emerald-300' : 'text-offwhite/80')}>{opcao.label}</p>
                      <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                        <ArrowUpRight size={9} />↗ Redirecionamento
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{opcao.descricao}</p>
                  </div>
                </div>
              </button>
            )
          })}

          {/* Consequence message */}
          {motivo && (
            <div className={cn(
              'mt-3 rounded-lg px-3 py-2 border text-xs',
              isRedirecionamento
                ? 'bg-emerald-400/5 border-emerald-400/20 text-emerald-400'
                : 'bg-red-400/5 border-red-400/20 text-red-400',
            )}>
              {isRedirecionamento
                ? 'Este lead não será perdido — será redirecionado para o pipeline de Batismo.'
                : 'Este lead será marcado como desqualificado e sairá do funil ativo.'}
            </div>
          )}

          {/* Observação */}
          <div className="mt-4 mb-5">
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Observação (opcional)</label>
            <textarea
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
              className="zion-input resize-none"
              rows={2}
              placeholder="Detalhes adicionais..."
            />
          </div>

          {/* Botões */}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="zion-btn-secondary flex-1 text-sm">Cancelar</button>
            <button
              type="button"
              onClick={confirmarDesqualificacao}
              disabled={!motivo || loading}
              className={cn(
                'flex-1 text-sm px-4 py-2.5 rounded-lg font-medium border transition-all disabled:opacity-50 disabled:cursor-not-allowed',
                isRedirecionamento
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
                  : 'bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/25',
              )}
            >
              {loading ? 'Salvando…' : isRedirecionamento ? 'Redirecionar para Batismo' : 'Registrar desqualificação'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Outras fases (Aulas, Pós-Aula, Batismo) ──
  let opcoes: OpcaoMotivo[]
  let chipLabel: string
  let tituloModal: string

  if (fase === 'AULAS') {
    opcoes = MOTIVOS_AULAS
    chipLabel = 'Aulas'
    tituloModal = 'Registrar perda'
  } else if (fase === 'POS_AULA' && contact.subetapa_batismo) {
    opcoes = MOTIVOS_BATISMO
    chipLabel = 'Trilha de batismo'
    tituloModal = 'Registrar perda'
  } else {
    opcoes = MOTIVOS_ENCAMINHAMENTO
    chipLabel = 'Encaminhamento'
    tituloModal = 'Registrar perda'
  }

  const opcaoSelecionada = opcoes.find(o => o.value === motivo)
  const reencaminha = opcaoSelecionada?.reencaminha ?? false

  async function confirmar() {
    if (!profile || !motivo) return
    setLoading(true)
    try {
      await registrarPerda(contact, motivo as MotivoPerdaLead, observacao || null, profile.id)
      toast.success(reencaminha ? 'Lead reencaminhado' : 'Perda registrada')
      onSaved()
    } catch {
      toast.error('Erro ao registrar perda')
    } finally {
      setLoading(false)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl w-full max-w-md p-6 animate-fade-in">

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-red-400/10 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={18} className="text-red-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-offwhite">{tituloModal}</h2>
              <p className="text-xs text-muted-foreground">{contact.nome}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>

        {/* Chip contextual */}
        <div className="mb-4">
          <span className="text-[10px] font-medium bg-muted/30 border border-border text-muted-foreground px-2.5 py-1 rounded-full">
            Lead em <strong className="text-offwhite">{chipLabel}</strong> — exibindo motivos relevantes para esta etapa
          </span>
        </div>

        {/* Radio cards */}
        <div className="space-y-2 mb-4">
          {opcoes.map(opcao => {
            const selecionado = motivo === opcao.value
            return (
              <button
                key={opcao.value}
                type="button"
                onClick={() => setMotivo(opcao.value)}
                className={cn(
                  'w-full text-left px-3.5 py-3 rounded-xl border transition-all',
                  selecionado
                    ? 'border-red-400/50 bg-red-400/10'
                    : 'border-border bg-muted/10 hover:border-border/80 hover:bg-muted/20',
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-4 h-4 rounded-full border-2 flex-shrink-0 transition-all',
                    selecionado ? 'border-red-400 bg-red-400' : 'border-border',
                  )}>
                    {selecionado && <div className="w-full h-full rounded-full scale-50 bg-white" />}
                  </div>
                  <div>
                    <p className={cn('text-sm font-medium', selecionado ? 'text-offwhite' : 'text-offwhite/80')}>
                      {opcao.label}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{opcao.sublabel}</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Aviso reencaminhamento */}
        {reencaminha && (
          <div className="bg-yellow-400/5 border border-yellow-400/20 rounded-lg px-3 py-2 mb-4">
            <p className="text-xs text-yellow-400">⚠ Este lead será <strong>reencaminhado</strong>, não perdido definitivamente — voltará à lista de espera do batismo.</p>
          </div>
        )}

        {/* Observação */}
        <div className="mb-5">
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Observação (opcional)</label>
          <textarea
            value={observacao}
            onChange={e => setObservacao(e.target.value)}
            className="zion-input resize-none"
            rows={2}
            placeholder="Detalhes adicionais..."
          />
        </div>

        {/* Botões */}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="zion-btn-secondary flex-1 text-sm">Cancelar</button>
          <button
            type="button"
            onClick={confirmar}
            disabled={!motivo || loading}
            className={cn(
              'flex-1 text-sm px-4 py-2.5 rounded-lg font-medium border transition-all disabled:opacity-50 disabled:cursor-not-allowed',
              reencaminha
                ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/25'
                : 'bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/25',
            )}
          >
            {loading ? 'Salvando…' : reencaminha ? 'Reencaminhar' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}
