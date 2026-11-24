import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { PhoneInputInternacional, validatePhone } from '@/components/ui/PhoneInputInternacional'

const MENSAGEM: Record<string, string> = {
  nao_encontrado:   'Não encontramos esse WhatsApp. Confira o número ou fale com o seu voluntário.',
  fora_das_aulas:   'Esse número não está nas aulas do Jornada agora. Fale com o seu voluntário.',
  nome_nao_confere: 'O nome não confere com o cadastro desse WhatsApp. Use o nome que você informou no cadastro.',
  dados_invalidos:  'Confira o nome e o WhatsApp.',
}

/** Página pública do QR Code de cada aula: o aluno registra a própria presença. */
export default function CheckinAula() {
  const aula = Number(useParams<{ aula: string }>().aula)
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [pais, setPais] = useState('BR')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [feito, setFeito] = useState<{ nome: string; jaTinha: boolean } | null>(null)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return setErro('Informe seu nome.')
    if (!validatePhone(telefone, pais)) return setErro('Número de WhatsApp inválido.')
    setEnviando(true); setErro('')
    const { data, error } = await supabase.rpc('registrar_checkin', { p_aula: aula, p_nome: nome, p_telefone: telefone })
    setEnviando(false)
    const r = data?.[0]
    if (error || !r) return setErro('Não foi possível registrar agora. Tente de novo em instantes.')
    if (r.resultado === 'ok' || r.resultado === 'ja_registrado')
      return setFeito({ nome: r.primeiro_nome, jaTinha: r.resultado === 'ja_registrado' })
    setErro(MENSAGEM[r.resultado] ?? MENSAGEM.dados_invalidos)
  }

  if (!(aula >= 1 && aula <= 4)) {
    return <Tela><p className="text-sm text-center" style={{ color: '#7A9FA8' }}>Link de check-in inválido.</p></Tela>
  }

  if (feito) {
    return (
      <Tela>
        <div className="flex flex-col items-center text-center gap-3">
          <CheckCircle size={40} style={{ color: '#00B0A8' }} />
          <h1 className="text-xl font-semibold text-white">Presença confirmada, {feito.nome}!</h1>
          <p className="text-sm" style={{ color: '#7A9FA8' }}>
            {feito.jaTinha ? `Sua presença na Aula ${aula} já estava registrada.` : `Aula ${aula} registrada. Boa aula!`}
          </p>
        </div>
      </Tela>
    )
  }

  return (
    <Tela>
      <form onSubmit={enviar} className="space-y-5">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-white">Check-in · Aula {aula}</h1>
          <p className="text-sm mt-1" style={{ color: '#5A7A82' }}>Use o mesmo nome e WhatsApp do seu cadastro.</p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="checkin-nome" className="block text-xs font-medium" style={{ color: '#5A7A82' }}>Nome completo</label>
          <input id="checkin-nome" type="text" autoComplete="name" value={nome} onChange={e => setNome(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
            style={{ background: '#071920', border: '1px solid #1A3540' }} />
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-medium" style={{ color: '#5A7A82' }}>WhatsApp</label>
          <PhoneInputInternacional value={telefone} onChange={setTelefone} onCountryChange={setPais} defaultCountry="BR"
            inputStyle={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #1A3540', background: '#071920', color: '#fff', fontSize: '14px', outline: 'none' }} />
        </div>
        {erro && <p className="text-xs text-center" style={{ color: '#f87171' }} role="alert">{erro}</p>}
        <button type="submit" disabled={enviando}
          className="w-full py-3 rounded-2xl text-sm font-semibold disabled:opacity-50"
          style={{ background: '#00B0A8', color: '#071C23' }}>
          {enviando ? 'Registrando…' : 'Confirmar presença'}
        </button>
      </form>
    </Tela>
  )
}

function Tela({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10" style={{ background: '#050F12' }}>
      <div className="w-full max-w-md rounded-3xl p-6" style={{ background: '#0C1D23', border: '1px solid #1A3540' }}>
        {children}
      </div>
      <p className="text-xs mt-6" style={{ color: '#2A4550' }}>Zion Church · Jornada CRM</p>
    </div>
  )
}
