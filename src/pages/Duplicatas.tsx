import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { GitMerge, Eye, CheckCircle, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Layout } from '@/components/layout/Layout'
import { mesclarLeads } from '@/lib/distribuicao'
import { useAuth } from '@/contexts/AuthContext'
import { cn, getGrupoLabel, getTipoLabel, formatPhone } from '@/lib/utils'
import { FASE_LABELS } from '@/lib/pipeline'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Contact } from '@/types/database'

interface GrupoDuplicata {
  telefone: string
  contatos: Contact[]
}

export default function Duplicatas() {
  const { profile } = useAuth()
  const qc = useQueryClient()
  const [mesclando, setMesclando] = useState<string | null>(null)
  const [ignorando, setIgnorando] = useState<string | null>(null)

  const { data: grupos = [], isLoading } = useQuery({
    queryKey: ['duplicatas', profile?.grupo],
    queryFn: async () => {
      let q = supabase
        .from('contacts')
        .select('*')
        .not('status', 'eq', 'arquivado')
        .eq('duplicata_revisada', false)
        .order('created_at', { ascending: true })
      if (profile?.nivel === 'coordenador' && profile?.grupo) {
        q = q.eq('grupo', profile.grupo)
      }
      const { data, error } = await q
      if (error) throw error
      const todos = (data ?? []) as Contact[]

      // Agrupar por telefone normalizado
      const map = new Map<string, Contact[]>()
      for (const c of todos) {
        const tel = c.telefone.replace(/\D/g, '')
        if (!map.has(tel)) map.set(tel, [])
        map.get(tel)!.push(c)
      }

      return Array.from(map.entries())
        .filter(([, arr]) => arr.length > 1)
        .map(([telefone, contatos]) => ({ telefone, contatos })) as GrupoDuplicata[]
    },
    enabled: !!profile,
  })

  async function handleMesclar(grupo: GrupoDuplicata) {
    const tel = grupo.telefone
    setMesclando(tel)
    try {
      // Manter o contato com mais histórico (ou o mais antigo)
      const sorted = [...grupo.contatos].sort((a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
      const manter = sorted[0]
      const descartar = sorted[1]
      const { error } = await mesclarLeads(manter.id, descartar.id)
      if (error) throw new Error(error)
      toast.success('Contatos mesclados com sucesso!')
      qc.invalidateQueries({ queryKey: ['duplicatas'] })
    } catch (e: unknown) {
      toast.error(`Erro ao mesclar: ${e instanceof Error ? e.message : 'erro desconhecido'}`)
    } finally {
      setMesclando(null)
    }
  }

  async function handleIgnorar(grupo: GrupoDuplicata) {
    const tel = grupo.telefone
    setIgnorando(tel)
    try {
      const ids = grupo.contatos.map(c => c.id)
      await supabase.from('contacts').update({ duplicata_revisada: true }).in('id', ids)
      toast.success('Par marcado como revisado.')
      qc.invalidateQueries({ queryKey: ['duplicatas'] })
    } catch {
      toast.error('Erro ao marcar como revisado.')
    } finally {
      setIgnorando(null)
    }
  }

  return (
    <Layout title="Duplicatas">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <GitMerge size={16} />
          <span>Contatos com mesmo número de telefone</span>
        </div>
        {!isLoading && (
          <span className={cn(
            'text-xs font-semibold px-2.5 py-1 rounded-full border',
            grupos.length > 0
              ? 'bg-red-400/15 text-red-400 border-red-400/20'
              : 'bg-emerald-400/15 text-emerald-400 border-emerald-400/20'
          )}>
            {grupos.length} {grupos.length === 1 ? 'grupo' : 'grupos'}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-menta-light border-t-transparent rounded-full animate-spin" />
        </div>
      ) : grupos.length === 0 ? (
        <div className="text-center py-16">
          <CheckCircle size={32} className="text-menta-light mx-auto mb-3" />
          <p className="text-sm font-medium text-offwhite">Nenhuma duplicata pendente</p>
          <p className="text-xs text-muted-foreground mt-1">Todos os contatos estão sem duplicatas identificadas.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grupos.map(grupo => (
            <div key={grupo.telefone} className="zion-card">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={14} className="text-yellow-400" />
                  <span className="text-xs text-muted-foreground font-medium">{formatPhone(grupo.telefone)}</span>
                  <span className="text-[10px] text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 px-1.5 py-0.5 rounded-full">
                    {grupo.contatos.length} entradas
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleIgnorar(grupo)}
                    disabled={ignorando === grupo.telefone}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-offwhite hover:border-foreground/30 transition-all"
                  >
                    <Eye size={12} /> Ignorar
                  </button>
                  <button
                    onClick={() => handleMesclar(grupo)}
                    disabled={mesclando === grupo.telefone}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-menta-light/15 border border-menta-light/30 text-menta-light hover:bg-menta-light/25 transition-all font-medium"
                  >
                    <GitMerge size={12} />
                    {mesclando === grupo.telefone ? 'Mesclando…' : 'Mesclar'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {grupo.contatos.map((c, i) => (
                  <div key={c.id} className={cn(
                    'rounded-lg border p-3 space-y-1.5',
                    i === 0 ? 'border-menta-light/20 bg-menta-light/5' : 'border-border bg-muted/5'
                  )}>
                    {i === 0 && (
                      <span className="text-[9px] text-menta-light font-semibold uppercase tracking-wider">Manter (mais antigo)</span>
                    )}
                    <p className="text-sm font-medium text-offwhite">{c.nome}</p>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-[10px] text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded">
                        {getTipoLabel(c.tipo)}
                      </span>
                      <span className="text-[10px] text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded">
                        {getGrupoLabel(c.grupo)}
                      </span>
                      <span className="text-[10px] text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded">
                        {FASE_LABELS[c.fase_pipeline]}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground/60">
                      Cadastrado em {format(new Date(c.created_at), "dd/MM/yy", { locale: ptBR })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  )
}
