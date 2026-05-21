import { useEffect, useState } from 'react'
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
import { FASE_LABELS, SUBETAPA_LABELS } from '@/lib/pipeline'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Contact, ContactTipo, ContactGrupo, ContactStatus, Profile, LeadHistorico, Interaction } from '@/types/database'

const schema = z.object({
  nome: z.string().min(2),
  telefone: z.string().min(10).max(11).regex(/^\d+$/, 'Somente dígitos'),
  email: z.string().email().optional().or(z.literal('')),
  tipo: z.enum(['novo_nascimento', 'reconciliacao', 'visitante'] as const),
  status: z.enum(['ativo', 'sem_resposta', 'encaminhado', 'arquivado', 'batizado', 'reciclado', 'pendente_aprovacao', 'inativo'] as const),
  grupo: z.enum(['rise', 'flow', 'vox', 'ek', 'zion_geral'] as const),
  voluntario_atribuido_id: z.string().uuid().nullable().optional(),
  observacoes: z.string().optional(),
})
type F = z.infer<typeof schema>

type Aba = 'dados' | 'historico' | 'interacoes' | 'pipeline'

interface Props {
  contact: Contact
  onClose: () => void
  onSaved: (updated: Partial<Contact>) => void
}

const TIPO_HIST: Record<string, { label: string; cor: string }> = {
  AVANCO_ETAPA:    { label: 'Avanço',      cor: 'text-menta-light' },
  PRESENCA:        { label: 'Presença',     cor: 'text-emerald-400' },
  PERDA:           { label: 'Perda',        cor: 'text-red-400' },
  REENCAMINHAMENTO:{ label: 'Reencaminh.',  cor: 'text-yellow-400' },
  CONTATO:         { label: 'Contato',      cor: 'text-blue-400' },
  EDICAO:          { label: 'Edição',       cor: 'text-muted-foreground' },
}

const TIPO_INT: Record<string, string> = { whatsapp: 'WhatsApp', ligacao: 'Ligação', presencial: 'Presencial', zoom: 'Zoom' }
const RESULTADO_INT: Record<string, string> = { respondeu: 'Respondeu', nao_atendeu: 'Não atendeu', sem_resposta: 'Sem resposta', avancou: 'Avançou', recusou: 'Recusou' }
const RESULTADO_COR: Record<string, string> = { respondeu: 'text-emerald-400', nao_atendeu: 'text-yellow-400', sem_resposta: 'text-red-400', avancou: 'text-menta-light', recusou: 'text-red-400' }

