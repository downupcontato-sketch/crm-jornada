import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Layout } from '@/components/layout/Layout'
import { TrendingUp } from 'lucide-react'
import type { ContactTipo, ContactGrupo } from '@/types/database'
import { LOCAL_OPTIONS } from '@/lib/locaisCulto'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

// Mapa de local → grupo de culto
const LOCAL_GRUPO_MAP = new Map<string, string>()
LOCAL_OPTIONS.forEach(g => g.items.forEach(item => LOCAL_GRUPO_MAP.set(item, g.group)))

const LOCAIS_CAMPUS      = new Set(LOCAL_OPTIONS.find(g => g.group === 'Campus Chácara Flora')?.items ?? [])
const LOCAIS_GERACIONAIS = new Set(LOCAL_OPTIONS.find(g => g.group === 'Cultos por Ministério')?.items ?? [])

type TabMatriz = 'todos' | 'campus' | 'geracionais' | 'outros'

const TABS_MATRIZ: { key: TabMatriz; label: string }[] = [
  { key: 'todos',       label: 'Todos' },
  { key: 'campus',      label: 'Campus Flora' },
  { key: 'geracionais', label: 'Geracionais' },
  { key: 'outros',      label: 'Outros' },
]

// ─── Constantes ─────────────────────────────────────────────────────────────

const hoje = new Date().toISOString().split('T')[0]
const ha30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

const GRUPO_LABEL: Record<ContactGrupo, string> = {
  rise: 'Rise', flow: 'Flow', vox: 'Vox', ek: 'Eklektos', zion_geral: 'Zion Geral',
}

const TIPO_LABEL: Record<ContactTipo, string> = {
  novo_nascimento: 'Novo Nascimento',
  reconciliacao:   'Reconciliação',
  visitante:       'Visitante',
}

const FAIXAS = ['G5.2 (0–11)', 'Rise (12–14)', 'Flow (15–17)', 'Vox (18–29)', 'EK (30–38)', 'Zion Geral (39+)']

const CORES: Record<ContactTipo, string> = {
  novo_nascimento: '#00B0A8',
  reconciliacao:   '#8B5CF6',
  visitante:       '#F59E0B',
}

function classifyFaixa(idade: number | null): string | null {
  if (!idade) return null
  if (idade < 12) return 'G5.2 (0–11)'
  if (idade < 15) return 'Rise (12–14)'
  if (idade < 18) return 'Flow (15–17)'
  if (idade < 30) return 'Vox (18–29)'
  if (idade < 39) return 'EK (30–38)'
  return 'Zion Geral (39+)'
}

function pct(valor: number, total: number) {
  return total > 0 ? Math.round((valor / total) * 100) : 0
}

// ─── Tipos ──────────────────────────────────────────────────────────────────

interface MatrizRow {
  local: string
  novo_nascimento: number
  reconciliacao: number
  visitante: number
  total: number
}

interface EntradaDados {
  totalEntradas: number
  batizadosMes: number
  porTipo: { tipo: ContactTipo; count: number }[]
  porGrupo: { grupo: ContactGrupo; count: number }[]
  porLocal: { local: string; count: number }[]
  porFaixa: { faixa: string; count: number }[]
  tendenciaSemanal: { semana: string; total: number }[]
  porIgrejaOrigem: { nome: string; count: number }[]
  porSexo: { sexo: string; count: number }[]
  matrizTipoLocal: MatrizRow[]
}

// ─── Componente ─────────────────────────────────────────────────────────────

