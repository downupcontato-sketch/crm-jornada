import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export default function AguardandoAprovacao() {
  const navigate = useNavigate()

  async function handleBack() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-petroleo flex items-center justify-center px-4">
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-menta-dark/10 blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      <div className="w-full max-w-sm relative text-center">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-menta-light to-menta-dark flex items-center justify-center mx-auto mb-6">
          <span className="text-petroleo font-bold text-2xl">Z</span>
        </div>
        <h1 className="text-2xl font-semibold text-offwhite mb-3">Solicitação enviada</h1>
        <p className="text-muted-foreground text-sm leading-relaxed mb-8">
          Sua solicitação foi enviada. Aguarde a aprovação do coordenador ou administrador.
        </p>
        <button onClick={handleBack} className="zion-btn-secondary w-full">
          Voltar para o login
        </button>
      </div>
    </div>
  )
}
