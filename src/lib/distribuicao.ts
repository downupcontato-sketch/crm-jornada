import { supabase } from '@/lib/supabase'
import type { Contact, ContactTipo, ContactGrupo } from '@/types/database'

// =============================================================
// TIPOS
// =============================================================

export interface ResultadoDedup {
  duplicataEncontrada: boolean
  score?: number // 0-100
  leadExistente?: {
    id: string
    nome: string
    telefone: string
    status: string
    voluntario?: string
    etapa_atual: number
    created_at: string
  }
}

export interface ResultadoDistribuicao {
  sucesso: boolean
  voluntarioId?: string
  tipo: 'AUTOMATICA' | 'FILA' | 'ERRO'
  mensagem: string
}

// =============================================================
// 1. DEDUPLICAÇÃO
// =============================================================

export async function verificarDuplicata(
  telefone: string,
  email?: string,
  nome?: string
): Promise<ResultadoDedup> {
  const telNormalizado = telefone.replace(/\D/g, '')

  // 1. Telefone exato
  const { data: porTel } = await supabase
    .from('contacts')
    .select('id, nome, telefone, status, etapa_atual, created_at, profiles!contacts_voluntario_atribuido_id_fkey(nome)')
    .neq('status', 'arquivado')
    .ilike('telefone', `%${telNormalizado}%`)
    .limit(1)
    .single()

  if (porTel) {
    return {
      duplicataEncontrada: true,
      score: 100,
      leadExistente: {
        id: porTel.id,
        nome: porTel.nome,
        telefone: porTel.telefone,
        status: porTel.status,
        etapa_atual: porTel.etapa_atual,
        created_at: porTel.created_at,
        voluntario: (porTel.profiles as any)?.nome,
      },
    }
  }

  // 2. Email exato
  if (email?.trim()) {
    const { data: porEmail } = await supabase
      .from('contacts')
      .select('id, nome, telefone, status, etapa_atual, created_at, profiles!contacts_voluntario_atribuido_id_fkey(nome)')
      .neq('status', 'arquivado')
      .ilike('email', email.trim())
      .limit(1)
      .single()

    if (porEmail) {
      return {
        duplicataEncontrada: true,
        score: 95,
        leadExistente: {
          id: porEmail.id,
          nome: porEmail.nome,
          telefone: porEmail.telefone,
          status: porEmail.status,
          etapa_atual: porEmail.etapa_atual,
          created_at: porEmail.created_at,
          voluntario: (porEmail.profiles as any)?.nome,
        },
      }
    }
  }

  // 3. Similaridade por nome (Levenshtein)
  if (nome && nome.trim().length > 3) {
    const { data: todos } = await supabase
      .from('contacts')
      .select('id, nome, telefone, status, etapa_atual, created_at, profiles!contacts_voluntario_atribuido_id_fkey(nome)')
      .neq('status', 'arquivado')
      .limit(500)

    if (todos) {
      const nomeNorm = nome.toLowerCase().trim()
      for (const c of todos) {
        const score = calcularSimilaridade(nomeNorm, c.nome.toLowerCase().trim())
        if (score >= 85) {
          return {
            duplicataEncontrada: true,
            score,
            leadExistente: {
              id: c.id,
              nome: c.nome,
              telefone: c.telefone,
              status: c.status,
              etapa_atual: c.etapa_atual,
              created_at: c.created_at,
              voluntario: (c.profiles as any)?.nome,
            },
          }
        }
      }
    }
  }

  return { duplicataEncontrada: false }
}

// =============================================================
// 2. DISTRIBUIÇÃO
// =============================================================

export async function distribuirLead(contactId: string): Promise<ResultadoDistribuicao> {
  const { data, error } = await supabase.rpc('distribuir_lead', {
    p_contact_id: contactId,
  })

  if (error) {
    return { sucesso: false, tipo: 'ERRO', mensagem: error.message }
  }

  const resultado = Array.isArray(data) ? data[0] : data

  if (!resultado) {
    return { sucesso: false, tipo: 'ERRO', mensagem: 'Sem resposta da função de distribuição.' }
  }

  if (resultado.tipo_atribuicao === 'AUTOMATICA') {
    return {
      sucesso: true,
      voluntarioId: resultado.voluntario_id,
      tipo: 'AUTOMATICA',
      mensagem: 'Lead atribuído automaticamente.',
    }
  }

  // Verifica tamanho da fila para disparar alerta
  const { data: contact } = await supabase
    .from('contacts')
    .select('grupo')
    .eq('id', contactId)
    .single()

  if (contact?.grupo) {
    const { count } = await supabase
      .from('contacts')
      .select('id', { count: 'exact' })
      .eq('grupo', contact.grupo)
      .eq('status', 'ativo')
      .is('voluntario_atribuido_id', null)

    if ((count ?? 0) >= 3) {
      await supabase.from('alertas_sla').insert({
        contact_id: contactId,
        tipo: 'FILA_CHEIA',
      })
    }
  }

  return {
    sucesso: false,
    tipo: 'FILA',
    mensagem: resultado.motivo ?? 'Lead adicionado à fila de espera.',
  }
}

// =============================================================
// 3. REDISTRIBUIÇÃO MANUAL
// =============================================================

export async function redistribuirLead(
  contactId: string,
  novoVoluntarioId: string,
  motivo: string,
  realizadoPor: string
): Promise<{ error: string | null }> {
  // Transação simulada via chamadas sequenciais
  const { error: e1 } = await supabase
    .from('contacts')
    .update({
      voluntario_atribuido_id: novoVoluntarioId,
      data_distribuicao: new Date().toISOString(),
      sla_status: 'ok',
      posicao_fila: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', contactId)

  if (e1) return { error: e1.message }

  const { error: e2 } = await supabase.from('atribuicoes').insert({
    contact_id: contactId,
    voluntario_id: novoVoluntarioId,
    tipo: 'REDISTRIBUICAO_SLA',
    motivo,
    criado_por: realizadoPor,
  })

  if (e2) return { error: e2.message }

  // Resolve alertas pendentes
  await supabase
    .from('alertas_sla')
    .update({ resolvido: true, resolvido_em: new Date().toISOString(), resolvido_por: realizadoPor })
    .eq('contact_id', contactId)
    .eq('resolvido', false)

  // Atualiza ultima_atribuicao
  await supabase
    .from('profiles')
    .update({ ultima_atribuicao: new Date().toISOString() })
    .eq('id', novoVoluntarioId)

  return { error: null }
}

// =============================================================
// 4. MESCLAR DUPLICATAS
// =============================================================

export async function mesclarLeads(
  leadManterId: string,
  leadDescartarId: string
): Promise<{ error: string | null }> {
  // Migra atribuicoes
  await supabase
    .from('atribuicoes')
    .update({ contact_id: leadManterId })
    .eq('contact_id', leadDescartarId)

  // Migra alertas
  await supabase
    .from('alertas_sla')
    .update({ contact_id: leadManterId })
    .eq('contact_id', leadDescartarId)

  // Migra interações
  await supabase
    .from('interactions')
    .update({ contact_id: leadManterId })
    .eq('contact_id', leadDescartarId)

  // Arquiva o duplicado (nunca deleta)
  const { error } = await supabase
    .from('contacts')
    .update({
      status: 'arquivado',
      duplicata_origem_id: leadManterId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadDescartarId)

  return { error: error?.message ?? null }
}

// =============================================================
// HELPERS: Levenshtein
// =============================================================

function calcularSimilaridade(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 100
  return Math.round((1 - levenshtein(a, b) / maxLen) * 100)
}

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}
