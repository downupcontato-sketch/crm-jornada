import { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'

interface Props {
  nomes: string[]           // 1 lead ou múltiplos
  onConfirmar: (motivo: string) => Promise<void>
  onCancelar: () => void
}

export function ModalArquivar({ nomes, onConfirmar, onCancelar }: Props) {
  const [motivo, setMotivo] = useState('')
  const [carregando, setCarregando] = useState(false)
  const bulk = nomes.length > 1

  async function confirmar() {
    setCarregando(true)
    try { await onConfirmar(motivo) } finally { setCarregando(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70" onClick={onCancelar} />
      <div className="relative bg-card border border-border rounded-2xl w-full max-w-md p-6 animate-fade-in">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-red-400/10 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={18} className="text-red-400" />
            </div>
            <h2 className="text-base font-semibold text-offwhite">
              {bulk ? `Arquivar ${nomes.length} leads` : 'Arquivar lead'}
            </h2>
          </div>
          <button onClick={onCancelar} className="text-muted-foreground hover:text-foreground"><X size={18}/></button>
        </div>

        {!bulk && (
          <p className="text-sm text-muted-foreground mb-4">
            Você está arquivando <strong className="text-offwhite">{nomes[0]}</strong>.
          </p>
        )}
        {bulk && (
          <p className="text-sm text-muted-foreground mb-4">
            Você está arquivando <strong className="text-offwhite">{nomes.length} leads</strong>: {nomes.slice(0,3).join(', ')}{nomes.length > 3 ? ` e +${nomes.length - 3}` : ''}.
          </p>
        )}

        <div className="bg-yellow-400/5 border border-yellow-400/20 rounded-lg px-3 py-2 mb-4">
          <p className="text-xs text-yellow-400">O lead não será deletado. Poderá ser recuperado depois alterando o status.</p>
        </div>

        <div className="mb-5">
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Motivo (opcional)</label>
          <textarea
            value={motivo}
            onChange={e => setMotivo(e.target.value)}
            className="zion-input resize-none"
            rows={2}
            placeholder="Ex: Sem resposta após 30 dias, mudou de cidade…"
          />
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={onCancelar} className="zion-btn-secondary flex-1 text-sm">Cancelar</button>
          <button
            type="button"
            onClick={confirmar}
            disabled={carregando}
            className="flex-1 text-sm px-4 py-2.5 rounded-lg font-medium bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-all disabled:opacity-50"
          >
            {carregando ? 'Arquivando…' : bulk ? `Arquivar ${nomes.length} leads` : 'Arquivar lead'}
          </button>
        </div>
      </div>
    </div>
  )
}
