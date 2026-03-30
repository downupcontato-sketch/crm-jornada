import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { AlertTriangle, Clock, Users, RefreshCw, ChevronRight, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { redistribuirLead } from '@/lib/distribuicao'
import { toast } from 'sonner'
import { cn, getGrupoLabel, formatPhone } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Link } from 'react-router-dom'
import type { Profile } from '@/types/database'

type AlertaTipo = 'SLA_48H_VOLUNTARIO' | 'SLA_72H_COORDENADOR' | 'FILA_CHEIA'

interface Alerta {
  id: string
  tipo: AlertaTipo
  created_at: string
  contact_id: string
  contacts: {
    id: string
    nome: string
    telefone: string
    grupo: string
    etapa_atual: number
    voluntario_atribuido_id: string | null
    profiles: { nome: string } | null
  }
}

interface RedistribuirState {
  alertaId: string
  contactId: string
}

const tipoConfig: Record<AlertaTipo, { label: string; color: string; icon: React.ReactNode }> = {
  SLA_48H_VOLUNTARIO: {
    label: 'SLA 48h — Sem contato',
    color: 'text-red-400 bg-red-400/10 border-red-400/20',
    icon: <Clock size={14} className="text-red-400" />,
  },
  SLA_72H_COORDENADOR: {
    label: 'Escalado — 72h sem contato',
    color: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
    icon: <AlertTriangle size={14} className="text-orange-400" />,
  },
  FILA_CHEIA: {
    label: 'Fila de espera',
    color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
    icon: <Users size={14} className="text-yellow-400" />,
  },
}

