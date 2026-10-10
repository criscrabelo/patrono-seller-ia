'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Bot, BellRing, CheckCircle2, AlertTriangle, XCircle, Loader2, Play, ShieldAlert, Clock, Plug, Wallet, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { CopilotPainel } from './CopilotPainel'

interface Painel {
  patrono: {
    modo: string
    politicaVersao: number
    bloqueado: boolean
    safeMode: boolean
    motivoDoBloqueio: string | null
    ultimoCiclo: { estado: string; quando: string; resumo: string[] } | null
  }
  pendencias: number
  atividadeHoje: { quando: string; texto: string }[]
  decisoesRecentes: { id: string; tipo: string; ator: string; decisao: string; explicacao: string[]; criadoEm: string }[]
  integracoes: { plataforma: string; estado: 'OK' | 'ATENCAO' | 'PROBLEMA' | 'DESCONECTADA'; detalhe: string }[]
  financeiro: { comissoes: { prevista: number; confirmada: number; recebida: number } }
  proximaAcao: { texto: string; link: string | null; comando: string | null }
}

const MODO: Record<string, string> = {
  MANUAL: 'Sugere e pede sua decisão',
  ASSISTED: 'Faz o rotineiro, pede o importante',
  AUTOMATIC: 'Age sozinho dentro das suas regras',
}

const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
const quandoRelativo = (iso: string) => {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.round(min / 60)
  return h < 24 ? `há ${h} h` : new Date(iso).toLocaleDateString('pt-BR')
}
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const ATOR: Record<string, string> = { PATRONO: 'Patrono', TITULAR: 'Você', SISTEMA: 'Sistema' }

/**
 * P2.15 — Command Center no topo da home. Some sozinho se a flag
 * CENTRAL_OPERACIONAL estiver desligada (a API responde 404).
 */
