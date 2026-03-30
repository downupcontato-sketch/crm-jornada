import { useState } from 'react'
import { X, Phone, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { avancarSubetapa } from '@/lib/pipeline'
import type { Contact } from '@/types/database'

interface Props {
  contact: Contact
  onClose: () => void
  onUpdated: (upd: Partial<Contact>) => void
}

const TIPO_OPTS = [
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { value: 'ligacao', label: 'Ligação', icon: Phone },
]

export function ModalRegistroContato({ contact, onClose, onUpdated }: Props) {
  const { profile } = useAuth()
  const [tipo, setTipo] = useState<'whatsapp' | 'ligacao'>('whatsapp')
  const [resultado, setResultado] = useState<'respondeu' | 'sem_resposta' | 'avancou'>('respondeu')
  const [observacao, setObservacao] = useState('')
  const [avancar, setAvancar] = useState(false)
  const [loading, setLoading] = useState(false)

  async function salvar() {
    if (!profile) return
    setLoading(true)
    try {
      // Registrar interação no histórico de lead
      await supabase.from('lead_historico').insert({
        contact_id: contact.id,
        user_id: profile.id,
        tipo: 'CONTATO',
        descricao: `${tipo === 'whatsapp' ? 'WhatsApp' : 'Ligação'}: ${resultado === 'respondeu' ? 'respondeu' : resultado === 'sem_resposta' ? 'sem resposta' : 'avançou'}${observacao ? ` — ${observacao}` : ''}`,
      })

      let upd: Partial<Contact> = {}

      if (avancar && resultado !== 'sem_resposta') {
        const avancado = await avancarSubetapa(contact, profile.id)
        if (avancado) upd = avancado
      } else {
        // Touch updated_at
        await supabase.from('contacts').update({ updated_at: new Date().toISOString() }).eq('id', contact.id)
      }

      toast.success('Contato registrado!')
      onUpdated(upd)
      onClose()
    } catch {
      toast.error('Erro ao registrar contato')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl w-full max-w-sm p-5 animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-offwhite">Registrar Contato</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{contact.nome}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>

        {/* Canal */}
        <div className="flex gap-2 mb-4">
          {TIPO_OPTS.map(t => (
            <button
              key={t.value}
              onClick={() => setTipo(t.value as typeof tipo)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium border transition-all ${
                tipo === t.value
                  ? 'bg-menta-light/15 text-menta-light border-menta-light/40'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              <t.icon size={14} />{t.label}
            </button>
          ))}
        </div>

        {/* Resultado */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Resultado</label>
          <div className="space-y-1.5">
            {([
              { v: 'respondeu',    l: 'Respondeu / atendeu' },
              { v: 'sem_resposta', l: 'Sem resposta' },
              { v: 'avancou',      l: 'Avançou na conversa' },
            ] as const).map(r => (
              <label key={r.v} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="resultado"
                  value={r.v}
                  checked={resultado === r.v}
                  onChange={() => setResultado(r.v)}
                  className="accent-[#4ECDC4]"
                />
                <span className="text-sm text-offwhite">{r.l}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Obs */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Observação (opcional)</label>
          <textarea
            value={observacao}
            onChange={e => setObservacao(e.target.value)}
            rows={2}
            className="zion-input resize-none text-sm"
            placeholder="Ex: Vai pensar e responde amanhã..."
          />
        </div>

        {/* Avançar etapa? */}
        {resultado !== 'sem_resposta' && (
          <label className="flex items-center gap-2 cursor-pointer mb-4">
            <input
              type="checkbox"
              checked={avancar}
              onChange={e => setAvancar(e.target.checked)}
              className="accent-[#4ECDC4]"
            />
            <span className="text-sm text-offwhite">Avançar etapa também</span>
          </label>
        )}

        <div className="flex gap-2">
          <button onClick={onClose} className="zion-btn-secondary flex-1 text-sm">Cancelar</button>
          <button
            onClick={salvar}
            disabled={loading}
            className="flex-1 zion-btn-primary text-sm disabled:opacity-50"
          >
            {loading ? 'Salvando…' : 'Registrar'}
          </button>
        </div>
      </div>
    </div>
  )
}
