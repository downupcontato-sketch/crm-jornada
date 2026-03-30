import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { CheckCircle, XCircle, Power, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Layout } from '@/components/layout/Layout'
import { toast } from 'sonner'
import { cn, getGrupoLabel, nivelLabel } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import type { Profile, UserNivel, ContactGrupo } from '@/types/database'

type Tab = 'pendentes' | 'ativos' | 'rejeitados'

const nivelColors: Record<UserNivel, string> = {
  admin: 'text-red-400 bg-red-400/10 border-red-400/20',
  lider: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
  coordenador: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  voluntario: 'text-menta-light bg-menta-light/10 border-menta-light/20',
  linha_de_frente: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
}

export default function Usuarios() {
  const qc = useQueryClient()
  const { profile, isAdmin, isCoordenador } = useAuth()
  const [tab, setTab] = useState<Tab>('pendentes')
  const [rejectModal, setRejectModal] = useState<Profile | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [pendingNiveis, setPendingNiveis] = useState<Record<string, UserNivel>>({})

  const { data: users, isLoading } = useQuery({
    queryKey: ['users', tab, profile?.id],
    queryFn: async () => {
      let query = supabase.from('profiles').select('*')

      if (tab === 'pendentes') {
        query = query.eq('status', 'pendente')
        if (isCoordenador && !isAdmin) {
          query = query.eq('grupo', profile?.grupo ?? '').eq('nivel', 'linha_de_frente')
        }
      } else if (tab === 'ativos') {
        query = query.eq('status', 'ativo').order('nivel').order('nome')
        if (isCoordenador && !isAdmin) {
          query = query.eq('grupo', profile?.grupo ?? '')
        }
      } else {
        query = query.eq('status', 'rejeitado').order('rejeitado_em', { ascending: false })
        if (isCoordenador && !isAdmin) {
          query = query.eq('grupo', profile?.grupo ?? '')
        }
      }

      const { data, error } = await query
      if (error) throw error
      return data as Profile[]
    },
  })

  async function handleApprove(u: Profile) {
    const novoNivel = pendingNiveis[u.id] ?? u.nivel
    const { error } = await supabase.from('profiles').update({
      status: 'ativo',
      ativo: true,
      nivel: novoNivel,
      aprovado_por: profile?.id,
      aprovado_em: new Date().toISOString(),
    }).eq('id', u.id)
    if (error) { toast.error('Erro ao aprovar usuário.'); return }
    toast.success(`${u.nome} aprovado!`)
    qc.invalidateQueries({ queryKey: ['users'] })
    qc.invalidateQueries({ queryKey: ['pendentes-count'] })
  }

  async function handleReject() {
    if (!rejectModal) return
    const { error } = await supabase.from('profiles').update({
      status: 'rejeitado',
      ativo: false,
      rejeitado_por: profile?.id,
      rejeitado_em: new Date().toISOString(),
      nota_rejeicao: rejectNote || null,
    }).eq('id', rejectModal.id)
    if (error) { toast.error('Erro ao rejeitar usuário.'); return }
    toast.success(`${rejectModal.nome} rejeitado.`)
    setRejectModal(null)
    setRejectNote('')
    qc.invalidateQueries({ queryKey: ['users'] })
    qc.invalidateQueries({ queryKey: ['pendentes-count'] })
  }

  async function toggleActive(u: Profile) {
    const { error } = await supabase.from('profiles').update({ ativo: !u.ativo }).eq('id', u.id)
    if (error) toast.error('Erro.')
    else { toast.success(u.ativo ? 'Desativado.' : 'Ativado.'); qc.invalidateQueries({ queryKey: ['users'] }) }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'pendentes', label: 'Pendentes' },
    { key: 'ativos', label: 'Ativos' },
    { key: 'rejeitados', label: 'Rejeitados' },
  ]

  return (
    <Layout title="Usuários">
      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-all border-b-2 -mb-px',
              tab === t.key
                ? 'border-menta-light text-menta-light'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-menta-light border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !users?.length ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          Nenhum usuário encontrado nesta categoria.
        </div>
      ) : (
        <div className="space-y-3">
          {/* PENDENTES */}
          {tab === 'pendentes' && users.map(u => (
            <div key={u.id} className="zion-card">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-menta-dark flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-semibold text-menta-light">{u.nome.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-offwhite">{u.nome}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {u.grupo && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{getGrupoLabel(u.grupo as ContactGrupo)}</span>
                    )}
                    <span className={cn('text-xs px-2 py-0.5 rounded-full border', nivelColors[u.nivel])}>{nivelLabel(u.nivel)}</span>
                    {u.created_at && (
                      <span className="text-xs text-muted-foreground">
                        Solicitado em {new Date(u.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>

                  {/* Nível dropdown (admin only) */}
                  {isAdmin && (
                    <div className="mt-2">
                      <label className="text-xs text-muted-foreground block mb-1">Nível ao aprovar:</label>
                      <select
                        className="zion-input text-xs py-1"
                        value={pendingNiveis[u.id] ?? u.nivel}
                        onChange={e => setPendingNiveis(prev => ({ ...prev, [u.id]: e.target.value as UserNivel }))}
                      >
                        <option value="linha_de_frente">Linha de Frente</option>
                        <option value="voluntario">Voluntário</option>
                        <option value="coordenador">Coordenador</option>
                        <option value="lider">Líder de Jornada</option>
                        <option value="admin">Admin Geral</option>
                      </select>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleApprove(u)}
                    className="zion-btn-primary flex items-center gap-1.5 text-xs px-3 py-1.5"
                  >
                    <CheckCircle size={14} />Aprovar
                  </button>
                  <button
                    onClick={() => { setRejectModal(u); setRejectNote('') }}
                    className="zion-btn-secondary flex items-center gap-1.5 text-xs px-3 py-1.5 hover:text-red-400 hover:border-red-400/50"
                  >
                    <XCircle size={14} />Rejeitar
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* ATIVOS */}
          {tab === 'ativos' && users.map(u => (
            <div key={u.id} className={cn('zion-card flex items-center gap-3', !u.ativo && 'opacity-50')}>
              <div className="w-9 h-9 rounded-full bg-menta-dark flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-menta-light">{u.nome.charAt(0).toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-offwhite">{u.nome}</p>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full border', nivelColors[u.nivel])}>{nivelLabel(u.nivel)}</span>
                  {!u.ativo && <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Inativo</span>}
                </div>
                <p className="text-xs text-muted-foreground">{u.email}{u.grupo && ` · ${getGrupoLabel(u.grupo as ContactGrupo)}`}</p>
              </div>
              <button
                onClick={() => toggleActive(u)}
                className={cn('p-1.5', u.ativo ? 'text-muted-foreground hover:text-red-400' : 'text-muted-foreground hover:text-emerald-400')}
                title={u.ativo ? 'Desativar' : 'Ativar'}
              >
                <Power size={15} />
              </button>
            </div>
          ))}

          {/* REJEITADOS */}
          {tab === 'rejeitados' && users.map(u => (
            <div key={u.id} className="zion-card">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-red-400/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-semibold text-red-400">{u.nome.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-offwhite">{u.nome}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {u.grupo && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{getGrupoLabel(u.grupo as ContactGrupo)}</span>
                    )}
                    <span className={cn('text-xs px-2 py-0.5 rounded-full border', nivelColors[u.nivel])}>{nivelLabel(u.nivel)}</span>
                  </div>
                  {u.nota_rejeicao && (
                    <p className="text-xs text-red-400/80 mt-1.5 italic">Motivo: {u.nota_rejeicao}</p>
                  )}
                  {u.rejeitado_em && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Rejeitado em {new Date(u.rejeitado_em).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Rejeição */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0">
          <div className="absolute inset-0 bg-black/70" onClick={() => setRejectModal(null)} />
          <div className="relative bg-card border border-border rounded-2xl w-full max-w-md p-5 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-offwhite">Rejeitar solicitação</h2>
              <button onClick={() => setRejectModal(null)} className="text-muted-foreground hover:text-foreground">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Tem certeza que deseja rejeitar <span className="text-offwhite font-medium">{rejectModal.nome}</span>?
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Motivo da rejeição <span className="text-muted-foreground text-xs">(opcional)</span>
              </label>
              <textarea
                className="zion-input resize-none"
                rows={3}
                placeholder="Ex: perfil não se encaixa nos critérios atuais..."
                value={rejectNote}
                onChange={e => setRejectNote(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setRejectModal(null)} className="zion-btn-secondary flex-1 text-sm">Cancelar</button>
              <button
                onClick={handleReject}
                className="flex-1 text-sm px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all"
              >
                Confirmar rejeição
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
