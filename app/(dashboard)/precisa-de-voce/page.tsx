'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Loader2, AlertTriangle, ShieldCheck, ArrowRight, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { useGuardModulo } from '@/hooks/useGuardModulo'

interface Item {
  id: string
  tipo: string
  titulo: string
  resumo: string
  porque: string[]
  risco: string
  criadoEm: string
  expiraEm: string | null
  acoes: { aprovar: string; rejeitar: string }
  link: string | null
  podeVirarRegra: boolean
  podeMarcarResolvido: boolean
  comoFazer: string[] | null
}

const RISCO: Record<string, { rotulo: string; cls: string }> = {
  BAIXO: { rotulo: 'Risco baixo', cls: 'border-accent/30 bg-accent/10 text-accent' },
  MEDIO: { rotulo: 'Risco médio', cls: 'border-warning/40 bg-warning/10 text-warning' },
  ALTO: { rotulo: 'Risco alto', cls: 'border-danger/40 bg-danger/10 text-danger' },
}

/**
 * P2.15 — "Precisa de você": a ÚNICA fila de decisões da titular.
 * Tudo o que o Patrono resolve sozinho não aparece aqui.
 */
export default function PrecisaDeVocePage() {
  useGuardModulo('precisa-de-voce')
  const [itens, setItens] = useState<Item[] | null>(null)
  const [desligado, setDesligado] = useState(false)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [sempre, setSempre] = useState<Record<string, boolean>>({})
  const [abertos, setAbertos] = useState<Record<string, boolean>>({})

  const carregar = useCallback(async () => {
    const res = await fetch('/api/precisa-de-voce')
    if (res.status === 404) return setDesligado(true)
    const dados = await res.json().catch(() => ({ itens: [] }))
    setItens(dados.itens ?? [])
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function decidir(item: Item, decisao: 'APROVAR' | 'REJEITAR') {
    setOcupado(item.id)
    try {
      const res = await fetch(`/api/precisa-de-voce/${item.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decisao, sempre: decisao === 'APROVAR' && !!sempre[item.id] }),
      })
      const dados = await res.json().catch(() => ({}))
      if (res.ok) toast({ title: dados.mensagem ?? 'Feito.', variant: dados.status === 'PENDENTE' ? 'default' : 'success' })
      else toast({ title: 'Não foi possível concluir', description: dados.error, variant: 'destructive' })
      await carregar()
    } finally {
      setOcupado(null)
    }
  }

  if (desligado) {
    return (
      <div className="card-stat max-w-2xl text-sm text-muted-foreground">
        Esta área ainda não foi liberada para a sua conta. As aprovações de conteúdo continuam em{' '}
        <Link href="/aprovacao" className="underline">Aprovações</Link>.
      </div>
    )
  }
  if (!itens) return <div className="card-stat animate-pulse h-32 max-w-3xl" />

  const urgentes = itens.filter((i) => i.risco === 'ALTO').length

  return (
    <div className="space-y-4 max-w-3xl">
      {itens.length > 0 && (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="text-2xl font-bold text-warning tabular-nums">{itens.length}</p>
          <p className="text-sm text-white">{itens.length === 1 ? 'item precisa de você' : 'itens precisam de você'}</p>
          {urgentes > 0 && <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium', RISCO.ALTO.cls)}>{urgentes} urgente{urgentes > 1 ? 's' : ''}</span>}
          <p className="w-full text-xs text-muted-foreground">O mais importante vem primeiro. O resto o Patrono resolve sozinho, dentro das suas regras.</p>
        </div>
      )}

      {itens.length === 0 ? (
        <div className="card-stat flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-accent" />
          <div>
            <p className="text-sm font-semibold text-white">Nada agora — o Patrono segue sozinho.</p>
            <p className="text-xs text-muted-foreground">Quando algo depender só de você, aparece aqui primeiro.</p>
          </div>
        </div>
      ) : (
        itens.map((item, posicao) => {
          const risco = RISCO[item.risco] ?? RISCO.BAIXO
          const emAndamento = ocupado === item.id
          return (
            <div key={item.id} className={cn('card-stat space-y-3', posicao === 0 && itens.length > 1 && 'border-warning/40')}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  {item.tipo === 'EXCECAO' ? <AlertTriangle className="w-4 h-4 text-warning mt-0.5" /> : <CheckCircle2 className="w-4 h-4 text-accent mt-0.5" />}
                  <div>
                    <p className="text-sm font-semibold text-white">{item.titulo}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.resumo}</p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {posicao === 0 && itens.length > 1 && <span className="text-[10px] font-semibold uppercase tracking-wider text-warning">Primeiro</span>}
                  <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium', risco.cls)}>{risco.rotulo}</span>
                </div>
              </div>

              {item.porque.length > 0 && (
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer select-none hover:text-white">Por que estou pedindo</summary>
                  <ul className="mt-1 ml-4 list-disc space-y-0.5">{item.porque.map((p, i) => <li key={i}>{p}</li>)}</ul>
                </details>
              )}

              {item.podeVirarRegra && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                  <input type="checkbox" checked={!!sempre[item.id]} onChange={(e) => setSempre((s) => ({ ...s, [item.id]: e.target.checked }))} />
                  Sempre aprovar casos assim (mesma categoria, até este preço e risco)
                </label>
              )}

              {item.comoFazer && abertos[item.id] && (
                <ol className="ml-4 list-decimal space-y-1 rounded-lg border border-border bg-secondary/40 p-3 pl-7 text-xs text-white/90">
                  {item.comoFazer.map((passo, i) => <li key={i}>{passo}</li>)}
                </ol>
              )}

              <div className="flex flex-wrap gap-2 pt-1 border-t border-border">
                {item.podeMarcarResolvido ? (
                  <Button size="sm" disabled={emAndamento} onClick={() => decidir(item, 'APROVAR')}>
                    {emAndamento ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    {item.acoes.aprovar}
                  </Button>
                ) : (
                  // P2.15.3: este item não sai por clique — só com a conexão real.
                  <Button size="sm" onClick={() => setAbertos((a) => ({ ...a, [item.id]: !a[item.id] }))} aria-expanded={!!abertos[item.id]}>
                    <BookOpen className="w-3.5 h-3.5" />
                    {abertos[item.id] ? 'Fechar passos' : item.acoes.aprovar}
                  </Button>
                )}
                <Button size="sm" variant="outline" disabled={emAndamento} onClick={() => decidir(item, 'REJEITAR')}>
                  {item.acoes.rejeitar}
                </Button>
                {item.link && item.podeMarcarResolvido && (
                  <Button size="sm" variant="ghost" asChild>
                    <Link href={item.link}>Ver detalhes<ArrowRight className="w-3.5 h-3.5" /></Link>
                  </Button>
                )}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
