import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, X, Phone } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useViewAs } from '@/contexts/ViewAsContext'
import { Layout } from '@/components/layout/Layout'
import { PainelAlertas } from '@/components/contacts/PainelAlertas'
import { redistribuirLead } from '@/lib/distribuicao'
import { DrawerLead } from '@/components/pipeline/DrawerLead'
import { toast } from 'sonner'
import { cn, getGrupoLabel } from '@/lib/utils'
import { FASE_LABELS, SUBETAPA_LABELS } from '@/lib/pipeline'
import type { FasePipeline, Contact } from '@/types/database'
import type { Profile } from '@/types/database'

// ─── helpers ─────────────────────────────────────────────────────────────────

const SLA_DOT: Record<string, string> = {
  vencido: 'bg-red-400 animate-pulse',
  atencao: 'bg-yellow-400',
  ok:      'bg-emerald-400',
}

function barCls(carga: number, max: number) {
  if (carga <= max)          return 'bg-emerald-400'
  if (carga <= max * 1.5)    return 'bg-yellow-400'
  return 'bg-red-400'
}

function barTextCls(carga: number, max: number) {
  if (carga <= max)          return 'text-emerald-400'
  if (carga <= max * 1.5)    return 'text-yellow-400'
  return 'text-red-400'
}

function barLegend(carga: number, max: number) {
  if (carga <= max)          return 'na meta'
  if (carga <= max * 1.5)    return 'acima da meta'
  return 'sobrecarregado'
}

function etapaLabel(c: any): string {
  const sub = c.subetapa_contato ?? c.subetapa_qualificacao ??
    c.subetapa_encaminhamento ?? c.subetapa_batismo ?? ''
  return SUBETAPA_LABELS[sub] || FASE_LABELS[c.fase_pipeline as FasePipeline] || c.fase_pipeline
}

// ─── LeadRow ─────────────────────────────────────────────────────────────────

