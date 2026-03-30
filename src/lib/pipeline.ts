import { supabase } from './supabase'
import type { Contact, FasePipeline, MotivoPerdaLead } from '@/types/database'

// ─── Frequência nas aulas ────────────────────────────────────────────────────

export function calcularFrequencia(c: Pick<Contact, 'presenca_aula1'|'presenca_aula2'|'presenca_aula3'|'presenca_aula4'>) {
  const aulas = [c.presenca_aula1, c.presenca_aula2, c.presenca_aula3, c.presenca_aula4]
  const realizadas = aulas.filter(a => a !== null).length
  const presentes = aulas.filter(a => a === true).length
  return { presentes, total: realizadas, atingiuMinimo: presentes >= 3 }
}

// ─── SLA por fase ────────────────────────────────────────────────────────────

export function calcularSLAFase(c: Pick<Contact, 'updated_at' | 'fase_pipeline'>): 'ok' | 'warn' | 'over' {
  const horas = (Date.now() - new Date(c.updated_at).getTime()) / 3_600_000
  if (c.fase_pipeline === 'CONTATO_INICIAL') {
    if (horas < 24) return 'ok'
    if (horas < 48) return 'warn'
    return 'over'
  }
  if (horas < 72) return 'ok'
  if (horas < 120) return 'warn'
  return 'over'
}

export function slaBordaCor(sla: 'ok' | 'warn' | 'over'): string {
  return { ok: 'border-l-emerald-500', warn: 'border-l-yellow-400', over: 'border-l-red-500' }[sla]
}

export function slaTextoCor(sla: 'ok' | 'warn' | 'over'): string {
  return { ok: 'text-emerald-400', warn: 'text-yellow-400', over: 'text-red-400' }[sla]
}

// ─── Labels ──────────────────────────────────────────────────────────────────

export const FASE_LABELS: Record<FasePipeline, string> = {
  CONTATO_INICIAL: 'Contato Inicial',
  QUALIFICACAO:    'Qualificação',
  AULAS:           'Aulas',
  POS_AULA:        'Pós-Aula',
  BATIZADO:        'Batizados',
  PERDIDO:         'Perdidos',
  REENCAMINHADO:   'Reencaminhados',
}

export const SUBETAPA_LABELS: Record<string, string> = {
  // Contato
  TENTATIVA_1:          '1ª Tentativa',
  TENTATIVA_2:          '2ª Tentativa',
  TENTATIVA_3:          '3ª Tentativa',
  // Qualificação
  CONVERSA:             'Conversa',
  PERFIL_CONFIRMADO:    'Perfil Confirmado',
  CONVITE_ENVIADO:      'Convite Enviado',
  AGUARDANDO_PROVER:    'Aguardando PROVER',
  PROVER_CONFIRMADO:    'PROVER Confirmado',
  // Encaminhamento
  ENCAMINHADO:          'Encaminhado',
  HANDS_OFF_CONFIRMADO: 'Hands-off Confirmado',
  // Batismo
  DECIDIU_BATIZAR:      'Decidiu Batizar',
  LISTA_ESPERA:         'Lista de Espera',
  INSCRICAO_CONFIRMADA: 'Inscrição Confirmada',
  AULA_BATISMO:         'Aula de Batismo',
  CUMPRE_REQUISITOS:    'Cumpre Requisitos',
  BATISMO_AGENDADO:     'Batismo Agendado',
}

// Label do próximo passo para o botão "Avançar"
export function proximaSubetapaLabel(c: Pick<Contact, 'fase_pipeline'|'subetapa_contato'|'subetapa_qualificacao'|'subetapa_encaminhamento'|'subetapa_batismo'>): string {
  const map: Record<string, string> = {
    'CONTATO_INICIAL:TENTATIVA_1': '2ª tentativa de contato',
    'CONTATO_INICIAL:TENTATIVA_2': '3ª tentativa de contato',
    'CONTATO_INICIAL:TENTATIVA_3': 'Respondeu → Qualificação',
    'QUALIFICACAO:CONVERSA':          'Perfil confirmado',
    'QUALIFICACAO:PERFIL_CONFIRMADO': 'Convite enviado',
    'QUALIFICACAO:CONVITE_ENVIADO':   'Aguardando PROVER',
    'QUALIFICACAO:AGUARDANDO_PROVER': 'PROVER confirmado',
    'QUALIFICACAO:PROVER_CONFIRMADO': 'Iniciar Aulas',
    'POS_AULA:ENCAMINHADO':           'Hands-off confirmado',
    'POS_AULA:DECIDIU_BATIZAR':       'Lista de espera',
    'POS_AULA:LISTA_ESPERA':          'Inscrição confirmada',
    'POS_AULA:INSCRICAO_CONFIRMADA':  'Aula de batismo',
    'POS_AULA:AULA_BATISMO':          'Cumpre requisitos',
    'POS_AULA:CUMPRE_REQUISITOS':     'Agendar batismo',
    'POS_AULA:BATISMO_AGENDADO':      'Confirmar batismo ✓',
  }
  const sub = c.subetapa_contato ?? c.subetapa_qualificacao ?? c.subetapa_encaminhamento ?? c.subetapa_batismo ?? ''
  return map[`${c.fase_pipeline}:${sub}`] ?? 'Avançar etapa'
}

