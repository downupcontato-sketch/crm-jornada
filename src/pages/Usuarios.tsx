import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { UserPlus, X, Pencil, Power } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Layout } from '@/components/layout/Layout'
import { toast } from 'sonner'
import { cn, getGrupoLabel, nivelLabel } from '@/lib/utils'
import type { Profile, UserNivel, ContactGrupo } from '@/types/database'

const schema = z.object({
  email: z.string().email().optional().or(z.literal('')),
  nome: z.string().min(2),
  nivel: z.enum(['admin','lider','coordenador','voluntario','linha_de_frente'] as const),
  grupo: z.enum(['rise','flow','vox','ek','zion_geral'] as const).optional(),
  telefone: z.string().optional(),
  max_contatos_ativos: z.coerce.number().min(1).max(20).default(7),
  password: z.string().min(6).optional(),
})
type F = z.infer<typeof schema>

const nivelColors: Record<UserNivel,string> = {
  admin:'text-red-400 bg-red-400/10 border-red-400/20', lider:'text-purple-400 bg-purple-400/10 border-purple-400/20',
  coordenador:'text-yellow-400 bg-yellow-400/10 border-yellow-400/20', voluntario:'text-menta-light bg-menta-light/10 border-menta-light/20',
  linha_de_frente:'text-blue-400 bg-blue-400/10 border-blue-400/20',
}

export default function Usuarios() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editUser, setEditUser] = useState<Profile|null>(null)

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => { const { data } = await supabase.from('profiles').select('*').order('nivel').order('nome'); return data as Profile[] },
  })

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<F>({
    resolver: zodResolver(schema), defaultValues: { max_contatos_ativos:7, nivel:'voluntario' }
  })

  function openCreate() { setEditUser(null); reset({max_contatos_ativos:7,nivel:'voluntario'}); setShowModal(true) }
  function openEdit(u: Profile) { setEditUser(u); reset({nome:u.nome,email:u.email,nivel:u.nivel,grupo:u.grupo??undefined,telefone:u.telefone??undefined,max_contatos_ativos:u.max_contatos_ativos}); setShowModal(true) }

  async function toggleActive(u: Profile) {
    const { error } = await supabase.from('profiles').update({ativo:!u.ativo}).eq('id',u.id)
    if (error) toast.error('Erro.'); else { toast.success(u.ativo?'Desativado.':'Ativado.'); qc.invalidateQueries({queryKey:['users']}) }
  }

  async function onSubmit(data: F) {
    try {
      if (editUser) {
        await supabase.from('profiles').update({nome:data.nome,nivel:data.nivel as UserNivel,grupo:(data.grupo as ContactGrupo)??null,telefone:data.telefone??null,max_contatos_ativos:data.max_contatos_ativos}).eq('id',editUser.id)
        toast.success('Atualizado!')
      } else {
        const { data: authData, error } = await supabase.auth.signUp({ email:data.email!, password:data.password??'Jornada@2026', options:{data:{nome:data.nome}} })
        if (error) throw error
        if (authData.user) {
          await supabase.from('profiles').update({nome:data.nome,nivel:data.nivel as UserNivel,grupo:(data.grupo as ContactGrupo)??null,telefone:data.telefone??null,max_contatos_ativos:data.max_contatos_ativos}).eq('id',authData.user.id)
        }
        toast.success('Criado! Email de confirmação enviado.')
      }
      setShowModal(false); qc.invalidateQueries({queryKey:['users']})
    } catch (err:any) { toast.error(err?.message??'Erro.') }
  }

  return (
    <Layout title="Gerenciar Usuários">
      <div className="flex justify-end mb-4">
        <button onClick={openCreate} className="zion-btn-primary flex items-center gap-2 text-sm"><UserPlus size={16}/>Novo Usuário</button>
      </div>
      {isLoading ? <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-2 border-menta-light border-t-transparent rounded-full animate-spin"/></div>
        : (
          <div className="space-y-2">
            {users?.map(u=>(
              <div key={u.id} className={cn('zion-card flex items-center gap-3',!u.ativo&&'opacity-50')}>
                <div className="w-9 h-9 rounded-full bg-menta-dark flex items-center justify-center flex-shrink-0"><span className="text-xs font-semibold text-menta-light">{u.nome.charAt(0).toUpperCase()}</span></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-offwhite">{u.nome}</p>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full border',nivelColors[u.nivel])}>{nivelLabel(u.nivel)}</span>
                    {!u.ativo&&<span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Inativo</span>}
                  </div>
                  <p className="text-xs text-muted-foreground">{u.email}{u.grupo&&` · ${getGrupoLabel(u.grupo)}`}{u.nivel==='voluntario'&&` · Máx. ${u.max_contatos_ativos}`}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={()=>openEdit(u)} className="text-muted-foreground hover:text-menta-light p-1.5"><Pencil size={15}/></button>
                  <button onClick={()=>toggleActive(u)} className={cn('p-1.5',u.ativo?'text-muted-foreground hover:text-red-400':'text-muted-foreground hover:text-emerald-400')}><Power size={15}/></button>
                </div>
              </div>
            ))}
          </div>
        )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0">
          <div className="absolute inset-0 bg-black/70" onClick={()=>setShowModal(false)}/>
          <div className="relative bg-card border border-border rounded-2xl w-full max-w-md p-5 animate-fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-offwhite">{editUser?'Editar':'Novo'} Usuário</h2>
              <button onClick={()=>setShowModal(false)} className="text-muted-foreground hover:text-foreground"><X size={20}/></button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div><label className="block text-sm font-medium text-foreground mb-1.5">Nome</label><input type="text" className="zion-input" {...register('nome')}/></div>
              {!editUser && <>
                <div><label className="block text-sm font-medium text-foreground mb-1.5">Email</label><input type="email" className="zion-input" {...register('email')}/></div>
                <div><label className="block text-sm font-medium text-foreground mb-1.5">Senha <span className="text-muted-foreground text-xs">(padrão: Jornada@2026)</span></label><input type="password" placeholder="Jornada@2026" className="zion-input" {...register('password')}/></div>
              </>}
              <div><label className="block text-sm font-medium text-foreground mb-1.5">Nível</label>
                <select className="zion-input" {...register('nivel')}>
                  <option value="linha_de_frente">Linha de Frente</option><option value="voluntario">Voluntário</option>
                  <option value="coordenador">Coordenador</option><option value="lider">Líder de Jornada</option><option value="admin">Admin Geral</option>
                </select></div>
              <div><label className="block text-sm font-medium text-foreground mb-1.5">Grupo</label>
                <select className="zion-input" {...register('grupo')}>
                  <option value="">Sem grupo específico</option><option value="rise">RISE</option><option value="flow">FLOW</option><option value="vox">VOX</option><option value="ek">EK</option><option value="zion_geral">Zion Geral</option>
                </select></div>
              {watch('nivel')==='voluntario'&&<div><label className="block text-sm font-medium text-foreground mb-1.5">Máx. Contatos</label><input type="number" min={1} max={20} className="zion-input" {...register('max_contatos_ativos')}/></div>}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={()=>setShowModal(false)} className="zion-btn-secondary flex-1 text-sm">Cancelar</button>
                <button type="submit" className="zion-btn-primary flex-1 text-sm">{editUser?'Salvar':'Criar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}