function LeadRow({ contact: c, onOpen }: { contact: any; onOpen: (c: any) => void }) {
  const label = etapaLabel(c)
  return (
    <div className="flex items-center gap-1 py-1 border-b border-border/30 last:border-0 group">
      <button
        onClick={() => onOpen(c)}
        className="flex-1 flex items-center gap-2 text-xs text-left hover:bg-muted/30 rounded px-1 py-0.5 transition-all min-w-0"
      >
        <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', SLA_DOT[c.sla_status] ?? 'bg-muted-foreground')} />
        <span className="text-offwhite truncate flex-1">{c.nome}</span>
        <span className="text-muted-foreground text-[10px] whitespace-nowrap flex-shrink-0">{label}</span>
      </button>
      {c.telefone && (
        <a
          href={`https://wa.me/55${c.telefone.replace(/\D/g, '')}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="w-6 h-6 flex items-center justify-center rounded-full text-emerald-400/50 hover:text-emerald-400 hover:bg-emerald-400/10 transition-all flex-shrink-0 opacity-0 group-hover:opacity-100"
        >
          <Phone size={11} />
        </a>
      )}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function Equipe() {
  const { profile } = useAuth()
  const { setViewingAs } = useViewAs()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [redistribuindo, setRedistribuindo] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'equipe'|'alertas'>('alertas')
  const [drawerVol, setDrawerVol] = useState<{ nome: string; contatos: any[] } | null>(null)
  const [drawerContact, setDrawerContact] = useState<Contact | null>(null)
  const [modalAtribuir, setModalAtribuir] = useState<any | null>(null)

  const { data: voluntarios, isLoading } = useQuery({
    queryKey: ['equipe', profile?.grupo],
    queryFn: async () => {
      let q = supabase.from('profiles').select('*').eq('nivel','voluntario').eq('ativo',true)
      if (profile?.nivel==='coordenador' && profile?.grupo) q = q.eq('grupo',profile.grupo)
      const { data: vols } = await q
      const { data: contacts } = await supabase.from('contacts')
        .select('*')
        .eq('status','ativo')
        .eq('atribuido_por_coordenador',true)
        .in('fase_pipeline',['CONTATO_INICIAL','QUALIFICACAO','AULAS','POS_AULA'])
        .in('voluntario_atribuido_id',(vols??[]).map((v:any)=>v.id))
      return (vols??[]).map((v:any)=>({
        ...v as Profile,
        contatos: (contacts??[]).filter((c:any)=>c.voluntario_atribuido_id===v.id),
      }))
    },
    enabled: !!profile,
  })

  const { data: semVoluntario } = useQuery({
    queryKey: ['sem-voluntario'],
    queryFn: async () => {
      let q = supabase.from('contacts')
        .select('id,nome,grupo,tipo,sla_status,fase_pipeline,subetapa_contato,created_at')
        .eq('status','ativo').is('voluntario_atribuido_id',null)
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
    if (error) {
      toast.error('Erro ao atribuir.')
    } else {
      toast.success('Contato atribuído!')
      qc.invalidateQueries({queryKey:['equipe']})
      qc.invalidateQueries({queryKey:['sem-voluntario']})
      setModalAtribuir(null)
    }
    setRedistribuindo(null)
  }

  function openLead(c: any) {
    setDrawerVol(null)
    setDrawerContact(c as Contact)
  }

  return (
    <Layout title="Minha Equipe">
      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {([['alertas','Alertas'],['equipe','Equipe']] as const).map(([k,l])=>(
          <button key={k} onClick={()=>setActiveTab(k)}
            className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-all border',
              activeTab===k ? 'bg-menta-light/15 border-menta-light/40 text-menta-light' : 'border-border text-muted-foreground')}>
            {l}
          </button>
        ))}
      </div>

      {activeTab==='alertas' && <PainelAlertas />}

      {activeTab==='equipe' && (
        <>
          {/* ── Sem voluntário ── */}
          {!!semVoluntario?.length && (
            <div className="zion-card mb-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={16} className="text-yellow-400"/>
                <h2 className="text-sm font-semibold text-offwhite">{semVoluntario.length} sem voluntário</h2>
              </div>
              <div className="space-y-2">
                {semVoluntario.map((c:any)=>(
                  <div key={c.id} className="flex items-center justify-between gap-2 py-2 border-b border-border/50 last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm text-offwhite truncate">{c.nome}</p>
                      <p className="text-xs text-muted-foreground">{getGrupoLabel(c.grupo)}</p>
                    </div>
                    <button
                      onClick={() => setModalAtribuir(c)}
                      className="text-xs bg-menta-dark/30 hover:bg-menta-dark/50 text-menta-light px-3 py-1.5 rounded-md transition-all whitespace-nowrap flex-shrink-0"
                    >
                      Atribuir →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Cards de voluntários ── */}
          {isLoading
            ? <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-2 border-menta-light border-t-transparent rounded-full animate-spin"/></div>
            : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {voluntarios?.map((vol:any)=>{
                  const venc    = vol.contatos.filter((c:any)=>c.sla_status==='vencido').length
                  const atencao = vol.contatos.filter((c:any)=>c.sla_status==='atencao').length
                  const emDia   = vol.contatos.filter((c:any)=>c.sla_status==='ok').length
                  const carga   = vol.contatos.length
                  const max     = vol.max_contatos_ativos ?? 7
                  const pct     = Math.min(Math.round(carga / max * 100), 100)

                  return (
                    <div key={vol.id} className="zion-card">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="text-sm font-semibold text-offwhite">{vol.nome}</p>
                          <p className="text-xs text-muted-foreground">{vol.email}</p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {venc>0 && (
                            <span className="text-xs bg-red-400/10 text-red-400 border border-red-400/20 px-2 py-0.5 rounded-full">
                              {venc} vencido{venc>1?'s':''}
                            </span>
                          )}
                          <button
                            onClick={() => { setViewingAs({ id: vol.id, nome: vol.nome }); navigate('/meus-contatos') }}
                            className="text-[10px] text-muted-foreground/60 hover:text-menta-light border border-border hover:border-menta-light/40 px-1.5 py-0.5 rounded transition-all"
                            title="Ver como este voluntário"
                          >
                            Ver como
                          </button>
                        </div>
                      </div>

                      {/* Barra semântica */}
                      <div className="mb-3">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Carga</span>
                          <div className="flex items-center gap-1.5">
                            <span className={cn('font-medium', barTextCls(carga, max))}>{carga}/{max}</span>
                            <span className={cn('text-[10px]', barTextCls(carga, max))}>{barLegend(carga, max)}</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={cn('h-full rounded-full transition-all', barCls(carga, max))} style={{width:`${pct}%`}}/>
                        </div>
                      </div>

                      {/* Resumo SLA */}
                      {carga > 0 && (
                        <div className="flex gap-1.5 mb-3">
                          {venc>0    && <span className="text-[10px] text-red-400 bg-red-400/10 border border-red-400/20 px-2 py-0.5 rounded-full">{venc} venc.</span>}
                          {atencao>0 && <span className="text-[10px] text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 px-2 py-0.5 rounded-full">{atencao} aten.</span>}
                          {emDia>0   && <span className="text-[10px] text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full">{emDia} ok</span>}
                        </div>
                      )}

                      {/* Lead rows clicáveis */}
                      {[...vol.contatos]
                        .sort((a:any,b:any)=>{
                          const o={vencido:0,atencao:1,ok:2}
                          return (o[a.sla_status as keyof typeof o]??3)-(o[b.sla_status as keyof typeof o]??3)
                        })
                        .slice(0,5)
                        .map((c:any)=>(
                          <LeadRow key={c.id} contact={c} onOpen={openLead} />
                        ))}

                      {vol.contatos.length > 5 && (
                        <button
                          onClick={() => setDrawerVol({ nome: vol.nome, contatos: vol.contatos })}
                          className="text-xs text-menta-light hover:underline pt-1 text-left"
                        >
                          +{vol.contatos.length-5} outros — ver todos
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          }
        </>
      )}

      {/* ── Drawer: lista completa do voluntário ── */}
      {drawerVol && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setDrawerVol(null)} />
          <div className="fixed right-0 top-0 h-full w-full sm:w-[400px] z-50 bg-card border-l border-border flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h2 className="text-base font-semibold text-offwhite">{drawerVol.nome}</h2>
                <p className="text-xs text-muted-foreground">{drawerVol.contatos.length} contatos atribuídos</p>
              </div>
              <button onClick={() => setDrawerVol(null)} className="text-muted-foreground hover:text-foreground">
                <X size={20}/>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3">
              {[...drawerVol.contatos]
                .sort((a,b)=>{
                  const o={vencido:0,atencao:1,ok:2}
                  return (o[a.sla_status as keyof typeof o]??3)-(o[b.sla_status as keyof typeof o]??3)
                })
                .map((c:any)=>(
                  <LeadRow key={c.id} contact={c} onOpen={openLead} />
                ))}
            </div>
          </div>
        </>
      )}

      {/* ── Modal: atribuir voluntário ── */}
      {modalAtribuir && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setModalAtribuir(null)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[420px] z-50 bg-card border border-border rounded-xl flex flex-col max-h-[75vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
              <div>
                <h2 className="text-sm font-semibold text-offwhite">Atribuir voluntário</h2>
                <p className="text-xs text-muted-foreground truncate max-w-[280px]">{modalAtribuir.nome}</p>
              </div>
              <button onClick={() => setModalAtribuir(null)} className="text-muted-foreground hover:text-foreground">
                <X size={18}/>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {(voluntarios ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum voluntário disponível.</p>
              )}
              {(voluntarios ?? []).map((v:any)=>{
                const carga = v.contatos.length
                const max   = v.max_contatos_ativos ?? 7
                const cheio = carga >= max
                return (
                  <button
                    key={v.id}
                    onClick={() => !cheio && atribuir(modalAtribuir.id, v.id)}
                    disabled={redistribuindo === modalAtribuir.id || cheio}
                    className={cn(
                      'w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border transition-all text-left',
                      cheio
                        ? 'border-border/40 opacity-40 cursor-not-allowed'
                        : 'border-border hover:border-menta-light/40 hover:bg-menta-light/5 cursor-pointer',
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-offwhite truncate">{v.nome}</p>
                      <p className={cn('text-xs', barTextCls(carga, max))}>
                        {carga}/{max} — {barLegend(carga, max)}
                      </p>
                    </div>
                    <div className="w-16 flex-shrink-0">
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full', barCls(carga, max))} style={{width:`${Math.min(carga/max*100,100)}%`}}/>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* ── DrawerLead: detalhe do lead ── */}
      {drawerContact && (
        <DrawerLead
          contact={drawerContact}
          onClose={() => setDrawerContact(null)}
          onUpdated={upd => {
            setDrawerContact(c => c ? { ...c, ...upd } : null)
            qc.invalidateQueries({ queryKey: ['equipe'] })
          }}
        />
      )}
    </Layout>
  )
}
