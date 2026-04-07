export type UserNivel = 'admin' | 'lider' | 'coordenador' | 'voluntario' | 'linha_de_frente'
export type SubtipoVisitante = 'CONHECENDO' | 'SEM_IGREJA' | 'COM_IGREJA'
export type ContactSexo = 'MASCULINO' | 'FEMININO' | 'NAO_INFORMADO'

export const SUBTIPO_VISITANTE_LABEL: Record<SubtipoVisitante, string> = {
  CONHECENDO: 'Estou conhecendo',
  SEM_IGREJA: 'Não tem igreja local',
  COM_IGREJA:  'Tem igreja local',
}
export type ContactTipo = 'novo_nascimento' | 'reconciliacao' | 'visitante'
export type ContactGrupo = 'rise' | 'flow' | 'vox' | 'ek' | 'zion_geral'
export type ContactStatus = 'ativo' | 'sem_resposta' | 'encaminhado' | 'arquivado' | 'batizado' | 'reciclado' | 'pendente_aprovacao' | 'inativo'
export type SlaStatus = 'ok' | 'atencao' | 'vencido'
export type InteractionTipo = 'whatsapp' | 'ligacao' | 'presencial' | 'zoom'
export type InteractionResultado = 'respondeu' | 'nao_atendeu' | 'sem_resposta' | 'avancou' | 'recusou'

// ─── Pipeline v2 ────────────────────────────────────────────────────────────
export type FasePipeline =
  | 'CONTATO_INICIAL' | 'QUALIFICACAO' | 'AULAS'
  | 'POS_AULA' | 'BATIZADO' | 'PERDIDO' | 'REENCAMINHADO'

export type SubetapaContato = 'TENTATIVA_1' | 'TENTATIVA_2' | 'TENTATIVA_3'
export type SubetapaQualificacao =
  | 'CONVERSA' | 'PERFIL_CONFIRMADO' | 'CONVITE_ENVIADO'
  | 'AGUARDANDO_PROVER' | 'PROVER_CONFIRMADO'
export type SubetapaEncaminhamento = 'ENCAMINHADO' | 'HANDS_OFF_CONFIRMADO'
export type SubetapaBatismo =
  | 'DECIDIU_BATIZAR' | 'LISTA_ESPERA' | 'INSCRICAO_CONFIRMADA'
  | 'AULA_BATISMO' | 'CUMPRE_REQUISITOS' | 'BATISMO_AGENDADO'

export type MotivoPerdaLead =
  | 'SEM_APRESENTACAO_VISITANTES' | 'SEM_APELO_NOVO_NASCIMENTO'
  | 'NAO_CADASTROU' | 'DADOS_FRIOS_INCOMPLETOS'
  | 'NUMERO_INCORRETO' | 'SEM_RESPOSTA_APOS_TENTATIVAS'
  | 'SEM_DISPONIBILIDADE' | 'NAO_INSCREVEU_PROVER'
  | 'NAO_COMPARECEU_AULA_1' | 'FREQUENCIA_INSUFICIENTE'
  | 'NAO_ENTROU_LINK'
  | 'NAO_DECIDIU_BATIZAR' | 'NAO_RESPONDEU_CONTATO_BATISMO'
  | 'NAO_COMPARECEU_AULA_BATISMO' | 'NAO_CUMPRE_REQUISITOS'
  | 'OUTROS'

export interface Profile {
  id: string
  nome: string
  email: string
  telefone: string | null
  nivel: UserNivel
  grupo: ContactGrupo | null
  ativo: boolean
  status?: 'pendente' | 'ativo' | 'rejeitado'
  aprovado_por?: string | null
  aprovado_em?: string | null
  rejeitado_por?: string | null
  rejeitado_em?: string | null
  nota_rejeicao?: string | null
  max_contatos_ativos: number
  coordenador_id: string | null
  ultima_atribuicao: string | null
  especializacao: string[]
  created_at: string
  updated_at: string
}

export interface PipelineStage {
  id: number
  nome: string
  fase: string
  ordem: number
  tipo: 'acao' | 'decisao'
  sla_horas: number | null
  cor_status: string | null
  descricao: string | null
}

export interface Contact {
  id: string
  nome: string
  telefone: string
  whatsapp_valido: boolean
  email: string | null
  tipo: ContactTipo
  grupo: ContactGrupo
  sexo: ContactSexo | null
  idade: number | null
  igreja_origem: string | null
  culto_captacao: string | null
  local_culto: string | null
  possui_igreja_local: boolean | null
  igreja_local_nome: string | null
  subtipo_visitante: SubtipoVisitante | null
  captador_id: string | null
  numero_pulseira: string | null
  autorizacao_contato: boolean
  etapa_atual: number
  etapa_anterior: number | null
  voluntario_atribuido_id: string | null
  data_distribuicao: string | null
  data_primeiro_contato: string | null
  sla_status: SlaStatus
  status: ContactStatus
  tentativas_contato: number
  observacoes: string | null
  posicao_fila: number | null
  duplicata_origem_id: string | null
  data_reciclagem: string | null
  created_at: string
  updated_at: string
  pipeline_stages?: PipelineStage
  profiles?: Pick<Profile, 'id' | 'nome' | 'email'> | null
  // Pipeline v2
  fase_pipeline: FasePipeline
  subetapa_contato: SubetapaContato | null
  subetapa_qualificacao: SubetapaQualificacao | null
  subetapa_encaminhamento: SubetapaEncaminhamento | null
  subetapa_batismo: SubetapaBatismo | null
  presenca_aula1: boolean | null
  presenca_aula2: boolean | null
  presenca_aula3: boolean | null
  presenca_aula4: boolean | null
  pro_ver_inscrito: boolean
  pro_ver_confirmado_em: string | null
  data_batismo_agendado: string | null
  data_batismo_realizado: string | null
  link_confirmado_em: string | null
  motivo_perda: MotivoPerdaLead | null
  observacao_perda: string | null
  perda_definitiva: boolean
}

export interface LeadHistorico {
  id: string
  contact_id: string
  user_id: string
  tipo: string
  descricao: string
  dados_antes: Record<string, unknown> | null
  dados_depois: Record<string, unknown> | null
  created_at: string
  profiles?: { nome: string } | null
}

export interface Interaction {
  id: string
  contact_id: string
  voluntario_id: string
  data_interacao: string
  tipo: InteractionTipo
  resultado: InteractionResultado
  observacao: string | null
  etapa_antes: number | null
  etapa_depois: number | null
  created_at: string
  profiles?: Pick<Profile, 'id' | 'nome'> | null
}

export interface AlertaSLA {
  id: string
  contact_id: string
  tipo: 'SLA_48H_VOLUNTARIO' | 'SLA_72H_COORDENADOR' | 'FILA_CHEIA'
  resolvido: boolean
  resolvido_em: string | null
  resolvido_por: string | null
  created_at: string
}

export interface Atribuicao {
  id: string
  contact_id: string
  voluntario_id: string
  tipo: 'AUTOMATICA' | 'MANUAL' | 'REDISTRIBUICAO_SLA' | 'OVERFLOW'
  motivo: string | null
  criado_por: string | null
  created_at: string
}
