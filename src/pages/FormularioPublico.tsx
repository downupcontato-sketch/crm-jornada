import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle, UserPlus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import type { ContactTipo, ContactGrupo } from '@/types/database'

const schema = z.object({
  nome: z.string().min(2, 'Nome é obrigatório'),
  telefone: z.string().min(10, 'Telefone inválido').regex(/^[\d\s\(\)\-\+]+$/, 'Somente números'),
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

export default function FormularioPublico() {
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, reset, formState: { errors }, watch } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { tipo: 'novo_nascimento', grupo: 'zion_geral', autorizacao_contato: true },
  })

  const grupo = watch('grupo')
  const tipo = watch('tipo')

  async function onSubmit(data: FormData) {
    setLoading(true)
    try {
      const { error } = await supabase.from('contacts').insert({
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
        captador_id: null,
        culto_captacao: new Date().toISOString().split('T')[0],
        etapa_atual: 0,
        status: 'pendente_aprovacao',
        fase_pipeline: 'CONTATO_INICIAL',
        subetapa_contato: 'TENTATIVA_1',
        sla_status: 'ok',
        tentativas_contato: 0,
      })
      if (error) throw error
      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        reset({ tipo: 'novo_nascimento', grupo: 'zion_geral', autorizacao_contato: true })
      }, 4000)
    } catch (err) {
      toast.error('Erro ao enviar cadastro. Tente novamente.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-petroleo flex items-center justify-center px-4">
        <div className="text-center animate-fade-in">
          <div className="w-20 h-20 rounded-full bg-menta-light/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={40} className="text-menta-light" />
          </div>
          <h2 className="text-2xl font-semibold text-offwhite mb-2">Cadastro enviado!</h2>
          <p className="text-muted-foreground">Em breve nossa equipe entrará em contato.</p>
          <p className="text-sm text-muted-foreground mt-1">Obrigado, que Deus te abençoe!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-petroleo px-4 py-8 pb-16">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-menta-light to-menta-dark flex items-center justify-center mx-auto mb-3">
            <span className="text-petroleo font-bold text-xl">Z</span>
          </div>
          <h1 className="text-xl font-semibold text-offwhite">Bem-vindo à Zion Church</h1>
          <p className="text-muted-foreground text-sm mt-1">Preencha seus dados para se cadastrar</p>
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
            <label className="block text-sm font-medium text-foreground mb-1.5">Nome Completo <span className="text-red-400">*</span></label>
            <input type="text" placeholder="João da Silva" autoComplete="name" className="zion-input" {...register('nome')} />
            {errors.nome && <p className="text-red-400 text-xs mt-1">{errors.nome.message}</p>}
          </div>

          {/* Telefone */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">WhatsApp <span className="text-red-400">*</span></label>
            <input type="tel" placeholder="(11) 99999-9999" autoComplete="tel" inputMode="tel" className="zion-input" {...register('telefone')} />
            {errors.telefone && <p className="text-red-400 text-xs mt-1">{errors.telefone.message}</p>}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Email <span className="text-muted-foreground text-xs">(opcional)</span></label>
            <input type="email" placeholder="joao@email.com" autoComplete="email" className="zion-input" {...register('email')} />
          </div>

          {/* Grupo */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Grupo <span className="text-red-400">*</span></label>
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

          {/* Pulseira */}
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
              Autorizo o contato via WhatsApp pelo ministério Jornada da Zion Church.
            </label>
          </div>

          <button type="submit" disabled={loading}
            className="zion-btn-primary w-full flex items-center justify-center gap-2 text-base py-3">
            {loading
              ? <div className="w-5 h-5 border-2 border-petroleo border-t-transparent rounded-full animate-spin" />
              : <UserPlus size={18} />}
            {loading ? 'Enviando...' : 'Enviar Cadastro'}
          </button>
        </form>
      </div>
    </div>
  )
}
