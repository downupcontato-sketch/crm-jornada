import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, ExternalLink } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { cn, getGrupoLabel } from '@/lib/utils'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import type { Contact, ContactTipo, ContactGrupo, ContactStatus, Profile } from '@/types/database'

const schema = z.object({
  nome: z.string().min(2),
  telefone: z.string().min(10).max(11).regex(/^\d+$/, 'Somente dígitos'),
  email: z.string().email().optional().or(z.literal('')),
  tipo: z.enum(['novo_nascimento', 'reconciliacao', 'visitante'] as const),
  status: z.enum(['ativo', 'sem_resposta', 'encaminhado', 'arquivado', 'batizado', 'reciclado'] as const),
  grupo: z.enum(['rise', 'flow', 'vox', 'ek', 'zion_geral'] as const),
  voluntario_atribuido_id: z.string().uuid().nullable().optional(),
  observacoes: z.string().optional(),
})
type F = z.infer<typeof schema>

interface Props {
  contact: Contact
  onClose: () => void
  onSaved: (updated: Partial<Contact>) => void
}

export function DrawerEdicaoLead({ contact, onClose, onSaved }: Props) {
  const { isAdmin, isLider, profile } = useAuth()
  const canChangeGrupo = isAdmin
  const navigate = useNavigate()

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<F>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: contact.nome,
      telefone: contact.telefone,
      email: contact.email ?? '',
      tipo: contact.tipo,
      status: contact.status,
      grupo: contact.grupo,
      voluntario_atribuido_id: contact.voluntario_atribuido_id ?? null,
      observacoes: contact.observacoes ?? '',
    },
  })

  useEffect(() => { reset({
    nome: contact.nome, telefone: contact.telefone, email: contact.email ?? '',
    tipo: contact.tipo, status: contact.status, grupo: contact.grupo,
    voluntario_atribuido_id: contact.voluntario_atribuido_id ?? null,
    observacoes: contact.observacoes ?? '',
  }) }, [contact.id])

  const grupoSelecionado = watch('grupo')

  const { data: voluntarios } = useQuery({
    queryKey: ['voluntarios-gestao', grupoSelecionado],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id,nome').eq('nivel','voluntario').eq('ativo',true).eq('grupo', grupoSelecionado).order('nome')
      return data as Pick<Profile,'id'|'nome'>[]
    },
  })

  async function onSubmit(data: F) {
    const payload = {
      nome: data.nome,
      telefone: data.telefone,
      email: data.email || null,
      tipo: data.tipo as ContactTipo,
      status: data.status as ContactStatus,
      grupo: data.grupo as ContactGrupo,
      voluntario_atribuido_id: data.voluntario_atribuido_id ?? null,
      observacoes: data.observacoes || null,
    }
    const { error } = await supabase.from('contacts').update(payload).eq('id', contact.id)
    if (error) { toast.error('Erro ao salvar. Tente novamente.'); return }

    // Se mudou voluntário, registra atribuição
    if (data.voluntario_atribuido_id && data.voluntario_atribuido_id !== contact.voluntario_atribuido_id) {
      await supabase.from('atribuicoes').insert({
        contact_id: contact.id,
        voluntario_id: data.voluntario_atribuido_id,
        tipo: 'MANUAL',
        motivo: 'Reatribuição via gestão de leads',
        criado_por: profile?.id ?? null,
      })
    }

    toast.success('Lead atualizado com sucesso')
    onSaved(payload)
    onClose()
  }

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full sm:w-[480px] z-50 bg-card border-l border-border flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-offwhite truncate max-w-[340px]">{contact.nome}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{getGrupoLabel(contact.grupo)} · {contact.tipo.replace(/_/g,' ')}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1"><X size={20}/></button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Nome completo *</label>
            <input className={cn('zion-input', errors.nome && 'border-red-400')} {...register('nome')} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Telefone *</label>
              <input className={cn('zion-input', errors.telefone && 'border-red-400')} {...register('telefone')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">E-mail</label>
              <input type="email" className="zion-input" {...register('email')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Tipo</label>
              <select className="zion-input" {...register('tipo')}>
                <option value="novo_nascimento">Novo Nascimento</option>
                <option value="reconciliacao">Reconciliação</option>
                <option value="visitante">Visitante</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
              <select className="zion-input" {...register('status')}>
                <option value="ativo">Ativo</option>
                <option value="sem_resposta">Sem resposta</option>
                <option value="encaminhado">Encaminhado</option>
                <option value="batizado">Batizado</option>
                <option value="reciclado">Reciclado</option>
                <option value="arquivado">Arquivado</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Grupo</label>
              <select className="zion-input" disabled={!canChangeGrupo} {...register('grupo')}>
                <option value="rise">RISE</option>
                <option value="flow">FLOW</option>
                <option value="vox">VOX</option>
                <option value="ek">EK</option>
                <option value="zion_geral">Zion Geral</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Voluntário</label>
              <select className="zion-input" {...register('voluntario_atribuido_id')}>
                <option value="">— Sem atribuição —</option>
                {voluntarios?.map(v => <option key={v.id} value={v.id}>{v.nome}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Observações</label>
            <textarea className="zion-input resize-none" rows={3} {...register('observacoes')} />
          </div>
        </form>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border flex-shrink-0 space-y-3">
          <button
            type="button"
            onClick={() => navigate(`/contato/${contact.id}`)}
            className="flex items-center gap-1.5 text-xs text-menta-light hover:text-menta-light/80 transition-colors"
          >
            Ver histórico completo <ExternalLink size={12}/>
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="zion-btn-secondary flex-1 text-sm">Cancelar</button>
            <button type="submit" form="" onClick={handleSubmit(onSubmit)} disabled={isSubmitting} className="zion-btn-primary flex-1 text-sm">
              {isSubmitting ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
