'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Loader2, AlertTriangle, ShieldCheck, ArrowRight } from 'lucide-react'
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
      if (res.ok) toast({ title: dados.mensagem ?? 'Feito.', variant: 'success' })
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

  return (
    <div className="space-y-4 max-w-3xl">
      <p className="text-sm text-muted-foreground">
        Só aparece aqui o que depende de uma decisão sua. O resto o Patrono resolve sozinho, dentro das suas regras.
      </p>

      {itens.length === 0 ? (
        <div className="card-stat flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-accent" />
          <div>
            <p className="text-sm font-semibold text-white">Nada precisa de você agora</p>
            <p className="text-xs text-muted-foreground">Quando houver algo que só você pode decidir, aparece aqui.</p>
          </div>
        </div>
      ) : (
        itens.map((item) => {
          const risco = RISCO[item.risco] ?? RISCO.BAIXO
          const emAndamento = ocupado === item.id
          return (
            <div key={item.id} className="card-stat space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  {item.tipo === 'EXCECAO' ? <AlertTriangle className="w-4 h-4 text-warning mt-0.5" /> : <CheckCircle2 className="w-4 h-4 text-accent mt-0.5" />}
                  <div>
                    <p className="text-sm font-semibold text-white">{item.titulo}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.resumo}</p>
                  </div>
                </div>
                <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium', risco.cls)}>{risco.rotulo}</span>
              </div>

              {item.porque.length > 0 && (
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer select-none hover:text-white">Por que o Patrono está pedindo</summary>
                  <ul className="mt-1 ml-4 list-disc space-y-0.5">{item.porque.map((p, i) => <li key={i}>{p}</li>)}</ul>
                </details>
              )}

              {item.podeVirarRegra && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                  <input type="checkbox" checked={!!sempre[item.id]} onChange={(e) => setSempre((s) => ({ ...s, [item.id]: e.target.checked }))} />
                  Sempre aprovar casos assim (mesma categoria, até este preço e risco)
                </label>
              )}

              <div className="flex flex-wrap gap-2 pt-1 border-t border-border">
                <Button size="sm" disabled={emAndamento} onClick={() => decidir(item, 'APROVAR')}>
                  {emAndamento ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  {item.acoes.aprovar}
                </Button>
                <Button size="sm" variant="outline" disabled={emAndamento} onClick={() => decidir(item, 'REJEITAR')}>
                  {item.acoes.rejeitar}
                </Button>
                {item.link && (
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
