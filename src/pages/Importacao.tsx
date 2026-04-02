import { useState, useCallback, useRef } from 'react'
import { Upload, FileSpreadsheet, X, AlertCircle, CheckCircle, AlertTriangle, Loader2, Info } from 'lucide-react'
import { Layout } from '@/components/layout/Layout'
import { RelatorioImportacaoView } from '@/components/importacao/RelatorioImportacao'
import { previewImportacaoExcel, confirmarImportacao } from '@/lib/importacao'
import type { PreviewImportacao, RelatorioImportacao, ConfigImportacao } from '@/types/importacao'
import { FASE_LABELS } from '@/lib/pipeline'
import { cn } from '@/lib/utils'
import type { FasePipeline, ContactGrupo } from '@/types/database'

type Fase = 'upload' | 'preview' | 'confirmando' | 'concluido' | 'erro'

const GRUPOS: { value: ContactGrupo; label: string }[] = [
  { value: 'rise',       label: 'Rise (12–14 anos)' },
  { value: 'flow',       label: 'Flow (15–17 anos)' },
  { value: 'vox',        label: 'Vox (18–29 anos)' },
  { value: 'ek',         label: 'Eklektos (30–38 anos)' },
  { value: 'zion_geral', label: 'Zion Geral (39+)' },
]

const FASES_IMPORT: FasePipeline[] = ['CONTATO_INICIAL', 'QUALIFICACAO', 'AULAS', 'POS_AULA']

