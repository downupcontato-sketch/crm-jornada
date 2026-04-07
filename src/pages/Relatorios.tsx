import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { calcularSLAFase, FASE_LABELS } from '@/lib/pipeline'
import { LOCAL_OPTIONS } from '@/lib/locaisCulto'
import { GRUPO_LABEL, TIPO_LABEL, FASES_ATIVAS, RelatorioPDF, type DadosRelatorio } from '@/lib/relatorio-pdf'
import { pdf } from '@react-pdf/renderer'
import * as XLSX from 'xlsx'
import { BarChart2, FileText, Table2, Loader2 } from 'lucide-react'
import type { FasePipeline, ContactGrupo, ContactTipo } from '@/types/database'

// ─── Constantes ──────────────────────────────────────────────────────────────

const hoje = new Date().toISOString().split('T')[0]
const ha30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

const GRUPOS: ContactGrupo[] = ['rise', 'flow', 'vox', 'ek', 'zion_geral']
const TIPOS: ContactTipo[] = ['novo_nascimento', 'reconciliacao', 'visitante']
const FASES_FILTRO: FasePipeline[] = ['CONTATO_INICIAL', 'QUALIFICACAO', 'AULAS', 'POS_AULA', 'BATIZADO', 'PERDIDO', 'REENCAMINHADO']

const LOCAIS_FLAT = LOCAL_OPTIONS.flatMap(g => g.items as unknown as string[])

// ─── Tipos de filtro ──────────────────────────────────────────────────────────

