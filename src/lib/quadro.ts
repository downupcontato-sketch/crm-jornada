import { supabase } from './supabase'
import { numeroFup } from './pipeline'
import type { Contact, SubetapaContato } from '@/types/database'

// Quadro do Jornada e do Batismo (reunião de 12/11). Nenhuma coluna é gravada no
// banco: cada vida cai na coluna a partir de fase + subetapa + presenças, os
// mesmos campos que a ficha já usa. Mover no quadro grava esses campos.

export type ColunaJornada =
  | 'CONTATO_INICIAL' | 'TENTANDO' | 'FUP_1' | 'FUP_2' | 'FUP_3' | 'FUP_4' | 'FUP_5'
  | 'EM_CONTATO' | 'AULA_1' | 'AULA_2' | 'AULA_3' | 'AULA_4'
  | 'POS_AULA' | 'LINKS' | 'RAIZES'

export type ColunaBatismo = 'LISTA_ESPERA' | 'CADASTRADO' | 'AULAS_OBRIGATORIAS' | 'PARTICIPOU' | 'FINALIZADO'

export interface DefColuna<T extends string> { id: T; nome: string; desc?: string; prazoDias?: number }

// Prazos definidos pelo Alexandre: antes da conexão 2 dias por etapa; depois, 10.
export const COLUNAS_JORNADA: DefColuna<ColunaJornada>[] = [
  { id: 'CONTATO_INICIAL', nome: 'Contato inicial', desc: 'Ninguém falou ainda', prazoDias: 2 },
  { id: 'TENTANDO',        nome: 'Tentando contato', desc: 'Mensagem enviada, sem resposta', prazoDias: 2 },
  { id: 'FUP_1', nome: 'FUP 01', prazoDias: 2 },
  { id: 'FUP_2', nome: 'FUP 02', prazoDias: 2 },
  { id: 'FUP_3', nome: 'FUP 03', prazoDias: 2 },
  { id: 'FUP_4', nome: 'FUP 04', prazoDias: 2 },
  { id: 'FUP_5', nome: 'FUP 05', prazoDias: 2 },
  { id: 'EM_CONTATO', nome: 'Em contato', desc: 'Conectou com o voluntário', prazoDias: 10 },
  { id: 'AULA_1', nome: 'Aula 1', prazoDias: 10 },
  { id: 'AULA_2', nome: 'Aula 2', prazoDias: 10 },
  { id: 'AULA_3', nome: 'Aula 3', prazoDias: 10 },
  { id: 'AULA_4', nome: 'Aula 4', prazoDias: 10 },
  { id: 'POS_AULA', nome: 'Pós-aula', desc: 'Encaminhar para um Link', prazoDias: 10 },
  { id: 'LINKS',  nome: 'Links', desc: 'Já está num Link', prazoDias: 10 },
  { id: 'RAIZES', nome: 'Raízes', desc: 'Etapa final' },
]

export const COLUNAS_BATISMO: DefColuna<ColunaBatismo>[] = [
  { id: 'LISTA_ESPERA',       nome: 'Lista de espera' },
  { id: 'CADASTRADO',         nome: 'Cadastrado' },
  { id: 'AULAS_OBRIGATORIAS', nome: 'Aulas obrigatórias' },
  { id: 'PARTICIPOU',         nome: 'Participou do batismo' },
  { id: 'FINALIZADO',         nome: 'Finalizado' },
]

export function colunaJornada(c: Contact): ColunaJornada | null {
  switch (c.fase_pipeline) {
    case 'CONTATO_INICIAL': {
      const fup = numeroFup(c)
      if (fup) return `FUP_${fup}` as ColunaJornada
      return c.data_primeiro_contato ? 'TENTANDO' : 'CONTATO_INICIAL'
    }
    case 'QUALIFICACAO': return 'EM_CONTATO'
    case 'AULAS': {
      // A próxima aula depois da última registrada. O check-in só grava presença,
      // então pode haver aulas anteriores sem registro (o voluntário confere na ficha).
      const ultima = [c.presenca_aula1, c.presenca_aula2, c.presenca_aula3, c.presenca_aula4]
        .reduce((u, p, i) => (p !== null ? i : u), -1)
      return `AULA_${Math.min(ultima + 2, 4)}` as ColunaJornada
    }
    case 'POS_AULA':
      if (c.subetapa_encaminhamento === 'RAIZES') return 'RAIZES'
      if (c.subetapa_encaminhamento === 'HANDS_OFF_CONFIRMADO') return 'LINKS'
      return 'POS_AULA'
    default: return null // batizado, perdido e reencaminhado ficam fora do quadro
  }
}

export function colunaBatismo(c: Contact): ColunaBatismo | null {
  if (c.fase_pipeline === 'BATIZADO') return c.batismo_finalizado_em ? 'FINALIZADO' : 'PARTICIPOU'
  switch (c.subetapa_batismo) {
    case 'DECIDIU_BATIZAR': case 'LISTA_ESPERA': return 'LISTA_ESPERA'
    case 'INSCRICAO_CONFIRMADA': return 'CADASTRADO'
    case 'AULA_BATISMO': case 'CUMPRE_REQUISITOS': case 'BATISMO_AGENDADO': return 'AULAS_OBRIGATORIAS'
    default: return null
  }
}

