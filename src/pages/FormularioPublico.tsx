import { useState } from 'react'
import { CheckCircle, ChevronLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { calcularGrupo } from '@/lib/calcularGrupo'
import { LOCAL_OPTIONS } from '@/lib/locaisCulto'
import { DEFAULT_CHURCH_ID } from '@/lib/constants/church'
import type { ContactTipo, SubtipoVisitante } from '@/types/database'

// ─── Tipos internos ─────────────────────────────────────────────────────────

type StepContent = 'voce' | 'momento' | 'perfil' | 'local'

const SUBTIPOS: { value: SubtipoVisitante; label: string; sub: string }[] = [
  { value: 'SEM_IGREJA', label: 'Não tenho igreja no momento', sub: 'Sem vínculo religioso atualmente' },
  { value: 'CONHECENDO', label: 'Nunca frequentei uma Igreja',  sub: 'Primeira vez ou ainda explorando' },
  { value: 'COM_IGREJA', label: 'Tenho uma igreja local',       sub: 'Venho de outra denominação' },
]

const STEP_SUBTITLE: Record<StepContent, string> = {
  voce:    'Conte um pouco sobre você',
  momento: 'Seu momento com Deus',
  perfil:  'Nos conte um pouco mais',
  local:   'Onde você estava?',
}

// ─── Máscara de telefone ────────────────────────────────────────────────────

function maskTel(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2)  return `(${d}`
  if (d.length <= 7)  return `(${d.slice(0,2)}) ${d.slice(2)}`
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
}

// ─── Estado inicial ─────────────────────────────────────────────────────────

interface FormData {
  nome: string
  telefone: string
  idade: string
  sexo: 'MASCULINO' | 'FEMININO' | ''
  tipo: ContactTipo | ''
  dataEntrada: string
  localCulto: string
  subtipoVisitante: SubtipoVisitante | ''
  igrejaLocalNome: string
}

function emptyForm(): FormData {
  return {
    nome: '',
    telefone: '',
    idade: '',
    sexo: '',
    tipo: '',
    dataEntrada: new Date().toISOString().split('T')[0],
    localCulto: '',
    subtipoVisitante: '',
    igrejaLocalNome: '',
  }
}

// ─── Componente ─────────────────────────────────────────────────────────────