export default function Importacao() {
  const [fase, setFase] = useState<Fase>('upload')
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [erroGlobal, setErroGlobal] = useState<string | null>(null)
  const [preview, setPreview] = useState<PreviewImportacao | null>(null)
  const [relatorio, setRelatorio] = useState<RelatorioImportacao | null>(null)
  const [filtroAba, setFiltroAba] = useState('')
  const [config, setConfig] = useState<ConfigImportacao>({
    fasePipeline: 'CONTATO_INICIAL',
    grupoDefault: 'zion_geral',
    modoImport: 'validas_apenas',
  })
  const inputRef = useRef<HTMLInputElement>(null)
  const bufferRef = useRef<ArrayBuffer | null>(null)

  // ─── Upload e parsing ─────────────────────────────────────────────────────

  async function processar(file: File) {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setErroGlobal('Selecione um arquivo .xlsx ou .xls.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setErroGlobal('Arquivo muito grande. Máximo 10MB.')
      return
    }
    setNomeArquivo(file.name)
    setErroGlobal(null)
    setFase('confirmando') // reuse confirmando state as "parsing"

    try {
      const buffer = await file.arrayBuffer()
      bufferRef.current = buffer
      const resultado = await previewImportacaoExcel(buffer)
      setPreview(resultado)
      setFiltroAba('')
      setFase('preview')
    } catch (err: any) {
      setErroGlobal(err?.message ?? 'Erro inesperado ao processar o arquivo.')
      setFase('erro')
    }
  }

  function handleFile(files: FileList | null) {
    if (!files?.length) return
    processar(files[0])
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files)
  }, [])

  // ─── Confirmar importação ─────────────────────────────────────────────────

  async function handleConfirmar() {
    if (!preview) return
    setFase('confirmando')
    try {
      const resultado = await confirmarImportacao(preview, config)
      setRelatorio(resultado)
      setFase('concluido')
    } catch (err: any) {
      setErroGlobal(err?.message ?? 'Erro ao importar.')
      setFase('erro')
    }
  }

  // ─── Reset ────────────────────────────────────────────────────────────────

  function resetar() {
    setFase('upload')
    setPreview(null)
    setRelatorio(null)
    setErroGlobal(null)
    setNomeArquivo(null)
    setFiltroAba('')
    bufferRef.current = null
    if (inputRef.current) inputRef.current.value = ''
  }

  // ─── Dados filtrados por aba ──────────────────────────────────────────────

  const linhasFiltradas = preview?.resultados.filter(l =>
    !filtroAba || l.aba === filtroAba
  ) ?? []
  const validasFiltradas   = linhasFiltradas.filter(l => l.status === 'SUCESSO')
  const invalidasFiltradas = linhasFiltradas.filter(l => l.status !== 'SUCESSO' && l.status !== 'AVISO_DADO_INCOMPLETO')
  const avisosFiltrados    = linhasFiltradas.filter(l => l.status === 'AVISO_DADO_INCOMPLETO')

  const totalParaImportar = preview
    ? (config.modoImport === 'validas_apenas' ? preview.validas : preview.validas + preview.avisos)
    : 0

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <Layout title="Importar Contatos">
      <div className="max-w-4xl mx-auto space-y-5">

        {/* Steps */}
        <div className="flex items-center gap-2">
          {(['upload', 'preview', 'concluido'] as const).map((f, i) => {
            const done = (f === 'upload' && ['preview','confirmando','concluido'].includes(fase))
                      || (f === 'preview' && fase === 'concluido')
            const active = fase === f || (f === 'preview' && fase === 'confirmando')
            return (
              <div key={f} className="flex items-center gap-2">
                <div className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-all',
                  done   ? 'bg-menta-light text-petroleo'   :
                  active ? 'bg-petroleo/80 text-offwhite border border-menta-light/40' :
                           'bg-muted/40 text-muted-foreground'
                )}>
                  {done ? '✓' : i + 1}
                </div>
                <span className={cn('text-xs', active ? 'text-offwhite font-medium' : 'text-muted-foreground')}>
                  {f === 'upload' ? 'Upload' : f === 'preview' ? 'Preview' : 'Concluído'}
                </span>
                {i < 2 && <div className="w-8 h-px bg-border" />}
              </div>
            )
          })}
        </div>

        {/* ── FASE: UPLOAD ── */}
        {(fase === 'upload' || fase === 'erro') && (
          <>
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all',
                dragging ? 'border-menta-light bg-menta-light/5' : 'border-border hover:border-menta-light/50 hover:bg-muted/20'
              )}
            >
              <div className="w-14 h-14 rounded-full bg-menta-dark/20 flex items-center justify-center">
                <FileSpreadsheet size={26} className="text-menta-light" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-offwhite">Arraste sua planilha aqui</p>
                <p className="text-xs text-muted-foreground mt-1">ou clique para selecionar · .xlsx ou .xls · máx 10MB</p>
              </div>
              <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => handleFile(e.target.files)} />
            </div>

            {erroGlobal && (
              <div className="zion-card border-red-400/30 flex items-start gap-3">
                <AlertCircle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-400">{erroGlobal}</p>
              </div>
            )}

            <div className="zion-card space-y-2">
              <p className="text-xs font-semibold text-offwhite">Formato esperado</p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>Cada aba representa um voluntário — o nome da aba é usado para associar o contato</li>
                <li>Colunas obrigatórias: <strong className="text-offwhite">Nome</strong>, <strong className="text-offwhite">Telefone</strong></li>
                <li>Colunas opcionais: Tipo, Grupo, Email, Sexo, Idade, Igreja Origem, Observações</li>
                <li>Tipo aceito: <em>novo_nascimento</em>, <em>reconciliacao</em>, <em>visitante</em> (e variações)</li>
                <li>Abas ignoradas automaticamente: ORIGEM, CONFIG, LEGENDA, INSTRUÇÕES</li>
              </ul>
            </div>
          </>
        )}

        {/* ── FASE: PARSING / CONFIRMANDO ── */}
        {fase === 'confirmando' && (
          <div className="zion-card flex flex-col items-center gap-4 py-12">
            <Loader2 size={32} className="text-menta-light animate-spin" />
            <div className="text-center">
              <p className="text-sm font-medium text-offwhite">
                {!preview ? `Analisando ${nomeArquivo}...` : 'Importando contatos...'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {!preview ? 'Verificando duplicatas e validando registros' : 'Inserindo no banco de dados'}
              </p>
            </div>
          </div>
        )}

        {/* ── FASE: PREVIEW ── */}
        {fase === 'preview' && preview && (
          <div className="space-y-5">

            {/* Arquivo selecionado */}
            <div className="zion-card flex items-center gap-3">
              <FileSpreadsheet size={18} className="text-menta-light flex-shrink-0" />
              <span className="text-sm text-offwhite flex-1 truncate">{nomeArquivo}</span>
              <button onClick={resetar} className="text-muted-foreground hover:text-red-400 p-1 transition-colors">
                <X size={15} />
              </button>
            </div>

            {/* Cards de resumo */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Total de linhas',    value: preview.totalLinhas, icon: <Info size={16} />,            color: 'text-offwhite' },
                { label: 'Prontas p/ import',  value: preview.validas,     icon: <CheckCircle size={16} />,     color: 'text-emerald-400' },
                { label: 'Com erros',          value: preview.invalidas,   icon: <AlertCircle size={16} />,     color: preview.invalidas > 0 ? 'text-red-400' : 'text-muted-foreground' },
                { label: 'Avisos',             value: preview.avisos,      icon: <AlertTriangle size={16} />,   color: preview.avisos > 0 ? 'text-yellow-400' : 'text-muted-foreground' },
              ].map(m => (
                <div key={m.label} className="zion-card text-center">
                  <div className={cn('mx-auto mb-1', m.color)}>{m.icon}</div>
                  <p className={cn('text-2xl font-bold', m.color)}>{m.value}</p>
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                </div>
              ))}
            </div>

            {/* Configurações */}
            <div className="zion-card space-y-4">
              <p className="text-sm font-medium text-offwhite">Configurações de importação</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Etapa inicial no pipeline</label>
                  <select
                    value={config.fasePipeline}
                    onChange={e => setConfig(c => ({ ...c, fasePipeline: e.target.value as any }))}
                    className={selectCls}
                  >
                    {FASES_IMPORT.map(f => <option key={f} value={f}>{FASE_LABELS[f]}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Grupo padrão</label>
                  <p className="text-[10px] text-muted-foreground/60">Para contatos sem idade</p>
                  <select
                    value={config.grupoDefault}
                    onChange={e => setConfig(c => ({ ...c, grupoDefault: e.target.value }))}
                    className={selectCls}
                  >
                    {GRUPOS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Modo de importação</label>
                  <p className="text-[10px] text-muted-foreground/60">O que fazer com erros</p>
                  <select
                    value={config.modoImport}
                    onChange={e => setConfig(c => ({ ...c, modoImport: e.target.value as any }))}
                    className={selectCls}
                  >
                    <option value="validas_apenas">Apenas linhas válidas ({preview.validas})</option>
                    <option value="todas">Válidas + avisos ({preview.validas + preview.avisos})</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Filtro por aba */}
            {preview.abas.length > 1 && (
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs text-muted-foreground flex-shrink-0">Filtrar por voluntário:</p>
                <button
                  onClick={() => setFiltroAba('')}
                  className={cn('text-xs px-3 py-1 rounded-full border transition-all',
                    !filtroAba ? 'border-menta-light bg-menta-light/15 text-menta-light' : 'border-border text-muted-foreground hover:border-border/80'
                  )}
                >
                  Todos
                </button>
                {preview.abas.map(aba => (
                  <button key={aba} onClick={() => setFiltroAba(aba)}
                    className={cn('text-xs px-3 py-1 rounded-full border transition-all',
                      filtroAba === aba ? 'border-menta-light bg-menta-light/15 text-menta-light' : 'border-border text-muted-foreground hover:border-border/80'
                    )}
                  >
                    {aba}
                  </button>
                ))}
              </div>
            )}

            {/* Tabela de preview */}
            <div className="zion-card overflow-hidden p-0">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <p className="text-xs font-medium text-offwhite">
                  {filtroAba ? `Aba: ${filtroAba}` : 'Todas as abas'} · {linhasFiltradas.length} linhas
                </p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="text-emerald-400">{validasFiltradas.length} OK</span>
                  {invalidasFiltradas.length > 0 && <span className="text-red-400">{invalidasFiltradas.length} erro(s)</span>}
                  {avisosFiltrados.length > 0 && <span className="text-yellow-400">{avisosFiltrados.length} aviso(s)</span>}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      <th className="text-left px-3 py-2 text-muted-foreground font-medium w-12">#</th>
                      <th className="text-left px-3 py-2 text-muted-foreground font-medium">Nome</th>
                      <th className="text-left px-3 py-2 text-muted-foreground font-medium hidden sm:table-cell">Telefone</th>
                      <th className="text-left px-3 py-2 text-muted-foreground font-medium hidden md:table-cell">Tipo</th>
                      <th className="text-left px-3 py-2 text-muted-foreground font-medium hidden lg:table-cell">Aba</th>
                      <th className="text-left px-3 py-2 text-muted-foreground font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhasFiltradas.slice(0, 100).map((l, i) => (
                      <tr key={`${l.aba}-${l.linha}`}
                        className={cn('border-b border-border/40 last:border-0',
                          i % 2 === 0 ? '' : 'bg-muted/10'
                        )}
                        title={l.mensagem}
                      >
                        <td className="px-3 py-2 text-muted-foreground">{l.linha}</td>
                        <td className="px-3 py-2 text-offwhite font-medium truncate max-w-[120px]">{l.nome ?? '—'}</td>
                        <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">{l.telefone ?? '—'}</td>
                        <td className="px-3 py-2 text-muted-foreground hidden md:table-cell">
                          {l.dados?.tipo ? String(l.dados.tipo).replace('_', ' ') : '—'}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground truncate max-w-[80px] hidden lg:table-cell">{l.aba}</td>
                        <td className="px-3 py-2">
                          {l.status === 'SUCESSO' ? (
                            <span className="text-[10px] bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 px-1.5 py-0.5 rounded-full">OK</span>
                          ) : l.status === 'AVISO_DADO_INCOMPLETO' ? (
                            <span className="text-[10px] bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 px-1.5 py-0.5 rounded-full" title={l.mensagem}>Aviso</span>
                          ) : (
                            <span className="text-[10px] bg-red-400/10 text-red-400 border border-red-400/20 px-1.5 py-0.5 rounded-full" title={l.mensagem}>Erro</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {linhasFiltradas.length > 100 && (
                <p className="text-xs text-muted-foreground text-center py-2 border-t border-border">
                  Exibindo 100 de {linhasFiltradas.length} linhas. Todas serão processadas na importação.
                </p>
              )}
            </div>

            {/* Erros detalhados */}
            {invalidasFiltradas.length > 0 && (
              <div className="zion-card border-red-400/20 space-y-2">
                <p className="text-xs font-medium text-red-400">{invalidasFiltradas.length} linha(s) com erro serão ignoradas</p>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {invalidasFiltradas.map(l => (
                    <p key={`${l.aba}-${l.linha}`} className="text-[11px] text-muted-foreground">
                      <strong className="text-offwhite">{l.aba}</strong> · linha {l.linha}: {l.mensagem}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Ações */}
            <div className="flex items-center gap-3">
              <button onClick={resetar} className="text-sm text-muted-foreground hover:text-offwhite transition-colors px-3 py-2">
                ← Trocar arquivo
              </button>
              <button
                onClick={handleConfirmar}
                disabled={totalParaImportar === 0}
                className="flex-1 sm:flex-none bg-menta-dark text-petroleo text-sm font-semibold px-6 py-2.5 rounded-xl hover:bg-menta-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Importar {totalParaImportar} contato{totalParaImportar !== 1 ? 's' : ''} →
              </button>
            </div>
          </div>
        )}

        {/* ── FASE: CONCLUÍDO ── */}
        {fase === 'concluido' && relatorio && (
          <div className="space-y-5">
            <div className="zion-card flex items-center gap-3">
              <FileSpreadsheet size={18} className="text-menta-light flex-shrink-0" />
              <span className="text-sm text-offwhite flex-1 truncate">{nomeArquivo}</span>
              <CheckCircle size={16} className="text-emerald-400" />
            </div>
            <RelatorioImportacaoView relatorio={relatorio} />
            <button onClick={resetar} className="zion-btn-secondary w-full flex items-center justify-center gap-2 text-sm">
              <Upload size={15} />Nova importação
            </button>
          </div>
        )}
      </div>
    </Layout>
  )
}

const selectCls = 'w-full text-sm bg-input border border-border rounded-xl px-3 py-2 text-offwhite focus:outline-none focus:ring-1 focus:ring-menta-light'
