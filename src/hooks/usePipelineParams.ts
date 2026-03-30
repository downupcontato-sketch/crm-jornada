import { useSearchParams } from 'react-router-dom'
import type { FasePipeline } from '@/types/database'

const FASES: FasePipeline[] = ['CONTATO_INICIAL', 'QUALIFICACAO', 'AULAS', 'POS_AULA']

export function usePipelineParams() {
  const [params, setParams] = useSearchParams()

  const fase = (params.get('fase') as FasePipeline | null) ?? 'CONTATO_INICIAL'
  const subetapa = params.get('sub') ?? null
  const page = Math.max(1, parseInt(params.get('page') ?? '1', 10))

  function setFase(f: FasePipeline) {
    setParams(p => { p.set('fase', f); p.delete('sub'); p.delete('page'); return p }, { replace: true })
  }

  function setSubetapa(s: string | null) {
    setParams(p => { s ? p.set('sub', s) : p.delete('sub'); p.delete('page'); return p }, { replace: true })
  }

  function setPage(n: number) {
    setParams(p => { n === 1 ? p.delete('page') : p.set('page', String(n)); return p }, { replace: true })
  }

  return {
    fase: FASES.includes(fase) ? fase : 'CONTATO_INICIAL' as FasePipeline,
    subetapa,
    page,
    setFase,
    setSubetapa,
    setPage,
  }
}
