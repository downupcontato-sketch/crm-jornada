import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, MessageSquare, Phone } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import type { Contact, PipelineStage } from '@/types/database'

const schema = z.object({
  tipo: z.enum(['whatsapp', 'ligacao', 'presencial', 'zoom']),
  resultado: z.enum(['respondeu', 'nao_atendeu', 'sem_resposta', 'avancou', 'recusou']),
  observacao: z.string().optional(),
  avancar_etapa: z.boolean().default(false),
  nova_etapa: z.coerce.number().optional(),
})
type FormData = z.infer<typeof schema>

export function InteractionModal({ contact, stages, onClose, onSuccess }: {
  contact: Contact; stages: PipelineStage[]; onClose: () => void; onSuccess: () => void
}) {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(false)
  const { register, handleSubmit, watch } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { tipo: 'whatsapp', resultado: 'respondeu', avancar_etapa: false },
  })

  const avancar = watch('avancar_etapa')
  const nextStages = stages.filter(s => s.id > contact.etapa_atual).slice(0, 6)

  async function onSubmit(data: FormData) {
    if (!profile) return
    setLoading(true)
    try {
      const etapaDepois = data.avancar_etapa && data.nova_etapa ? data.nova_etapa : null
      await supabase.from('interactions').insert({
        contact_id: contact.id, voluntario_id: profile.id, tipo: data.tipo,
        resultado: data.resultado, observacao: data.observacao ?? null,
        etapa_antes: contact.etapa_atual, etapa_depois: etapaDepois,
      })
      const upd: Record<string, unknown> = {
        tentativas_contato: (contact.tentativas_contato ?? 0) + 1,
        updated_at: new Date().toISOString(),
      }
      if (!contact.data_primeiro_contato && data.resultado !== 'sem_resposta') {
        upd.data_primeiro_contato = new Date().toISOString()
        upd.sla_status = 'ok'
      }
      if (etapaDepois) { upd.etapa_anterior = contact.etapa_atual; upd.etapa_atual = etapaDepois }
      if (data.resultado === 'recusou') upd.status = 'arquivado'
      if (data.resultado === 'sem_resposta' && (contact.tentativas_contato ?? 0) >= 2) upd.status = 'sem_resposta'
      await supabase.from('contacts').update(upd).eq('id', contact.id)
      toast.success('Interação registrada!')
      onSuccess()
    } catch { toast.error('Erro ao registrar interação.') }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl w-full max-w-md p-5 animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2"><MessageSquare size={18} className="text-menta-light" /><h2 className="text-base font-semibold text-offwhite">Registrar Interação</h2></div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
        </div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-muted-foreground">Contato: <span className="text-offwhite font-medium">{contact.nome}</span></p>
          <a
            href={`https://wa.me/55${contact.telefone.replace(/\D/g,'')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-400/10 hover:bg-emerald-400/20 border border-emerald-400/30 px-3 py-1.5 rounded-lg transition-all"
          >
            <Phone size={13}/>Abrir WhatsApp
          </a>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Tipo de Contato</label>
            <div className="grid grid-cols-2 gap-2">
              {(['whatsapp','ligacao','presencial','zoom'] as const).map(v => (
                <label key={v} className="cursor-pointer">
                  <input type="radio" value={v} {...register('tipo')} className="sr-only" />
                  <div className={`border rounded-lg p-2 text-center text-xs font-medium transition-all ${watch('tipo')===v ? 'border-menta-light/60 bg-menta-light/10 text-menta-light' : 'border-border text-muted-foreground'}`}>
                    {v.charAt(0).toUpperCase()+v.slice(1)}
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Resultado</label>
            <select className="zion-input" {...register('resultado')}>
              <option value="respondeu">Respondeu</option>
              <option value="nao_atendeu">Não atendeu</option>
              <option value="sem_resposta">Sem resposta</option>
              <option value="avancou">Avançou de etapa</option>
              <option value="recusou">Recusou / Desistiu</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Observação</label>
            <textarea rows={2} placeholder="Detalhes..." className="zion-input resize-none" {...register('observacao')} />
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="avancar" className="w-4 h-4 accent-menta-light" {...register('avancar_etapa')} />
            <label htmlFor="avancar" className="text-sm text-foreground cursor-pointer">Avançar para próxima etapa</label>
          </div>
          {avancar && nextStages.length > 0 && (
            <select className="zion-input" {...register('nova_etapa')}>
              {nextStages.map(s => <option key={s.id} value={s.id}>{s.id}. {s.nome}</option>)}
            </select>
          )}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="zion-btn-secondary flex-1 text-sm">Cancelar</button>
            <button type="submit" disabled={loading} className="zion-btn-primary flex-1 text-sm flex items-center justify-center gap-2">
              {loading ? <div className="w-4 h-4 border-2 border-petroleo border-t-transparent rounded-full animate-spin" /> : 'Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