// ─── Trilha de progresso ─────────────────────────────────────────────────────

export type NoProgresso = { label: string; status: 'done' | 'current' | 'pending' }

export function trilhaProgresso(c: Contact): NoProgresso[] {
  const nos: NoProgresso[] = []

  // Contato Inicial
  const subContatos = ['TENTATIVA_1','TENTATIVA_2','TENTATIVA_3'] as const
  const fasesAposContato: FasePipeline[] = ['QUALIFICACAO','AULAS','POS_AULA','BATIZADO']
  for (const sub of subContatos) {
    const isDone = fasesAposContato.includes(c.fase_pipeline) ||
      (c.fase_pipeline === 'CONTATO_INICIAL' && subContatos.indexOf(sub) < subContatos.indexOf(c.subetapa_contato as typeof subContatos[number]))
    const isCurrent = c.fase_pipeline === 'CONTATO_INICIAL' && c.subetapa_contato === sub
    nos.push({ label: SUBETAPA_LABELS[sub], status: isDone ? 'done' : isCurrent ? 'current' : 'pending' })
  }

  // Qualificação
  const subQual = ['CONVERSA','PERFIL_CONFIRMADO','CONVITE_ENVIADO','AGUARDANDO_PROVER','PROVER_CONFIRMADO'] as const
  const fasesAposQual: FasePipeline[] = ['AULAS','POS_AULA','BATIZADO']
  for (const sub of subQual) {
    const isDone = fasesAposQual.includes(c.fase_pipeline) ||
      (c.fase_pipeline === 'QUALIFICACAO' && subQual.indexOf(sub) < subQual.indexOf(c.subetapa_qualificacao as typeof subQual[number]))
    const isCurrent = c.fase_pipeline === 'QUALIFICACAO' && c.subetapa_qualificacao === sub
    nos.push({ label: SUBETAPA_LABELS[sub], status: isDone ? 'done' : isCurrent ? 'current' : 'pending' })
  }

  // Aulas
  for (let i = 1; i <= 4; i++) {
    const presenca = c[`presenca_aula${i}` as keyof Contact] as boolean | null
    const isDone = presenca !== null || ['POS_AULA','BATIZADO'].includes(c.fase_pipeline)
    const isCurrent = c.fase_pipeline === 'AULAS' && presenca === null
    nos.push({
      label: `Aula ${i}${i === 1 ? ' (P)' : ' (Z)'}`,
      status: isDone ? 'done' : isCurrent ? 'current' : 'pending'
    })
  }

  // Encaminhamento
  const subEnc = ['ENCAMINHADO','HANDS_OFF_CONFIRMADO'] as const
  for (const sub of subEnc) {
    const isDone = c.fase_pipeline === 'BATIZADO' ||
      (c.fase_pipeline === 'POS_AULA' && c.subetapa_encaminhamento === 'HANDS_OFF_CONFIRMADO' && sub === 'ENCAMINHADO')
    const isCurrent = c.fase_pipeline === 'POS_AULA' && c.subetapa_encaminhamento === sub
    nos.push({ label: SUBETAPA_LABELS[sub], status: isDone ? 'done' : isCurrent ? 'current' : 'pending' })
  }

  // Batismo (só se iniciou)
  if (c.subetapa_batismo || c.fase_pipeline === 'BATIZADO') {
    const subBat = ['DECIDIU_BATIZAR','LISTA_ESPERA','INSCRICAO_CONFIRMADA','AULA_BATISMO','CUMPRE_REQUISITOS','BATISMO_AGENDADO'] as const
    for (const sub of subBat) {
      const isDone = c.fase_pipeline === 'BATIZADO' ||
        (c.fase_pipeline === 'POS_AULA' && c.subetapa_batismo && subBat.indexOf(sub) < subBat.indexOf(c.subetapa_batismo as typeof subBat[number]))
      const isCurrent = c.fase_pipeline === 'POS_AULA' && c.subetapa_batismo === sub
      nos.push({ label: SUBETAPA_LABELS[sub], status: isDone ? 'done' : isCurrent ? 'current' : 'pending' })
    }
  }

  return nos
}

// ─── Avançar subetapa (client-side) ─────────────────────────────────────────