export default function FormularioPublico() {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormData>(emptyForm())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const isVisitante = form.tipo === 'visitante'
  const totalSteps  = isVisitante ? 4 : 3

  function getStepContent(s: number): StepContent {
    if (!isVisitante) {
      if (s === 3) return 'local'
      if (s === 2) return 'momento'
      return 'voce'
    }
    if (s === 4) return 'local'
    if (s === 3) return 'perfil'
    if (s === 2) return 'momento'
    return 'voce'
  }

  const content = getStepContent(step)

  function set<K extends keyof FormData>(field: K, value: FormData[K]) {
    setForm(f => ({ ...f, [field]: value }))
    setErrors(e => ({ ...e, [field]: '' }))
  }

  function setTipo(value: ContactTipo) {
    setForm(f => ({ ...f, tipo: value, subtipoVisitante: '', igrejaLocalNome: '' }))
    setErrors(e => ({ ...e, tipo: '' }))
  }

  function validateStep(s: number): boolean {
    const errs: Record<string, string> = {}
    const c = getStepContent(s)

    if (c === 'voce') {
      if (!form.nome.trim()) errs.nome = 'Informe seu nome'
      if (form.telefone.replace(/\D/g, '').length < 10) errs.telefone = 'Telefone inválido'
      if (!form.idade || isNaN(Number(form.idade)) || Number(form.idade) < 0) errs.idade = 'Informe sua idade'
    }

    if (c === 'momento') {
      if (!form.tipo)        errs.tipo = 'Selecione uma opção'
      if (!form.dataEntrada) errs.dataEntrada = 'Informe a data'
    }

    if (c === 'perfil') {
      if (!form.subtipoVisitante)
        errs.subtipoVisitante = 'Selecione uma opção'
      if (form.subtipoVisitante === 'COM_IGREJA' && !form.igrejaLocalNome.trim())
        errs.igrejaLocalNome = 'Informe o nome da sua igreja'
    }

    if (c === 'local') {
      if (!form.localCulto) errs.localCulto = 'Selecione onde você estava'
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function next() {
    if (validateStep(step)) setStep(s => s + 1)
  }

  function back() {
    setErrors({})
    setStep(s => s - 1)
  }

  async function handleSubmit() {
    if (!validateStep(step)) return
    setLoading(true)
    try {
      const idade  = Number(form.idade)
      const grupo  = calcularGrupo(idade)
      const subtipo = isVisitante ? (form.subtipoVisitante || null) : null

      const { error } = await supabase.from('contacts').insert({
        nome:               form.nome.trim(),
        telefone:           form.telefone.replace(/\D/g, ''),
        email:              null,
        whatsapp_valido:    true,
        tipo:               form.tipo as ContactTipo,
        grupo,
        idade,
        local_culto:        form.localCulto,
        culto_captacao:     form.dataEntrada,
        church_id:          DEFAULT_CHURCH_ID,
        sexo:               form.sexo || null,
        subtipo_visitante:  subtipo,
        possui_igreja_local: subtipo === 'COM_IGREJA' ? true : subtipo === 'SEM_IGREJA' ? false : null,
        igreja_local_nome:  subtipo === 'COM_IGREJA' && form.igrejaLocalNome.trim()
                              ? form.igrejaLocalNome.trim()
                              : null,
        captador_id:        null,
        status:             'pendente_aprovacao',
        fase_pipeline:      'CONTATO_INICIAL',
        subetapa_contato:   'TENTATIVA_1',
        sla_status:         'ok',
        tentativas_contato: 0,
        autorizacao_contato: true,
      })
      if (error) throw error
      setSuccess(true)
    } catch (err: unknown) {
      const msg = err instanceof Error
        ? err.message
        : (err as { message?: string })?.message ?? JSON.stringify(err)
      setErrors({ geral: `Erro: ${msg}` })
    } finally {
      setLoading(false)
    }
  }

  function reiniciar() {
    setForm(emptyForm())
    setErrors({})
    setStep(1)
    setSuccess(false)
  }

  // ─── Tela de sucesso ───────────────────────────────────────────────────────

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 text-center"
        style={{ background: '#050F12' }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
          style={{ background: 'rgba(0,176,168,0.1)', border: '1px solid rgba(0,176,168,0.3)' }}>
          <CheckCircle size={28} style={{ color: '#00B0A8' }} />
        </div>
        <h1 className="text-2xl font-semibold text-white tracking-tight">Cadastro recebido!</h1>
        <p className="text-sm mt-3 max-w-xs leading-relaxed" style={{ color: '#5A7A82' }}>
          Suas informações foram enviadas com sucesso. Em breve alguém da nossa equipe entrará em contato com você.
        </p>
        <div className="mt-8 px-5 py-4 rounded-2xl max-w-xs w-full"
          style={{ background: '#0C1D23', border: '1px solid #1A3540' }}>
          <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: '#3A5560' }}>Próximo passo</p>
          <p className="text-sm leading-relaxed" style={{ color: '#7A9FA8' }}>
            Fique atento ao seu WhatsApp. Nosso time vai entrar em contato nas próximas 48 horas.
          </p>
        </div>
        <button onClick={reiniciar}
          className="mt-8 flex items-center gap-2 text-sm px-5 py-2.5 rounded-2xl transition-colors"
          style={{ color: '#5A7A82', border: '1px solid #1A3540' }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#00B0A8'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0,176,168,0.4)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#5A7A82'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#1A3540' }}
        >
          + Novo cadastro
        </button>
        <p className="text-xs mt-10" style={{ color: '#2A4550' }}>Zion Church · Jornada CRM</p>
      </div>
    )
  }

  // ─── Render principal ──────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#050F12' }}>
      {/* Header */}
      <div className="flex flex-col items-center pt-10 pb-6 px-4">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: '#071C23', border: '1px solid #1A3540' }}>
          <span className="font-bold text-xl" style={{ color: '#00B0A8' }}>Z</span>
        </div>
        <h1 className="text-xl font-semibold text-white">Bem-vindo à Jornada</h1>
        <p className="text-sm mt-1" style={{ color: '#5A7A82' }}>
          {STEP_SUBTITLE[content]}
        </p>
      </div>

      {/* Progress — adapta ao totalSteps */}
      <div className="flex items-center gap-2 px-8 mb-6">
        {Array.from({ length: totalSteps }, (_, i) => i + 1).map(n => (
          <div key={n} className="flex-1 h-1 rounded-full transition-all"
            style={{ background: n <= step ? '#00B0A8' : '#1A3540' }} />
        ))}
      </div>

      {/* Card */}
      <div className="flex-1 px-4 pb-10">
        <div className="max-w-md mx-auto rounded-3xl p-6 space-y-5"
          style={{ background: '#0C1D23', border: '1px solid #1A3540' }}>

          {/* ── STEP: Você ── */}
          {content === 'voce' && (
            <>
              <Field label="Nome completo" error={errors.nome}>
                <input
                  type="text" placeholder="Seu nome completo" autoComplete="name"
                  value={form.nome} onChange={e => set('nome', e.target.value)}
                  style={inputStyle(!!errors.nome)}
                />
              </Field>

              <Field label="WhatsApp" error={errors.telefone}>
                <input
                  type="tel" placeholder="(11) 99999-9999" inputMode="tel"
                  value={form.telefone}
                  onChange={e => set('telefone', maskTel(e.target.value))}
                  style={inputStyle(!!errors.telefone)}
                />
              </Field>

              <Field label="Idade" error={errors.idade}>
                <input
                  type="number" placeholder="Ex: 25" inputMode="numeric" min={0} max={120}
                  value={form.idade} onChange={e => set('idade', e.target.value)}
                  style={inputStyle(!!errors.idade)}
                />
              </Field>

              <Field label="Sexo (opcional)">
                <div className="flex gap-2">
                  {([{ value: 'MASCULINO', label: 'Masculino' }, { value: 'FEMININO', label: 'Feminino' }] as const).map(opt => {
                    const active = form.sexo === opt.value
                    return (
                      <button key={opt.value} onClick={() => set('sexo', active ? '' : opt.value)}
                        className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
                        style={{
                          border:     active ? '1px solid #00B0A8' : '1px solid #1A3540',
                          background: active ? 'rgba(0,176,168,0.1)' : '#071920',
                          color:      active ? '#00B0A8' : '#7A9FA8',
                        }}>
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </Field>
            </>
          )}

          {/* ── STEP: Momento ── */}
          {content === 'momento' && (
            <>
              <Field label="O que melhor descreve você?" error={errors.tipo}>
                <div className="flex flex-col gap-2">
                  {([
                    { value: 'novo_nascimento', label: 'Novo Nascimento', desc: 'Aceitei Jesus recentemente' },
                    { value: 'reconciliacao',   label: 'Reconciliação',   desc: 'Quero voltar para Deus' },
                    { value: 'visitante',       label: 'Visitante',       desc: 'Estou conhecendo a Zion' },
                  ] as const).map(opt => {
                    const active = form.tipo === opt.value
                    return (
                      <button key={opt.value} onClick={() => setTipo(opt.value)}
                        className="text-left px-4 py-3 rounded-xl transition-all"
                        style={{
                          border:     active ? '1px solid #00B0A8' : '1px solid #1A3540',
                          background: active ? 'rgba(0,176,168,0.08)' : 'transparent',
                        }}>
                        <p className="text-sm font-medium" style={{ color: active ? '#00B0A8' : '#fff' }}>{opt.label}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#5A7A82' }}>{opt.desc}</p>
                      </button>
                    )
                  })}
                </div>
              </Field>

              <Field label="Data do culto que você veio" error={errors.dataEntrada}>
                <input
                  type="date" value={form.dataEntrada}
                  onChange={e => set('dataEntrada', e.target.value)}
                  style={inputStyle(!!errors.dataEntrada)}
                />
              </Field>
            </>
          )}

          {/* ── STEP: Perfil (visitante only) ── */}
          {content === 'perfil' && (
            <>
              <Field label="Como você se descreve?" error={errors.subtipoVisitante}>
                <div className="flex flex-col gap-2">
                  {SUBTIPOS.map(s => {
                    const active = form.subtipoVisitante === s.value
                    return (
                      <button key={s.value}
                        onClick={() => {
                          set('subtipoVisitante', s.value)
                          if (s.value !== 'COM_IGREJA') set('igrejaLocalNome', '')
                        }}
                        className="text-left px-4 py-3.5 rounded-xl transition-all"
                        style={{
                          border:     active ? '1px solid #00B0A8' : '1px solid #1A3540',
                          background: active ? 'rgba(0,176,168,0.08)' : 'transparent',
                        }}>
                        <p className="text-sm font-medium" style={{ color: active ? '#00B0A8' : '#fff' }}>{s.label}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#5A7A82' }}>{s.sub}</p>
                      </button>
                    )
                  })}
                </div>
              </Field>

              {form.subtipoVisitante === 'COM_IGREJA' && (
                <Field label="Qual é a sua igreja?" error={errors.igrejaLocalNome}>
                  <input
                    type="text" placeholder="Ex: Lagoinha, Batista, Católica..."
                    autoFocus
                    value={form.igrejaLocalNome}
                    onChange={e => set('igrejaLocalNome', e.target.value)}
                    style={inputStyle(!!errors.igrejaLocalNome)}
                  />
                </Field>
              )}
            </>
          )}

          {/* ── STEP: Local ── */}
          {content === 'local' && (
            <Field label="Aonde você estava?" error={errors.localCulto}>
              <div className="max-h-72 overflow-y-auto space-y-4 pr-1">
                {LOCAL_OPTIONS.map(group => (
                  <div key={group.group}>
                    <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: '#3A5560' }}>
                      {group.group}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {group.items.map(item => {
                        const active = form.localCulto === item
                        return (
                          <button key={item} onClick={() => set('localCulto', item)}
                            className="text-sm px-3 py-1.5 rounded-full transition-all"
                            style={{
                              border:      active ? '1px solid #00B0A8' : '1px solid #1A3540',
                              background:  active ? '#00B0A8' : 'transparent',
                              color:       active ? '#071C23' : '#7A9FA8',
                              fontWeight:  active ? 600 : 400,
                            }}>
                            {item}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
              {form.localCulto && (
                <p className="text-xs mt-3 flex items-center gap-1.5" style={{ color: '#00B0A8' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  Selecionado: {form.localCulto}
                </p>
              )}
            </Field>
          )}

          {/* Erro geral */}
          {errors.geral && (
            <p className="text-xs text-center" style={{ color: '#f87171' }}>{errors.geral}</p>
          )}

          {/* Botões */}
          <div className="flex gap-2 pt-1">
            {step > 1 && (
              <button onClick={back}
                className="flex items-center gap-1 px-4 py-3 rounded-2xl text-sm transition-all"
                style={{ border: '1px solid #1A3540', color: '#5A7A82', background: 'transparent' }}>
                <ChevronLeft size={16} /> Voltar
              </button>
            )}
            <button
              onClick={step < totalSteps ? next : handleSubmit}
              disabled={loading}
              className="flex-1 py-3 rounded-2xl text-sm font-semibold transition-all disabled:opacity-50"
              style={{ background: '#00B0A8', color: '#071C23' }}>
              {loading ? 'Enviando...' : step < totalSteps ? 'Continuar' : 'Enviar cadastro'}
            </button>
          </div>
        </div>
      </div>

      <p className="text-center text-xs pb-6" style={{ color: '#2A4550' }}>Zion Church · Jornada CRM</p>
    </div>
  )
}

// ─── Helpers de estilo ───────────────────────────────────────────────────────

function inputStyle(hasError: boolean): React.CSSProperties {
  return {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '12px',
    border: `1px solid ${hasError ? '#ef4444' : '#1A3540'}`,
    background: '#071920',
    color: '#fff',
    fontSize: '14px',
    outline: 'none',
  }
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium" style={{ color: '#5A7A82' }}>{label}</label>
      {children}
      {error && <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>}
    </div>
  )
}
