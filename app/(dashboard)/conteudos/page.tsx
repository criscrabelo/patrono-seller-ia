'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Eye, Trash2, Library, Zap, CalendarClock, X, Send, Upload, Copy,
  Instagram, Loader2, ExternalLink, AlertCircle, CheckCircle, Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatDateShort, copyToClipboard } from '@/lib/utils'
import { LINK_COMPRA } from '@/lib/config'
import { STATUS_LABELS, type StatusConteudo } from '@/types'
import { toast } from '@/hooks/use-toast'

interface Conteudo {
  id: string
  status: string
  redeSocial: string
  estilo: string
  visualizacoes: number
  createdAt: string
  dataAgendamento: string | null
  videoUrl: string | null
  videoRequestId: string | null
  videoErro: string | null
  legendaInstagram: string | null
  hashtags: string[]
  chamadaAcao: string | null
  publicacaoExternaId: string | null
  erroPublicacao: string | null
  produto: { nome: string; imagens: string[] }
}

const STATUS_LIST = Object.keys(STATUS_LABELS) as StatusConteudo[]

export default function ConteudosPage() {
  const [conteudos, setConteudos] = useState<Conteudo[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroRede, setFiltroRede] = useState('')
  const [agendarId, setAgendarId] = useState<string | null>(null)
  const [agendarData, setAgendarData] = useState('')
  const [salvandoAgenda, setSalvandoAgenda] = useState(false)
  const [igConectado, setIgConectado] = useState(false)
  const [publicarId, setPublicarId] = useState<string | null>(null)
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [publicandoIg, setPublicandoIg] = useState(false)
  const [gerandoVideoIA, setGerandoVideoIA] = useState(false)

  async function fetchConteudos() {
    setLoading(true)
    const params = new URLSearchParams()
    if (filtroStatus) params.set('status', filtroStatus)
    if (filtroRede) params.set('redeSocial', filtroRede)
    const res = await fetch(`/api/conteudos?${params}`)
    const data = await res.json()
    setConteudos(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { fetchConteudos() }, [filtroStatus, filtroRede])

  useEffect(() => {
    fetch('/api/integracoes')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setIgConectado(
            data.some((i) => i.plataforma === 'instagram' && i.status === 'conectado')
          )
        }
      })
      .catch(() => {})
  }, [])

  // Polling do status de geração de vídeo (fal.ai) enquanto a modal Postar
  // está aberta e existe um job em andamento.
  useEffect(() => {
    if (!publicarId) {
      setGerandoVideoIA(false)
      return
    }
    const c = conteudos.find((x) => x.id === publicarId)
    if (!c?.videoRequestId || c.videoUrl) {
      setGerandoVideoIA(false)
      return
    }
    setGerandoVideoIA(true)
    let cancelado = false
    const tick = async () => {
      if (cancelado) return
      try {
        const res = await fetch(`/api/conteudos/${publicarId}/video-status`)
        const data = await res.json().catch(() => ({}))
        if (cancelado) return
        if (data.status === 'pronto') {
          toast({ title: 'Vídeo pronto!', description: 'A IA gerou o vídeo e ele já está anexado.', variant: 'success' })
          fetchConteudos()
        } else if (data.status === 'erro') {
          toast({ title: 'Falha na geração do vídeo', description: data.erro ?? '', variant: 'destructive' })
          fetchConteudos()
        }
      } catch {}
    }
    const intervalo = setInterval(tick, 5000)
    return () => { cancelado = true; clearInterval(intervalo) }
  }, [publicarId, conteudos])

  async function deletar(id: string) {
    if (!confirm('Deseja realmente excluir este conteúdo?')) return
    await fetch(`/api/conteudos/${id}`, { method: 'DELETE' })
    toast({ title: 'Conteúdo excluído', variant: 'success' })
    fetchConteudos()
  }

  function abrirAgendamento(c: Conteudo) {
    setAgendarId(c.id)
    // pré-preenche com a data já agendada (se houver), no formato datetime-local
    if (c.dataAgendamento) {
      const d = new Date(c.dataAgendamento)
      const pad = (n: number) => String(n).padStart(2, '0')
      setAgendarData(
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
      )
    } else {
      setAgendarData('')
    }
  }

  async function confirmarAgendamento() {
    if (!agendarId || !agendarData) {
      toast({ title: 'Escolha a data e a hora', variant: 'destructive' })
      return
    }
    const dataISO = new Date(agendarData)
    if (isNaN(dataISO.getTime())) {
      toast({ title: 'Data inválida', variant: 'destructive' })
      return
    }
    setSalvandoAgenda(true)
    const res = await fetch(`/api/conteudos/${agendarId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'agendado', dataAgendamento: dataISO.toISOString() }),
    })
    setSalvandoAgenda(false)
    if (!res.ok) {
      toast({ title: 'Erro ao agendar', description: 'Tente novamente.', variant: 'destructive' })
      return
    }
    toast({ title: 'Conteúdo agendado!', description: 'Será publicado automaticamente na data marcada.', variant: 'success' })
    setAgendarId(null)
    setAgendarData('')
    fetchConteudos()
  }

  async function enviarVideo(file: File) {
    if (!publicarId) return
    if (!file.type.startsWith('video/')) {
      toast({ title: 'Selecione um arquivo de vídeo', variant: 'destructive' })
      return
    }
    setUploadingVideo(true)

    // 1. Solicita URL assinada — o arquivo vai direto do browser ao Supabase
    const presign = await fetch('/api/upload/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size }),
    })
    if (!presign.ok) {
      const err = await presign.json().catch(() => ({}))
      setUploadingVideo(false)
      toast({ title: 'Erro no upload', description: err.error ?? 'Tente novamente.', variant: 'destructive' })
      return
    }
    const { uploadUrl, publicUrl } = await presign.json()

    // 2. Envia o arquivo diretamente ao Supabase (sem passar pelo Next.js)
    const put = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    })
    if (!put.ok) {
      setUploadingVideo(false)
      toast({ title: 'Erro no upload', description: 'Falha ao enviar o arquivo. Tente novamente.', variant: 'destructive' })
      return
    }

    // 3. Salva a URL pública no conteúdo
    const patch = await fetch(`/api/conteudos/${publicarId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoUrl: publicUrl }),
    })
    setUploadingVideo(false)
    if (!patch.ok) {
      toast({ title: 'Erro ao salvar o vídeo', variant: 'destructive' })
      return
    }
    toast({ title: 'Vídeo enviado!', variant: 'success' })
    fetchConteudos()
  }

  function copiarTudo(c: Conteudo) {
    const texto = [
      c.legendaInstagram?.trim(),
      (c.hashtags ?? []).join(' ').trim(),
      c.chamadaAcao?.trim(),
      `🛒 Comprar: ${LINK_COMPRA}`,
    ].filter(Boolean).join('\n\n')
    copyToClipboard(texto)
    toast({ title: 'Tudo copiado!', description: 'Legenda, hashtags e link prontos para colar.', variant: 'success' })
  }

  async function gerarVideoIA() {
    if (!publicarId) return
    setGerandoVideoIA(true)
    const res = await fetch(`/api/conteudos/${publicarId}/gerar-video`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setGerandoVideoIA(false)
      toast({ title: 'Erro ao iniciar geração', description: data.error ?? 'Tente novamente.', variant: 'destructive' })
      return
    }
    toast({ title: 'Geração iniciada!', description: 'O vídeo deve ficar pronto em 1-3 minutos. Aguarde nesta tela.', variant: 'success' })
    fetchConteudos()
  }

  async function publicarInstagram() {
    if (!publicarId) return
    setPublicandoIg(true)
    const res = await fetch(`/api/conteudos/${publicarId}/publicar`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    setPublicandoIg(false)
    if (!res.ok) {
      toast({ title: 'Falha ao publicar', description: data.error ?? 'Tente novamente.', variant: 'destructive' })
      if (data.oauthError) setIgConectado(false)
      fetchConteudos()
      return
    }
    toast({ title: 'Publicado no Instagram!', variant: 'success' })
    setPublicarId(null)
    fetchConteudos()
  }

  const selectClass = `rounded-lg border border-border bg-background px-3 py-2 text-sm text-white
    focus:outline-none focus:ring-1 focus:ring-accent`

  const conteudoPublicar = conteudos.find((c) => c.id === publicarId) ?? null

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Banco de Conteúdos</h2>
          <p className="text-sm text-muted-foreground">{conteudos.length} conteúdo(s)</p>
        </div>
        <Button asChild>
          <Link href="/conteudos/gerar"><Zap className="w-4 h-4" />Gerar Novo</Link>
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <select className={selectClass} value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}>
          <option value="">Todos os status</option>
          {STATUS_LIST.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
        <select className={selectClass} value={filtroRede}
          onChange={(e) => setFiltroRede(e.target.value)}>
          <option value="">Todas as redes</option>
          {['TikTok', 'Instagram Reels', 'YouTube Shorts', 'WhatsApp', 'Facebook', 'Marketplace', 'Landing Page'].map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="card-stat animate-pulse h-64" />
      ) : conteudos.length === 0 ? (
        <div className="card-stat flex flex-col items-center justify-center py-16 text-center">
          <Library className="w-10 h-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground mb-4">Nenhum conteúdo encontrado.</p>
          <Button asChild>
            <Link href="/conteudos/gerar"><Zap className="w-4 h-4" />Gerar primeiro conteúdo</Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Produto</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Rede</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Estilo</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Views</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Data</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody>
                {conteudos.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {c.produto.imagens[0] ? (
                          <img src={c.produto.imagens[0]} alt="" className="w-7 h-7 rounded object-cover" />
                        ) : (
                          <div className="w-7 h-7 rounded bg-secondary" />
                        )}
                        <span className="font-medium text-white">{c.produto.nome}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.redeSocial}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.estilo}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.status as StatusConteudo} />
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{c.visualizacoes.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{formatDateShort(c.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {(c.status === 'aprovado' || c.status === 'agendado') && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => abrirAgendamento(c)}>
                              <CalendarClock className="w-3.5 h-3.5" />
                              {c.status === 'agendado' ? 'Reagendar' : 'Agendar'}
                            </Button>
                            <Button size="sm" onClick={() => setPublicarId(c.id)}>
                              <Send className="w-3.5 h-3.5" />Postar
                            </Button>
                          </>
                        )}
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/conteudos/${c.id}`}><Eye className="w-3.5 h-3.5" /></Link>
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => deletar(c.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de agendamento */}
      {agendarId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !salvandoAgenda && setAgendarId(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-border bg-card p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-accent" />Agendar publicação
              </h3>
              <button
                onClick={() => !salvandoAgenda && setAgendarId(null)}
                className="text-muted-foreground hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Data e hora</label>
              <input
                type="datetime-local"
                value={agendarData}
                onChange={(e) => setAgendarData(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm
                  text-white focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Na data marcada o conteúdo é publicado automaticamente. Se houver vídeo e o
              Instagram estiver conectado, o Reels é publicado de verdade.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAgendarId(null)} disabled={salvandoAgenda}>
                Cancelar
              </Button>
              <Button onClick={confirmarAgendamento} disabled={salvandoAgenda}>
                {salvandoAgenda ? 'Salvando...' : 'Confirmar agendamento'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de postagem */}
      {conteudoPublicar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !uploadingVideo && !publicandoIg && setPublicarId(null)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-border bg-card p-5 space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-accent" />Postar — {conteudoPublicar.produto.nome}
              </h3>
              <button
                onClick={() => !uploadingVideo && !publicandoIg && setPublicarId(null)}
                className="text-muted-foreground hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Vídeo */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Vídeo do Reels
              </p>
              {conteudoPublicar.videoUrl ? (
                <div className="rounded-lg border border-accent/30 bg-accent/10 p-3 flex items-center justify-between gap-2">
                  <span className="text-sm text-accent flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4" />Vídeo pronto
                  </span>
                  <a
                    href={conteudoPublicar.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-accent hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />Ver
                  </a>
                </div>
              ) : gerandoVideoIA ? (
                <div className="rounded-lg border border-accent/30 bg-accent/10 p-3 flex items-start gap-2 text-sm text-accent">
                  <Loader2 className="w-4 h-4 animate-spin mt-0.5 shrink-0" />
                  <span>
                    A IA está gerando o vídeo… leva de 1 a 3 minutos. Pode deixar
                    esta janela aberta — quando ficar pronto aparece aqui.
                  </span>
                </div>
              ) : (
                <>
                  <p className="text-[11px] text-muted-foreground">
                    Use a IA (Kling v3) gerando a partir da imagem do produto, ou envie um vídeo pronto.
                  </p>
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={uploadingVideo}
                    onClick={gerarVideoIA}
                  >
                    <Sparkles className="w-4 h-4" />Gerar vídeo com IA (Kling v3)
                  </Button>
                </>
              )}
              {conteudoPublicar.videoErro && !gerandoVideoIA && (
                <div className="rounded-lg border border-danger/30 bg-danger/10 p-2.5 text-xs text-danger flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>Erro na geração: {conteudoPublicar.videoErro}</span>
                </div>
              )}
              <label className="block">
                <input
                  type="file"
                  accept="video/*"
                  disabled={uploadingVideo || gerandoVideoIA}
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) enviarVideo(f)
                    e.target.value = ''
                  }}
                  className="hidden"
                />
                <span className={`flex items-center justify-center gap-2 rounded-lg border border-border
                  bg-background px-3 py-2.5 text-sm cursor-pointer hover:bg-secondary transition-colors
                  ${uploadingVideo || gerandoVideoIA ? 'opacity-60 pointer-events-none' : ''}`}>
                  {uploadingVideo
                    ? <><Loader2 className="w-4 h-4 animate-spin" />Enviando vídeo...</>
                    : <><Upload className="w-4 h-4" />{conteudoPublicar.videoUrl ? 'Trocar vídeo' : 'Ou enviar vídeo pronto'}</>}
                </span>
              </label>
            </div>

            {/* Legenda */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Legenda
              </p>
              <Button variant="outline" className="w-full" onClick={() => copiarTudo(conteudoPublicar)}>
                <Copy className="w-4 h-4" />Copiar tudo para postar
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Copia legenda + hashtags + chamada + link de compra de uma vez.
              </p>
            </div>

            {/* Publicar no Instagram */}
            <div className="space-y-2 pt-2 border-t border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Publicar no Instagram
              </p>
              {!igConectado && (
                <div className="rounded-lg border border-warning/30 bg-warning/10 p-2.5 text-xs text-warning flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>
                    Instagram não conectado.{' '}
                    <Link href="/integracoes" className="underline">Conectar em Integrações</Link>
                  </span>
                </div>
              )}
              {conteudoPublicar.erroPublicacao && (
                <div className="rounded-lg border border-danger/30 bg-danger/10 p-2.5 text-xs text-danger flex items-start gap-2">
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>
                    Último erro: {conteudoPublicar.erroPublicacao}
                    {(conteudoPublicar.erroPublicacao.toLowerCase().includes('oauth') ||
                      conteudoPublicar.erroPublicacao.toLowerCase().includes('access token')) && (
                      <>
                        {' — '}
                        <Link href="/integracoes" className="underline font-semibold">
                          Reconectar Instagram
                        </Link>
                      </>
                    )}
                  </span>
                </div>
              )}
              <Button
                className="w-full"
                disabled={!igConectado || !conteudoPublicar.videoUrl || publicandoIg || uploadingVideo}
                onClick={publicarInstagram}
              >
                {publicandoIg
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Publicando...</>
                  : <><Instagram className="w-4 h-4" />Publicar no Instagram agora</>}
              </Button>
              {!conteudoPublicar.videoUrl && (
                <p className="text-[11px] text-muted-foreground">
                  Envie o vídeo acima para habilitar a publicação.
                </p>
              )}
              {publicandoIg && (
                <p className="text-[11px] text-muted-foreground">
                  O Instagram pode levar até ~1 minuto processando o vídeo. Não feche esta janela.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
