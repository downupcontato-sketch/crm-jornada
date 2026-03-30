import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Layout } from '@/components/layout/Layout'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

export default function DashboardCoordenador() {
  const { profile } = useAuth()
  const grupo = profile?.grupo ?? null

  // Contatos do grupo
  const { data: contacts = [], isLoading: loadingContacts } = useQuery({
    queryKey: ['coordenador-contacts', grupo],
    queryFn: async () => {
      if (!grupo) return []
      const { data, error } = await supabase
        .from('contacts')
        .select('id,status,sla_status,voluntario_atribuido_id,fase_pipeline')
        .eq('grupo', grupo)
        .eq('status', 'ativo')
      if (error) throw error
      return data ?? []
    },
    enabled: !!grupo,
    refetchInterval: 60000,
  })

  // Voluntários do grupo
  const { data: voluntarios = [], isLoading: loadingVoluntarios } = useQuery({
    queryKey: ['coordenador-voluntarios', grupo],
    queryFn: async () => {
      if (!grupo) return []
      const { data, error } = await supabase
        .from('profiles')
        .select('id,nome,max_contatos_ativos,ativo')
        .eq('grupo', grupo)
        .eq('nivel', 'voluntario')
        .eq('ativo', true)
      if (error) throw error
      return data ?? []
    },
    enabled: !!grupo,
    refetchInterval: 60000,
  })

  // Pendentes de linha_de_frente no grupo
  const { data: pendentesLdf = [] } = useQuery({
    queryKey: ['coordenador-pendentes-ldf', grupo],
    queryFn: async () => {
      if (!grupo) return []
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('grupo', grupo)
        .eq('nivel', 'linha_de_frente')
        .eq('status', 'pendente')
      if (error) throw error
      return data ?? []
    },
    enabled: !!grupo,
    refetchInterval: 60000,
  })

  const isLoading = loadingContacts || loadingVoluntarios

  const totalAtivos = contacts.length
  const slaVencidos = contacts.filter(c => c.sla_status === 'vencido').length
  const slaAtencao = contacts.filter(c => c.sla_status === 'atencao').length

  // Montar dados de voluntários com contagem de contatos atribuídos
  const voluntariosComDados = voluntarios.map(v => {
    const atribuidos = contacts.filter(c => c.voluntario_atribuido_id === v.id)
    const temVencidos = atribuidos.some(c => c.sla_status === 'vencido')
    return {
      ...v,
      contatosAtivos: atribuidos.length,
      temVencidos,
    }
  })

  if (isLoading) {
    return (
      <Layout title="Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-2 border-menta-light border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Dashboard">
      {/* Banner pendentes linha de frente */}
      {pendentesLdf.length > 0 && (
        <div className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-3 mb-5 text-sm text-yellow-400">
          <AlertTriangle size={16} className="flex-shrink-0" />
          <span>
            <strong>{pendentesLdf.length}</strong> membro{pendentesLdf.length > 1 ? 's' : ''} da Linha de Frente aguardando aprovação.{' '}
            <Link to="/usuarios" className="underline hover:text-yellow-300 transition-colors">
              Gerenciar usuários
            </Link>
          </span>
        </div>
      )}

      {/* SLA alerts */}
      {(slaVencidos > 0 || slaAtencao > 0) && (
        <div className="flex flex-wrap gap-2 mb-5">
          {slaVencidos > 0 && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-sm text-red-400">
              <AlertTriangle size={15} />
              <span><strong>{slaVencidos}</strong> SLA vencido{slaVencidos > 1 ? 's' : ''}</span>
            </div>
          )}
          {slaAtencao > 0 && (
            <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 text-sm text-yellow-400">
              <AlertTriangle size={15} />
              <span><strong>{slaAtencao}</strong> em atenção</span>
            </div>
          )}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <MetricCard
          label="Ativos no Grupo"
          value={totalAtivos}
          sub="contatos em acompanhamento"
          valueColor="text-menta-light"
        />
        <MetricCard
          label="SLA Vencido"
          value={slaVencidos}
          sub="precisam de atenção imediata"
          valueColor={slaVencidos > 0 ? 'text-red-400' : 'text-offwhite'}
        />
        <MetricCard
          label="SLA Atenção"
          value={slaAtencao}
          sub="prazo se esgotando"
          valueColor={slaAtencao > 0 ? 'text-yellow-400' : 'text-offwhite'}
        />
      </div>

      {/* Volunteers table */}
      <div className="zion-card">
        <div className="flex items-center gap-2 mb-4">
          <Users size={18} className="text-menta-light" />
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Voluntários do Grupo
          </h2>
        </div>

        {voluntariosComDados.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-8">
            Nenhum voluntário ativo neste grupo.
          </p>
        ) : (
          <div className="space-y-3">
            {voluntariosComDados.map(v => {
              const max = v.max_contatos_ativos ?? 7
              const slots = Math.max(max, 7)
              return (
                <div key={v.id} className="flex items-center gap-4 py-2 border-b border-border last:border-0">
                  {/* Name */}
                  <div className="w-36 flex-shrink-0">
                    <p className="text-sm font-medium text-offwhite truncate">{v.nome}</p>
                  </div>

                  {/* Slot circles */}
                  <div className="flex items-center gap-1.5 flex-1">
                    {Array.from({ length: slots }).map((_, i) => (
                      <div
                        key={i}
                        className={cn(
                          'w-5 h-5 rounded-full border-2 transition-colors',
                          i < v.contatosAtivos
                            ? 'bg-menta-light border-menta-light'
                            : 'bg-transparent border-border'
                        )}
                      />
                    ))}
                  </div>

                  {/* Count + badge */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-sm text-muted-foreground">
                      <span className={cn('font-semibold', v.contatosAtivos >= max ? 'text-red-400' : 'text-offwhite')}>
                        {v.contatosAtivos}
                      </span>
                      /{max}
                    </span>
                    {v.temVencidos && (
                      <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">
                        SLA
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Layout>
  )
}

function MetricCard({
  label,
  value,
  sub,
  valueColor,
}: {
  label: string
  value: number
  sub?: string
  valueColor?: string
}) {
  return (
    <div className="zion-card">
      <p className="text-xs text-muted-foreground mb-3">{label}</p>
      <p className={cn('text-3xl font-bold mb-0.5', valueColor ?? 'text-offwhite')}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}
