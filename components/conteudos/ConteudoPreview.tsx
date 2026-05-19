'use client'

import { useState } from 'react'
import { Copy, Check, Star, AlertTriangle, AlertCircle, CheckCircle, ChevronRight, ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn, copyToClipboard } from '@/lib/utils'
import { LINK_COMPRA, NOME_LOJA } from '@/lib/config'
import type { AlertaCompliance } from '@/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface ConteudoPreviewProps {
  conteudo: Record<string, any>
  onEnviarAprovacao?: () => void
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  async function handle() {
    await copyToClipboard(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={handle} className="copy-btn">
      {copied ? <Check className="w-3.5 h-3.5 text-accent" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copiado!' : 'Copiar'}
    </button>
  )
}

function AlertaBadge({ alerta }: { alerta: AlertaCompliance }) {
  const colors = {
    verde: 'border-accent/30 bg-accent/10 text-accent',
    amarelo: 'border-warning/30 bg-warning/10 text-warning',
    vermelho: 'border-danger/30 bg-danger/10 text-danger',
  }
  const Icon = alerta.severidade === 'verde' ? CheckCircle
    : alerta.severidade === 'amarelo' ? AlertTriangle : AlertCircle

  return (
    <div className={cn('rounded-lg border p-3 flex gap-2.5', colors[alerta.severidade])}>
      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
      <div>
        <p className="text-sm font-medium">{alerta.mensagem}</p>
        <p className="text-xs opacity-75 mt-0.5">{alerta.acaoRecomendada}</p>
      </div>
    </div>
  )
}

const TABS = ['Roteiro', 'Legendas', 'Extras', 'Prompt de Vídeo']

export function ConteudoPreview({ conteudo, onEnviarAprovacao }: ConteudoPreviewProps) {
  const [tab, setTab] = useState(0)
  const alertas = (conteudo.alertasCompliance as AlertaCompliance[]) ?? []
  const temAlertaVermelho = alertas.some((a) => a.severidade === 'vermelho')
  const [confirmedRisk, setConfirmedRisk] = useState(false)

  const legendas = [
    { label: 'TikTok', text: conteudo.legendaTiktok as string },
    { label: 'Instagram', text: conteudo.legendaInstagram as string },
    { label: 'YouTube Shorts', text: conteudo.legendaYoutube as string },
    { label: 'WhatsApp', text: conteudo.legendaWhatsapp as string },
    { label: 'Facebook', text: conteudo.legendaFacebook as string },
    { label: 'Marketplace', text: conteudo.legendaMarketplace as string },
  ]

  return (
    <div className="space-y-4">
      {/* Alertas */}
      {alertas.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Alertas de Compliance
          </h3>
          {alertas.map((a, i) => <AlertaBadge key={i} alerta={a} />)}
          {temAlertaVermelho && !confirmedRisk && (
            <button onClick={() => setConfirmedRisk(true)}
              className="w-full text-xs text-danger border border-danger/30 rounded-lg py-2 hover:bg-danger/10 transition-colors">
              ⚠️ Entendi o risco — continuar mesmo assim
            </button>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="card-stat space-y-5">
        <div className="flex border-b border-border -mx-5 px-5">
          {TABS.map((t, i) => (
            <button key={t} onClick={() => setTab(i)}
              className={cn(
                'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                tab === i
                  ? 'border-accent text-accent'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}>
              {t}
            </button>
          ))}
        </div>

        {/* ABA ROTEIRO */}
        {tab === 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white text-sm">Roteiro</h3>
              <CopyButton text={conteudo.roteiro as string} />
            </div>
            <div className="rounded-lg bg-background border border-border p-4 text-sm text-foreground whitespace-pre-wrap">
              {conteudo.roteiro as string}
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-white text-sm">Texto para Tela</h3>
                <CopyButton text={conteudo.textoTela as string} />
              </div>
              <div className="rounded-lg bg-background border border-border p-4 text-sm text-foreground whitespace-pre-wrap">
                {conteudo.textoTela as string}
              </div>
            </div>
          </div>
        )}

        {/* ABA LEGENDAS */}
        {tab === 1 && (
          <div className="space-y-4">
            {legendas.map(({ label, text }) => text && (
              <div key={label}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-white text-sm">{label}</h3>
                  <CopyButton text={text} />
                </div>
                <div className="rounded-lg bg-background border border-border p-4 text-sm text-foreground whitespace-pre-wrap">
                  {text}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ABA EXTRAS */}
        {tab === 2 && (
          <div className="space-y-5">
            {/* Hashtags */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-white text-sm">Hashtags</h3>
                <CopyButton text={(conteudo.hashtags as string[]).join(' ')} />
              </div>
              <div className="flex flex-wrap gap-2">
                {(conteudo.hashtags as string[]).map((h) => (
                  <span key={h} className="px-2 py-1 rounded-full bg-secondary text-xs text-accent">{h}</span>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-white text-sm">Chamada para Ação</h3>
                <CopyButton text={conteudo.chamadaAcao as string} />
              </div>
              <div className="rounded-lg bg-background border border-border p-3 text-sm text-foreground">
                {String(conteudo.chamadaAcao ?? '')}
              </div>
            </div>

            {/* Link de Compra — Instagram */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-white text-sm">Link de Compra</h3>
                <CopyButton text={LINK_COMPRA} />
              </div>
              <div className="rounded-lg border border-accent/30 bg-accent/10 p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">🛒 {NOME_LOJA}</p>
                  <p className="text-xs text-muted-foreground truncate">{LINK_COMPRA}</p>
                </div>
                <Button asChild size="sm" className="shrink-0">
                  <a href={LINK_COMPRA} target="_blank" rel="noopener noreferrer">
                    <ShoppingBag className="w-3.5 h-3.5" />Comprar
                  </a>
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Use este link na bio do Instagram e nas legendas como destino de compra.
              </p>
            </div>

            {/* Narração */}
            {conteudo.narracao && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-white text-sm">Narração</h3>
                  <CopyButton text={conteudo.narracao as string} />
                </div>
                <div className="rounded-lg bg-background border border-border p-4 text-sm text-foreground whitespace-pre-wrap">
                  {String(conteudo.narracao ?? '')}
                </div>
              </div>
            )}

            {/* Avaliação */}
            <div className="rounded-xl border border-border bg-background p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white text-sm">Avaliação do Produto</h3>
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-warning fill-warning" />
                  <span className="text-warning font-bold">{conteudo.notaProduto as number}/10</span>
                </div>
              </div>
              <div className="space-y-2 text-xs">
                <div>
                  <p className="text-accent font-medium mb-1">✅ Pontos Positivos</p>
                  {(conteudo.pontosPositivos as string[]).map((p, i) => (
                    <p key={i} className="text-muted-foreground">• {p}</p>
                  ))}
                </div>
                <div>
                  <p className="text-danger font-medium mb-1">❌ Pontos Negativos</p>
                  {(conteudo.pontosNegativos as string[]).map((p, i) => (
                    <p key={i} className="text-muted-foreground">• {p}</p>
                  ))}
                </div>
                <div className="border-t border-border pt-2">
                  <p className="text-white font-medium">🏆 Veredito: <span className="text-accent">{conteudo.veredito as string}</span></p>
                </div>
              </div>
            </div>

            {/* Trilha */}
            {conteudo.trilhaSugerida && (
              <p className="text-sm text-muted-foreground">
                🎵 Trilha sugerida: <span className="text-white">{conteudo.trilhaSugerida as string}</span>
              </p>
            )}
          </div>
        )}

        {/* ABA PROMPT DE VÍDEO */}
        {tab === 3 && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-white text-sm">Prompt Completo</h3>
                <CopyButton text={conteudo.promptVideoIA as string} />
              </div>
              <div className="rounded-lg bg-background border border-accent/20 p-4 text-sm text-foreground whitespace-pre-wrap font-mono">
                {conteudo.promptVideoIA as string}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-white text-sm">Prompt Curto</h3>
                <CopyButton text={conteudo.promptCurto as string} />
              </div>
              <div className="rounded-lg bg-background border border-border p-4 text-sm text-foreground font-mono">
                {conteudo.promptCurto as string}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              ✅ Compatível com: Runway Gen-3, Kling, Pika 2.0, Veo 2
            </p>
          </div>
        )}
      </div>

      {/* Ações */}
      <div className="space-y-3">
        {temAlertaVermelho && !confirmedRisk && (
          <div className="rounded-lg border border-danger/30 bg-danger/10 p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-danger">
              ⚠️ Há um alerta de compliance grave. Confirme que entendeu o risco para liberar o envio.
            </p>
            <Button
              variant="destructive"
              size="sm"
              className="shrink-0"
              onClick={() => setConfirmedRisk(true)}
            >
              Entendi o risco — liberar envio
            </Button>
          </div>
        )}
        <div className="flex justify-end gap-3">
          <Button variant="outline">Salvar Rascunho</Button>
          <Button
            onClick={onEnviarAprovacao}
            disabled={temAlertaVermelho && !confirmedRisk}
          >
            Enviar para Aprovação <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
