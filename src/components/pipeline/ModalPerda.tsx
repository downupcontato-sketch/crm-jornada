import { useState } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { registrarPerda } from '@/lib/pipeline'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import { FASE_LABELS } from '@/lib/pipeline'
import type { Contact, FasePipeline, MotivoPerdaLead } from '@/types/database'

interface Props {
  contact: Contact
  onClose: () => void
  onSaved: () => void
}

interface OpcaoMotivo {
  value: MotivoPerdaLead
  label: string
  sublabel: string
  reencaminha?: boolean
}

const MOTIVOS_CONTATO_QUALIFICACAO: OpcaoMotivo[] = [
  { value: 'JA_INTEGRADO',               label: 'Sem perfil / incompatível',        sublabel: 'Não atende os requisitos da comunidade' },
  { value: 'SEM_DISPONIBILIDADE',        label: 'Sem interesse',                    sublabel: 'Manifestou que não quer prosseguir' },
  { value: 'NUMERO_INCORRETO',           label: 'Número incorreto / sem contato',   sublabel: 'Impossível estabelecer comunicação' },
  { value: 'SEM_RESPOSTA_APOS_TENTATIVAS', label: 'Falta de engajamento',           sublabel: 'Respondeu mas parou de interagir' },
  { value: 'OUTROS',                     label: 'Outros',                           sublabel: 'Motivo não listado acima' },
]

const MOTIVOS_AULAS: OpcaoMotivo[] = [
  { value: 'NAO_COMPARECEU_AULA_1',   label: 'Não compareceu à Aula 1',        sublabel: 'Faltou na primeira aula sem retorno' },
  { value: 'FREQUENCIA_INSUFICIENTE', label: 'Frequência insuficiente',         sublabel: 'Menos de 3 de 4 aulas concluídas' },
  { value: 'OUTROS',                  label: 'Outros',                          sublabel: 'Motivo não listado acima' },
]

const MOTIVOS_ENCAMINHAMENTO: OpcaoMotivo[] = [
  { value: 'NAO_ENTROU_LINK', label: 'Não entrou no link', sublabel: 'Não acessou o link enviado' },
  { value: 'OUTROS',          label: 'Outros',             sublabel: 'Motivo não listado acima' },
]

const MOTIVOS_BATISMO: OpcaoMotivo[] = [
  { value: 'NAO_DECIDIU_BATIZAR',          label: 'Não decidiu batizar',             sublabel: 'Ainda não se sente pronto',           reencaminha: true },
  { value: 'NAO_RESPONDEU_CONTATO_BATISMO',label: 'Sem resposta no contato batismo', sublabel: 'Não respondeu às tentativas de contato' },
  { value: 'NAO_COMPARECEU_AULA_BATISMO',  label: 'Não compareceu à aula',           sublabel: 'Faltou à aula de batismo',            reencaminha: true },
  { value: 'NAO_CUMPRE_REQUISITOS',        label: 'Não cumpre requisitos',           sublabel: 'Não atende os critérios para batismo', reencaminha: true },
  { value: 'OUTROS',                       label: 'Outros',                          sublabel: 'Motivo não listado acima' },
]

function getOpcoes(contact: Contact): { opcoes: OpcaoMotivo[]; chipLabel: string; tituloModal: string } {
  const fase = contact.fase_pipeline as FasePipeline
  if (fase === 'CONTATO_INICIAL' || fase === 'QUALIFICACAO') {
    return {
      opcoes: MOTIVOS_CONTATO_QUALIFICACAO,
      chipLabel: FASE_LABELS[fase],
      tituloModal: 'Registrar desqualificação',
    }
  }
  if (fase === 'AULAS') {
    return { opcoes: MOTIVOS_AULAS, chipLabel: 'Aulas', tituloModal: 'Registrar perda' }
  }
  if (fase === 'POS_AULA') {
    if (contact.subetapa_batismo) {
      return { opcoes: MOTIVOS_BATISMO, chipLabel: 'Trilha de batismo', tituloModal: 'Registrar perda' }
    }
    return { opcoes: MOTIVOS_ENCAMINHAMENTO, chipLabel: 'Encaminhamento', tituloModal: 'Registrar perda' }
  }
  return { opcoes: MOTIVOS_CONTATO_QUALIFICACAO, chipLabel: FASE_LABELS[fase] ?? fase, tituloModal: 'Registrar perda' }
}

export function ModalPerda({ contact, onClose, onSaved }: Props) {
  const { profile } = useAuth()
  const [motivo, setMotivo] = useState<MotivoPerdaLead | ''>('')
  const [observacao, setObservacao] = useState('')
  const [loading, setLoading] = useState(false)

  const { opcoes, chipLabel, tituloModal } = getOpcoes(contact)
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
