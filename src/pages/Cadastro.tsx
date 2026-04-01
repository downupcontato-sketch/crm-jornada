import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle, UserPlus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { verificarDuplicata, distribuirLead, mesclarLeads, type ResultadoDedup } from '@/lib/distribuicao'
import { ModalDuplicata } from '@/components/contacts/ModalDuplicata'
import { toast } from 'sonner'
import type { ContactTipo, ContactGrupo } from '@/types/database'

const schema = z.object({
  nome: z.string().min(2, 'Nome é obrigatório'),
  telefone: z.string()
    .min(10, 'Telefone inválido')
    .regex(/^[\d\s\(\)\-\+]+$/, 'Somente números'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  tipo: z.enum(['novo_nascimento', 'reconciliacao', 'visitante'] as const),
  grupo: z.enum(['rise', 'flow', 'vox', 'ek', 'zion_geral'] as const),
  sexo: z.enum(['masculino', 'feminino', 'outro']).optional(),
  idade: z.coerce.number().min(1).max(120).optional(),
  igreja_origem: z.string().optional(),
  numero_pulseira: z.string().optional(),
  autorizacao_contato: z.boolean().default(true),
})
type FormData = z.infer<typeof schema>

export default function Cadastro() {
  const { profile } = useAuth()
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [duplicata, setDuplicata] = useState<ResultadoDedup | null>(null)
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null)

  const { register, handleSubmit, reset, formState: { errors }, watch } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      tipo: 'novo_nascimento',
      grupo: profile?.grupo ?? 'zion_geral',
      autorizacao_contato: true,
    },
  })

  const grupo = watch('grupo')
  const tipo = watch('tipo')

  async function criarContato(data: FormData) {
    setLoading(true)
    try {
      const { data: contact, error } = await supabase.from('contacts').insert({
        nome: data.nome,
        telefone: data.telefone.replace(/\D/g, ''),
        email: data.email || null,
        whatsapp_valido: true,
        tipo: data.tipo as ContactTipo,
        grupo: data.grupo as ContactGrupo,
        sexo: data.sexo ?? null,
        idade: data.idade ?? null,
        igreja_origem: data.igreja_origem ?? null,
        numero_pulseira: data.numero_pulseira ?? null,
        autorizacao_contato: data.autorizacao_contato,
        captador_id: profile?.id ?? null,
        culto_captacao: new Date().toISOString().split('T')[0],
        etapa_atual: 3,
        status: 'ativo',
        sla_status: 'ok',
        tentativas_contato: 0,
      }).select('id').single()

      if (error) throw error

      // Disparar distribuição automática
      if (contact?.id) {
        const dist = await distribuirLead(contact.id)
        if (dist.tipo === 'AUTOMATICA') {
          toast.success('Lead distribuído automaticamente para um voluntário.')
        } else if (dist.tipo === 'FILA') {
          toast.info('Todos os voluntários estão no limite. Lead adicionado à fila de espera.')
        }
      }

      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        reset({
          tipo: 'novo_nascimento',
          grupo: profile?.grupo ?? 'zion_geral',
          autorizacao_contato: true,
        })
      }, 3000)
    } catch (err) {
      toast.error('Erro ao salvar cadastro. Tente novamente.')
      console.error(err)
    } finally {
      setLoading(false)
      setPendingFormData(null)
      setDuplicata(null)
    }
  }

  async function onSubmit(data: FormData) {
    setLoading(true)

    // Verificar duplicata antes de criar
    const resultado = await verificarDuplicata(
      data.telefone,
      data.email || undefined,
      data.nome
    )
    setLoading(false)

    if (resultado.duplicataEncontrada) {
      setPendingFormData(data)
      setDuplicata(resultado)
      return
    }

    await criarContato(data)
  }

  // Ações do modal de duplicata
  async function onForceCriacao() {
    if (!pendingFormData) return
    await criarContato(pendingFormData)
  }

  async function onMesclar(leadExistenteId: string) {
    if (!pendingFormData) return
    setLoading(true)
    try {
      // Cria o novo contato primeiro
      const { data: novoContact, error } = await supabase.from('contacts').insert({
        nome: pendingFormData.nome,
        telefone: pendingFormData.telefone.replace(/\D/g, ''),
        email: pendingFormData.email || null,
        whatsapp_valido: true,
        tipo: pendingFormData.tipo as ContactTipo,
        grupo: pendingFormData.grupo as ContactGrupo,
        sexo: pendingFormData.sexo ?? null,
        idade: pendingFormData.idade ?? null,
        captador_id: profile?.id ?? null,
        culto_captacao: new Date().toISOString().split('T')[0],
        etapa_atual: 3,
        status: 'ativo',
        sla_status: 'ok',
        tentativas_contato: 0,
        autorizacao_contato: pendingFormData.autorizacao_contato,
      }).select('id').single()

      if (error) throw error

      // Mescla: mantém o existente, arquiva o novo (que tem menos dados)
      if (novoContact?.id) {
        const { error: mergeError } = await mesclarLeads(leadExistenteId, novoContact.id)
        if (mergeError) throw new Error(mergeError)
      }

      toast.success('Registros mesclados. O cadastro existente foi atualizado.')
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      toast.error('Erro ao mesclar registros.')
      console.error(err)
    } finally {
      setLoading(false)
      setPendingFormData(null)
      setDuplicata(null)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-petroleo flex items-center justify-center px-4">
        <div className="text-center animate-fade-in">
          <div className="w-20 h-20 rounded-full bg-menta-light/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={40} className="text-menta-light" />
          </div>
          <h2 className="text-2xl font-semibold text-offwhite mb-2">Cadastrado!</h2>
          <p className="text-muted-foreground">O contato foi registrado e distribuído.</p>
          <p className="text-sm text-muted-foreground mt-1">Próximo formulário em instantes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-petroleo px-4 py-8 pb-16">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-menta-light to-menta-dark flex items-center justify-center mx-auto mb-3">
            <UserPlus size={22} className="text-petroleo" />
          </div>
          <h1 className="text-xl font-semibold text-offwhite">Novo Cadastro</h1>
          <p className="text-muted-foreground text-sm mt-1">Jornada — Zion Church</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Tipo */}
          <div className="zion-card">
            <label className="block text-sm font-semibold text-offwhite mb-3">
              Tipo de Decisão <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: 'novo_nascimento', label: 'Novo Nascimento', color: 'border-menta-light/60 bg-menta-light/10 text-menta-light' },
                { value: 'reconciliacao', label: 'Reconciliação', color: 'border-purple-400/60 bg-purple-400/10 text-purple-400' },
                { value: 'visitante', label: 'Visitante', color: 'border-blue-400/60 bg-blue-400/10 text-blue-400' },
              ] as const).map(opt => (
                <label key={opt.value} className="cursor-pointer">
                  <input type="radio" value={opt.value} {...register('tipo')} className="sr-only" />
                  <div className={`border rounded-lg p-2.5 text-center text-xs font-medium transition-all ${
                    tipo === opt.value ? opt.color + ' border-current' : 'border-border text-muted-foreground hover:border-muted'
                  }`}>
                    {opt.label}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Nome */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Nome Completo <span className="text-red-400">*</span>
            </label>
            <input type="text" placeholder="João da Silva" autoComplete="name" className="zion-input" {...register('nome')} />
            {errors.nome && <p className="text-red-400 text-xs mt-1">{errors.nome.message}</p>}
          </div>

          {/* Telefone */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              WhatsApp <span className="text-red-400">*</span>
            </label>
            <input type="tel" placeholder="(11) 99999-9999" autoComplete="tel" inputMode="tel" className="zion-input" {...register('telefone')} />
            {errors.telefone && <p className="text-red-400 text-xs mt-1">{errors.telefone.message}</p>}
          </div>

          {/* Email (opcional, melhora deduplicação) */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Email <span className="text-muted-foreground text-xs">(opcional)</span>
            </label>
            <input type="email" placeholder="joao@email.com" autoComplete="email" className="zion-input" {...register('email')} />
          </div>

          {/* Grupo */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Grupo <span className="text-red-400">*</span>
            </label>
            <select className="zion-input" {...register('grupo')}>
              <option value="rise">RISE</option>
              <option value="flow">FLOW</option>
              <option value="vox">VOX</option>
              <option value="ek">EK</option>
              <option value="zion_geral">Zion Geral</option>
            </select>
          </div>

          {/* Sexo + Idade */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Sexo</label>
              <select className="zion-input" {...register('sexo')}>
                <option value="">Selecione</option>
                <option value="masculino">Masculino</option>
                <option value="feminino">Feminino</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Idade</label>
              <input type="number" placeholder="25" inputMode="numeric" min={1} max={120} className="zion-input" {...register('idade')} />
            </div>
          </div>

          {/* Igreja de origem */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Igreja de Origem</label>
            <input type="text" placeholder="Nome da igreja anterior (se houver)" className="zion-input" {...register('igreja_origem')} />
          </div>

          {/* Pulseira (Rise/Flow) */}
          {(grupo === 'rise' || grupo === 'flow') && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Número da Pulseira</label>
              <input type="text" placeholder="Ex: A-042" className="zion-input" {...register('numero_pulseira')} />
            </div>
          )}

          {/* Autorização */}
          <div className="flex items-start gap-3 zion-card">
            <input type="checkbox" id="autorizacao" className="mt-0.5 w-4 h-4 accent-menta-light" {...register('autorizacao_contato')} />
            <label htmlFor="autorizacao" className="text-sm text-muted-foreground cursor-pointer">
              A pessoa autoriza o contato via WhatsApp pelo ministério Jornada.
            </label>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="zion-btn-primary w-full flex items-center justify-center gap-2 text-base py-3"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-petroleo border-t-transparent rounded-full animate-spin" />
            ) : (
              <UserPlus size={18} />
            )}
            {loading ? 'Verificando...' : 'Cadastrar'}
          </button>
        </form>
      </div>

      {/* Modal de duplicata */}
      {duplicata?.duplicataEncontrada && (
        <ModalDuplicata
          resultado={duplicata}
          onForceCriacao={onForceCriacao}
          onMesclar={onMesclar}
          onCancelar={() => { setDuplicata(null); setPendingFormData(null) }}
        />
      )}
    </div>
  )
}
