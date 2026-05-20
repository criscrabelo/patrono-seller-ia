'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Film, Download, Copy, Sparkles, ExternalLink, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDateShort, copyToClipboard } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'

interface ConteudoComVideo {
  id: string
  videoUrl: string
  status: string
  createdAt: string
  publicacaoExternaId: string | null
  produto: { nome: string; imagens: string[] }
}

export default function VideosPage() {
  const [videos, setVideos] = useState<ConteudoComVideo[]>([])
  const [loading, setLoading] = useState(true)

  async function buscar() {
    setLoading(true)
    const res = await fetch('/api/conteudos')
    const data = await res.json()
    if (Array.isArray(data)) {
      // Só conteúdos que já têm vídeo gerado
      setVideos(data.filter((c: ConteudoComVideo) => c.videoUrl))
    }
    setLoading(false)
  }

  useEffect(() => { buscar() }, [])

  function copiarLink(url: string) {
    copyToClipboard(url)
    toast({ title: 'Link copiado!', description: 'Cole onde quiser usar.', variant: 'success' })
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <div key={i} className="card-stat animate-pulse h-80" />)}
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Vídeos Gerados</h2>
          <p className="text-sm text-muted-foreground">
            {videos.length} vídeo(s) criado(s) pela IA
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/conteudos"><Sparkles className="w-4 h-4" />Gerar mais</Link>
        </Button>
      </div>

      {videos.length === 0 ? (
        <div className="card-stat flex flex-col items-center justify-center py-16 text-center">
          <Film className="w-10 h-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground mb-2 font-medium">
            Nenhum vídeo gerado ainda
          </p>
          <p className="text-xs text-muted-foreground mb-4 max-w-md">
            Vá para o <strong className="text-foreground">Banco de Conteúdos</strong>, escolha
            um conteúdo aprovado, clique em <strong className="text-foreground">Postar</strong> e depois em
            <strong className="text-foreground"> &quot;Gerar vídeo com IA&quot;</strong>. Os vídeos prontos
            aparecem aqui.
          </p>
          <Button asChild>
            <Link href="/conteudos"><Sparkles className="w-4 h-4" />Ir para Banco de Conteúdos</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {videos.map((c) => (
            <div key={c.id} className="card-stat space-y-3 flex flex-col">
              {/* Vídeo */}
              <video
                src={c.videoUrl}
                controls
                playsInline
                preload="metadata"
                className="w-full rounded-lg aspect-[9/16] bg-black"
              />

              {/* Info do produto */}
              <div className="flex items-start gap-2">
                {c.produto.imagens[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.produto.imagens[0]}
                    alt=""
                    className="w-9 h-9 rounded object-cover shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded bg-secondary shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{c.produto.nome}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                    {formatDateShort(c.createdAt)}
                    {c.status === 'publicado' && (
                      <span className="text-accent flex items-center gap-0.5">
                        · <CheckCircle className="w-3 h-3" />Publicado
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Ações */}
              <div className="flex gap-2 mt-auto">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => copiarLink(c.videoUrl)}
                >
                  <Copy className="w-3.5 h-3.5" />Copiar URL
                </Button>
                <Button asChild variant="outline" size="sm" className="flex-1">
                  <a href={c.videoUrl} target="_blank" rel="noopener noreferrer" download>
                    <Download className="w-3.5 h-3.5" />Baixar
                  </a>
                </Button>
              </div>

              {/* Link da publicação no IG, se houver */}
              {c.publicacaoExternaId && (
                <a
                  href={`https://www.instagram.com/p/${c.publicacaoExternaId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-accent hover:underline flex items-center gap-1 justify-center"
                >
                  <ExternalLink className="w-3 h-3" />Ver no Instagram
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
