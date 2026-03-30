import { useQuery } from '@tanstack/react-query'
import { Users, TrendingUp, Clock, Award, AlertTriangle, Activity } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Layout } from '@/components/layout/Layout'
import { cn, getGrupoLabel } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { ContactGrupo } from '@/types/database'

const GRUPOS: ContactGrupo[] = ['rise', 'flow', 'vox', 'ek', 'zion_geral']
const FUNNEL_COLORS = ['#00B0A8','#1C7D75','#004F4A','#3B82F6','#8B5CF6','#EC4899','#10B981']

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const { data: all } = await supabase.from('contacts').select('id,tipo,grupo,status,sla_status,etapa_atual,data_distribuicao,data_primeiro_contato,created_at,updated_at')
      const contacts = all ?? []
      const ativos = contacts.filter(c => c.status === 'ativo')
      const batizados = contacts.filter(c => c.status === 'batizado')
      const vencidos = contacts.filter(c => c.sla_status === 'vencido')
      const atencao = contacts.filter(c => c.sla_status === 'atencao')
      const comDist = contacts.filter(c => c.data_distribuicao && c.data_primeiro_contato)
      const slaOk = comDist.filter(c => new Date(c.data_primeiro_contato!).getTime() - new Date(c.data_distribuicao!).getTime() <= 48*3600000)
      const slaPercent = comDist.length > 0 ? Math.round(slaOk.length/comDist.length*100) : 0
      const funnelData = [
        { name: 'Entrada', value: contacts.length },
        { name: 'Contatado', value: contacts.filter(c => c.data_primeiro_contato).length },
        { name: 'Qualificado', value: contacts.filter(c => c.etapa_atual >= 15).length },
        { name: 'Inscrito', value: contacts.filter(c => c.etapa_atual >= 21).length },
        { name: 'Frequentou', value: contacts.filter(c => c.etapa_atual >= 28).length },
        { name: 'Encaminhado', value: contacts.filter(c => c.etapa_atual >= 31).length },
        { name: 'Batizado', value: batizados.length },
      ]
      const byGrupo = GRUPOS.map(g => ({ grupo: getGrupoLabel(g), ativos: ativos.filter(c=>c.grupo===g).length, total: contacts.filter(c=>c.grupo===g).length }))
      return { total: contacts.length, ativos: ativos.length, batizados: batizados.length, semResposta: contacts.filter(c=>c.status==='sem_resposta').length, vencidos: vencidos.length, atencao: atencao.length, slaPercent, funnelData, byGrupo, taxaConversao: contacts.length > 0 ? (batizados.length/contacts.length*100).toFixed(1) : '0' }
    },
    refetchInterval: 60000,
  })

  if (isLoading || !stats) return <Layout title="Dashboard"><div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-menta-light border-t-transparent rounded-full animate-spin" /></div></Layout>

  return (
    <Layout title="Dashboard">
      {(stats.vencidos > 0 || stats.atencao > 0) && (
        <div className="flex flex-wrap gap-2 mb-5">
          {stats.vencidos > 0 && <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-sm text-red-400"><AlertTriangle size={15}/><span><strong>{stats.vencidos}</strong> SLA vencido{stats.vencidos>1?'s':''}</span></div>}
          {stats.atencao > 0 && <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 text-sm text-yellow-400"><AlertTriangle size={15}/><span><strong>{stats.atencao}</strong> em atenção</span></div>}
        </div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <MetricCard icon={<Users size={20} className="text-menta-light"/>} label="Total de Entradas" value={stats.total} sub="histórico completo" />
        <MetricCard icon={<Clock size={20} className="text-yellow-400"/>} label="SLA 48h" value={`${stats.slaPercent}%`} sub="contatados no prazo" valueColor={stats.slaPercent>=80?'text-emerald-400':stats.slaPercent>=60?'text-yellow-400':'text-red-400'} />
        <MetricCard icon={<Activity size={20} className="text-blue-400"/>} label="Em Acompanhamento" value={stats.ativos} sub="contatos ativos" />
        <MetricCard icon={<Award size={20} className="text-menta-light"/>} label="Batizados" value={stats.batizados} sub={`${stats.taxaConversao}% conversão`} valueColor="text-menta-light" />
      </div>
      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <div className="zion-card">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Funil de Conversão</h2>
          <div className="space-y-2">
            {stats.funnelData.map((item, i) => {
              const pct = Math.round(item.value/(stats.funnelData[0].value||1)*100)
              return (
                <div key={item.name}>
                  <div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">{item.name}</span><span className="text-offwhite font-medium">{item.value}</span></div>
                  <div className="h-5 bg-muted rounded-md overflow-hidden">
                    <div className="h-full rounded-md transition-all duration-500" style={{width:`${pct}%`,backgroundColor:FUNNEL_COLORS[i]}}/>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <div className="zion-card">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Por Grupo</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats.byGrupo} margin={{top:0,right:0,left:-20,bottom:0}}>
              <XAxis dataKey="grupo" tick={{fill:'#94A3B8',fontSize:11}}/>
              <YAxis tick={{fill:'#94A3B8',fontSize:11}}/>
              <Tooltip contentStyle={{background:'#0D2B35',border:'1px solid #1C3D4A',borderRadius:8}} labelStyle={{color:'#FFFCF2'}} itemStyle={{color:'#00B0A8'}}/>
              <Bar dataKey="ativos" fill="#00B0A8" radius={[4,4,0,0]} name="Ativos"/>
              <Bar dataKey="total" fill="#1C7D75" radius={[4,4,0,0]} name="Total"/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[{l:'Ativos',v:stats.ativos,c:'text-emerald-400 bg-emerald-400/10'},{l:'Sem Resposta',v:stats.semResposta,c:'text-red-400 bg-red-400/10'},{l:'SLA Vencido',v:stats.vencidos,c:'text-red-400 bg-red-400/10'},{l:'Batizados',v:stats.batizados,c:'text-menta-light bg-menta-light/10'}].map(s=>(
          <div key={s.l} className="zion-card flex items-center gap-3">
            <div className={cn('w-2 h-8 rounded-full flex-shrink-0',s.c.split(' ')[1])}/>
            <div><p className={cn('text-xl font-bold',s.c.split(' ')[0])}>{s.v}</p><p className="text-xs text-muted-foreground">{s.l}</p></div>
          </div>
        ))}
      </div>
    </Layout>
  )
}

function MetricCard({icon,label,value,sub,valueColor}:{icon:React.ReactNode;label:string;value:string|number;sub?:string;valueColor?:string}) {
  return (
    <div className="zion-card">
      <div className="flex items-center gap-2 mb-3">{icon}<p className="text-xs text-muted-foreground">{label}</p></div>
      <p className={cn('text-3xl font-bold text-offwhite mb-0.5',valueColor)}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}