export async function avancarSubetapa(c: Contact, userId: string): Promise<Partial<Contact> | null> {
  let upd: Partial<Contact> = {}

  if (c.fase_pipeline === 'CONTATO_INICIAL') {
    if (c.subetapa_contato === 'TENTATIVA_1') upd = { subetapa_contato: 'TENTATIVA_2' }
    else if (c.subetapa_contato === 'TENTATIVA_2') upd = { subetapa_contato: 'TENTATIVA_3' }
    else if (c.subetapa_contato === 'TENTATIVA_3') upd = {
      fase_pipeline: 'QUALIFICACAO', subetapa_contato: null, subetapa_qualificacao: 'CONVERSA',
    }
  } else if (c.fase_pipeline === 'QUALIFICACAO') {
    const next: Record<string, Partial<Contact>> = {
      CONVERSA:          { subetapa_qualificacao: 'PERFIL_CONFIRMADO' },
      PERFIL_CONFIRMADO: { subetapa_qualificacao: 'CONVITE_ENVIADO' },
      CONVITE_ENVIADO:   { subetapa_qualificacao: 'AGUARDANDO_PROVER' },
      AGUARDANDO_PROVER: { subetapa_qualificacao: 'PROVER_CONFIRMADO', pro_ver_inscrito: true },
      PROVER_CONFIRMADO: { fase_pipeline: 'AULAS', subetapa_qualificacao: null },
    }
    upd = next[c.subetapa_qualificacao ?? ''] ?? {}
  } else if (c.fase_pipeline === 'POS_AULA') {
    if (c.subetapa_encaminhamento === 'ENCAMINHADO') {
      upd = { subetapa_encaminhamento: 'HANDS_OFF_CONFIRMADO', link_confirmado_em: new Date().toISOString() }
    } else if (c.subetapa_batismo) {
      const next: Record<string, Partial<Contact>> = {
        DECIDIU_BATIZAR:      { subetapa_batismo: 'LISTA_ESPERA' },
        LISTA_ESPERA:         { subetapa_batismo: 'INSCRICAO_CONFIRMADA' },
        INSCRICAO_CONFIRMADA: { subetapa_batismo: 'AULA_BATISMO' },
        AULA_BATISMO:         { subetapa_batismo: 'CUMPRE_REQUISITOS' },
        CUMPRE_REQUISITOS:    { subetapa_batismo: 'BATISMO_AGENDADO' },
        BATISMO_AGENDADO:     {
          fase_pipeline: 'BATIZADO', status: 'batizado',
          data_batismo_realizado: new Date().toISOString(),
        },
      }
      upd = next[c.subetapa_batismo] ?? {}
    }
  }

  if (!Object.keys(upd).length) return null

  const { error } = await supabase.from('contacts').update(upd).eq('id', c.id)
  if (error) throw error

  await supabase.from('lead_historico').insert({
    contact_id: c.id, user_id: userId, tipo: 'AVANCO_ETAPA',
    descricao: `Avançou: ${Object.entries(upd).map(([k, v]) => `${k}→${v}`).join(', ')}`,
    dados_antes: { fase: c.fase_pipeline, subetapa: c.subetapa_contato ?? c.subetapa_qualificacao ?? c.subetapa_encaminhamento ?? c.subetapa_batismo },
    dados_depois: upd,
  })

  return upd
}

// ─── Registrar presença em aula ──────────────────────────────────────────────

export async function registrarPresenca(c: Contact, aula: 1|2|3|4, presente: boolean, userId: string): Promise<void> {
  const campo = `presenca_aula${aula}` as 'presenca_aula1'|'presenca_aula2'|'presenca_aula3'|'presenca_aula4'
  const upd: Partial<Contact> = { [campo]: presente }

  // Verificar se todas aulas estarão registradas após esta
  const aulasFinal = {
    presenca_aula1: aula === 1 ? presente : c.presenca_aula1,
    presenca_aula2: aula === 2 ? presente : c.presenca_aula2,
    presenca_aula3: aula === 3 ? presente : c.presenca_aula3,
    presenca_aula4: aula === 4 ? presente : c.presenca_aula4,
  }
  const todasRegistradas = Object.values(aulasFinal).every(v => v !== null)
  const { presentes } = calcularFrequencia({ ...c, ...aulasFinal })

  if (todasRegistradas) {
    if (presentes >= 3) {
      // Avança para Pós-Aula — Encaminhamento
      Object.assign(upd, {
        fase_pipeline: 'POS_AULA',
        subetapa_encaminhamento: 'ENCAMINHADO',
      })
    } else {
      // Perda 10 automática
      Object.assign(upd, {
        fase_pipeline: 'PERDIDO',
        motivo_perda: 'FREQUENCIA_INSUFICIENTE',
        observacao_perda: `Frequência: ${presentes}/4`,
        perda_definitiva: true,
        status: 'arquivado',
      })
    }
  }

  const { error } = await supabase.from('contacts').update(upd).eq('id', c.id)
  if (error) throw error

  await supabase.from('lead_historico').insert({
    contact_id: c.id, user_id: userId, tipo: 'PRESENCA',
    descricao: `Aula ${aula}: ${presente ? 'presente ✓' : 'faltou ✗'}${todasRegistradas ? ` — frequência ${presentes}/4` : ''}`,
  })
}

