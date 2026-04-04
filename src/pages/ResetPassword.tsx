import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, KeyRound, CheckCircle, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Estado = 'aguardando' | 'pronto' | 'sucesso' | 'erro_token'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [estado, setEstado] = useState<Estado>('aguardando')
  const [senha, setSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [showSenha, setShowSenha] = useState(false)
  const [showConfirmar, setShowConfirmar] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  // Supabase dispara PASSWORD_RECOVERY quando o usuário chega via link de reset
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setEstado('pronto')
      }
    })

    // Se já há uma sessão ativa (usuário voltou ao tab), verifica o hash
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && estado === 'aguardando') {
        // Sessão existe — pode ter vindo do link. Marca como pronto.
        setEstado('pronto')
      }
    })

    // Timeout: se em 5s não chegou o evento, o token é inválido ou expirado
    const timer = setTimeout(() => {
      setEstado(s => s === 'aguardando' ? 'erro_token' : s)
    }, 5000)

    return () => { subscription.unsubscribe(); clearTimeout(timer) }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')

    if (senha.length < 6) { setErro('A senha deve ter pelo menos 6 caracteres'); return }
    if (senha !== confirmar) { setErro('As senhas não coincidem'); return }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    setLoading(false)

    if (error) {
      setErro('Erro ao redefinir a senha. O link pode ter expirado.')
    } else {
      await supabase.auth.signOut()
      setEstado('sucesso')
    }
  }

  // ── Aguardando confirmação do token ──
  if (estado === 'aguardando') {
    return (
      <Wrapper>
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-menta-light border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Verificando link...</p>
        </div>
      </Wrapper>
    )
  }

  // ── Token inválido ou expirado ──
  if (estado === 'erro_token') {
    return (
      <Wrapper>
        <div className="text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
            <AlertCircle size={24} className="text-red-400" />
          </div>
          <div>
            <p className="text-offwhite font-medium">Link inválido ou expirado</p>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              Este link de redefinição expirou ou já foi utilizado. Solicite um novo.
            </p>
          </div>
          <button
            onClick={() => navigate('/esqueci-senha')}
            className="zion-btn-primary w-full mt-2">
            Solicitar novo link
          </button>
        </div>
      </Wrapper>
    )
  }

  // ── Sucesso ──
  if (estado === 'sucesso') {
    return (
      <Wrapper>
        <div className="text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-menta-dark/20 border border-menta-dark/40 flex items-center justify-center mx-auto">
            <CheckCircle size={24} className="text-menta-light" />
          </div>
          <div>
            <p className="text-offwhite font-medium">Senha redefinida!</p>
            <p className="text-sm text-muted-foreground mt-1">
              Sua senha foi atualizada com sucesso. Faça login com a nova senha.
            </p>
          </div>
          <button
            onClick={() => navigate('/login')}
            className="zion-btn-primary w-full mt-2">
            Ir para o login
          </button>
        </div>
      </Wrapper>
    )
  }

  // ── Formulário de nova senha ──
  return (
    <Wrapper>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-offwhite">Nova senha</h2>
        <p className="text-sm text-muted-foreground mt-1">Escolha uma senha segura para sua conta.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Nova senha</label>
          <div className="relative">
            <input
              type={showSenha ? 'text' : 'password'}
              placeholder="Mínimo 6 caracteres"
              value={senha}
              onChange={e => { setSenha(e.target.value); setErro('') }}
              className="zion-input pr-10"
              autoFocus
            />
            <button type="button" onClick={() => setShowSenha(!showSenha)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showSenha ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">Confirmar nova senha</label>
          <div className="relative">
            <input
              type={showConfirmar ? 'text' : 'password'}
              placeholder="Repita a senha"
              value={confirmar}
              onChange={e => { setConfirmar(e.target.value); setErro('') }}
              className="zion-input pr-10"
            />
            <button type="button" onClick={() => setShowConfirmar(!showConfirmar)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showConfirmar ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {erro && <p className="text-red-400 text-xs">{erro}</p>}

        <button type="submit" disabled={loading}
          className="zion-btn-primary w-full flex items-center justify-center gap-2 mt-2">
          {loading
            ? <div className="w-4 h-4 border-2 border-petroleo border-t-transparent rounded-full animate-spin" />
            : <KeyRound size={16} />}
          {loading ? 'Salvando...' : 'Redefinir senha'}
        </button>
      </form>
    </Wrapper>
  )
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-petroleo flex items-center justify-center px-4">
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-menta-dark/10 blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      <div className="w-full max-w-sm relative">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-menta-light to-menta-dark flex items-center justify-center mx-auto mb-4">
            <span className="text-petroleo font-bold text-2xl">Z</span>
          </div>
          <h1 className="text-2xl font-semibold text-offwhite">CRM Jornada</h1>
          <p className="text-muted-foreground text-sm mt-1">Zion Church — Redefinição de senha</p>
        </div>
        {children}
      </div>
    </div>
  )
}