export function CentralOperacional() {
  const [painel, setPainel] = useState<Painel | null>(null)
  const [desligado, setDesligado] = useState(false)
  const [rodando, setRodando] = useState(false)

  const carregar = useCallback(async () => {
    const res = await fetch('/api/central')
    if (res.status === 404) return setDesligado(true)
    if (res.ok) setPainel(await res.json())
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function rodar() {
    setRodando(true)
    try {
      const res = await fetch('/api/supervisor/ciclo', { method: 'POST' })
      const dados = await res.json().catch(() => ({}))
      if (res.ok) toast({ title: 'O Patrono terminou o ciclo', description: (dados.resumo ?? []).join(' '), variant: 'success' })
      else toast({ title: 'O ciclo não rodou', description: dados.error, variant: 'destructive' })
      await carregar()
    } finally {
      setRodando(false)
    }
  }

  if (desligado) return null
  if (!painel) return <div className="card-stat animate-pulse h-40" />

  const { patrono } = painel
  const c = painel.financeiro.comissoes

  return (
    <div className="space-y-4">
      {/* 1. O que o Patrono está fazendo + próxima melhor ação */}
      <div className={cn('card-stat flex flex-col md:flex-row md:items-center gap-4', patrono.bloqueado && 'border-warning/40')}>
        <div className="flex items-start gap-3 flex-1">
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', patrono.bloqueado ? 'bg-warning/15' : 'bg-accent/15')}>
            {patrono.bloqueado ? <ShieldAlert className="w-5 h-5 text-warning" /> : <Bot className="w-5 h-5 text-accent" />}
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-white">
              {patrono.safeMode ? 'O Patrono está em modo de segurança' : 'O Patrono está trabalhando para você'}
            </p>
            <p className="text-xs text-muted-foreground">
              {MODO[patrono.modo] ?? patrono.modo}
              {patrono.bloqueado && patrono.motivoDoBloqueio ? ` · ${patrono.motivoDoBloqueio}` : ''}
            </p>
            {patrono.ultimoCiclo && (
              <p className="text-xs text-muted-foreground">
                Último ciclo {quandoRelativo(patrono.ultimoCiclo.quando)}: {patrono.ultimoCiclo.resumo.join(' ') || patrono.ultimoCiclo.estado.toLowerCase()}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 md:items-center">
          <div className="rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-xs text-white max-w-xs">
            <span className="text-muted-foreground">Próximo passo: </span>
            {painel.proximaAcao.link ? (
              <Link href={painel.proximaAcao.link} className="underline underline-offset-2">{painel.proximaAcao.texto}</Link>
            ) : (
              painel.proximaAcao.texto
            )}
          </div>
          <Button size="sm" onClick={rodar} disabled={rodando}>
            {rodando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            {rodando ? 'Analisando…' : 'Rodar agora'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 2. Precisa de você */}
        <Link href="/precisa-de-voce" className={cn('card-stat flex items-center gap-3 hover:border-accent/40 transition-colors', painel.pendencias > 0 && 'border-warning/40')}>
          <BellRing className={cn('w-5 h-5', painel.pendencias > 0 ? 'text-warning' : 'text-muted-foreground')} />
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">Precisa de você</p>
            <p className="text-xs text-muted-foreground">
              {painel.pendencias > 0 ? `${painel.pendencias} decisão(ões) só sua(s)` : 'Nada agora — o resto o Patrono resolve'}
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
        </Link>

        {/* 6. Resultado */}
        <div className="card-stat flex items-center gap-3">
          <Wallet className="w-5 h-5 text-accent" />
          <div>
            <p className="text-sm font-semibold text-white">Comissões</p>
            <p className="text-xs text-muted-foreground">
              Recebida {brl(c.recebida)} · confirmada {brl(c.confirmada)} · prevista {brl(c.prevista)}
            </p>
          </div>
        </div>

        {/* 5. Saúde das integrações */}
        <Link href="/integracoes" className="card-stat flex items-start gap-3 hover:border-accent/40 transition-colors">
          <Plug className="w-5 h-5 text-muted-foreground mt-0.5" />
          <div className="space-y-0.5 min-w-0">
            <p className="text-sm font-semibold text-white">Integrações</p>
            {painel.integracoes.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma conectada.</p>}
            {painel.integracoes.map((i) => (
              <p key={i.plataforma} className="text-xs flex items-center gap-1">
                {i.estado === 'OK' ? <CheckCircle2 className="w-3 h-3 text-accent" /> : i.estado === 'ATENCAO' ? <AlertTriangle className="w-3 h-3 text-warning" /> : <XCircle className="w-3 h-3 text-danger" />}
                <span className="capitalize text-white">{i.plataforma}</span>
                <span className="text-muted-foreground truncate">— {i.detalhe}</span>
              </p>
            ))}
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 3. O que aconteceu hoje */}
        <div className="card-stat space-y-2">
          <p className="text-sm font-semibold text-white flex items-center gap-2"><Clock className="w-4 h-4 text-muted-foreground" />Hoje</p>
          {painel.atividadeHoje.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nada ainda hoje. Use “Rodar agora”.</p>
          ) : (
            painel.atividadeHoje.map((a, i) => (
              <p key={i} className="text-xs text-muted-foreground"><span className="text-white tabular-nums">{hora(a.quando)}</span> — {a.texto}</p>
            ))
          )}
        </div>

        {/* 4. Decisões recentes, com o porquê */}
        <div className="card-stat space-y-2">
          <p className="text-sm font-semibold text-white">Decisões recentes</p>
          {painel.decisoesRecentes.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma decisão registrada ainda.</p>
          ) : (
            painel.decisoesRecentes.map((d) => (
              <details key={d.id} className="text-xs">
                <summary className="cursor-pointer text-white">
                  <span className="text-muted-foreground">{ATOR[d.ator] ?? d.ator}:</span> {d.decisao}
                </summary>
                {d.explicacao.length > 0 && <ul className="mt-1 ml-3 list-disc text-muted-foreground space-y-0.5">{d.explicacao.slice(0, 3).map((x, i) => <li key={i}>{x}</li>)}</ul>}
              </details>
            ))
          )}
        </div>

        {/* Copilot */}
        <CopilotPainel aoAlterar={carregar} />
      </div>
    </div>
  )
}
