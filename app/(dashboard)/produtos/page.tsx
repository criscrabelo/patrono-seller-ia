'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Package, ExternalLink, Zap, Trash2, Search, RefreshCw, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDateShort } from '@/lib/utils'
import { CATEGORIAS } from '@/types'
import { toast } from '@/hooks/use-toast'

interface Produto {
  id: string
  nome: string
  categoria: string
  preco: number | null
  tipoVenda: string
  imagens: string[]
  createdAt: string
  _count: { conteudos: number }
}

export default function ProdutosPage() {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState('')

  async function fetchProdutos() {
    setLoading(true)
    setErro(null)
    try {
      const params = new URLSearchParams()
      if (busca) params.set('busca', busca)
      if (categoria) params.set('categoria', categoria)
      const res = await fetch(`/api/produtos?${params}`)
      const data = await res.json()
      if (!res.ok) {
        setErro(data?.error || `Erro ${res.status} ao carregar produtos`)
        setProdutos([])
      } else {
        setProdutos(Array.isArray(data) ? data : [])
      }
    } catch {
      setErro('Falha de conexão. Verifique sua internet e tente novamente.')
      setProdutos([])
    } finally {
      setLoading(false)
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchProdutos() }, [busca, categoria])

  async function deletar(id: string) {
    if (!confirm('Deseja realmente arquivar este produto?')) return
    await fetch(`/api/produtos/${id}`, { method: 'DELETE' })
    toast({ title: 'Produto arquivado', variant: 'success' })
    fetchProdutos()
  }

  return (
    <div className="space-y-4 w-full max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-white">Produtos</h2>
          <p className="text-sm text-muted-foreground">{produtos.length} produto(s) cadastrado(s)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchProdutos} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button asChild>
            <Link href="/produtos/novo">
              <Plus className="w-4 h-4" />
              Novo Produto
            </Link>
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border bg-background
                       text-white placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <select
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-border bg-background text-white
                     focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="">Todas as categorias</option>
          {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Erro de carregamento */}
      {erro && (
        <div className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3">
          <AlertCircle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-danger font-medium">Erro ao carregar produtos</p>
            <p className="text-xs text-danger/80 mt-0.5">{erro}</p>
          </div>
          <button
            onClick={fetchProdutos}
            className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white border border-border rounded-md px-2 py-1 transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> Tentar novamente
          </button>
        </div>
      )}

      {/* Grid de produtos */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card-stat animate-pulse h-48" />
          ))}
        </div>
      ) : produtos.length === 0 ? (
        <div className="card-stat flex flex-col items-center justify-center py-16 text-center">
          <Package className="w-10 h-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground mb-4">Nenhum produto cadastrado ainda.</p>
          <Button asChild>
            <Link href="/produtos/novo"><Plus className="w-4 h-4" />Cadastrar primeiro produto</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {produtos.map((p) => (
            <div key={p.id} className="card-stat flex flex-col gap-3">
              {/* Imagem */}
              <div className="w-full h-32 rounded-lg bg-secondary flex items-center justify-center overflow-hidden">
                {p.imagens[0] ? (
                  <img src={p.imagens[0]} alt={p.nome} className="w-full h-full object-cover" />
                ) : (
                  <Package className="w-8 h-8 text-muted-foreground" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1">
                <p className="font-semibold text-white text-sm line-clamp-1">{p.nome}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {p.categoria} · {p.tipoVenda}
                </p>
                <div className="flex items-center justify-end mt-2">
                  <span className="text-xs text-muted-foreground">{p._count.conteudos} conteúdo(s)</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{formatDateShort(p.createdAt)}</p>
              </div>

              {/* Ações */}
              <div className="flex gap-2 pt-2 border-t border-border">
                <Button asChild size="sm" variant="outline" className="flex-1">
                  <Link href={`/produtos/${p.id}/editar`}><ExternalLink className="w-3.5 h-3.5" />Imagens</Link>
                </Button>
                <Button asChild size="sm" className="flex-1">
                  <Link href={`/conteudos/gerar?produtoId=${p.id}`}><Zap className="w-3.5 h-3.5" />Gerar</Link>
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => deletar(p.id)}
                  className="w-9 p-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
