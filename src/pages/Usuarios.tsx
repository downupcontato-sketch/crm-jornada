import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { CheckCircle, XCircle, Power, X, Pencil, RotateCcw, KeyRound } from 'lucide-react'
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

const NIVEIS: { value: UserNivel; label: string }[] = [
  { value: 'linha_de_frente', label: 'Linha de Frente' },
  { value: 'voluntario', label: 'Voluntário' },
  { value: 'coordenador', label: 'Coordenador' },
  { value: 'lider', label: 'Líder de Jornada' },
  { value: 'admin', label: 'Admin Geral' },
]

const GRUPOS: { value: ContactGrupo; label: string }[] = [
  { value: 'rise', label: 'RISE' },
  { value: 'flow', label: 'FLOW' },
  { value: 'vox', label: 'VOX' },
  { value: 'ek', label: 'EK' },
  { value: 'zion_geral', label: 'Zion Geral' },
]

interface EditModal {
  user: Profile
  nivel: UserNivel
  grupo: ContactGrupo | ''
  max_contatos_ativos: number
}

export default function Usuarios() {
  const qc = useQueryClient()
  const { profile, isAdmin, isCoordenador } = useAuth()
  const [tab, setTab] = useState<Tab>('pendentes')
  const [rejectModal, setRejectModal] = useState<Profile | null>(null)
  const [resetSenhaModal, setResetSenhaModal] = useState<Profile | null>(null)
  const [resetLoading, setResetLoading] = useState(false)
  const [rejectNote, setRejectNote] = useState('')
  const [pendingNiveis, setPendingNiveis] = useState<Record<string, UserNivel>>({})
  const [pendingGrupos, setPendingGrupos] = useState<Record<string, ContactGrupo | ''>>({})
  const [editModal, setEditModal] = useState<EditModal | null>(null)

  const { data: users, isLoading } = useQuery({
    queryKey: ['users', tab, profile?.id],
    queryFn: async () => {
      let query = supabase.from('profiles').select('*')
      if (tab === 'pendentes') {
        query = query.eq('status', 'pendente')
        if (isCoordenador && !isAdmin)
          query = query.eq('grupo', profile?.grupo ?? '').eq('nivel', 'linha_de_frente')
      } else if (tab === 'ativos') {
        query = query.eq('status', 'ativo').order('nivel').order('nome')
        if (isCoordenador && !isAdmin) query = query.eq('grupo', profile?.grupo ?? '')
      } else {
        query = query.eq('status', 'rejeitado').order('rejeitado_em', { ascending: false })
        if (isCoordenador && !isAdmin) query = query.eq('grupo', profile?.grupo ?? '')
      }
      const { data, error } = await query
      if (error) throw error
      return data as Profile[]
    },
  })

  const { data: counts } = useQuery({
    queryKey: ['users-counts', profile?.id],
    queryFn: async () => {
      const base = supabase.from('profiles')
      const [p, a, r] = await Promise.all([
        base.select('id', { count: 'exact', head: true }).eq('status', 'pendente'),
        base.select('id', { count: 'exact', head: true }).eq('status', 'ativo'),
        base.select('id', { count: 'exact', head: true }).eq('status', 'rejeitado'),
      ])
      return { pendentes: p.count ?? 0, ativos: a.count ?? 0, rejeitados: r.count ?? 0 }
    },
  })

  async function handleApprove(u: Profile) {
    const novoNivel = pendingNiveis[u.id] ?? u.nivel
    const novoGrupo = pendingGrupos[u.id] !== undefined ? pendingGrupos[u.id] : u.grupo
    const { error } = await supabase.from('profiles').update({
      status: 'ativo', ativo: true,
      nivel: novoNivel,
      grupo: novoGrupo || null,
      aprovado_por: profile?.id,
      aprovado_em: new Date().toISOString(),
    }).eq('id', u.id)
    if (error) { toast.error('Erro ao aprovar usuário.'); return }
    toast.success(`${u.nome} aprovado como ${nivelLabel(novoNivel)}!`)
    qc.invalidateQueries({ queryKey: ['users'] })
    qc.invalidateQueries({ queryKey: ['users-counts'] })
    qc.invalidateQueries({ queryKey: ['pendentes-count'] })
  }

  async function handleReject() {
    if (!rejectModal) return
    const { error } = await supabase.from('profiles').update({
      status: 'rejeitado', ativo: false,
      rejeitado_por: profile?.id,
      rejeitado_em: new Date().toISOString(),
      nota_rejeicao: rejectNote || null,
    }).eq('id', rejectModal.id)
    if (error) { toast.error('Erro ao rejeitar.'); return }
    toast.success(`${rejectModal.nome} rejeitado.`)
    setRejectModal(null); setRejectNote('')
    qc.invalidateQueries({ queryKey: ['users'] })
    qc.invalidateQueries({ queryKey: ['users-counts'] })
    qc.invalidateQueries({ queryKey: ['pendentes-count'] })
  }

  async function handleReativar(u: Profile) {
    const { error } = await supabase.from('profiles').update({
      status: 'pendente',
      rejeitado_por: null, rejeitado_em: null, nota_rejeicao: null,
    }).eq('id', u.id)
    if (error) { toast.error('Erro.'); return }
    toast.success(`${u.nome} movido para pendentes.`)
    qc.invalidateQueries({ queryKey: ['users'] })
    qc.invalidateQueries({ queryKey: ['users-counts'] })
    qc.invalidateQueries({ queryKey: ['pendentes-count'] })
  }

  async function toggleActive(u: Profile) {
    const { error } = await supabase.from('profiles').update({ ativo: !u.ativo }).eq('id', u.id)
    if (error) toast.error('Erro.')
    else { toast.success(u.ativo ? 'Desativado.' : 'Ativado.'); qc.invalidateQueries({ queryKey: ['users'] }) }
  }

  async function handleResetSenha() {
    if (!resetSenhaModal) return
    setResetLoading(true)
    try {
      const appUrl = import.meta.env.VITE_APP_URL ?? window.location.origin
      const { error } = await supabase.auth.resetPasswordForEmail(resetSenhaModal.email, {
        redirectTo: `${appUrl}/reset-password`,
      })
      if (error) throw error
      toast.success(`Link de redefinição enviado para ${resetSenhaModal.email}`)
      setResetSenhaModal(null)
    } catch {
      toast.error('Erro ao enviar o link. Verifique se o email está correto.')
    } finally {
      setResetLoading(false)
    }
  }

  async function handleEdit() {
    if (!editModal) return
    const { error } = await supabase.from('profiles').update({
      nivel: editModal.nivel,
      grupo: editModal.grupo || null,
      max_contatos_ativos: editModal.max_contatos_ativos,
    }).eq('id', editModal.user.id)
    if (error) { toast.error('Erro ao salvar.'); return }
    toast.success('Usuário atualizado!')
    setEditModal(null)
    qc.invalidateQueries({ queryKey: ['users'] })
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'pendentes', label: `Pendentes${counts?.pendentes ? ` (${counts.pendentes})` : ''}` },
    { key: 'ativos', label: `Ativos${counts?.ativos ? ` (${counts.ativos})` : ''}` },
    { key: 'rejeitados', label: `Rejeitados${counts?.rejeitados ? ` (${counts.rejeitados})` : ''}` },
  ]

  return (
    <Layout title="Gestão de Acessos">
      <div className="flex gap-1 mb-6 border-b border-border">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn('px-4 py-2 text-sm font-medium transition-all border-b-2 -mb-px',
              tab === t.key ? 'border-menta-light text-menta-light' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-menta-light border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !users?.length ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Nenhum usuário nesta categoria.</div>
      ) : (
        <div className="space-y-3">

          {/* ── PENDENTES ── */}
          {tab === 'pendentes' && users.map(u => (
            <div key={u.id} className="zion-card">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-semibold text-yellow-400">{u.nome.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0 space-y-3">
                  <div>
                    <p className="text-sm font-medium text-offwhite">{u.nome}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Solicitado em {new Date(u.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>

                  {/* Definir nível e grupo antes de aprovar */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Nível de acesso</label>
                      <select
                        className="zion-input text-xs py-1.5"
                        value={pendingNiveis[u.id] ?? u.nivel}
                        onChange={e => setPendingNiveis(prev => ({ ...prev, [u.id]: e.target.value as UserNivel }))}
                      >
                        {NIVEIS.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground block mb-1">Grupo ministerial</label>
                      <select
                        className="zion-input text-xs py-1.5"
                        value={pendingGrupos[u.id] !== undefined ? pendingGrupos[u.id] : (u.grupo ?? '')}
                        onChange={e => setPendingGrupos(prev => ({ ...prev, [u.id]: e.target.value as ContactGrupo | '' }))}
                      >
                        <option value="">Sem grupo</option>
                        {GRUPOS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => handleApprove(u)}
                      className="zion-btn-primary flex items-center gap-1.5 text-xs px-4 py-2 flex-1 justify-center">
                      <CheckCircle size={14} /> Aprovar acesso
                    </button>
                    <button onClick={() => { setRejectModal(u); setRejectNote('') }}
                      className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg border border-red-400/30 text-red-400 hover:bg-red-400/10 transition-all flex-1 justify-center">
                      <XCircle size={14} /> Rejeitar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* ── ATIVOS ── */}
          {tab === 'ativos' && users.map(u => (
            <div key={u.id} className={cn('zion-card flex items-center gap-3', !u.ativo && 'opacity-60')}>
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
              {isAdmin && (
                <div className="flex items-center gap-1">
                  <button onClick={() => setEditModal({ user: u, nivel: u.nivel, grupo: u.grupo ?? '', max_contatos_ativos: u.max_contatos_ativos })}
                    className="p-1.5 text-muted-foreground hover:text-menta-light transition-colors" title="Editar">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => setResetSenhaModal(u)}
                    className="p-1.5 text-muted-foreground hover:text-yellow-400 transition-colors" title="Redefinir senha">
                    <KeyRound size={15} />
                  </button>
                  <button onClick={() => toggleActive(u)}
                    className={cn('p-1.5 transition-colors', u.ativo ? 'text-muted-foreground hover:text-red-400' : 'text-muted-foreground hover:text-emerald-400')}
                    title={u.ativo ? 'Desativar' : 'Ativar'}>
                    <Power size={15} />
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* ── REJEITADOS ── */}
          {tab === 'rejeitados' && users.map(u => (
            <div key={u.id} className="zion-card flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-red-400/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-red-400">{u.nome.charAt(0).toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-offwhite">{u.nome}</p>
                <p className="text-xs text-muted-foreground">{u.email}</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {u.grupo && <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{getGrupoLabel(u.grupo as ContactGrupo)}</span>}
                  <span className={cn('text-xs px-2 py-0.5 rounded-full border', nivelColors[u.nivel])}>{nivelLabel(u.nivel)}</span>
                </div>
                {u.nota_rejeicao && <p className="text-xs text-red-400/80 mt-1.5 italic">Motivo: {u.nota_rejeicao}</p>}
                {u.rejeitado_em && <p className="text-xs text-muted-foreground mt-0.5">Rejeitado em {new Date(u.rejeitado_em).toLocaleDateString('pt-BR')}</p>}
              </div>
              {isAdmin && (
                <button onClick={() => handleReativar(u)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-muted text-muted-foreground hover:text-menta-light hover:border-menta-light/50 transition-all flex-shrink-0"
                  title="Mover para pendentes">
                  <RotateCcw size={13} /> Reavaliar
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Modal de Rejeição ── */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0">
          <div className="absolute inset-0 bg-black/70" onClick={() => setRejectModal(null)} />
          <div className="relative bg-card border border-border rounded-2xl w-full max-w-md p-5 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-offwhite">Rejeitar solicitação</h2>
              <button onClick={() => setRejectModal(null)} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Rejeitar acesso de <span className="text-offwhite font-medium">{rejectModal.nome}</span>?
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-foreground mb-1.5">Motivo <span className="text-muted-foreground text-xs">(opcional)</span></label>
              <textarea className="zion-input resize-none" rows={3}
                placeholder="Ex: perfil não se encaixa nos critérios atuais..."
                value={rejectNote} onChange={e => setRejectNote(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setRejectModal(null)} className="zion-btn-secondary flex-1 text-sm">Cancelar</button>
              <button onClick={handleReject}
                className="flex-1 text-sm px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all">
                Confirmar rejeição
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de Reset de Senha ── */}
      {resetSenhaModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0">
          <div className="absolute inset-0 bg-black/70" onClick={() => setResetSenhaModal(null)} />
          <div className="relative bg-card border border-border rounded-2xl w-full max-w-md p-5 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-offwhite">Redefinir senha</h2>
              <button onClick={() => setResetSenhaModal(null)} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 mb-4">
              <div className="flex items-start gap-2">
                <KeyRound size={15} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-offwhite font-medium">{resetSenhaModal.nome}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{resetSenhaModal.email}</p>
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-5">
              Um link de redefinição de senha será enviado para o email acima. A pessoa poderá criar uma nova senha ao clicar no link.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setResetSenhaModal(null)} className="zion-btn-secondary flex-1 text-sm">Cancelar</button>
              <button onClick={handleResetSenha} disabled={resetLoading}
                className="flex-1 text-sm px-4 py-2 rounded-lg bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/25 transition-all disabled:opacity-50">
                {resetLoading ? 'Enviando...' : 'Enviar link de redefinição'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de Edição ── */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0">
          <div className="absolute inset-0 bg-black/70" onClick={() => setEditModal(null)} />
          <div className="relative bg-card border border-border rounded-2xl w-full max-w-md p-5 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-offwhite">Editar acesso</h2>
              <button onClick={() => setEditModal(null)} className="text-muted-foreground hover:text-foreground"><X size={20} /></button>
            </div>
            <div className="mb-1">
              <p className="text-sm font-medium text-offwhite">{editModal.user.nome}</p>
              <p className="text-xs text-muted-foreground mb-4">{editModal.user.email}</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Nível de acesso</label>
                <select className="zion-input" value={editModal.nivel}
                  onChange={e => setEditModal(m => m ? { ...m, nivel: e.target.value as UserNivel } : m)}>
                  {NIVEIS.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Grupo ministerial</label>
                <select className="zion-input" value={editModal.grupo}
                  onChange={e => setEditModal(m => m ? { ...m, grupo: e.target.value as ContactGrupo | '' } : m)}>
                  <option value="">Sem grupo específico</option>
                  {GRUPOS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              </div>
              {editModal.nivel === 'voluntario' && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Máx. contatos ativos</label>
                  <input type="number" min={1} max={20} className="zion-input"
                    value={editModal.max_contatos_ativos}
                    onChange={e => setEditModal(m => m ? { ...m, max_contatos_ativos: Number(e.target.value) } : m)} />
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setEditModal(null)} className="zion-btn-secondary flex-1 text-sm">Cancelar</button>
              <button onClick={handleEdit} className="zion-btn-primary flex-1 text-sm">Salvar alterações</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
