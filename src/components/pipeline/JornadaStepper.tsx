import { cn } from '@/lib/utils'
import type { FasePipeline } from '@/types/database'

const STEPS: { label: string; fase: FasePipeline | null }[] = [
  { label: 'Cadastro',     fase: null },
  { label: 'Contato',      fase: 'CONTATO_INICIAL' },
  { label: 'Qualificação', fase: 'QUALIFICACAO' },
  { label: 'Aulas',        fase: 'AULAS' },
  { label: 'Matrícula',    fase: 'POS_AULA' },
]

function getStepIdx(fase: FasePipeline): number {
  if (fase === 'BATIZADO') return STEPS.length // all done
  const idx = STEPS.findIndex(s => s.fase === fase)
  return idx === -1 ? 0 : idx
}

export function JornadaStepper({ fasePipeline }: { fasePipeline: FasePipeline }) {
  const currentIdx = getStepIdx(fasePipeline)

  return (
    <div className="flex items-start">
      {STEPS.map((step, i) => {
        const isDone    = i < currentIdx
        const isCurrent = i === currentIdx
        return (
          <div key={step.label} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center gap-1.5 flex-1">
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all flex-shrink-0',
                isDone    ? 'bg-menta-light border-menta-light text-petroleo' :
                isCurrent ? 'bg-transparent border-menta-light text-menta-light' :
                            'bg-transparent border-border text-muted-foreground/40',
              )}>
                {isDone ? '✓' : i + 1}
              </div>
              <span className={cn(
                'text-[10px] text-center leading-tight px-0.5 w-full truncate',
                isDone    ? 'text-muted-foreground' :
                isCurrent ? 'text-menta-light font-semibold' :
                            'text-muted-foreground/40',
              )}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn('h-px flex-1 mb-5 mx-1', isDone ? 'bg-menta-light/50' : 'bg-border')} />
            )}
          </div>
        )
      })}
    </div>
  )
}
