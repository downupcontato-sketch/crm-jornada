import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ArrowLeft, Phone, MessageSquare, Clock, User, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Layout } from '@/components/layout/Layout'
import { InteractionModal } from '@/components/contacts/InteractionModal'
import { BadgeSLA } from '@/components/contacts/BadgeSLA'
import { cn, formatRelativeTime, getGrupoLabel, getTipoLabel, getTipoBadgeColor, getStatusColor, formatPhone } from '@/lib/utils'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Contact, Interaction, PipelineStage } from '@/types/database'

export default function ContatoDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)

  const { data: contact, isLoading } = useQuery({
    queryKey: ['contact', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('contacts').select('*').eq('id',id!).single()
      if (error) throw error
      return data as Contact
    },
    enabled: !!id,
  })

  const { data: interactions } = useQuery({
    queryKey: ['interactions', id],
    queryFn: async () => {
      const { data } = await supabase.from('interactions').select('*,profiles!interactions_voluntario_id_fkey(id,nome)').eq('contact_id',id!).order('data_interacao',{ascending:false})
      return data as (Interaction & { profiles: { id:string;nome:string } })[]
    },
    enabled: !!id,
  })

  const { data: stages } = useQuery({
    queryKey: ['pipeline_stages'],
    queryFn: async () => { const { data } = await supabase.from('pipeline_stages').select('*').order('ordem'); return data as PipelineStage[] },
  })

  const contactStage = stages?.find(s => s.ordem === contact?.etapa_atual) ?? null

  if (isLoading) return <Layout><div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-menta-light border-t-transparent rounded-full animate-spin"/></div></Layout>
  if (!contact) return <Layout><p className="text-muted-foreground">Contato não encontrado.</p></Layout>

  const tipoLabel: Record<string,string> = { whatsapp:'WhatsApp', ligacao:'Ligação', presencial:'Presencial', zoom:'Zoom' }
  const resultadoLabel: Record<string,string> = { respondeu:'Respondeu', nao_atendeu:'Não atendeu', sem_resposta:'Sem resposta', avancou:'Avançou', recusou:'Recusou' }
  const resultadoColor: Record<string,string> = { respondeu:'text-emerald-400', nao_atendeu:'text-yellow-400', sem_resposta:'text-red-400', avancou:'text-menta-light', recusou:'text-red-400' }

  return (
    <Layout>
      <div className="flex items-center gap-3 mb-5">
        <button onClick={()=>navigate(-1)} className="text-muted-foreground hover:text-foreground"><ArrowLeft size={20}/></button>
        <h1 className="text-lg font-semibold text-offwhite truncate">{contact.nome}</h1>
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 space-y-4">
          <div className="zion-card">
            <div className="flex flex-wrap gap-2 mb-3">
              <span className={cn('text-xs px-2 py-1 rounded-full font-medium',getTipoBadgeColor(contact.tipo))}>{getTipoLabel(contact.tipo)}</span>
              <span className={cn('text-xs px-2 py-1 rounded-full font-medium',getStatusColor(contact.status))}>{contact.status}</span>
              <BadgeSLA dataDistribuicao={contact.data_distribuicao} dataPrimeiroContato={contact.data_primeiro_contato} />
            </div>
            <div className="bg-menta-dark/20 border border-menta-dark/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-0.5">Etapa atual</p>
              <p className="text-sm font-semibold text-menta-light">{contact.etapa_atual}. {contactStage?.nome}</p>
              <p className="text-xs text-muted-foreground">{contactStage?.fase}</p>
            </div>
          </div>
          <div className="zion-card space-y-3">
            <InfoRow icon={<Phone size={14}/>} label="Telefone" value={formatPhone(contact.telefone)}/>
            <InfoRow icon={<User size={14}/>} label="Grupo" value={getGrupoLabel(contact.grupo)}/>
            {contact.sexo && <InfoRow icon={<User size={14}/>} label="Sexo" value={contact.sexo}/>}
            {contact.idade && <InfoRow icon={<User size={14}/>} label="Idade" value={`${contact.idade} anos`}/>}
            {contact.igreja_origem && <InfoRow icon={<User size={14}/>} label="Igreja Origem" value={contact.igreja_origem}/>}
            <InfoRow icon={<Clock size={14}/>} label="Cadastrado" value={formatRelativeTime(contact.created_at)}/>
            <InfoRow icon={<MessageSquare size={14}/>} label="Tentativas" value={`${contact.tentativas_contato}x`}/>
            {contact.posicao_fila != null && <InfoRow icon={<Clock size={14}/>} label="Posição na Fila" value={`#${contact.posicao_fila}`}/>}
          </div>
          <div className="flex gap-2">
            <a
              href={`https://wa.me/55${contact.telefone.replace(/\D/g,'')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 text-sm font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-400/10 hover:bg-emerald-400/20 border border-emerald-400/30 px-4 py-2.5 rounded-lg transition-all"
            >
              <Phone size={15}/>WhatsApp
            </a>
            <button onClick={()=>setShowModal(true)} className="flex-1 zion-btn-primary flex items-center justify-center gap-2">
              <MessageSquare size={15}/>Registrar
            </button>
          </div>
        </div>
        <div className="lg:col-span-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Histórico de Interações</h2>
          {!interactions?.length ? (
            <div className="zion-card text-center py-10 text-muted-foreground text-sm">Nenhuma interação registrada ainda.</div>
          ) : (
            <div className="space-y-3">
              {interactions.map(i=>(
                <div key={i.id} className="zion-card">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{tipoLabel[i.tipo]}</span>
                      <span className={cn('text-xs font-medium',resultadoColor[i.resultado])}>{resultadoLabel[i.resultado]}</span>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">{format(new Date(i.data_interacao),'dd/MM HH:mm',{locale:ptBR})}</span>
                  </div>
                  {i.observacao && <p className="text-sm text-muted-foreground mt-1">{i.observacao}</p>}
                  {i.etapa_depois && i.etapa_depois!==i.etapa_antes && <div className="flex items-center gap-1 text-xs text-menta-light mt-1.5"><ChevronRight size={12}/><span>Avançou para etapa {i.etapa_depois}</span></div>}
                  <p className="text-xs text-muted-foreground/60 mt-1">por {i.profiles?.nome}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {showModal && stages && <InteractionModal contact={contact} stages={stages} onClose={()=>setShowModal(false)} onSuccess={()=>{setShowModal(false);qc.invalidateQueries({queryKey:['contact',id]});qc.invalidateQueries({queryKey:['interactions',id]})}}/>}
    </Layout>
  )
}

function InfoRow({icon,label,value}:{icon:React.ReactNode;label:string;value:string}) {
  return <div className="flex items-start gap-2"><span className="text-muted-foreground mt-0.5">{icon}</span><div><p className="text-xs text-muted-foreground">{label}</p><p className="text-sm text-offwhite">{value}</p></div></div>
}
