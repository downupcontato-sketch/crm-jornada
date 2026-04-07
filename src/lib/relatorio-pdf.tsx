import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { FasePipeline, ContactGrupo, ContactTipo } from '@/types/database'
import { FASE_LABELS } from '@/lib/pipeline'
import { LOCAL_OPTIONS } from '@/lib/locaisCulto'

// ─── Labels ─────────────────────────────────────────────────────────────────

export const GRUPO_LABEL: Record<ContactGrupo, string> = {
  rise:       'Rise',
  flow:       'Flow',
  vox:        'Vox',
  ek:         'Eklektos',
  zion_geral: 'Zion Geral',
}

export const TIPO_LABEL: Record<ContactTipo, string> = {
  novo_nascimento: 'Novo Nascimento',
  reconciliacao:   'Reconciliação',
  visitante:       'Visitante',
}

const LOCAIS_CAMPUS      = new Set(LOCAL_OPTIONS.find(g => g.group === 'Campus Chácara Flora')?.items ?? [])
const LOCAIS_GERACIONAIS = new Set(LOCAL_OPTIONS.find(g => g.group === 'Cultos por Ministério')?.items ?? [])

export const FASES_ATIVAS: FasePipeline[] = [
  'CONTATO_INICIAL', 'QUALIFICACAO', 'AULAS', 'POS_AULA', 'BATIZADO',
]

// ─── Tipos de dados do relatório ─────────────────────────────────────────────

export interface DadosRelatorio {
  meta: {
    totalContatos: number
    geradoEm: string
    dataInicio: string
    dataFim: string
    nomeRelator: string
  }
  porFase: { fase: FasePipeline; count: number }[]
  porGrupo: { grupo: ContactGrupo; count: number }[]
  porLocal: { local: string; count: number }[]
  porTipo: { tipo: ContactTipo; count: number }[]
  taxaConversao: { de: FasePipeline; para: FasePipeline; taxa: number }[]
  sla: { ok: number; warn: number; over: number }
  batizados: number
  porVoluntario: { id: string; nome: string; grupo: string; totalContatos: number }[]
  porIgrejaOrigem: { nome: string; count: number }[]
  porSexo?: { sexo: string; count: number }[]
  matrizTipoLocal?: { local: string; novo_nascimento: number; reconciliacao: number; visitante: number; total: number }[]
}

// ─── Estilos ─────────────────────────────────────────────────────────────────

const C = {
  petroleo:  '#071C23',
  teal:      '#00B0A8',
  gray:      '#6B7280',
  lightGray: '#F3F4F6',
  border:    '#E5E7EB',
  white:     '#FFFFFF',
  red:       '#EF4444',
  amber:     '#F59E0B',
}

