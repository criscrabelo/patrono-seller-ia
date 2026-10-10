'use client'

import { useEffect, useState } from 'react'
import { DollarSign, TrendingUp, Users, Zap, Link2, BarChart2, Star, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils'
import { useGuardModulo } from '@/hooks/useGuardModulo'

interface LinkDinamico {
  id: string; plataforma: string; tipo: string; cliques: number
  conversoes: number; receitaTotal: number; comissao: number | null
  produto: { nome: string; preco: number }
}

const CATEGORIAS = [
  { id: 'comprei-testei', label: '"Comprei e Testei"', pct: 40, emoji: '📦', desc: 'Afiliados + Shop + Loja', cor: 'bg-accent' },
  { id: 'fatos-virais', label: '"Fatos Virais"', pct: 25, emoji: '🔥', desc: 'Consultoria + Educação', cor: 'bg-warning' },
  { id: 'engajamento', label: '"Engajamento Puro"', pct: 20, emoji: '❤️', desc: 'Tráfego → Links', cor: 'bg-purple-500' },
  { id: 'produto-fato', label: '"Produto + Fato"', pct: 10, emoji: '💡', desc: 'Mix de tudo', cor: 'bg-blue-500' },
  { id: 'educacao', label: '"Educação/Expertise"', pct: 5, emoji: '🎓', desc: 'Cursos + Consultoria', cor: 'bg-pink-500' },
]

const PILARES = [
  { id: 'afiliado', label: 'Afiliados', emoji: '🔗', comissao: '5-30%', setup: '1 dia', prazo: 'Inicial', cor: 'border-accent/40 bg-accent/5' },
  { id: 'tiktok-shop', label: 'TikTok Shop', emoji: '🎵', comissao: '~10% margem', setup: '3-7 dias', prazo: 'Volume', cor: 'border-blue-500/40 bg-blue-500/5' },
  { id: 'loja-propria', label: 'Loja Própria', emoji: '🏪', comissao: '70-100%', setup: '1-2 semanas', prazo: 'Longo prazo', cor: 'border-warning/40 bg-warning/5' },
]

const ESTIMATIVAS = [
  { fonte: 'Afiliados', valor: 150, cor: 'text-accent', icon: '🔗' },
  { fonte: 'TikTok Shop', valor: 15, cor: 'text-blue-400', icon: '🎵' },
  { fonte: 'Loja Própria', valor: 140, cor: 'text-warning', icon: '🏪' },
  { fonte: 'Consultoria', valor: 300, cor: 'text-purple-400', icon: '🎓' },
]

export default function MonetizacaoPage() {
  useGuardModulo('monetizacao')
  const [links, setLinks] = useState<LinkDinamico[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/links')
      .then(r => r.json())
      .then(d => setLinks(Array.isArray(d) ? d : []))
      .catch(() => setLinks([]))
      .finally(() => setLoading(false))
  }, [])

  const totalCliques = links.reduce((s, l) => s + l.cliques, 0)
  const totalConversoes = links.reduce((s, l) => s + l.conversoes, 0)
  const totalReceita = links.reduce((s, l) => s + l.receitaTotal, 0)
  const taxaConversao = totalCliques > 0 ? ((totalConversoes / totalCliques) * 100).toFixed(1) : '0.0'

  const totalDia = ESTIMATIVAS.reduce((s, e) => s + e.valor, 0)
  const totalMes = totalDia * 30

  // Cliques por plataforma
  const porPlat = links.reduce((acc, l) => {
    acc[l.plataforma] = (acc[l.plataforma] ?? 0) + l.cliques
    return acc
  }, {} as Record<string, number>)
  const topPlat = Object.entries(porPlat).sort((a, b) => b[1] - a[1]).slice(0, 6)

  const platEmoji: Record<string, string> = {
    tiktok:'🎵', instagram:'📸', youtube:'▶️', facebook:'👤', whatsapp:'💬',
    telegram:'✈️', pinterest:'📌', linkedin:'💼', amazon:'📦', shopee:'🛍️',
    mercadolivre:'🛒', hotmart:'🔥', blog:'📝', email:'📧',
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-accent" /> Monetização Omnichannel
        </h2>
        <p className="text-sm text-muted-foreground">Onde dá para divulgar e vender — e o que seus links já trouxeram</p>
      </div>

      {/* Stats reais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Cliques (total)', value: totalCliques.toLocaleString(), icon: Link2, color: 'text-accent' },
          { label: 'Conversões', value: totalConversoes.toLocaleString(), icon: TrendingUp, color: 'text-warning' },
          { label: 'Taxa Conversão', value: `${taxaConversao}%`, icon: BarChart2, color: 'text-blue-400' },
          { label: 'Receita Total', value: formatCurrency(totalReceita), icon: DollarSign, color: 'text-accent' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card-stat">
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* 3 Pilares */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Star className="w-4 h-4 text-warning" /> 3 Pilares de Monetização
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {PILARES.map(p => (
            <div key={p.id} className={`rounded-xl border p-4 space-y-3 ${p.cor}`}>
              <div className="text-2xl">{p.emoji}</div>
              <p className="font-semibold text-white">{p.label}</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Comissão</span>
                  <span className="text-white font-medium">{p.comissao}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Setup</span>
                  <span className="text-white font-medium">{p.setup}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Melhor para</span>
                  <span className="text-accent font-medium">{p.prazo}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Estimativa de renda + Categorias */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Estimativa */}
        <div className="card-stat space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-accent" /> Estimativa com 10k Seguidores
          </h3>
          <div className="space-y-2">
            {ESTIMATIVAS.map(e => (
              <div key={e.fonte} className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{e.icon} {e.fonte}</span>
                <span className={`font-semibold text-sm ${e.cor}`}>R$ {e.valor}/dia</span>
              </div>
            ))}
            <div className="border-t border-border pt-2 mt-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-white">Total estimado</span>
              <div className="text-right">
                <p className="text-accent font-bold">R$ {totalDia}/dia</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(totalMes)}/mês</p>
              </div>
            </div>
          </div>
          <div className="flex gap-2 rounded-lg bg-warning/10 border border-warning/20 p-3">
            <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <p className="text-xs text-warning">Estimativa baseada em médias do mercado. Resultados variam conforme nicho e engajamento.</p>
          </div>
        </div>

        {/* Categorias de conteúdo */}
        <div className="card-stat space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-accent" /> 5 Categorias de Conteúdo Viral
          </h3>
          <div className="space-y-2">
            {CATEGORIAS.map(c => (
              <div key={c.id} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white">{c.emoji} {c.label}</span>
                  <span className="text-xs text-muted-foreground">{c.pct}% — {c.desc}</span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div className={`h-full rounded-full ${c.cor}`} style={{ width: `${c.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cliques por plataforma */}
      {topPlat.length > 0 && (
        <div className="card-stat space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-accent" /> Cliques por Plataforma
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {topPlat.map(([plat, cliques]) => (
              <div key={plat} className="flex items-center gap-3 rounded-lg bg-background border border-border p-3">
                <span className="text-xl">{platEmoji[plat] ?? '🔗'}</span>
                <div>
                  <p className="text-xs font-medium text-white capitalize">{plat}</p>
                  <p className="text-lg font-bold text-accent">{cliques.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plataformas onde divulgar */}
      <div className="card-stat space-y-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Users className="w-4 h-4 text-accent" /> Plataformas onde você pode divulgar (sem integração automática)
        </h3>
        <div className="flex flex-wrap gap-2">
          {['🎵 TikTok','📸 Instagram','▶️ YouTube','👤 Facebook','📌 Pinterest',
            '💼 LinkedIn','📝 Blog','📧 Email','💬 WhatsApp','✈️ Telegram',
            '🟠 Reddit','💜 Discord','🎨 Patreon','💚 Gumroad','📦 Amazon',
            '🛒 Mercado Livre','🛍️ Shopee','🔥 Hotmart','🐦 Twitter/X',
            '📱 Kwai','🎮 Twitch','🎙️ Podcast','📲 SMS','🖨️ Print'].map(p => (
            <span key={p} className="px-2.5 py-1 rounded-full bg-accent/10 border border-accent/20 text-xs text-accent">{p}</span>
          ))}
        </div>
      </div>

      {/* CTAs */}
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/links"><Link2 className="w-4 h-4" />Gerenciar Links</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/conteudos/gerar"><Zap className="w-4 h-4" />Gerar Conteúdo</Link>
        </Button>
      </div>
    </div>
  )
}
