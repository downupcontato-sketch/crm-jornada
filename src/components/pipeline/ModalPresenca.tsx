import { useState } from 'react'
import { X, Check, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { registrarPresenca } from '@/lib/pipeline'
import { useAuth } from '@/contexts/AuthContext'
import type { Contact } from '@/types/database'

interface Props {
  contact: Contact
  aula: 1 | 2 | 3 | 4
  onClose: () => void
  onSaved: (updated: Partial<Contact>) => void
}

export function ModalPresenca({ contact, aula, onClose, onSaved }: Props) {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(false)
  const tipo = aula === 1 ? 'Presencial' : 'Zoom'

  async function confirmar(presente: boolean) {
    if (!profile) return
    setLoading(true)
    try {
      await registrarPresenca(contact, aula, presente, profile.id)
      toast.success(`Aula ${aula}: ${presente ? 'presença' : 'falta'} registrada`)
      onSaved({ [`presenca_aula${aula}`]: presente })
    } catch {
      toast.error('Erro ao registrar presença')
    } finally {
      setLoading(false)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl w-full max-w-sm p-6 animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-offwhite">Aula {aula} — {tipo}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{contact.nome}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18}/></button>
        </div>

        <p className="text-sm text-muted-foreground mb-5">O lead compareceu à aula?</p>

        <div className="flex gap-3">
          <button
            disabled={loading}
            onClick={() => confirmar(true)}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all disabled:opacity-50"
          >
            <Check size={16}/> Sim, compareceu
          </button>
          <button
            disabled={loading}
            onClick={() => confirmar(false)}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-medium text-sm bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-all disabled:opacity-50"
          >
            <XCircle size={16}/> Não, faltou
          </button>
        </div>
      </div>
    </div>
  )
}
