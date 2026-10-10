'use client'

import { toast } from '@/hooks/use-toast'
import { useEffect, useState } from 'react'
import { BarChart2, Eye, Package, Zap, TrendingUp } from 'lucide-react'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatDateShort } from '@/lib/utils'
import type { StatusConteudo } from '@/types'
import { useGuardModulo } from '@/hooks/useGuardModulo'

interface Metricas {
  totalProdutos: number
  totalConteudos: number
  aguardandoAprovacao: number
  publicados: number
  visualizacoesTotais: number
  topConteudos: Array<{
    id: string
    produto: { nome: string }
    redeSocial: string
    visualizacoes: number
    comentarios: number
    compartilhamentos: number
    status: string
    createdAt: string
  }>
  conteudosPorStatus: Array<{
    status: string
    _count: { status: number }
  }>
}

export default function RelatoriosPage() {
  useGuardModulo('relatorios')
  const [metricas, setMetricas] = useState<Metricas | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/metricas')
      .then(async (r) => {
        const d = await r.json().catch(() => null)
        if (r.ok && d) setMetricas(d)
        else toast({ title: 'Não consegui carregar os relatórios', description: 'Tente atualizar a página.', variant: 'destructive' })
      })
      .catch(() => toast({ title: 'Sem conexão', description: 'Não consegui carregar os relatórios.', variant: 'destructive' }))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => <div key={i} className="card-stat animate-pulse h-24" />)}
      </div>
    )
  }

  const cards = [
    { label: 'Produtos Ativos', value: metricas?.totalProdutos ?? 0, icon: Package, color: 'text-blue-400' },
    { label: 'Conteúdos Gerados', value: metricas?.totalConteudos ?? 0, icon: Zap, color: 'text-accent' },
    { label: 'Publicados', value: metricas?.publicados ?? 0, icon: TrendingUp, color: 'text-green-400' },
    { label: 'Visualizações Totais', value: metricas?.visualizacoesTotais ?? 0, icon: Eye, color: 'text-purple-400' },
  ]

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-lg font-semibold text-white">Relatórios</h2>
        <p className="text-sm text-muted-foreground">Visão geral da sua operação</p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card-stat">
            <Icon className={`w-5 h-5 ${color} mb-2`} />
            <p className="text-2xl font-bold text-white">{value.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Status breakdown */}
      <div className="card-stat">
        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-accent" /> Conteúdos por Status
        </h3>
        <div className="space-y-3">
          {(metricas?.conteudosPorStatus ?? []).map(({ status, _count }) => {
            const pct = metricas?.totalConteudos
              ? Math.round((_count.status / metricas.totalConteudos) * 100)
              : 0
            return (
              <div key={status} className="flex items-center gap-3">
                <div className="w-32 shrink-0">
                  <StatusBadge status={status as StatusConteudo} />
                </div>
                <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-accent rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-muted-foreground w-12 text-right">
                  {_count.status} ({pct}%)
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Top conteúdos */}
      <div className="card-stat">
        <h3 className="font-semibold text-white mb-4">Conteúdos recentes</h3>
        {(metricas?.topConteudos ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum conteúdo publicado ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['Produto', 'Rede', 'Status', 'Views', 'Comentários', 'Shares', 'Data'].map((h) => (
                    <th key={h} className="text-left px-3 py-2 text-xs font-medium text-muted-foreground first:pl-0">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {metricas?.topConteudos.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2.5 first:pl-0 font-medium text-white">{c.produto.nome}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{c.redeSocial}</td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={c.status as StatusConteudo} />
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{c.visualizacoes.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{c.comentarios.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{c.compartilhamentos.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{formatDateShort(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        * Métricas inseridas manualmente. Integração automática com plataformas disponível em versões futuras.
      </p>
    </div>
  )
}
