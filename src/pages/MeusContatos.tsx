import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Layout } from '@/components/layout/Layout'
import { ContactCard } from '@/components/contacts/ContactCard'
import { BadgeSLA } from '@/components/contacts/BadgeSLA'
import { cn } from '@/lib/utils'
import type { Contact } from '@/types/database'

type Filter = 'todos'|'ativos'|'sla_vencido'|'sem_resposta'

export default function MeusContatos() {
  const { profile } = useAuth()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('ativos')

  const { data: contacts, isLoading } = useQuery({
    queryKey: ['meus-contatos', profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('contacts').select('*').eq('voluntario_atribuido_id',profile!.id).order('updated_at',{ascending:true})
      if (error) throw error
      return data as Contact[]
    },
    enabled: !!profile?.id,
  })

  const filtered = contacts?.filter(c=>{
    const ms = !search || c.nome.toLowerCase().includes(search.toLowerCase()) || c.telefone.includes(search)
    const mf = filter==='ativos'?c.status==='ativo':filter==='sla_vencido'?c.sla_status==='vencido':filter==='sem_resposta'?c.status==='sem_resposta':true
    return ms && mf
  })

  const vencidos = contacts?.filter(c=>c.sla_status==='vencido').length??0
  const ativos = contacts?.filter(c=>c.status==='ativo').length??0
  const max = profile?.max_contatos_ativos??7

  return (
    <Layout title="Meus Contatos">
      <div className="zion-card mb-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-muted-foreground">Capacidade</p>
          <p className="text-sm font-semibold text-offwhite">{ativos} / {max}</p>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className={cn('h-full rounded-full transition-all',ativos>=max?'bg-red-400':'bg-menta-light')} style={{width:`${Math.min(ativos/max*100,100)}%`}}/>
        </div>
        {ativos>=max && <p className="text-xs text-red-400 mt-1">Capacidade máxima atingida</p>}
      </div>

      {vencidos>0 && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5 mb-4 text-sm text-red-400">
          <BadgeSLA dataDistribuicao={null} dataPrimeiroContato={null} />
          <span><strong>{vencidos}</strong> contato{vencidos>1?'s':''} com SLA vencido — contate agora!</span>
        </div>
      )}

      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
        <input type="search" placeholder="Buscar por nome ou telefone..." className="zion-input pl-9" value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {(['todos','ativos','sla_vencido','sem_resposta'] as const).map(opt=>(
          <button key={opt} onClick={()=>setFilter(opt)} className={cn('flex-shrink-0 text-xs px-3 py-1.5 rounded-lg border transition-all font-medium', filter===opt?'bg-menta-light/15 border-menta-light/40 text-menta-light':'border-border text-muted-foreground')}>
            {{todos:'Todos',ativos:'Ativos',sla_vencido:'SLA Vencido',sem_resposta:'Sem Resposta'}[opt]}
          </button>
        ))}
      </div>

      {isLoading ? <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-2 border-menta-light border-t-transparent rounded-full animate-spin"/></div>
        : !filtered?.length ? <div className="text-center py-16 text-muted-foreground text-sm">Nenhum contato encontrado.</div>
        : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{filtered.map(c=><ContactCard key={c.id} contact={c}/>)}</div>}
    </Layout>
  )
}
