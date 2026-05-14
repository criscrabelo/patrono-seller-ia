'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Eye, Trash2, Library, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatDateShort } from '@/lib/utils'
import { STATUS_LABELS, type StatusConteudo } from '@/types'
import { toast } from '@/hooks/use-toast'

interface Conteudo {
  id: string
  status: string
  redeSocial: string
  estilo: string
  visualizacoes: number
  createdAt: string
  produto: { nome: string; imagens: string[] }
}

const STATUS_LIST = Object.keys(STATUS_LABELS) as StatusConteudo[]

export default function ConteudosPage() {
  const [conteudos, setConteudos] = useState<Conteudo[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroRede, setFiltroRede] = useState('')

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

  async function deletar(id: string) {
    if (!confirm('Deseja realmente excluir este conteúdo?')) return
    await fetch(`/api/conteudos/${id}`, { method: 'DELETE' })
    toast({ title: 'Conteúdo excluído', variant: 'success' })
    fetchConteudos()
  }

  const selectClass = `rounded-lg border border-border bg-background px-3 py-2 text-sm text-white
    focus:outline-none focus:ring-1 focus:ring-accent`

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
          {['TikTok', 'Instagram Reels', 'YouTube Shorts', 'WhatsApp', 'Marketplace', 'Landing Page'].map((r) => (
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
    </div>
  )
}
