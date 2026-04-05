import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function EsqueciSenha() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [erro, setErro] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) { setErro('Informe o email'); return }
    setLoading(true)
    setErro('')
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: 'https://crm.jornadazionchurch.com/reset-password',
    })
    setLoading(false)
    if (error) {
      setErro('Não foi possível enviar o link. Verifique o email e tente novamente.')
    } else {
      setEnviado(true)
    }
  }

  return (
    <div className="min-h-screen bg-petroleo flex items-center justify-center px-4">
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-menta-dark/10 blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      <div className="w-full max-w-sm relative">

        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-menta-light to-menta-dark flex items-center justify-center mx-auto mb-4">
            <span className="text-petroleo font-bold text-2xl">Z</span>
          </div>
          <h1 className="text-2xl font-semibold text-offwhite">Recuperar senha</h1>
          <p className="text-muted-foreground text-sm mt-1">CRM Jornada — Zion Church</p>
        </div>

        {enviado ? (
          <div className="text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-menta-dark/20 border border-menta-dark/40 flex items-center justify-center mx-auto">
              <CheckCircle size={24} className="text-menta-light" />
            </div>
            <div>
              <p className="text-offwhite font-medium">Link enviado!</p>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Se esse email estiver cadastrado, você receberá um link para redefinir sua senha. Verifique também a caixa de spam.
              </p>
            </div>
            <Link to="/login"
              className="inline-flex items-center gap-2 text-sm text-menta-light hover:underline mt-4">
              <ArrowLeft size={14} /> Voltar para o login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Informe o email da sua conta e enviaremos um link para você criar uma nova senha.
            </p>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setErro('') }}
                  className="zion-input pl-9"
                  autoComplete="email"
                  autoFocus
                />
              </div>
              {erro && <p className="text-red-400 text-xs mt-1">{erro}</p>}
            </div>

            <button type="submit" disabled={loading}
              className="zion-btn-primary w-full flex items-center justify-center gap-2">
              {loading
                ? <div className="w-4 h-4 border-2 border-petroleo border-t-transparent rounded-full animate-spin" />
                : <Mail size={16} />}
              {loading ? 'Enviando...' : 'Enviar link de recuperação'}
            </button>

            <p className="text-center text-xs text-muted-foreground mt-2">
              <Link to="/login" className="text-menta-light hover:underline inline-flex items-center gap-1">
                <ArrowLeft size={12} /> Voltar para o login
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
