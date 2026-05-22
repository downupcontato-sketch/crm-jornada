import type { FasePipeline } from '@/types/database'

export const FASE_SLUG: Record<FasePipeline, string> = {
  CONTATO_INICIAL: 'contato-inicial',
  QUALIFICACAO:    'qualificacao',
  AULAS:           'aulas',
  POS_AULA:        'pos-aula',
  BATIZADO:        'batizado',
  PERDIDO:         'perdido',
  REENCAMINHADO:   'reencaminhado',
}

export const SLUG_FASE: Record<string, FasePipeline> = Object.fromEntries(
  Object.entries(FASE_SLUG).map(([k, v]) => [v, k as FasePipeline])
)
