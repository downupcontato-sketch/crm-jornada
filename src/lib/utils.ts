import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }

export function formatRelativeTime(date: string | Date) {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR })
}

export function getGrupoLabel(grupo: string) {
  return ({ rise: 'RISE', flow: 'FLOW', vox: 'VOX', ek: 'EK', zion_geral: 'Zion Geral' } as Record<string,string>)[grupo] ?? grupo
}

export function getTipoLabel(tipo: string) {
  return ({ novo_nascimento: 'Novo Nascimento', reconciliacao: 'Reconciliação', visitante: 'Visitante' } as Record<string,string>)[tipo] ?? tipo
}

export function getTipoBadgeColor(tipo: string) {
  return ({ novo_nascimento: 'bg-menta-light/20 text-menta-light', reconciliacao: 'bg-purple-500/20 text-purple-400', visitante: 'bg-blue-500/20 text-blue-400' } as Record<string,string>)[tipo] ?? 'bg-muted text-muted-foreground'
}

export function getStatusColor(status: string) {
  return ({ ativo: 'bg-emerald-500/20 text-emerald-400', sem_resposta: 'bg-red-500/20 text-red-400', encaminhado: 'bg-blue-500/20 text-blue-400', arquivado: 'bg-gray-500/20 text-gray-400', batizado: 'bg-menta-light/20 text-menta-light', reciclado: 'bg-yellow-500/20 text-yellow-400' } as Record<string,string>)[status] ?? 'bg-muted text-muted-foreground'
}

export function getSlaColor(sla: string) {
  return ({ vencido: 'text-red-400 bg-red-400/10', atencao: 'text-yellow-400 bg-yellow-400/10' } as Record<string,string>)[sla] ?? 'text-emerald-400 bg-emerald-400/10'
}

export function getSlaLabel(sla: string) {
  return ({ vencido: 'SLA Vencido', atencao: 'Atenção' } as Record<string,string>)[sla] ?? 'OK'
}

export function formatPhone(t: string) {
  const c = t.replace(/\D/g, '')
  if (c.length === 11) return `(${c.slice(0,2)}) ${c.slice(2,7)}-${c.slice(7)}`
  if (c.length === 10) return `(${c.slice(0,2)}) ${c.slice(2,6)}-${c.slice(6)}`
  return t
}

export function nivelLabel(nivel: string) {
  return ({ admin: 'Admin Geral', lider: 'Líder de Jornada', coordenador: 'Coordenador', voluntario: 'Voluntário', linha_de_frente: 'Linha de Frente' } as Record<string,string>)[nivel] ?? nivel
}