export default function DashboardEntrada() {
  const { profile, isAdmin, isLider } = useAuth()
  const [dados, setDados] = useState<EntradaDados | null>(null)
  const [loading, setLoading] = useState(true)
  const [dataInicio, setDataInicio] = useState(ha30)
  const [dataFim, setDataFim] = useState(hoje)
  const [tabMatriz, setTabMatriz] = useState<TabMatriz>('todos')

  const carregarDados = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    const iniciMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

    let q = supabase.from('contacts')
      .select('tipo,grupo,local_culto,idade,sexo,subtipo_visitante,igreja_local_nome,fase_pipeline,created_at')
      .gte('created_at', dataInicio)
      .lte('created_at', dataFim + 'T23:59:59')
      .neq('status', 'pendente_aprovacao')
    if (isLider && !isAdmin && profile?.grupo) q = q.eq('grupo', profile.grupo)
    const { data: contatos } = await q
    const cs = contatos ?? []

    // Batizados do mês
    let qBat = supabase.from('contacts').select('id', { count: 'exact', head: true })
      .eq('fase_pipeline', 'BATIZADO').gte('updated_at', iniciMes)
    if (isLider && !isAdmin && profile?.grupo) qBat = qBat.eq('grupo', profile.grupo)
    const { count: batizadosMes } = await qBat

    // Por tipo
    const tipoMap = new Map<ContactTipo, number>()
    cs.forEach(c => tipoMap.set(c.tipo as ContactTipo, (tipoMap.get(c.tipo as ContactTipo) ?? 0) + 1))
    const porTipo = ([...tipoMap.entries()] as [ContactTipo, number][]).map(([tipo, count]) => ({ tipo, count }))

    // Por sexo
    const sexoMap = new Map<string, number>()
    cs.forEach(c => { const s = (c as any).sexo ?? 'NAO_INFORMADO'; sexoMap.set(s, (sexoMap.get(s) ?? 0) + 1) })
    const porSexo = [...sexoMap.entries()].map(([sexo, count]) => ({ sexo, count }))

    // Matriz tipo × local
    const matrizMap = new Map<string, MatrizRow>()
    cs.forEach(c => {
      const local = c.local_culto || 'Não informado'
      if (!matrizMap.has(local)) matrizMap.set(local, { local, novo_nascimento: 0, reconciliacao: 0, visitante: 0, total: 0 })
      const row = matrizMap.get(local)!
      if (c.tipo === 'novo_nascimento') row.novo_nascimento++
      else if (c.tipo === 'reconciliacao') row.reconciliacao++
      else if (c.tipo === 'visitante') row.visitante++
      row.total++
    })
    const matrizTipoLocal = [...matrizMap.values()].sort((a, b) => b.total - a.total)

    // Por grupo
    const grupoMap = new Map<ContactGrupo, number>()
    cs.forEach(c => grupoMap.set(c.grupo as ContactGrupo, (grupoMap.get(c.grupo as ContactGrupo) ?? 0) + 1))
    const porGrupo = ([...grupoMap.entries()] as [ContactGrupo, number][]).map(([grupo, count]) => ({ grupo, count }))

    // Por local
    const localMap = new Map<string, number>()
    cs.forEach(c => { if (c.local_culto) localMap.set(c.local_culto, (localMap.get(c.local_culto) ?? 0) + 1) })
    const porLocal = [...localMap.entries()].map(([local, count]) => ({ local, count })).sort((a, b) => b.count - a.count).slice(0, 10)

    // Por faixa etária
    const faixaMap = new Map<string, number>()
    FAIXAS.forEach(f => faixaMap.set(f, 0))
    cs.forEach(c => { const f = classifyFaixa(c.idade as number | null); if (f) faixaMap.set(f, (faixaMap.get(f) ?? 0) + 1) })
    const porFaixa = FAIXAS.map(faixa => ({ faixa, count: faixaMap.get(faixa) ?? 0 }))

    // Tendência semanal
    const semanaMap = new Map<string, number>()
    cs.forEach(c => {
      const d = new Date(c.created_at)
      const monday = new Date(d)
      monday.setDate(d.getDate() - d.getDay() + 1)
      const label = `${String(monday.getDate()).padStart(2, '0')}/${String(monday.getMonth() + 1).padStart(2, '0')}`
      semanaMap.set(label, (semanaMap.get(label) ?? 0) + 1)
    })
    const tendenciaSemanal = [...semanaMap.entries()].map(([semana, total]) => ({ semana, total })).sort((a, b) => a.semana.localeCompare(b.semana))

    // Por igreja de origem
    const igrejaMap = new Map<string, number>()
    cs.filter((c: any) => c.tipo === 'visitante' && c.subtipo_visitante === 'COM_IGREJA' && c.igreja_local_nome)
      .forEach((c: any) => { const n = c.igreja_local_nome!; igrejaMap.set(n, (igrejaMap.get(n) ?? 0) + 1) })
    const porIgrejaOrigem = [...igrejaMap.entries()].map(([nome, count]) => ({ nome, count })).sort((a, b) => b.count - a.count)

    setDados({
      totalEntradas: cs.length,
      batizadosMes: batizadosMes ?? 0,
      porTipo, porGrupo, porLocal, porFaixa,
      tendenciaSemanal, porIgrejaOrigem, porSexo, matrizTipoLocal,
    })
    setLoading(false)
  }, [profile, isAdmin, isLider, dataInicio, dataFim])

  useEffect(() => {
    if (profile) carregarDados()
  }, [carregarDados])

  // ─── Skeleton ──────────────────────────────────────────────────────────────

  if (loading || !dados) return (
    <Layout title="Visão de Entrada">
      <div className="animate-pulse space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-card rounded-2xl border border-border" />)}
        </div>
        <div className="h-72 bg-card rounded-2xl border border-border" />
        <div className="h-64 bg-card rounded-2xl border border-border" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {[...Array(4)].map((_, i) => <div key={i} className="h-48 bg-card rounded-2xl border border-border" />)}
        </div>
      </div>
    </Layout>
  )

  const maxFaixa   = Math.max(...dados.porFaixa.map(f => f.count), 1)
  const maxSemana  = Math.max(...dados.tendenciaSemanal.map(s => s.total), 1)
  const taxaBatismo = pct(dados.batizadosMes, dados.totalEntradas)

  const totalMasc = dados.porSexo.find(s => s.sexo === 'MASCULINO')?.count ?? 0
  const totalFem  = dados.porSexo.find(s => s.sexo === 'FEMININO')?.count  ?? 0

  // Dados para o gráfico (top 8 locais, labels abreviados)
  const chartData = dados.matrizTipoLocal.slice(0, 8).map(row => ({
    local:           row.local.length > 18 ? row.local.slice(0, 16) + '…' : row.local,
    'Novo Nasc.':    row.novo_nascimento,
    'Reconciliação': row.reconciliacao,
    'Visitante':     row.visitante,
  }))

  // Filtra matriz conforme aba selecionada
  const matrizFiltrada = dados.matrizTipoLocal.filter(row => {
    if (tabMatriz === 'todos')       return true
    if (tabMatriz === 'campus')      return LOCAIS_CAMPUS.has(row.local as any)
    if (tabMatriz === 'geracionais') return LOCAIS_GERACIONAIS.has(row.local as any)
    return !LOCAIS_CAMPUS.has(row.local as any) && !LOCAIS_GERACIONAIS.has(row.local as any)
  })

  // Totais da linha de rodapé da matriz
  const totalNN  = matrizFiltrada.reduce((a, r) => a + r.novo_nascimento, 0)
  const totalRec = matrizFiltrada.reduce((a, r) => a + r.reconciliacao, 0)
  const totalVis = matrizFiltrada.reduce((a, r) => a + r.visitante, 0)
  const totalGeral = totalNN + totalRec + totalVis

  return (
    <Layout title="Visão de Entrada">
      <div className="max-w-5xl mx-auto space-y-5">

        {/* Cabeçalho + filtro de período */}
        <div className="flex flex-wrap items-center justify-between gap-3 -mt-2">
          <p className="text-xs text-muted-foreground">
            {isAdmin ? 'Todos os grupos' : `Grupo ${GRUPO_LABEL[profile?.grupo as ContactGrupo] ?? profile?.grupo}`}
          </p>
          <div className="flex items-center gap-2">
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
              className="text-xs bg-input border border-border rounded-lg px-2.5 py-1.5 text-offwhite focus:outline-none focus:ring-1 focus:ring-menta-light" />
            <span className="text-muted-foreground text-xs">→</span>
            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
              className="text-xs bg-input border border-border rounded-lg px-2.5 py-1.5 text-offwhite focus:outline-none focus:ring-1 focus:ring-menta-light" />
          </div>
        </div>

        {/* KPIs — linha 1 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="zion-card">
            <p className="text-xs text-muted-foreground mb-1">Novas entradas</p>
            <p className="text-3xl font-semibold text-menta-light">{dados.totalEntradas}</p>
          </div>
          <div className="zion-card">
            <p className="text-xs text-muted-foreground mb-1">Batizados este mês</p>
            <p className="text-3xl font-semibold text-menta-light">{dados.batizadosMes}</p>
            <p className="text-xs text-muted-foreground mt-1">Taxa {taxaBatismo}%</p>
          </div>
          <div className="zion-card">
            <p className="text-xs text-muted-foreground mb-1">Masculino</p>
            <p className="text-3xl font-semibold text-offwhite">{totalMasc}</p>
            <p className="text-xs text-muted-foreground mt-1">{pct(totalMasc, dados.totalEntradas)}% do total</p>
          </div>
          <div className="zion-card">
            <p className="text-xs text-muted-foreground mb-1">Feminino</p>
            <p className="text-3xl font-semibold text-offwhite">{totalFem}</p>
            <p className="text-xs text-muted-foreground mt-1">{pct(totalFem, dados.totalEntradas)}% do total</p>
          </div>
        </div>

        {/* Cards por tipo */}
        <div className="grid grid-cols-3 gap-4">
          {(['novo_nascimento', 'reconciliacao', 'visitante'] as ContactTipo[]).map(tipo => {
            const count = dados.porTipo.find(t => t.tipo === tipo)?.count ?? 0
            return (
              <div key={tipo} className="zion-card flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{TIPO_LABEL[tipo]}</p>
                  <p className="text-3xl font-semibold" style={{ color: CORES[tipo] }}>{count}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-muted-foreground">{pct(count, dados.totalEntradas)}%</p>
                  <div className="w-3 h-3 rounded-full mt-1 ml-auto" style={{ background: CORES[tipo] }} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Gráfico de barras empilhadas — tipo × local */}
        {chartData.length > 0 && (
          <div className="zion-card">
            <h2 className="text-sm font-medium text-offwhite mb-1">Conversões por culto</h2>
            <p className="text-xs text-muted-foreground mb-5">Top 8 locais — Novo Nascimento · Reconciliação · Visitante</p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -24, bottom: 56 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="local" tick={{ fill: '#5A7A82', fontSize: 11 }}
                  angle={-35} textAnchor="end" interval={0} />
                <YAxis tick={{ fill: '#5A7A82', fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#0C1D23', border: '1px solid #1A3540', borderRadius: 10, fontSize: 12 }}
                  labelStyle={{ color: '#FFFCF2', marginBottom: 4 }}
                  itemStyle={{ color: '#FFFCF2' }}
                />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" />
                <Bar dataKey="Novo Nasc."    stackId="a" fill={CORES.novo_nascimento} />
                <Bar dataKey="Reconciliação" stackId="a" fill={CORES.reconciliacao}   />
                <Bar dataKey="Visitante"     stackId="a" fill={CORES.visitante} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Tabela matricial tipo × local */}
        {dados.matrizTipoLocal.length > 0 && (
          <div className="zion-card p-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-sm font-medium text-offwhite">Detalhamento por culto</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Total de cada tipo por evento</p>
                </div>
                {/* Abas de filtro */}
                <div className="flex gap-1">
                  {TABS_MATRIZ.map(tab => (
                    <button key={tab.key} onClick={() => setTabMatriz(tab.key)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                        tabMatriz === tab.key
                          ? 'bg-menta-dark/20 text-menta-light border border-menta-dark/40'
                          : 'text-muted-foreground hover:text-foreground border border-transparent'
                      }`}>
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-petroleo/60">
                    <th className="text-left text-xs text-muted-foreground font-medium px-5 py-3">Evento / Culto</th>
                    <th className="text-center text-xs font-medium px-4 py-3" style={{ color: CORES.novo_nascimento }}>Novo Nasc.</th>
                    <th className="text-center text-xs font-medium px-4 py-3" style={{ color: CORES.reconciliacao }}>Reconcil.</th>
                    <th className="text-center text-xs font-medium px-4 py-3" style={{ color: CORES.visitante }}>Visitante</th>
                    <th className="text-right text-xs text-muted-foreground font-medium px-5 py-3">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {matrizFiltrada.map((row, i) => (
                    <tr key={row.local} className={`border-t border-border/50 ${i % 2 === 1 ? 'bg-muted/10' : ''}`}>
                      <td className="px-5 py-2.5 text-xs text-offwhite font-medium truncate max-w-[200px]">{row.local}</td>
                      <CellCount value={row.novo_nascimento} color={CORES.novo_nascimento} />
                      <CellCount value={row.reconciliacao}   color={CORES.reconciliacao}   />
                      <CellCount value={row.visitante}       color={CORES.visitante}        />
                      <td className="px-5 py-2.5 text-right">
                        <span className="text-sm font-semibold text-offwhite">{row.total}</span>
                      </td>
                    </tr>
                  ))}
                  {/* Linha de totais */}
                  <tr className="border-t border-border bg-petroleo/60">
                    <td className="px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total geral</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="text-sm font-semibold text-offwhite">{totalNN}</span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="text-sm font-semibold text-offwhite">{totalRec}</span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="text-sm font-semibold text-offwhite">{totalVis}</span>
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <span className="text-sm font-semibold text-menta-light">{totalGeral}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Por geracional + tendência semanal */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="zion-card">
            <h2 className="text-sm font-medium text-offwhite mb-4">Por geracional</h2>
            <div className="space-y-3">
              {dados.porFaixa.map(f => {
                const p = Math.round((f.count / maxFaixa) * 100)
                return (
                  <div key={f.faixa} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-32 flex-shrink-0">{f.faixa}</span>
                    <div className="flex-1 bg-muted/30 rounded-full h-2">
                      <div className="h-2 rounded-full bg-menta-light transition-all" style={{ width: `${p}%` }} />
                    </div>
                    <span className="text-xs font-medium text-offwhite w-6 text-right">{f.count}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {dados.tendenciaSemanal.length > 0 && (
            <div className="zion-card">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={15} className="text-menta-light" />
                <h2 className="text-sm font-medium text-offwhite">Entradas por semana</h2>
              </div>
              <div className="flex items-end gap-2 h-28">
                {dados.tendenciaSemanal.map(s => {
                  const h = Math.max((s.total / maxSemana) * 96, 4)
                  return (
                    <div key={s.semana} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-xs font-medium text-offwhite">{s.total}</span>
                      <div className="w-full rounded-t-md bg-menta-light" style={{ height: h }} />
                      <span className="text-[10px] text-muted-foreground">{s.semana}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Por local + por igreja de origem */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="zion-card">
            <h2 className="text-sm font-medium text-offwhite mb-4">Por local do culto</h2>
            {dados.porLocal.length === 0
              ? <p className="text-xs text-muted-foreground">Sem dados</p>
              : (
                <div className="space-y-2">
                  {dados.porLocal.map(l => {
                    const max = dados.porLocal[0]?.count ?? 1
                    const p = Math.round((l.count / max) * 100)
                    return (
                      <div key={l.local} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-44 truncate flex-shrink-0">{l.local}</span>
                        <div className="flex-1 bg-muted/30 rounded-full h-2">
                          <div className="h-2 rounded-full bg-menta-light" style={{ width: `${p}%` }} />
                        </div>
                        <span className="text-xs font-medium text-offwhite w-6 text-right">{l.count}</span>
                      </div>
                    )
                  })}
                </div>
              )}
          </div>

          <div className="zion-card">
            <h2 className="text-sm font-medium text-offwhite mb-4">Visitantes por igreja de origem</h2>
            {dados.porIgrejaOrigem.length === 0
              ? <p className="text-xs text-muted-foreground text-center py-6">Nenhum visitante com igreja informada no período</p>
              : (
                <div className="space-y-2">
                  {dados.porIgrejaOrigem.map(ig => (
                    <div key={ig.nome} className="flex items-center justify-between py-1 border-b border-border/50 last:border-0">
                      <span className="text-xs text-muted-foreground truncate">{ig.nome}</span>
                      <span className="text-sm font-semibold text-offwhite flex-shrink-0 ml-3">{ig.count}</span>
                    </div>
                  ))}
                </div>
              )}
          </div>
        </div>
      </div>
    </Layout>
  )
}

// ─── Sub-componente ──────────────────────────────────────────────────────────

function CellCount({ value, color }: { value: number; color: string }) {
  return (
    <td className="px-4 py-2.5 text-center">
      {value > 0 ? (
        <span className="inline-flex items-center justify-center min-w-[26px] px-2 py-0.5 rounded-full text-xs font-semibold"
          style={{ background: `${color}20`, color }}>
          {value}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground/40">—</span>
      )}
    </td>
  )
}
