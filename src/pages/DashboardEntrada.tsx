import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { calcularGrupo } from '@/lib/calcularGrupo'
import { Layout } from '@/components/layout/Layout'
import { TrendingUp } from 'lucide-react'
import type { ContactTipo, ContactGrupo } from '@/types/database'

const GRUPO_LABEL: Record<ContactGrupo, string> = {
  rise: 'Rise', flow: 'Flow', vox: 'Vox', ek: 'Eklektos', zion_geral: 'Zion Geral',
}

const TIPO_LABEL: Record<ContactTipo, string> = {
  novo_nascimento: 'Novo Nascimento',
  reconciliacao:   'Reconciliação',
  visitante:       'Visitante',
}

const FAIXAS = ['G5.2 (0–11)', 'Rise (12–14)', 'Flow (15–17)', 'Vox (18–29)', 'EK (30–38)', 'Zion Geral (39+)']

function classifyFaixa(idade: number | null): string | null {
  if (!idade) return null
  if (idade < 12)  return 'G5.2 (0–11)'
  if (idade < 15)  return 'Rise (12–14)'
  if (idade < 18)  return 'Flow (15–17)'
  if (idade < 30)  return 'Vox (18–29)'
  if (idade < 39)  return 'EK (30–38)'
  return 'Zion Geral (39+)'
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
}

export default function DashboardEntrada() {
  const { profile, isAdmin, isLider } = useAuth()
  const [dados, setDados] = useState<EntradaDados | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    carregarDados()
  }, [profile])

  async function carregarDados() {
    setLoading(true)
    const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const iniciMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

    let q = supabase.from('contacts')
      .select('tipo,grupo,local_culto,idade,possui_igreja_local,igreja_local_nome,fase_pipeline,created_at')
      .gte('created_at', desde)
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
    const porTipo = [...tipoMap.entries()].map(([tipo, count]) => ({ tipo, count }))

    // Por grupo
    const grupoMap = new Map<ContactGrupo, number>()
    cs.forEach(c => grupoMap.set(c.grupo as ContactGrupo, (grupoMap.get(c.grupo as ContactGrupo) ?? 0) + 1))
    const porGrupo = [...grupoMap.entries()].map(([grupo, count]) => ({ grupo, count }))

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
      const label = `${String(monday.getDate()).padStart(2,'0')}/${String(monday.getMonth()+1).padStart(2,'0')}`
      semanaMap.set(label, (semanaMap.get(label) ?? 0) + 1)
    })
    const tendenciaSemanal = [...semanaMap.entries()].map(([semana, total]) => ({ semana, total })).sort((a, b) => a.semana.localeCompare(b.semana))

    // Por igreja de origem (visitantes)
    const igrejaMap = new Map<string, number>()
    cs.filter(c => c.tipo === 'visitante' && c.possui_igreja_local && c.igreja_local_nome)
      .forEach(c => { const n = c.igreja_local_nome!; igrejaMap.set(n, (igrejaMap.get(n) ?? 0) + 1) })
    const porIgrejaOrigem = [...igrejaMap.entries()].map(([nome, count]) => ({ nome, count })).sort((a, b) => b.count - a.count)

    setDados({
      totalEntradas: cs.length,
      batizadosMes: batizadosMes ?? 0,
      porTipo,
      porGrupo,
      porLocal,
      porFaixa,
      tendenciaSemanal,
      porIgrejaOrigem,
    })
    setLoading(false)
  }

  if (loading || !dados) return (
    <Layout title="Visão de Entrada">
      <div className="animate-pulse space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">{[...Array(3)].map((_,i)=><div key={i} className="h-24 bg-card rounded-2xl border border-border"/>)}</div>
        <div className="h-40 bg-card rounded-2xl border border-border"/>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">{[...Array(4)].map((_,i)=><div key={i} className="h-48 bg-card rounded-2xl border border-border"/>)}</div>
      </div>
    </Layout>
  )

  const maxLocal = Math.max(...dados.porLocal.map(l => l.count), 1)
  const maxFaixa = Math.max(...dados.porFaixa.map(f => f.count), 1)
  const maxSemana = Math.max(...dados.tendenciaSemanal.map(s => s.total), 1)
  const taxaBatismo = dados.totalEntradas > 0 ? Math.round((dados.batizadosMes / dados.totalEntradas) * 100) : 0

  return (
    <Layout title="Visão de Entrada">
      <div className="max-w-5xl mx-auto space-y-5">

        {/* Subtítulo */}
        <p className="text-xs text-muted-foreground -mt-4">
          Últimos 30 dias · {isAdmin ? 'Todos os grupos' : `Grupo ${GRUPO_LABEL[profile?.grupo as ContactGrupo] ?? profile?.grupo}`}
        </p>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { label: 'Novas entradas',   value: dados.totalEntradas, color: 'text-menta-light' },
            { label: 'Batizados este mês', value: dados.batizadosMes, color: 'text-menta-light' },
            { label: 'Taxa de batismo',  value: `${taxaBatismo}%`,   color: 'text-offwhite' },
          ].map(m => (
            <div key={m.label} className="zion-card">
              <p className="text-xs text-muted-foreground mb-1">{m.label}</p>
              <p className={`text-3xl font-semibold ${m.color}`}>{m.value}</p>
            </div>
          ))}
        </div>

        {/* Tendência semanal */}
        {dados.tendenciaSemanal.length > 0 && (
          <div className="zion-card">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={15} className="text-menta-light" />
              <h2 className="text-sm font-medium text-offwhite">Entradas por semana</h2>
            </div>
            <div className="flex items-end gap-3 h-28">
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Por tipo */}
          <div className="zion-card">
            <h2 className="text-sm font-medium text-offwhite mb-4">Por tipo</h2>
            <div className="space-y-3">
              {dados.porTipo.map(t => {
                const pct = dados.totalEntradas > 0 ? Math.round((t.count / dados.totalEntradas) * 100) : 0
                return (
                  <div key={t.tipo} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-36 flex-shrink-0">{TIPO_LABEL[t.tipo]}</span>
                    <div className="flex-1 bg-muted/30 rounded-full h-2">
                      <div className="h-2 rounded-full bg-menta-light" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-medium text-offwhite w-10 text-right">{t.count} <span className="text-muted-foreground">({pct}%)</span></span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Por faixa etária */}
          <div className="zion-card">
            <h2 className="text-sm font-medium text-offwhite mb-4">Por geracional</h2>
            <div className="space-y-3">
              {dados.porFaixa.map(f => {
                const pct = Math.round((f.count / maxFaixa) * 100)
                return (
                  <div key={f.faixa} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-32 flex-shrink-0">{f.faixa}</span>
                    <div className="flex-1 bg-muted/30 rounded-full h-2">
                      <div className="h-2 rounded-full bg-menta-light" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-medium text-offwhite w-6 text-right">{f.count}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Por local do culto */}
          <div className="zion-card">
            <h2 className="text-sm font-medium text-offwhite mb-4">Por local do culto</h2>
            {dados.porLocal.length === 0
              ? <p className="text-xs text-muted-foreground">Sem dados</p>
              : (
                <div className="space-y-2">
                  {dados.porLocal.map(l => {
                    const pct = Math.round((l.count / maxLocal) * 100)
                    return (
                      <div key={l.local} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-44 truncate flex-shrink-0">{l.local}</span>
                        <div className="flex-1 bg-muted/30 rounded-full h-2">
                          <div className="h-2 rounded-full bg-menta-light" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-medium text-offwhite w-6 text-right">{l.count}</span>
                      </div>
                    )
                  })}
                </div>
              )}
          </div>

          {/* Por igreja de origem */}
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