export function PainelAlertas() {
  const { profile } = useAuth()
  const queryClient = useQueryClient()
  const [redistribuindo, setRedistribuindo] = useState<RedistribuirState | null>(null)
  const [resolvendoId, setResolvendoId] = useState<string | null>(null)

  const { data: alertas, isLoading } = useQuery({
    queryKey: ['alertas-sla', profile?.grupo],
    queryFn: async () => {
      let query = supabase
        .from('alertas_sla')
        .select(`
          id, tipo, created_at, contact_id,
          contacts(
            id, nome, telefone, grupo, etapa_atual, voluntario_atribuido_id,
            profiles!contacts_voluntario_atribuido_id_fkey(nome)
          )
        `)
        .eq('resolvido', false)
        .order('created_at', { ascending: true })

      const { data, error } = await query
      if (error) throw error

      // Coordenador vê só alertas do seu grupo
      let result = (data ?? []) as unknown as Alerta[]
      if (profile?.nivel === 'coordenador' && profile?.grupo) {
        result = result.filter(a => a.contacts?.grupo === profile.grupo)
      }

      return result
    },
    enabled: !!profile,
    refetchInterval: 60000,
  })

  const { data: voluntarios } = useQuery({
    queryKey: ['voluntarios-disponiveis', profile?.grupo],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, nome, grupo, max_contatos_ativos')
        .eq('nivel', 'voluntario')
        .eq('ativo', true)
      return (data ?? []) as Profile[]
    },
    enabled: !!redistribuindo,
  })

  async function handleRedistribuir(alertaId: string, contactId: string, novoVolId: string, motivo: string) {
    if (!profile) return
    const { error } = await redistribuirLead(contactId, novoVolId, motivo, profile.id)
    if (error) {
      toast.error('Erro ao redistribuir: ' + error)
    } else {
      toast.success('Lead redistribuído!')
      setRedistribuindo(null)
      queryClient.invalidateQueries({ queryKey: ['alertas-sla'] })
      queryClient.invalidateQueries({ queryKey: ['pipeline'] })
      queryClient.invalidateQueries({ queryKey: ['equipe'] })
    }
  }

  async function handleResolver(alertaId: string) {
    setResolvendoId(alertaId)
    await supabase
      .from('alertas_sla')
      .update({
        resolvido: true,
        resolvido_em: new Date().toISOString(),
        resolvido_por: profile?.id,
      })
      .eq('id', alertaId)
    queryClient.invalidateQueries({ queryKey: ['alertas-sla'] })
    setResolvendoId(null)
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
        <RefreshCw size={14} className="animate-spin" />
        Carregando alertas...
      </div>
    )
  }

  if (!alertas?.length) {
    return (
      <div className="zion-card text-center py-8">
        <CheckCircle size={28} className="text-menta-light mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Nenhum alerta pendente.</p>
        <p className="text-xs text-muted-foreground/60 mt-0.5">Tudo sob controle!</p>
      </div>
    )
  }

  // Agrupar por tipo
  const porTipo = alertas.reduce((acc, a) => {
    if (!acc[a.tipo]) acc[a.tipo] = []
    acc[a.tipo].push(a)
    return acc
  }, {} as Record<AlertaTipo, Alerta[]>)

  const ordem: AlertaTipo[] = ['SLA_72H_COORDENADOR', 'SLA_48H_VOLUNTARIO', 'FILA_CHEIA']

  return (
    <div className="space-y-4">
      {/* Total badge */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Alertas Ativos</span>
        <span className="text-xs bg-red-400/15 text-red-400 border border-red-400/20 px-2 py-0.5 rounded-full font-semibold">
          {alertas.length}
        </span>
      </div>

      {ordem.map(tipo => {
        const items = porTipo[tipo]
        if (!items?.length) return null
        const cfg = tipoConfig[tipo]

        return (
          <div key={tipo} className="zion-card">
            <div className={cn('flex items-center gap-2 text-xs font-semibold px-2.5 py-1.5 rounded-lg border mb-3 w-fit', cfg.color)}>
              {cfg.icon}
              {cfg.label}
              <span className="ml-1 opacity-70">({items.length})</span>
            </div>

            <div className="space-y-2">
              {items.map(alerta => (
                <div key={alerta.id} className="border border-border/60 rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <Link
                        to={`/contato/${alerta.contact_id}`}
                        className="text-sm font-medium text-offwhite hover:text-menta-light transition-colors truncate block"
                      >
                        {alerta.contacts?.nome}
                      </Link>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-muted-foreground">
                          {formatPhone(alerta.contacts?.telefone ?? '')}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {getGrupoLabel(alerta.contacts?.grupo ?? '')}
                        </span>
                        {alerta.contacts?.profiles?.nome && (
                          <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                            {alerta.contacts.profiles.nome}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        {formatDistanceToNow(new Date(alerta.created_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>

                    <div className="flex flex-col gap-1 flex-shrink-0">
                      <button
                        onClick={() => setRedistribuindo({
                          alertaId: alerta.id,
                          contactId: alerta.contact_id,
                        })}
                        className="text-xs bg-menta-dark/30 hover:bg-menta-dark/50 text-menta-light px-2.5 py-1 rounded-lg transition-all flex items-center gap-1"
                      >
                        <RefreshCw size={11} />
                        Redistribuir
                      </button>
                      <button
                        onClick={() => handleResolver(alerta.id)}
                        disabled={resolvendoId === alerta.id}
                        className="text-xs text-muted-foreground hover:text-emerald-400 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1"
                      >
                        <CheckCircle size={11} />
                        Resolver
                      </button>
                    </div>
                  </div>

                  {/* Redistribuição inline */}
                  {redistribuindo?.alertaId === alerta.id && (
                    <div className="mt-3 pt-3 border-t border-border/60">
                      <p className="text-xs text-muted-foreground mb-2">Escolher novo voluntário:</p>
                      <div className="grid grid-cols-2 gap-1.5">
                        {(voluntarios ?? [])
                          .filter(v => v.id !== alerta.contacts?.voluntario_atribuido_id)
                          .map(v => (
                            <button
                              key={v.id}
                              onClick={() => handleRedistribuir(
                                alerta.id,
                                alerta.contact_id,
                                v.id,
                                `Redistribuição por alerta ${tipo}`
                              )}
                              className="text-xs text-left px-2.5 py-1.5 rounded-lg border border-border hover:border-menta-dark/60 hover:bg-menta-dark/10 text-muted-foreground hover:text-offwhite transition-all"
                            >
                              {v.nome.split(' ')[0]}
                              {v.grupo && <span className="text-muted-foreground/50 ml-1">({getGrupoLabel(v.grupo)})</span>}
                            </button>
                          ))}
                      </div>
                      <button
                        onClick={() => setRedistribuindo(null)}
                        className="text-xs text-muted-foreground hover:text-foreground mt-2"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