const s = StyleSheet.create({
  page:         { fontSize: 9, color: C.petroleo, padding: 40, backgroundColor: C.white },
  logo:         { fontSize: 16, fontWeight: 'bold', color: C.teal, marginBottom: 3 },
  subtitle:     { fontSize: 8, color: C.gray },
  section:      { marginBottom: 18 },
  sectionTitle: { fontSize: 10, fontWeight: 'bold', color: C.petroleo, borderBottomWidth: 1, borderBottomColor: C.teal, paddingBottom: 3, marginBottom: 8 },
  row:          { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  label:        { width: 160, color: C.gray, fontSize: 8 },
  value:        { fontWeight: 'bold', fontSize: 9 },
  barBg:        { flex: 1, height: 7, backgroundColor: C.lightGray, borderRadius: 2, marginLeft: 8 },
  bar:          { height: 7, backgroundColor: C.teal, borderRadius: 2 },
  metaRow:      { flexDirection: 'row', gap: 10, marginBottom: 18 },
  metaCard:     { flex: 1, backgroundColor: C.lightGray, borderRadius: 4, padding: 8 },
  metaNum:      { fontSize: 18, fontWeight: 'bold', color: C.teal },
  metaLabel:    { fontSize: 7, color: C.gray, marginTop: 2 },
  tableHeader:  { flexDirection: 'row', backgroundColor: C.petroleo, padding: 5, borderRadius: 2 },
  tableRow:     { flexDirection: 'row', padding: 5, borderBottomWidth: 1, borderBottomColor: C.border },
  tableRowAlt:  { flexDirection: 'row', padding: 5, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.lightGray },
  th:           { fontSize: 7, fontWeight: 'bold', color: C.white },
  td:           { fontSize: 8, color: C.petroleo },
  footer:       { position: 'absolute', bottom: 24, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', color: C.gray, fontSize: 7 },
  header:       { marginBottom: 20 },
})

// ─── Helper: tabela de matriz tipo × culto ────────────────────────────────────

type MatrizRow = NonNullable<DadosRelatorio['matrizTipoLocal']>[number]

function MatrizPDF({ titulo, rows }: { titulo: string; rows: MatrizRow[] }) {
  if (rows.length === 0) return null
  const totalNN  = rows.reduce((a, r) => a + r.novo_nascimento, 0)
  const totalRec = rows.reduce((a, r) => a + r.reconciliacao, 0)
  const totalVis = rows.reduce((a, r) => a + r.visitante, 0)
  const total    = totalNN + totalRec + totalVis
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{titulo}</Text>
      <View style={{ borderRadius: 3, overflow: 'hidden' }}>
        <View style={s.tableHeader}>
          <Text style={[s.th, { flex: 3 }]}>Evento / Culto</Text>
          <Text style={[s.th, { width: 65, textAlign: 'center' }]}>Novo Nasc.</Text>
          <Text style={[s.th, { width: 55, textAlign: 'center' }]}>Reconcil.</Text>
          <Text style={[s.th, { width: 50, textAlign: 'center' }]}>Visitante</Text>
          <Text style={[s.th, { width: 40, textAlign: 'right' }]}>Total</Text>
        </View>
        {rows.map((row, i) => (
          <View key={row.local} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
            <Text style={[s.td, { flex: 3 }]}>{row.local}</Text>
            <Text style={[s.td, { width: 65, textAlign: 'center' }]}>{row.novo_nascimento || '—'}</Text>
            <Text style={[s.td, { width: 55, textAlign: 'center' }]}>{row.reconciliacao   || '—'}</Text>
            <Text style={[s.td, { width: 50, textAlign: 'center' }]}>{row.visitante       || '—'}</Text>
            <Text style={[s.td, { width: 40, textAlign: 'right', fontWeight: 'bold' }]}>{row.total}</Text>
          </View>
        ))}
        {/* Linha de total */}
        <View style={[s.tableRow, { backgroundColor: C.lightGray }]}>
          <Text style={[s.td, { flex: 3, fontWeight: 'bold', color: C.petroleo }]}>Total</Text>
          <Text style={[s.td, { width: 65, textAlign: 'center', fontWeight: 'bold' }]}>{totalNN}</Text>
          <Text style={[s.td, { width: 55, textAlign: 'center', fontWeight: 'bold' }]}>{totalRec}</Text>
          <Text style={[s.td, { width: 50, textAlign: 'center', fontWeight: 'bold' }]}>{totalVis}</Text>
          <Text style={[s.td, { width: 40, textAlign: 'right', fontWeight: 'bold', color: C.teal }]}>{total}</Text>
        </View>
      </View>
    </View>
  )
}

// ─── Componente PDF ───────────────────────────────────────────────────────────

export function RelatorioPDF({ dados }: { dados: DadosRelatorio }) {
  const { meta, porFase, porGrupo, porLocal, porTipo, taxaConversao, sla, batizados, porVoluntario, porIgrejaOrigem, porSexo, matrizTipoLocal } = dados
  const matrizCampus      = (matrizTipoLocal ?? []).filter(r => LOCAIS_CAMPUS.has(r.local as any))
  const matrizGeracionais = (matrizTipoLocal ?? []).filter(r => LOCAIS_GERACIONAIS.has(r.local as any))
  const dataInicio = new Date(meta.dataInicio).toLocaleDateString('pt-BR')
  const dataFim    = new Date(meta.dataFim).toLocaleDateString('pt-BR')
  const geradoEm   = new Date(meta.geradoEm).toLocaleString('pt-BR')
  const maxLocal   = Math.max(...porLocal.map(l => l.count), 1)

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Cabeçalho */}
        <View style={s.header}>
          <Text style={s.logo}>Jornada CRM — Zion Church</Text>
          <Text style={s.subtitle}>Gerado em {geradoEm} por {meta.nomeRelator}</Text>
          <Text style={[s.subtitle, { marginTop: 2 }]}>Período: {dataInicio} → {dataFim}</Text>
        </View>

        {/* Cards de resumo */}
        <View style={s.metaRow}>
          <View style={s.metaCard}>
            <Text style={s.metaNum}>{meta.totalContatos}</Text>
            <Text style={s.metaLabel}>Total de contatos</Text>
          </View>
          <View style={s.metaCard}>
            <Text style={s.metaNum}>{batizados}</Text>
            <Text style={s.metaLabel}>Batizados no período</Text>
          </View>
          <View style={s.metaCard}>
            <Text style={[s.metaNum, { color: sla.over > 0 ? C.red : C.teal }]}>{sla.over}</Text>
            <Text style={s.metaLabel}>SLA vencido</Text>
          </View>
          <View style={s.metaCard}>
            <Text style={[s.metaNum, { color: sla.warn > 0 ? C.amber : C.teal }]}>{sla.warn}</Text>
            <Text style={s.metaLabel}>SLA em atenção</Text>
          </View>
        </View>

        {/* 1. Por fase */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Contatos por etapa do pipeline</Text>
          {FASES_ATIVAS.map(fase => {
            const item = porFase.find(p => p.fase === fase)
            const count = item?.count ?? 0
            const pct = meta.totalContatos > 0 ? (count / meta.totalContatos) * 100 : 0
            return (
              <View key={fase} style={s.row}>
                <Text style={s.label}>{FASE_LABELS[fase]}</Text>
                <Text style={[s.value, { width: 28, textAlign: 'right' }]}>{count}</Text>
                <View style={s.barBg}>
                  <View style={[s.bar, { width: `${pct}%` }]} />
                </View>
                <Text style={[s.subtitle, { width: 32, textAlign: 'right' }]}>{Math.round(pct)}%</Text>
              </View>
            )
          })}
        </View>

        {/* 2. Taxa de conversão */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Taxa de conversão entre etapas</Text>
          {taxaConversao.map(t => (
            <View key={`${t.de}-${t.para}`} style={s.row}>
              <Text style={s.label}>{FASE_LABELS[t.de]} → {FASE_LABELS[t.para]}</Text>
              <Text style={[s.value, {
                color: t.taxa >= 50 ? C.teal : t.taxa >= 25 ? C.amber : C.red,
              }]}>{t.taxa}%</Text>
            </View>
          ))}
        </View>

        {/* 3. Por grupo */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Contatos por grupo ministerial</Text>
          {porGrupo.map(g => (
            <View key={g.grupo} style={s.row}>
              <Text style={s.label}>{GRUPO_LABEL[g.grupo]}</Text>
              <Text style={s.value}>{g.count}</Text>
            </View>
          ))}
        </View>

        {/* 4. Por tipo */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Contatos por tipo</Text>
          {porTipo.map(t => (
            <View key={t.tipo} style={s.row}>
              <Text style={s.label}>{TIPO_LABEL[t.tipo]}</Text>
              <Text style={s.value}>{t.count}</Text>
            </View>
          ))}
        </View>

        {/* 5. Por sexo */}
        {porSexo && porSexo.filter(s => s.sexo !== 'NAO_INFORMADO').length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Distribuição por sexo</Text>
            {porSexo.filter(s => s.sexo !== 'NAO_INFORMADO').map(sx => (
              <View key={sx.sexo} style={s.row}>
                <Text style={s.label}>{sx.sexo === 'MASCULINO' ? 'Masculino' : 'Feminino'}</Text>
                <Text style={s.value}>{sx.count}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={s.footer} fixed>
          <Text>Jornada CRM · Zion Church</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>

      {/* Página 2 — Local + Voluntários */}
      <Page size="A4" style={s.page}>
        {/* 5. Por local do culto */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Contatos por local do culto</Text>
          {porLocal.map(l => {
            const pct = (l.count / maxLocal) * 100
            return (
              <View key={l.local} style={s.row}>
                <Text style={[s.label, { width: 190 }]}>{l.local}</Text>
                <Text style={[s.value, { width: 28, textAlign: 'right' }]}>{l.count}</Text>
                <View style={s.barBg}>
                  <View style={[s.bar, { width: `${pct}%` }]} />
                </View>
              </View>
            )
          })}
        </View>

        {/* 6. Matrizes de conversão por culto */}
        <MatrizPDF titulo="Conversões por culto — Consolidado" rows={matrizTipoLocal ?? []} />
        <MatrizPDF titulo="Conversões por culto — Campus Chácara Flora" rows={matrizCampus} />
        <MatrizPDF titulo="Conversões por culto — Geracionais" rows={matrizGeracionais} />

        {/* 7. Igreja de origem (visitantes) */}
        {porIgrejaOrigem.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Visitantes por igreja de origem</Text>
            {porIgrejaOrigem.map(ig => (
              <View key={ig.nome} style={s.row}>
                <Text style={[s.label, { width: 220 }]}>{ig.nome}</Text>
                <Text style={s.value}>{ig.count}</Text>
              </View>
            ))}
          </View>
        )}

        {/* 7. Por voluntário */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Contatos por voluntário</Text>
          <View style={{ borderRadius: 3, overflow: 'hidden' }}>
            <View style={s.tableHeader}>
              <Text style={[s.th, { flex: 2 }]}>Voluntário</Text>
              <Text style={[s.th, { flex: 1 }]}>Grupo</Text>
              <Text style={[s.th, { width: 50, textAlign: 'right' }]}>Contatos</Text>
            </View>
            {porVoluntario.map((v, i) => (
              <View key={v.id} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                <Text style={[s.td, { flex: 2 }]}>{v.nome}</Text>
                <Text style={[s.td, { flex: 1 }]}>{GRUPO_LABEL[v.grupo as ContactGrupo] ?? v.grupo}</Text>
                <Text style={[s.td, { width: 50, textAlign: 'right', fontWeight: 'bold' }]}>{v.totalContatos}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={s.footer} fixed>
          <Text>Jornada CRM · Zion Church</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