export function DrawerEdicaoLead({ contact, onClose, onSaved }: Props) {
  const { isAdmin, profile } = useAuth()
  const canChangeGrupo = isAdmin
  const navigate = useNavigate()
  const [aba, setAba] = useState<Aba>('dados')

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

  const { data: historico } = useQuery({
    queryKey: ['lead-historico-gestao', contact.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('lead_historico')
        .select('*,profiles(nome)')
        .eq('contact_id', contact.id)
        .order('created_at', { ascending: false })
        .limit(50)
      return (data ?? []) as (LeadHistorico & { profiles: { nome: string } | null })[]
    },
    enabled: aba === 'historico',
  })

  const { data: interacoes } = useQuery({
    queryKey: ['interacoes-gestao', contact.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('interactions')
        .select('*,profiles!interactions_voluntario_id_fkey(id,nome)')
        .eq('contact_id', contact.id)
        .order('data_interacao', { ascending: false })
      return (data ?? []) as (Interaction & { profiles: { id: string; nome: string } | null })[]
    },
    enabled: aba === 'interacoes',
  })

  async function onSubmit(data: F) {
    const mudouVoluntario = data.voluntario_atribuido_id && data.voluntario_atribuido_id !== contact.voluntario_atribuido_id
    const payload = {
      nome: data.nome,
      telefone: data.telefone,
      email: data.email || null,
      tipo: data.tipo as ContactTipo,
      status: data.status as ContactStatus,
      grupo: data.grupo as ContactGrupo,
      voluntario_atribuido_id: data.voluntario_atribuido_id ?? null,
      ...(mudouVoluntario ? { atribuido_por_coordenador: true } : {}),
      observacoes: data.observacoes || null,
    }
    const { error } = await supabase.from('contacts').update(payload).eq('id', contact.id)
    if (error) { toast.error('Erro ao salvar. Tente novamente.'); return }

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

  const abas: { key: Aba; label: string }[] = [
    { key: 'dados',      label: 'Dados' },
    { key: 'historico',  label: 'Histórico' },
    { key: 'interacoes', label: 'Interações' },
    { key: 'pipeline',   label: 'Pipeline' },
  ]

  const subatual = contact.subetapa_contato ?? contact.subetapa_qualificacao ?? contact.subetapa_encaminhamento ?? contact.subetapa_batismo

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full sm:w-[500px] z-50 bg-card border-l border-border flex flex-col animate-slide-in-right">

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-offwhite truncate max-w-[380px]">{contact.nome}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{getGrupoLabel(contact.grupo)} · {contact.tipo.replace(/_/g,' ')}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1"><X size={20}/></button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-3 border-b border-border flex-shrink-0 pb-0">
          {abas.map(a => (
            <button
              key={a.key}
              onClick={() => setAba(a.key)}
              className={cn(
                'px-3 py-2 text-xs font-medium border-b-2 transition-all -mb-px',
                aba === a.key
                  ? 'border-menta-light text-menta-light'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {a.label}
            </button>
          ))}
        </div>

        {/* Conteúdo da aba */}
        <div className="flex-1 overflow-y-auto">

          {/* ── ABA DADOS ── */}
          {aba === 'dados' && (
            <form onSubmit={handleSubmit(onSubmit)} className="px-5 py-4 space-y-4">
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

              <div className="pt-2 space-y-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => navigate(`/contato/${contact.id}`)}
                  className="flex items-center gap-1.5 text-xs text-menta-light hover:text-menta-light/80 transition-colors"
                >
                  Ver página completa <ExternalLink size={12}/>
                </button>
                <div className="flex gap-2">
                  <button type="button" onClick={onClose} className="zion-btn-secondary flex-1 text-sm">Cancelar</button>
                  <button type="submit" disabled={isSubmitting} className="zion-btn-primary flex-1 text-sm">
                    {isSubmitting ? 'Salvando…' : 'Salvar'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* ── ABA HISTÓRICO ── */}
          {aba === 'historico' && (
            <div className="px-5 py-4">
              {!historico ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-menta-light border-t-transparent rounded-full animate-spin"/>
                </div>
              ) : historico.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">Nenhum registro de histórico.</p>
              ) : (
                <div className="space-y-2">
                  {historico.map(h => {
                    const meta = TIPO_HIST[h.tipo] ?? { label: h.tipo, cor: 'text-muted-foreground' }
                    return (
                      <div key={h.id} className="border-b border-border/40 pb-2 last:border-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className={cn('text-xs font-semibold', meta.cor)}>{meta.label}</span>
                          <span className="text-[10px] text-muted-foreground/60">{format(new Date(h.created_at),'dd/MM HH:mm',{locale:ptBR})}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{h.descricao}</p>
                        {h.profiles && <p className="text-[10px] text-muted-foreground/50 mt-0.5">por {h.profiles.nome}</p>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── ABA INTERAÇÕES ── */}
          {aba === 'interacoes' && (
            <div className="px-5 py-4">
              {!interacoes ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-menta-light border-t-transparent rounded-full animate-spin"/>
                </div>
              ) : interacoes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">Nenhuma interação registrada.</p>
              ) : (
                <div className="space-y-3">
                  {interacoes.map(i => (
                    <div key={i.id} className="border-b border-border/40 pb-3 last:border-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{TIPO_INT[i.tipo] ?? i.tipo}</span>
                          <span className={cn('text-xs font-medium', RESULTADO_COR[i.resultado] ?? 'text-muted-foreground')}>{RESULTADO_INT[i.resultado] ?? i.resultado}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground/60">{format(new Date(i.data_interacao),'dd/MM HH:mm',{locale:ptBR})}</span>
                      </div>
                      {i.observacao && <p className="text-xs text-muted-foreground">{i.observacao}</p>}
                      {i.profiles && <p className="text-[10px] text-muted-foreground/50 mt-0.5">por {i.profiles.nome}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── ABA PIPELINE ── */}
          {aba === 'pipeline' && (
            <div className="px-5 py-4 space-y-4">
              <div className="bg-menta-dark/20 border border-menta-dark/30 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-0.5">Fase atual</p>
                <p className="text-sm font-semibold text-menta-light">{FASE_LABELS[contact.fase_pipeline]}</p>
                {subatual && <p className="text-xs text-muted-foreground mt-0.5">{SUBETAPA_LABELS[subatual] ?? subatual}</p>}
              </div>

              <div className="space-y-2 text-xs">
                {contact.data_distribuicao && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Distribuído em</span>
                    <span className="text-offwhite">{format(new Date(contact.data_distribuicao),'dd/MM/yy HH:mm',{locale:ptBR})}</span>
                  </div>
                )}
                {contact.data_primeiro_contato && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Primeiro contato</span>
                    <span className="text-offwhite">{format(new Date(contact.data_primeiro_contato),'dd/MM/yy HH:mm',{locale:ptBR})}</span>
                  </div>
                )}
                {contact.data_envio_convite && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Convite enviado</span>
                    <span className="text-offwhite">{format(new Date(contact.data_envio_convite),'dd/MM/yy',{locale:ptBR})}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tentativas de contato</span>
                  <span className="text-offwhite">{contact.tentativas_contato}x</span>
                </div>
                {contact.motivo_perda && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Motivo de perda</span>
                    <span className="text-red-400">{contact.motivo_perda.replace(/_/g,' ')}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
