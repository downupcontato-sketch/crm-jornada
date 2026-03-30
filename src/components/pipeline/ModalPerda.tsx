import { useState } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { registrarPerda, MOTIVOS_PERDA } from '@/lib/pipeline'
import { useAuth } from '@/contexts/AuthContext'
import type { Contact, MotivoPerdaLead } from '@/types/database'

interface Props {
  contact: Contact
  onClose: () => void
  onSaved: () => void
}

export function ModalPerda({ contact, onClose, onSaved }: Props) {
  const { profile } = useAuth()
  const [motivo, setMotivo] = useState<MotivoPerdaLead | ''>('')
  const [observacao, setObservacao] = useState('')
  const [loading, setLoading] = useState(false)

  const motivoObj = MOTIVOS_PERDA.flatMap(g => g.motivos).find(m => m.value === motivo)
  const reencaminha = motivoObj?.reencaminha ?? false

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
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-red-400/10 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={18} className="text-red-400"/>
            </div>
            <div>
              <h2 className="text-base font-semibold text-offwhite">Registrar Perda</h2>
              <p className="text-xs text-muted-foreground">{contact.nome}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18}/></button>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Motivo *</label>
          <select
            value={motivo}
            onChange={e => setMotivo(e.target.value as MotivoPerdaLead)}
            className="zion-input"
          >
            <option value="">— Selecionar motivo —</option>
            {MOTIVOS_PERDA.map(grupo => (
              <optgroup key={grupo.fase} label={grupo.fase}>
                {grupo.motivos.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {reencaminha && (
          <div className="bg-yellow-400/5 border border-yellow-400/20 rounded-lg px-3 py-2 mb-4">
            <p className="text-xs text-yellow-400">⚠ Este lead será <strong>reencaminhado</strong>, não perdido definitivamente — voltará à lista de espera do batismo.</p>
          </div>
        )}

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

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="zion-btn-secondary flex-1 text-sm">Cancelar</button>
          <button
            type="button"
            onClick={confirmar}
            disabled={!motivo || loading}
            className={`flex-1 text-sm px-4 py-2.5 rounded-lg font-medium border transition-all disabled:opacity-50 ${
              reencaminha
                ? 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/25'
                : 'bg-red-500/15 text-red-400 border-red-500/30 hover:bg-red-500/25'
            }`}
          >
            {loading ? 'Salvando…' : reencaminha ? 'Reencaminhar' : 'Confirmar perda'}
          </button>
        </div>
      </div>
    </div>
  )
}
