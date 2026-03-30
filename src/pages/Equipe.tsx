import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Layout } from '@/components/layout/Layout'
import { PainelAlertas } from '@/components/contacts/PainelAlertas'
import { redistribuirLead } from '@/lib/distribuicao'
import { toast } from 'sonner'
import { cn, getGrupoLabel } from '@/lib/utils'
import type { Profile } from '@/types/database'

export default function Equipe() {
  const { profile } = useAuth()
  const qc = useQueryClient()
  const [redistribuindo, setRedistribuindo] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'equipe'|'alertas'>('alertas')

  const { data: voluntarios, isLoading } = useQuery({
    queryKey: ['equipe', profile?.grupo],
    queryFn: async () => {
      let q = supabase.from('profiles').select('*').eq('nivel','voluntario').eq('ativo',true)
      if (profile?.nivel==='coordenador' && profile?.grupo) q = q.eq('grupo',profile.grupo)
      const { data: vols } = await q
      const { data: contacts } = await supabase.from('contacts').select('id,nome,voluntario_atribuido_id,sla_status,status,etapa_atual').eq('status','ativo').in('voluntario_atribuido_id',(vols??[]).map((v:any)=>v.id))
      return (vols??[]).map((v:any)=>({ ...v as Profile, contatos:(contacts??[]).filter((c:any)=>c.voluntario_atribuido_id===v.id) }))
    },
    enabled: !!profile,
  })

  const { data: semVoluntario } = useQuery({
    queryKey: ['sem-voluntario'],
    queryFn: async () => {
      let q = supabase.from('contacts').select('id,nome,grupo,tipo,sla_status,etapa_atual,created_at').eq('status','ativo').is('voluntario_atribuido_id',null)
      if (profile?.nivel==='coordenador' && profile?.grupo) q = q.eq('grupo',profile.grupo)
      const { data } = await q
      return data
    },
    enabled: !!profile,
  })

  async function atribuir(contactId: string, voluntarioId: string) {
    if (!profile) return
    setRedistribuindo(contactId)
    const { error } = await redistribuirLead(contactId, voluntarioId, 'Atribuição manual pelo coordenador', profile.id)
    if (error) toast.error('Erro ao atribuir.')
    else { toast.success('Contato atribuído!'); qc.invalidateQueries({queryKey:['equipe']}); qc.invalidateQueries({queryKey:['sem-voluntario']}) }
    setRedistribuindo(null)
  }

  return (
    <Layout title="Minha Equipe">
      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {([['alertas','Alertas'],['equipe','Equipe']] as const).map(([k,l])=>(
          <button key={k} onClick={()=>setActiveTab(k)} className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-all border', activeTab===k?'bg-menta-light/15 border-menta-light/40 text-menta-light':'border-border text-muted-foreground')}>
            {l}
          </button>
        ))}
      </div>

      {activeTab==='alertas' && <PainelAlertas />}

      {activeTab==='equipe' && (
        <>
          {!!semVoluntario?.length && (
            <div className="zion-card mb-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={16} className="text-yellow-400"/>
                <h2 className="text-sm font-semibold text-offwhite">{semVoluntario.length} sem voluntário</h2>
              </div>
              <div className="space-y-2">
                {semVoluntario.map((c:any)=>(
                  <div key={c.id} className="flex items-center justify-between gap-2 py-2 border-b border-border/50 last:border-0">
                    <div><p className="text-sm text-offwhite">{c.nome}</p><p className="text-xs text-muted-foreground">{getGrupoLabel(c.grupo)}</p></div>
                    <div className="flex gap-1">
                      {(voluntarios??[]).filter((v:any)=>v.contatos.length<v.max_contatos_ativos).slice(0,3).map((v:any)=>(
                        <button key={v.id} onClick={()=>atribuir(c.id,v.id)} disabled={redistribuindo===c.id} className="text-xs bg-menta-dark/30 hover:bg-menta-dark/50 text-menta-light px-2 py-1 rounded-md transition-all">
                          {v.nome.split(' ')[0]}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isLoading ? <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-2 border-menta-light border-t-transparent rounded-full animate-spin"/></div>
            : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {voluntarios?.map((vol:any)=>{
                  const venc = vol.contatos.filter((c:any)=>c.sla_status==='vencido').length
                  const carga = vol.contatos.length
                  const pct = Math.round(carga/vol.max_contatos_ativos*100)
                  return (
                    <div key={vol.id} className="zion-card">
                      <div className="flex items-start justify-between mb-3">
                        <div><p className="text-sm font-semibold text-offwhite">{vol.nome}</p><p className="text-xs text-muted-foreground">{vol.email}</p></div>
                        {venc>0 && <span className="text-xs bg-red-400/10 text-red-400 border border-red-400/20 px-2 py-0.5 rounded-full">{venc} vencido{venc>1?'s':''}</span>}
                      </div>
                      <div className="mb-3">
                        <div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">Carga</span><span className={cn('font-medium',carga>=vol.max_contatos_ativos?'text-red-400':'text-offwhite')}>{carga}/{vol.max_contatos_ativos}</span></div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={cn('h-full rounded-full',carga>=vol.max_contatos_ativos?'bg-red-400':'bg-menta-light')} style={{width:`${Math.min(pct,100)}%`}}/>
                        </div>
                      </div>
                      {vol.contatos.slice(0,5).map((c:any)=>(
                        <div key={c.id} className="flex items-center justify-between text-xs py-1 border-b border-border/30 last:border-0">
                          <span className="text-muted-foreground truncate max-w-[140px]">{c.nome}</span>
                          <div className="flex items-center gap-1.5">
                            {c.sla_status==='vencido'&&<span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"/>}
                            {c.sla_status==='atencao'&&<span className="w-1.5 h-1.5 rounded-full bg-yellow-400"/>}
                            <span className="text-muted-foreground">Et. {c.etapa_atual}</span>
                          </div>
                        </div>
                      ))}
                      {vol.contatos.length>5&&<p className="text-xs text-muted-foreground pt-1">+{vol.contatos.length-5} outros</p>}
                    </div>
                  )
                })}
              </div>
            )}
        </>
      )}
    </Layout>
  )
}