interface Filtros {
  dataInicio: string
  dataFim: string
  grupo: string
  fase: string
  localCulto: string
  tipo: string
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function Relatorios() {
  const { profile, isAdmin, isLider } = useAuth()

  const [filtros, setFiltros] = useState<Filtros>({
    dataInicio: ha30,
    dataFim: hoje,
    grupo: '',
    fase: '',
    localCulto: '',
    tipo: '',
  })
  const [dados, setDados] = useState<DadosRelatorio | null>(null)
  const [loading, setLoading] = useState(false)
  const [exportando, setExportando] = useState<'pdf' | 'csv' | null>(null)
  const [erro, setErro] = useState('')

  function setFiltro(campo: keyof Filtros, valor: string) {
    setFiltros(f => ({ ...f, [campo]: valor }))
  }

  // ─── Busca e agrega dados ─────────────────────────────────────────────────

  async function gerarRelatorio() {
    setLoading(true)
    setErro('')
    try {
      // Query base de contatos
      let q = supabase
        .from('contacts')
        .select(`
          id, nome, telefone, idade, tipo, grupo, fase_pipeline,
          local_culto, culto_captacao, status, updated_at, created_at,
          voluntario_atribuido_id, subtipo_visitante, igreja_local_nome, sexo,
          profiles!contacts_voluntario_atribuido_id_fkey(nome)
        `)
        .in('status', ['ativo', 'sem_resposta', 'encaminhado', 'batizado'])
        .gte('created_at', filtros.dataInicio)
        .lte('created_at', filtros.dataFim + 'T23:59:59')

      // Filtro de grupo: líder só vê o próprio grupo
      if (isLider && !isAdmin) {
        q = q.eq('grupo', profile?.grupo ?? '')
      } else if (filtros.grupo && isAdmin) {
        q = q.eq('grupo', filtros.grupo)
      }

      if (filtros.fase)       q = q.eq('fase_pipeline', filtros.fase)
      if (filtros.localCulto) q = q.eq('local_culto', filtros.localCulto)
      if (filtros.tipo)       q = q.eq('tipo', filtros.tipo)

      const { data: contacts, error } = await q
      if (error) throw error

      // Busca voluntários ativos para a tabela de capacidade
      let qVol = supabase.from('profiles').select('id, nome, grupo').eq('nivel', 'voluntario').eq('ativo', true)
      if (isLider && !isAdmin) qVol = qVol.eq('grupo', profile?.grupo ?? '')
      else if (filtros.grupo && isAdmin) qVol = qVol.eq('grupo', filtros.grupo)
      const { data: voluntarios } = await qVol

      const cs = contacts ?? []

      // — Por sexo
      const sexoMap = new Map<string, number>()
      cs.forEach((c: any) => { const s = c.sexo ?? 'NAO_INFORMADO'; sexoMap.set(s, (sexoMap.get(s) ?? 0) + 1) })
      const porSexo = [...sexoMap.entries()].map(([sexo, count]) => ({ sexo, count }))

      // — Matriz tipo × local
      const matrizMap = new Map<string, { local: string; novo_nascimento: number; reconciliacao: number; visitante: number; total: number }>()
      cs.forEach((c: any) => {
        const local = c.local_culto || 'Não informado'
        if (!matrizMap.has(local)) matrizMap.set(local, { local, novo_nascimento: 0, reconciliacao: 0, visitante: 0, total: 0 })
        const row = matrizMap.get(local)!
        if (c.tipo === 'novo_nascimento') row.novo_nascimento++
        else if (c.tipo === 'reconciliacao') row.reconciliacao++
        else if (c.tipo === 'visitante') row.visitante++
        row.total++
      })
      const matrizTipoLocal = [...matrizMap.values()].sort((a, b) => b.total - a.total)

      // — Igreja de origem (visitantes COM_IGREJA)
      const igrejaMap = new Map<string, number>()
      cs.filter((c: any) => c.tipo === 'visitante' && c.subtipo_visitante === 'COM_IGREJA' && c.igreja_local_nome)
        .forEach((c: any) => { const n = c.igreja_local_nome!; igrejaMap.set(n, (igrejaMap.get(n) ?? 0) + 1) })
      const porIgrejaOrigem = [...igrejaMap.entries()]
        .map(([nome, count]) => ({ nome, count }))
        .sort((a, b) => b.count - a.count)

      // — Por fase
      const porFase = FASES_ATIVAS.map(fase => ({
        fase,
        count: cs.filter(c => c.fase_pipeline === fase).length,
      }))

      // — Por grupo
      const porGrupo = GRUPOS.map(grupo => ({
        grupo,
        count: cs.filter(c => c.grupo === grupo).length,
      })).filter(g => g.count > 0)

      // — Por local
      const localMap = new Map<string, number>()
      cs.forEach(c => {
        if (c.local_culto) localMap.set(c.local_culto, (localMap.get(c.local_culto) ?? 0) + 1)
      })
      const porLocal = [...localMap.entries()]
        .map(([local, count]) => ({ local, count }))
        .sort((a, b) => b.count - a.count)

      // — Por tipo
      const porTipo = TIPOS.map(tipo => ({
        tipo,
        count: cs.filter(c => c.tipo === tipo).length,
      })).filter(t => t.count > 0)

      // — Taxa de conversão
      const faseMap = Object.fromEntries(porFase.map(p => [p.fase, p.count]))
      const taxaConversao = FASES_ATIVAS.slice(0, -1).map((fase, i) => {
        const atual  = faseMap[fase] ?? 0
        const proximo = faseMap[FASES_ATIVAS[i + 1]] ?? 0
        const taxa = atual > 0 ? Math.round((proximo / atual) * 100) : 0
        return { de: fase as FasePipeline, para: FASES_ATIVAS[i + 1], taxa }
      })

      // — SLA (só contatos ativos, não batizados)
      const ativos = cs.filter(c => c.status === 'ativo' || c.status === 'sem_resposta')
      const sla = ativos.reduce(
        (acc, c) => {
          const s = calcularSLAFase(c as any)
          acc[s]++
          return acc
        },
        { ok: 0, warn: 0, over: 0 }
      )

      // — Batizados
      const batizados = cs.filter(c => c.fase_pipeline === 'BATIZADO').length

      // — Por voluntário
      const porVoluntario = (voluntarios ?? []).map(v => ({
        id: v.id,
        nome: v.nome,
        grupo: v.grupo ?? '',
        totalContatos: cs.filter(c => c.voluntario_atribuido_id === v.id).length,
      }))

      setDados({
        meta: {
          totalContatos: cs.length,
          geradoEm: new Date().toISOString(),
          dataInicio: filtros.dataInicio,
          dataFim: filtros.dataFim,
          nomeRelator: profile?.nome ?? '',
        },
        porFase,
        porGrupo,
        porLocal,
        porTipo,
        taxaConversao,
        sla,
        batizados,
        porVoluntario,
        porIgrejaOrigem,
        porSexo,
        matrizTipoLocal,
      })
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }

  // ─── Export PDF ───────────────────────────────────────────────────────────

  async function exportarPDF() {
    if (!dados) return
    setExportando('pdf')
    try {
      const blob = await pdf(<RelatorioPDF dados={dados} />).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `jornada-relatorio-${hoje}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExportando(null)
    }
  }

  // ─── Export CSV ───────────────────────────────────────────────────────────

  async function exportarCSV() {
    if (!dados) return
    setExportando('csv')

    // Rebusca contatos brutos para o CSV (com campos completos)
    try {
      let q = supabase
        .from('contacts')
        .select(`
          nome, telefone, idade, tipo, grupo, fase_pipeline,
          local_culto, culto_captacao, status, created_at,
          subtipo_visitante, igreja_local_nome, sexo,
          profiles!contacts_voluntario_atribuido_id_fkey(nome)
        `)
        .in('status', ['ativo', 'sem_resposta', 'encaminhado', 'batizado'])
        .gte('created_at', filtros.dataInicio)
        .lte('created_at', filtros.dataFim + 'T23:59:59')
        .order('created_at', { ascending: false })

      if (isLider && !isAdmin) q = q.eq('grupo', profile?.grupo ?? '')
      else if (filtros.grupo && isAdmin) q = q.eq('grupo', filtros.grupo)
      if (filtros.fase)       q = q.eq('fase_pipeline', filtros.fase)
      if (filtros.localCulto) q = q.eq('local_culto', filtros.localCulto)
      if (filtros.tipo)       q = q.eq('tipo', filtros.tipo)

      const { data: contatos } = await q

      const rows = (contatos ?? []).map((c: any) => ({
        'Nome':               c.nome,
        'Telefone':           c.telefone ?? '',
        'Idade':              c.idade ?? '',
        'Tipo':               TIPO_LABEL[c.tipo as ContactTipo] ?? c.tipo,
        'Grupo':              GRUPO_LABEL[c.grupo as ContactGrupo] ?? c.grupo,
        'Etapa':              FASE_LABELS[c.fase_pipeline as FasePipeline] ?? c.fase_pipeline,
        'Local do culto':     c.local_culto ?? '',
        'Data entrada':       c.culto_captacao ? new Date(c.culto_captacao).toLocaleDateString('pt-BR') : '',
        'Voluntário':         (c.profiles as any)?.nome ?? '',
        'Status':             c.status,
        'Sexo':               c.sexo === 'MASCULINO' ? 'Masculino' : c.sexo === 'FEMININO' ? 'Feminino' : '',
        'Perfil visitante':   c.subtipo_visitante === 'CONHECENDO' ? 'Estou conhecendo'
                              : c.subtipo_visitante === 'SEM_IGREJA' ? 'Não tem igreja local'
                              : c.subtipo_visitante === 'COM_IGREJA'  ? 'Tem igreja local'
                              : '',
        'Igreja de origem':   c.igreja_local_nome ?? '',
        'Cadastrado em':      new Date(c.created_at).toLocaleDateString('pt-BR'),
      }))

      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Relatório')
      XLSX.writeFile(wb, `jornada-relatorio-${hoje}.csv`, { bookType: 'csv' })
    } finally {
      setExportando(null)
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">

      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-menta-dark/10 flex items-center justify-center flex-shrink-0">
          <BarChart2 size={18} className="text-menta-light" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-offwhite">Relatórios</h1>
          <p className="text-xs text-muted-foreground">
            {isAdmin ? 'Todos os grupos' : `Grupo ${GRUPO_LABEL[profile?.grupo as ContactGrupo] ?? profile?.grupo}`}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-medium text-offwhite">Filtros</h2>

        {/* Período */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Data início</label>
            <input type="date" value={filtros.dataInicio}
              onChange={e => setFiltro('dataInicio', e.target.value)}
              className={inputCls} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Data fim</label>
            <input type="date" value={filtros.dataFim}
              onChange={e => setFiltro('dataFim', e.target.value)}
              className={inputCls} />
          </div>
        </div>

        {/* Selects */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {isAdmin && (
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Grupo</label>
              <select value={filtros.grupo} onChange={e => setFiltro('grupo', e.target.value)} className={selectCls}>
                <option value="">Todos</option>
                {GRUPOS.map(g => <option key={g} value={g}>{GRUPO_LABEL[g]}</option>)}
              </select>
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Etapa</label>
            <select value={filtros.fase} onChange={e => setFiltro('fase', e.target.value)} className={selectCls}>
              <option value="">Todas</option>
              {FASES_FILTRO.map(f => <option key={f} value={f}>{FASE_LABELS[f]}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Tipo</label>
            <select value={filtros.tipo} onChange={e => setFiltro('tipo', e.target.value)} className={selectCls}>
              <option value="">Todos</option>
              {TIPOS.map(t => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Local do culto</label>
            <select value={filtros.localCulto} onChange={e => setFiltro('localCulto', e.target.value)} className={selectCls}>
              <option value="">Todos</option>
              {LOCAIS_FLAT.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-3 pt-1 flex-wrap">
          <button onClick={gerarRelatorio} disabled={loading}
            className="flex items-center gap-2 bg-menta-dark text-petroleo text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-menta-light transition-colors disabled:opacity-50">
            {loading ? <Loader2 size={15} className="animate-spin" /> : <BarChart2 size={15} />}
            {loading ? 'Gerando...' : 'Gerar relatório'}
          </button>

          {dados && (
            <>
              <button onClick={exportarPDF} disabled={!!exportando}
                className="flex items-center gap-2 text-sm border border-border text-muted-foreground px-4 py-2.5 rounded-xl hover:border-menta-light hover:text-menta-light transition-colors disabled:opacity-50">
                {exportando === 'pdf' ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                {exportando === 'pdf' ? 'Gerando PDF...' : 'Exportar PDF'}
              </button>
              <button onClick={exportarCSV} disabled={!!exportando}
                className="flex items-center gap-2 text-sm border border-border text-muted-foreground px-4 py-2.5 rounded-xl hover:border-menta-light hover:text-menta-light transition-colors disabled:opacity-50">
                {exportando === 'csv' ? <Loader2 size={14} className="animate-spin" /> : <Table2 size={14} />}
                {exportando === 'csv' ? 'Gerando CSV...' : 'Exportar CSV'}
              </button>
            </>
          )}
        </div>

        {erro && <p className="text-xs text-red-400">{erro}</p>}
      </div>

      {/* Preview */}
      {dados && (
        <div className="space-y-5">

          {/* Cards de resumo */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total de contatos', value: dados.meta.totalContatos, color: 'text-menta-light' },
              { label: 'Batizados no período', value: dados.batizados, color: 'text-menta-light' },
              { label: 'SLA vencido', value: dados.sla.over, color: dados.sla.over > 0 ? 'text-red-400' : 'text-menta-light' },
              { label: 'SLA em atenção', value: dados.sla.warn, color: dados.sla.warn > 0 ? 'text-yellow-400' : 'text-menta-light' },
            ].map(m => (
              <div key={m.label} className="bg-card border border-border rounded-2xl p-4">
                <p className="text-xs text-muted-foreground mb-1">{m.label}</p>
                <p className={`text-3xl font-semibold ${m.color}`}>{m.value}</p>
              </div>
            ))}
          </div>

          {/* Por fase + taxa de conversão */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="text-sm font-medium text-offwhite mb-4">Por etapa do pipeline</h3>
              <div className="space-y-3">
                {FASES_ATIVAS.map(fase => {
                  const item = dados.porFase.find(p => p.fase === fase)
                  const count = item?.count ?? 0
                  const pct = dados.meta.totalContatos > 0
                    ? Math.round((count / dados.meta.totalContatos) * 100) : 0
                  return (
                    <div key={fase} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-36 flex-shrink-0">{FASE_LABELS[fase]}</span>
                      <div className="flex-1 bg-muted/30 rounded-full h-2">
                        <div className="h-2 rounded-full bg-menta-light transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-offwhite w-8 text-right">{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="text-sm font-medium text-offwhite mb-4">Taxa de conversão</h3>
              <div className="space-y-3">
                {dados.taxaConversao.map(t => (
                  <div key={`${t.de}-${t.para}`} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {FASE_LABELS[t.de]} → {FASE_LABELS[t.para]}
                    </span>
                    <span className={`text-sm font-semibold ${
                      t.taxa >= 50 ? 'text-menta-light' :
                      t.taxa >= 25 ? 'text-yellow-400' : 'text-red-400'
                    }`}>{t.taxa}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Por local + por grupo */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="text-sm font-medium text-offwhite mb-4">Por local do culto</h3>
              {dados.porLocal.length === 0
                ? <p className="text-xs text-muted-foreground">Sem dados</p>
                : (
                  <div className="space-y-2">
                    {dados.porLocal.map(l => {
                      const max = dados.porLocal[0]?.count ?? 1
                      const pct = Math.round((l.count / max) * 100)
                      return (
                        <div key={l.local} className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground w-44 truncate flex-shrink-0">{l.local}</span>
                          <div className="flex-1 bg-muted/30 rounded-full h-2">
                            <div className="h-2 rounded-full bg-menta-light" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs font-semibold text-offwhite w-6 text-right">{l.count}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
            </div>

            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="text-sm font-medium text-offwhite mb-4">Por grupo ministerial</h3>
              <div className="space-y-2">
                {dados.porGrupo.length === 0
                  ? <p className="text-xs text-muted-foreground">Sem dados</p>
                  : dados.porGrupo.map(g => (
                    <div key={g.grupo} className="flex items-center justify-between py-1 border-b border-border/50 last:border-0">
                      <span className="text-xs text-muted-foreground">{GRUPO_LABEL[g.grupo]}</span>
                      <span className="text-sm font-semibold text-offwhite">{g.count}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Igreja de origem */}
          {dados.porIgrejaOrigem.length > 0 && (
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="text-sm font-medium text-offwhite mb-4">Visitantes por igreja de origem</h3>
              <div className="space-y-2">
                {dados.porIgrejaOrigem.map(ig => (
                  <div key={ig.nome} className="flex items-center justify-between py-1 border-b border-border/50 last:border-0">
                    <span className="text-xs text-muted-foreground truncate">{ig.nome}</span>
                    <span className="text-sm font-semibold text-offwhite flex-shrink-0 ml-3">{ig.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Voluntários */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="text-sm font-medium text-offwhite mb-4">Contatos por voluntário</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs text-muted-foreground font-medium pb-2">Voluntário</th>
                    <th className="text-left text-xs text-muted-foreground font-medium pb-2">Grupo</th>
                    <th className="text-right text-xs text-muted-foreground font-medium pb-2">Contatos</th>
                    <th className="text-right text-xs text-muted-foreground font-medium pb-2 pl-4">Capacidade</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.porVoluntario.length === 0
                    ? (
                      <tr><td colSpan={4} className="py-4 text-xs text-muted-foreground text-center">Sem voluntários</td></tr>
                    )
                    : dados.porVoluntario.map(v => (
                      <tr key={v.id} className="border-b border-border/50 last:border-0">
                        <td className="py-2.5 text-offwhite">{v.nome}</td>
                        <td className="py-2.5 text-muted-foreground text-xs">
                          {GRUPO_LABEL[v.grupo as ContactGrupo] ?? v.grupo}
                        </td>
                        <td className="py-2.5 text-right font-semibold text-offwhite">{v.totalContatos}</td>
                        <td className="py-2.5 text-right pl-4">
                          <div className="flex items-center justify-end gap-0.5">
                            {[...Array(10)].map((_, i) => (
                              <div key={i} className={`w-2.5 h-2.5 rounded-full ${
                                i < v.totalContatos ? 'bg-menta-light' : 'bg-muted/30'
                              }`} />
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Helpers de estilo ────────────────────────────────────────────────────────

const inputCls = 'w-full text-sm bg-input border border-border rounded-xl px-3 py-2 text-offwhite focus:outline-none focus:ring-1 focus:ring-menta-light'
const selectCls = 'w-full text-sm bg-input border border-border rounded-xl px-3 py-2 text-offwhite focus:outline-none focus:ring-1 focus:ring-menta-light'