export function diasNaEtapa(c: Pick<Contact, 'etapa_desde' | 'updated_at'>, agora = Date.now()): number {
  return Math.max(0, Math.floor((agora - new Date(c.etapa_desde ?? c.updated_at).getTime()) / 86_400_000))
}

/** Amarelo a partir da metade do prazo, vermelho quando passa do prazo. */
export function situacaoPrazo(dias: number, prazoDias?: number): 'ok' | 'atencao' | 'atrasada' {
  if (!prazoDias) return 'ok'
  if (dias >= prazoDias) return 'atrasada'
  return dias >= prazoDias / 2 ? 'atencao' : 'ok'
}

/** Campos a gravar para a vida ir para a coluna. null = não dá para mover por arrasto. */
export function camposParaColunaJornada(c: Contact, destino: ColunaJornada): Partial<Contact> | null {
  const agora = new Date().toISOString()
  const contato = (sub: SubetapaContato, primeiro: string | null): Partial<Contact> => ({
    fase_pipeline: 'CONTATO_INICIAL', subetapa_contato: sub, subetapa_qualificacao: null,
    subetapa_encaminhamento: null, data_primeiro_contato: primeiro,
  })
  const posAula = (sub: Contact['subetapa_encaminhamento']): Partial<Contact> => ({
    fase_pipeline: 'POS_AULA', subetapa_contato: null, subetapa_qualificacao: null, subetapa_encaminhamento: sub,
  })
  switch (destino) {
    case 'CONTATO_INICIAL': return contato('TENTATIVA_1', null)
    case 'TENTANDO': return contato('TENTATIVA_1', c.data_primeiro_contato ?? agora)
    case 'FUP_1': return contato('TENTATIVA_2', c.data_primeiro_contato ?? agora)
    case 'FUP_2': case 'FUP_3': case 'FUP_4': case 'FUP_5':
      return contato(destino, c.data_primeiro_contato ?? agora)
    case 'EM_CONTATO': return {
      fase_pipeline: 'QUALIFICACAO', subetapa_contato: null, subetapa_encaminhamento: null,
      subetapa_qualificacao: c.subetapa_qualificacao ?? 'CONVERSA',
    }
    // Aula 2 a 4 dependem da presença registrada na ficha; só a entrada nas aulas é por arrasto.
    case 'AULA_1': return c.fase_pipeline === 'AULAS' ? null : {
      fase_pipeline: 'AULAS', subetapa_contato: null, subetapa_qualificacao: null, subetapa_encaminhamento: null,
      presenca_aula1: null, presenca_aula2: null, presenca_aula3: null, presenca_aula4: null,
    }
    case 'AULA_2': case 'AULA_3': case 'AULA_4': return null
    case 'POS_AULA': return posAula('ENCAMINHADO')
    case 'LINKS': return { ...posAula('HANDS_OFF_CONFIRMADO'), link_confirmado_em: c.link_confirmado_em ?? agora }
    case 'RAIZES': return posAula('RAIZES')
  }
}

export function camposParaColunaBatismo(c: Contact, destino: ColunaBatismo): Partial<Contact> {
  const agora = new Date().toISOString()
  // Sair de "batizado" devolve a vida ao pós-aula, onde a trilha de batismo vive.
  const ativo: Partial<Contact> = c.fase_pipeline === 'BATIZADO'
    ? { fase_pipeline: 'POS_AULA', status: 'ativo', data_batismo_realizado: null, batismo_finalizado_em: null }
    : {}
  switch (destino) {
    case 'LISTA_ESPERA': return { ...ativo, subetapa_batismo: 'LISTA_ESPERA' }
    case 'CADASTRADO': return { ...ativo, subetapa_batismo: 'INSCRICAO_CONFIRMADA' }
    case 'AULAS_OBRIGATORIAS': return { ...ativo, subetapa_batismo: 'AULA_BATISMO' }
    case 'PARTICIPOU': return {
      fase_pipeline: 'BATIZADO', status: 'batizado', subetapa_batismo: 'BATISMO_AGENDADO',
      data_batismo_realizado: c.data_batismo_realizado ?? agora, batismo_finalizado_em: null,
    }
    case 'FINALIZADO': return {
      fase_pipeline: 'BATIZADO', status: 'batizado', subetapa_batismo: 'BATISMO_AGENDADO',
      data_batismo_realizado: c.data_batismo_realizado ?? agora, batismo_finalizado_em: agora,
    }
  }
}

export async function moverVida(c: Contact, upd: Partial<Contact>, de: string, para: string, userId: string) {
  const { error } = await supabase.from('contacts').update(upd).eq('id', c.id)
  if (error) throw error
  // O histórico é secundário: a vida já mudou de coluna.
  await supabase.from('lead_historico').insert({
    contact_id: c.id, user_id: userId, tipo: 'AVANCO_ETAPA',
    descricao: `Movido no quadro: ${de} → ${para}`,
    dados_antes: { fase: c.fase_pipeline, contato: c.subetapa_contato, enc: c.subetapa_encaminhamento, batismo: c.subetapa_batismo },
    dados_depois: upd,
  })
}
