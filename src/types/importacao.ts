export type StatusLinha =
  | 'SUCESSO'
  | 'ERRO_CAMPO_OBRIGATORIO'
  | 'ERRO_TELEFONE_INVALIDO'
  | 'ERRO_DUPLICATA'
  | 'ERRO_TIPO_INVALIDO'
  | 'ERRO_ABA_CORROMPIDA'
  | 'AVISO_DADO_INCOMPLETO'

export interface ResultadoLinha {
  linha: number
  aba: string
  status: StatusLinha
  nome?: string
  telefone?: string
  mensagem: string
  dados?: Record<string, unknown>
}

export interface RelatorioImportacao {
  totalLinhas: number
  importados: number
  erros: number
  avisos: number
  resultados: ResultadoLinha[]
  iniciadoEm: Date
  finalizadoEm: Date
}
