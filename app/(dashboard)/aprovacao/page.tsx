'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle, X, Clock, AlertTriangle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDateShort, cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'
import type { AlertaCompliance } from '@/types'

interface Conteudo {
  id: string
  status: string
  redeSocial: string
  estilo: string
  roteiro: string
  legendaTiktok: string
  hashtags: string[]
  chamadaAcao: string
  notaProduto: number
  veredito: string
  alertasCompliance: AlertaCompliance[]
  createdAt: string
  produto: { nome: string }
}

export default function AprovacaoPage() {
  const [conteudos, setConteudos] = useState<Conteudo[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [confirmedRisks, setConfirmedRisks] = useState<string[]>([])

  async function fetchConteudos() {
    setLoading(true)
    const res = await fetch('/api/conteudos?status=aguardando_aprovacao')
    const data = await res.json()
    setConteudos(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { fetchConteudos() }, [])

  async function atualizar(id: string, status: string) {
    await fetch(`/api/conteudos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    const labels: Record<string, string> = {
      aprovado: 'Conteúdo aprovado!',
      descartado: 'Conteúdo rejeitado.',
      roteiro_gerado: 'Conteúdo adiado.',
    }
    toast({ title: labels[status], variant: status === 'aprovado' ? 'success' : 'default' })
    fetchConteudos()
  }

  if (loading) return <div className="card-stat animate-pulse h-48" />

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h2 className="text-lg font-semibold text-white">Aprovações Pendentes</h2>
        <p className="text-sm text-muted-foreground">{conteudos.length} conteúdo(s) aguardando</p>
      </div>

      {conteudos.length === 0 ? (
        <div className="card-stat flex flex-col items-center justify-center py-16 text-center">
          <CheckCircle className="w-10 h-10 text-accent mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum conteúdo aguardando aprovação.</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/conteudos/gerar">Gerar novo conteúdo</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {conteudos.map((c) => {
            const hasRedAlert = c.alertasCompliance?.some((a) => a.severidade === 'vermelho')
            const isConfirmed = confirmedRisks.includes(c.id)
            const canApprove = !hasRedAlert || isConfirmed

            return (
              <div key={c.id} className="card-stat">
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-white">{c.produto.nome}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {c.redeSocial} · {c.estilo} · {formatDateShort(c.createdAt)}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="destructive"
                      onClick={() => atualizar(c.id, 'descartado')}>
                      <X className="w-3.5 h-3.5" />Rejeitar
                    </Button>
                    <Button size="sm" variant="outline"
                      onClick={() => atualizar(c.id, 'roteiro_gerado')}>
                      <Clock className="w-3.5 h-3.5" />Adiar
                    </Button>
                    <Button size="sm"
                      disabled={!canApprove}
                      onClick={() => atualizar(c.id, 'aprovado')}>
                      <CheckCircle className="w-3.5 h-3.5" />Aprovar
                    </Button>
                  </div>
                </div>

                {/* Alertas */}
                {c.alertasCompliance?.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {c.alertasCompliance.map((a, i) => {
                      const colors = {
                        verde: 'border-accent/30 bg-accent/10 text-accent',
                        amarelo: 'border-warning/30 bg-warning/10 text-warning',
                        vermelho: 'border-danger/30 bg-danger/10 text-danger',
                      }
                      const Icon = a.severidade === 'vermelho' ? AlertCircle : AlertTriangle
                      return (
                        <div key={i} className={cn('flex gap-2 rounded-lg border p-2.5 text-xs', colors[a.severidade])}>
                          <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                          <span>{a.mensagem}</span>
                        </div>
                      )
                    })}
                    {hasRedAlert && !isConfirmed && (
                      <button
                        onClick={() => setConfirmedRisks((s) => [...s, c.id])}
                        className="w-full text-xs text-danger border border-danger/30 rounded-lg py-1.5
                                   hover:bg-danger/10 transition-colors">
                        ⚠️ Entendi o risco — aprovar mesmo assim
                      </button>
                    )}
                  </div>
                )}

                {/* Preview expandido */}
                <button
                  onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                  className="mt-3 text-xs text-muted-foreground hover:text-accent transition-colors">
                  {expanded === c.id ? '▲ Ocultar detalhes' : '▼ Ver roteiro e legenda'}
                </button>

                {expanded === c.id && (
                  <div className="mt-3 space-y-3 pt-3 border-t border-border">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1.5">ROTEIRO</p>
                      <div className="rounded-lg bg-background border border-border p-3 text-xs text-foreground whitespace-pre-wrap">
                        {c.roteiro}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1.5">LEGENDA TIKTOK</p>
                      <div className="rounded-lg bg-background border border-border p-3 text-xs text-foreground whitespace-pre-wrap">
                        {c.legendaTiktok}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">HASHTAGS</p>
                      <div className="flex flex-wrap gap-1">
                        {c.hashtags?.map((h) => (
                          <span key={h} className="px-2 py-0.5 rounded-full bg-secondary text-[10px] text-accent">{h}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        🏆 Veredito: <span className="text-white">{c.veredito}</span> ·
                        ⭐ Nota: <span className="text-warning">{c.notaProduto}/10</span>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
