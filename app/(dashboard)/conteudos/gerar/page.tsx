'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Zap, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConteudoPreview } from '@/components/conteudos/ConteudoPreview'
import { REDES_SOCIAIS, DURACOES, ESTILOS, OBJETIVOS } from '@/types'
import { toast } from '@/hooks/use-toast'

interface Produto {
  id: string
  nome: string
  categoria: string
}

function GerarConteudoInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [conteudo, setConteudo] = useState<Record<string, unknown> | null>(null)
  const [gerando, setGerando] = useState(false)
  const [config, setConfig] = useState({
    produtoId: searchParams.get('produtoId') ?? '',
    redeSocial: 'TikTok',
    duracao: 30,
    estilo: 'Viral',
    objetivo: 'Venda',
  })

  useEffect(() => {
    fetch('/api/produtos').then((r) => r.json()).then((data) => {
      if (Array.isArray(data)) setProdutos(data)
    })
  }, [])

  async function gerar() {
    if (!config.produtoId) {
      toast({ title: 'Selecione um produto', variant: 'destructive' })
      return
    }
    setGerando(true)
    setConteudo(null)

    const res = await fetch('/api/conteudos/gerar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    })

    if (!res.ok) {
      toast({ title: 'Erro ao gerar conteúdo', description: 'A IA demorou. Tente novamente.', variant: 'destructive' })
      setGerando(false)
      return
    }

    const data = await res.json()
    setConteudo(data)
    setGerando(false)
    const tentativas = Number(data.tentativasCompliance ?? 1)
    toast({
      title: 'Conteúdo gerado com sucesso!',
      description: tentativas > 1
        ? `A IA refez o conteúdo ${tentativas}x para reduzir os riscos de compliance.`
        : undefined,
      variant: 'success',
    })
  }

  const selectClass = `w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm
    text-white focus:outline-none focus:ring-1 focus:ring-accent`

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Formulário */}
      <div className="card-stat space-y-5">
        <h2 className="font-semibold text-white">Configurar Geração</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="text-xs text-muted-foreground mb-1.5 block">Produto *</label>
            <select className={selectClass} value={config.produtoId}
              onChange={(e) => setConfig((c) => ({ ...c, produtoId: e.target.value }))}>
              <option value="">Selecionar produto...</option>
              {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome} — {p.categoria}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Rede Social</label>
            <select className={selectClass} value={config.redeSocial}
              onChange={(e) => setConfig((c) => ({ ...c, redeSocial: e.target.value }))}>
              {REDES_SOCIAIS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Duração (segundos)</label>
            <select className={selectClass} value={config.duracao}
              onChange={(e) => setConfig((c) => ({ ...c, duracao: Number(e.target.value) }))}>
              {DURACOES.map((d) => <option key={d} value={d}>{d}s</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Estilo</label>
            <select className={selectClass} value={config.estilo}
              onChange={(e) => setConfig((c) => ({ ...c, estilo: e.target.value }))}>
              {ESTILOS.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Objetivo</label>
            <select className={selectClass} value={config.objetivo}
              onChange={(e) => setConfig((c) => ({ ...c, objetivo: e.target.value }))}>
              {OBJETIVOS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={gerar} disabled={gerando || !config.produtoId} size="lg">
            {gerando
              ? <><Loader2 className="w-4 h-4 animate-spin" />Gerando conteúdo...</>
              : <><Zap className="w-4 h-4" />Gerar Conteúdo</>}
          </Button>
        </div>
      </div>

      {/* Loading */}
      {gerando && (
        <div className="card-stat flex flex-col items-center justify-center py-16 text-center gap-4">
          <div className="w-14 h-14 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center">
            <Loader2 className="w-7 h-7 text-accent animate-spin" />
          </div>
          <div>
            <p className="text-white font-semibold">Analisando produto e criando conteúdo...</p>
            <p className="text-sm text-muted-foreground mt-1">Isso pode levar até 30 segundos</p>
          </div>
        </div>
      )}

      {/* Preview */}
      {conteudo && !gerando && (
        <ConteudoPreview
          conteudo={conteudo}
          onEnviarAprovacao={async () => {
            if (!conteudo.id) {
              toast({ title: 'Erro: conteúdo sem identificador', description: 'Gere o conteúdo novamente.', variant: 'destructive' })
              return
            }
            const res = await fetch(`/api/conteudos/${conteudo.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'aguardando_aprovacao' }),
            })
            if (!res.ok) {
              toast({ title: 'Erro ao enviar para aprovação', description: 'Tente novamente.', variant: 'destructive' })
              return
            }
            toast({ title: 'Enviado para aprovação!', variant: 'success' })
            router.push('/aprovacao')
          }}
        />
      )}
    </div>
  )
}

export default function GerarConteudoPage() {
  return (
    <Suspense fallback={<div className="card-stat animate-pulse h-48" />}>
      <GerarConteudoInner />
    </Suspense>
  )
}
