import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, UserPlus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { DEFAULT_CHURCH_ID } from '@/lib/constants/church'

const schema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  grupo: z.enum(['rise', 'flow', 'vox', 'ek', 'zion_geral'] as const, { required_error: 'Selecione um grupo' }),
  nivel: z.enum(['voluntario', 'linha_de_frente', 'coordenador', 'lider'] as const, { required_error: 'Selecione um nível' }),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  confirmPassword: z.string().min(6),
}).refine(d => d.password === d.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
})

type F = z.infer<typeof schema>

export default function SolicitarAcesso() {
  const navigate = useNavigate()
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<F>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(data: F) {
    setLoading(true)
    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: { data: { nome: data.nome } },
      })

      if (signUpError) throw signUpError
      if (!authData.user) throw new Error('Erro ao criar usuário.')

      const { error: profileError } = await supabase.from('profiles').update({
        nome: data.nome,
        nivel: data.nivel,
        grupo: data.grupo,
        status: 'pendente',
        ativo: false,
        church_id: DEFAULT_CHURCH_ID,
      }).eq('id', authData.user.id)

      if (profileError) throw profileError

      await supabase.auth.signOut()
      navigate('/aguardando-aprovacao')
    } catch (err: any) {
      toast.error(err?.message ?? 'Erro ao enviar solicitação.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-petroleo flex items-center justify-center px-4 py-8">
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-menta-dark/10 blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      <div className="w-full max-w-sm relative">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-menta-light to-menta-dark flex items-center justify-center mx-auto mb-4">
            <span className="text-petroleo font-bold text-2xl">Z</span>
          </div>
          <h1 className="text-2xl font-semibold text-offwhite">Solicitar Acesso</h1>
          <p className="text-muted-foreground text-sm mt-1">CRM Jornada — Zion Church</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Nome completo</label>
            <input type="text" placeholder="Seu nome" className="zion-input" {...register('nome')} />
            {errors.nome && <p className="text-red-400 text-xs mt-1">{errors.nome.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
            <input type="email" placeholder="seu@email.com" className="zion-input" {...register('email')} />
            {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Grupo</label>
            <select className="zion-input" {...register('grupo')}>
              <option value="">Selecione um grupo</option>
              <option value="rise">RISE</option>
              <option value="flow">FLOW</option>
              <option value="vox">VOX</option>
              <option value="ek">EK</option>
              <option value="zion_geral">Zion Geral</option>
            </select>
            {errors.grupo && <p className="text-red-400 text-xs mt-1">{errors.grupo.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Nível solicitado</label>
            <select className="zion-input" {...register('nivel')}>
              <option value="">Selecione um nível</option>
              <option value="voluntario">Voluntário</option>
              <option value="linha_de_frente">Linha de Frente</option>
              <option value="coordenador">Coordenador</option>
              <option value="lider">Líder</option>
            </select>
            {errors.nivel && <p className="text-red-400 text-xs mt-1">{errors.nivel.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Senha</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                placeholder="••••••••"
                className="zion-input pr-10"
                {...register('password')}
              />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Confirmar senha</label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                placeholder="••••••••"
                className="zion-input pr-10"
                {...register('confirmPassword')}
              />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.confirmPassword && <p className="text-red-400 text-xs mt-1">{errors.confirmPassword.message}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="zion-btn-primary w-full flex items-center justify-center gap-2 mt-2"
          >
            {loading
              ? <div className="w-4 h-4 border-2 border-petroleo border-t-transparent rounded-full animate-spin" />
              : <UserPlus size={16} />}
            {loading ? 'Enviando...' : 'Solicitar acesso'}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground mt-8">
          Já tem acesso?{' '}
          <Link to="/login" className="text-menta-light hover:underline">Entrar</Link>
        </p>
      </div>
    </div>
  )
}
