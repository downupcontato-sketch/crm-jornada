import { useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'

const schema = z.object({ email: z.string().email(), password: z.string().min(6) })
type F = z.infer<typeof schema>

function getRedirectPath(nivel: string | null, status: string | undefined): string {
  if (status === 'pendente') return '/aguardando-aprovacao'
  if (nivel === 'admin' || nivel === 'lider') return '/dashboard'
  if (nivel === 'coordenador') return '/pipeline'
  if (nivel === 'voluntario') return '/meus-contatos'
  if (nivel === 'linha_de_frente') return '/culto'
  return '/dashboard'
}

export default function Login() {
  const { user, signIn, nivel, profile } = useAuth()
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm<F>({ resolver: zodResolver(schema) })

  if (user) return <Navigate to={getRedirectPath(nivel, profile?.status)} replace />

  async function onSubmit(d: F) {
    setLoading(true)
    const { error } = await signIn(d.email, d.password)
    setLoading(false)
    if (error) toast.error('Email ou senha incorretos')
  }

  return (
    <div className="min-h-screen bg-petroleo flex items-center justify-center px-4">
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-menta-dark/10 blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      <div className="w-full max-w-sm relative">
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-menta-light to-menta-dark flex items-center justify-center mx-auto mb-4">
            <span className="text-petroleo font-bold text-2xl">Z</span>
          </div>
          <h1 className="text-2xl font-semibold text-offwhite">CRM Jornada</h1>
          <p className="text-muted-foreground text-sm mt-1">Zion Church — Área Restrita</p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
            <input type="email" autoComplete="email" placeholder="seu@email.com" className="zion-input" {...register('email')} />
            {errors.email && <p className="text-red-400 text-xs mt-1">Email inválido</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Senha</label>
            <div className="relative">
              <input type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="••••••••" className="zion-input pr-10" {...register('password')} />
              <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading} className="zion-btn-primary w-full flex items-center justify-center gap-2 mt-2">
            {loading ? <div className="w-4 h-4 border-2 border-petroleo border-t-transparent rounded-full animate-spin" /> : <LogIn size={16} />}
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
        <p className="text-center text-xs text-muted-foreground mt-8">
          Sem acesso?{' '}
          <Link to="/solicitar-acesso" className="text-menta-light hover:underline">Solicitar acesso</Link>
        </p>
      </div>
    </div>
  )
}