// ─── Ativar trilha de batismo ────────────────────────────────────────────────

export async function ativarTrilhaBatismo(c: Contact, userId: string): Promise<void> {
  const { error } = await supabase.from('contacts').update({ subetapa_batismo: 'DECIDIU_BATIZAR' }).eq('id', c.id)
  if (error) throw error
  await supabase.from('lead_historico').insert({
    contact_id: c.id, user_id: userId, tipo: 'AVANCO_ETAPA',
    descricao: 'Decidiu ser batizado — trilha de batismo ativada',
  })
}

// ─── Registrar perda ─────────────────────────────────────────────────────────

const REENCAMINHAM: MotivoPerdaLead[] = [
  'NAO_DECIDIU_BATIZAR', 'NAO_COMPARECEU_AULA_BATISMO', 'NAO_CUMPRE_REQUISITOS',
]

export async function registrarPerda(
  c: Contact, motivo: MotivoPerdaLead, observacao: string | null, userId: string
): Promise<void> {
  const definitiva = !REENCAMINHAM.includes(motivo)
  const upd: Partial<Contact> = {
    fase_pipeline: definitiva ? 'PERDIDO' : 'REENCAMINHADO',
    motivo_perda: motivo,
    observacao_perda: observacao,
    perda_definitiva: definitiva,
    status: definitiva ? 'arquivado' : 'ativo',
    ...(! definitiva && { subetapa_batismo: 'LISTA_ESPERA' }),
  }
  const { error } = await supabase.from('contacts').update(upd).eq('id', c.id)
  if (error) throw error
  await supabase.from('lead_historico').insert({
    contact_id: c.id, user_id: userId,
    tipo: definitiva ? 'PERDA' : 'REENCAMINHAMENTO',
    descricao: `${definitiva ? 'Lead perdido' : 'Reencaminhado'}: ${motivo}${observacao ? ` — ${observacao}` : ''}`,
  })
}

// ─── Motivos de perda agrupados ──────────────────────────────────────────────

export const MOTIVOS_PERDA: { fase: string; motivos: { value: MotivoPerdaLead; label: string; reencaminha?: boolean }[] }[] = [
  { fase: 'Fase 1 — Entrada', motivos: [
    { value: 'SEM_APRESENTACAO_VISITANTES', label: 'Sem apresentação de visitantes' },
    { value: 'SEM_APELO_NOVO_NASCIMENTO',  label: 'Sem apelo Novo Nascimento' },
    { value: 'NAO_CADASTROU',              label: 'Não cadastrou' },
    { value: 'DADOS_FRIOS_INCOMPLETOS',    label: 'Dados frios / incompletos' },
  ]},
  { fase: 'Fase 2 — Contato', motivos: [
    { value: 'NUMERO_INCORRETO',            label: 'Número incorreto' },
    { value: 'SEM_RESPOSTA_APOS_TENTATIVAS',label: 'Sem resposta após tentativas' },
  ]},
  { fase: 'Fase 3 — Qualificação', motivos: [
    { value: 'SEM_DISPONIBILIDADE',  label: 'Sem disponibilidade' },
    { value: 'NAO_INSCREVEU_PROVER', label: 'Não inscreveu no PROVER' },
  ]},
  { fase: 'Fase 4 — Aulas', motivos: [
    { value: 'NAO_COMPARECEU_AULA_1',   label: 'Não compareceu à Aula 1' },
    { value: 'FREQUENCIA_INSUFICIENTE', label: 'Frequência insuficiente (< 3/4)' },
  ]},
  { fase: 'Fase 5a — Encaminhamento', motivos: [
    { value: 'NAO_ENTROU_LINK', label: 'Não entrou no link' },
  ]},
  { fase: 'Fase 5b — Batismo', motivos: [
    { value: 'NAO_DECIDIU_BATIZAR',          label: 'Não decidiu batizar',             reencaminha: true },
    { value: 'NAO_RESPONDEU_CONTATO_BATISMO',label: 'Sem resposta no contato batismo'  },
    { value: 'NAO_COMPARECEU_AULA_BATISMO',  label: 'Não compareceu à aula de batismo',reencaminha: true },
    { value: 'NAO_CUMPRE_REQUISITOS',        label: 'Não cumpre requisitos',            reencaminha: true },
  ]},
  { fase: 'Genérico', motivos: [
    { value: 'OUTROS', label: 'Outros' },
  ]},
]
