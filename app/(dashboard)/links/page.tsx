'use client'

import { useEffect, useState } from 'react'
import { Copy, Check, Plus, Link2, Zap, TrendingUp, MousePointer, DollarSign, RefreshCw, X, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { formatCurrency } from '@/lib/utils'

interface Produto { id: string; nome: string; preco: number }
interface LinkDinamico {
  id: string; slug: string; plataforma: string; urlDestino: string
  tipo: string; comissao: number | null; cliques: number; conversoes: number
  receitaTotal: number; ativo: boolean; produto: { nome: string; preco: number }
  ultimaAtualizacao: string
}

const PLATAFORMAS_OPCOES = [
  { id: 'tiktok', label: 'TikTok', emoji: '🎵' },
  { id: 'instagram', label: 'Instagram', emoji: '📸' },
  { id: 'youtube', label: 'YouTube', emoji: '▶️' },
  { id: 'facebook', label: 'Facebook', emoji: '👤' },
  { id: 'pinterest', label: 'Pinterest', emoji: '📌' },
  { id: 'whatsapp', label: 'WhatsApp', emoji: '💬' },
  { id: 'telegram', label: 'Telegram', emoji: '✈️' },
  { id: 'linkedin', label: 'LinkedIn', emoji: '💼' },
  { id: 'blog', label: 'Blog', emoji: '📝' },
  { id: 'email', label: 'Email', emoji: '📧' },
  { id: 'reddit', label: 'Reddit', emoji: '🟠' },
  { id: 'discord', label: 'Discord', emoji: '💜' },
  { id: 'patreon', label: 'Patreon', emoji: '🎨' },
  { id: 'gumroad', label: 'Gumroad', emoji: '💚' },
  { id: 'amazon', label: 'Amazon', emoji: '📦' },
  { id: 'mercadolivre', label: 'Mercado Livre', emoji: '🛒' },
  { id: 'shopee', label: 'Shopee', emoji: '🛍️' },
  { id: 'hotmart', label: 'Hotmart', emoji: '🔥' },
]

const TIPOS = [
  { id: 'afiliado', label: 'Afiliado', desc: 'Comissão 5-30%' },
  { id: 'tiktok-shop', label: 'TikTok Shop', desc: '~10% margem' },
  { id: 'loja-propria', label: 'Loja Própria', desc: '70-100% margem' },
]

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button onClick={async () => {
      await navigator.clipboard.writeText(text)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    }} className="p-1 rounded hover:bg-white/10 transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-accent" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
    </button>
  )
}

const PLAT_EMOJI: Record<string, string> = Object.fromEntries(PLATAFORMAS_OPCOES.map(p => [p.id, p.emoji]))

export default function LinksPage() {
  const [links, setLinks] = useState<LinkDinamico[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [expandedProd, setExpandedProd] = useState<string | null>(null)

  const [form, setForm] = useState({
    produtoId: '', urlDestino: '', tipo: 'afiliado', comissao: '',
    plataformas: PLATAFORMAS_OPCOES.map(p => p.id),
  })

  async function fetchAll() {
    const [linksRes, prodRes] = await Promise.all([
      fetch('/api/links'), fetch('/api/produtos'),
    ])
    const [l, p] = await Promise.all([linksRes.json(), prodRes.json()])
    setLinks(Array.isArray(l) ? l : [])
    setProdutos(Array.isArray(p) ? p : [])
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  async function gerar() {
    if (!form.produtoId || !form.urlDestino) {
      toast({ title: 'Preencha produto e URL de destino', variant: 'destructive' }); return
    }
    setGenerating(true)
    const res = await fetch('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, plataformas: form.plataformas }),
    })
    if (res.ok) {
      const novos = await res.json()
      toast({ title: `✅ ${novos.length} links gerados!`, variant: 'success' })
      setShowForm(false)
      fetchAll()
    } else {
      toast({ title: 'Erro ao gerar links', variant: 'destructive' })
    }
    setGenerating(false)
  }

  function togglePlat(id: string) {
    setForm(f => ({
      ...f,
      plataformas: f.plataformas.includes(id)
        ? f.plataformas.filter(p => p !== id)
        : [...f.plataformas, id],
    }))
  }

  const totalCliques = links.reduce((s, l) => s + l.cliques, 0)
  const totalConversoes = links.reduce((s, l) => s + l.conversoes, 0)
  const totalReceita = links.reduce((s, l) => s + l.receitaTotal, 0)

  // Agrupar links por produto
  const porProduto = links.reduce((acc, l) => {
    const key = l.produto.nome
    if (!acc[key]) acc[key] = []
    acc[key].push(l)
    return acc
  }, {} as Record<string, LinkDinamico[]>)

  const inputCls = `w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm
    text-white placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent`

  return (
    <div className="space-y-6 w-full max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Link2 className="w-5 h-5 text-accent" /> Links Dinâmicos
          </h2>
          <p className="text-sm text-muted-foreground">{links.length} links ativos em {Object.keys(porProduto).length} produtos</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus className="w-4 h-4" /> Gerar Links
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Cliques Totais', value: totalCliques.toLocaleString(), icon: MousePointer, color: 'text-accent' },
          { label: 'Conversões', value: totalConversoes.toLocaleString(), icon: TrendingUp, color: 'text-warning' },
          { label: 'Receita Total', value: formatCurrency(totalReceita), icon: DollarSign, color: 'text-accent' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card-stat flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Formulário de geração */}
      {showForm && (
        <div className="card-stat space-y-5 border-accent/30">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-accent" /> Gerar Links para Todas as Plataformas
            </h3>
            <button onClick={() => setShowForm(false)}>
              <X className="w-4 h-4 text-muted-foreground hover:text-white" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Produto *</label>
              <select className={inputCls} value={form.produtoId} onChange={e => setForm(f => ({ ...f, produtoId: e.target.value }))}>
                <option value="">Selecionar produto...</option>
                {produtos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Tipo de monetização *</label>
              <select className={inputCls} value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                {TIPOS.map(t => <option key={t.id} value={t.id}>{t.label} — {t.desc}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs text-muted-foreground mb-1.5 block">URL de destino (link do produto) *</label>
              <input className={inputCls} placeholder="https://shopee.com.br/produto..." value={form.urlDestino}
                onChange={e => setForm(f => ({ ...f, urlDestino: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Comissão (%)</label>
              <input className={inputCls} type="number" placeholder="ex: 15" value={form.comissao}
                onChange={e => setForm(f => ({ ...f, comissao: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-2 block">
              Plataformas ({form.plataformas.length} selecionadas)
            </label>
            <div className="flex flex-wrap gap-2">
              {PLATAFORMAS_OPCOES.map(p => (
                <button key={p.id} onClick={() => togglePlat(p.id)}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors flex items-center gap-1
                    ${form.plataformas.includes(p.id)
                      ? 'bg-accent text-primary-dark border-accent font-semibold'
                      : 'border-border text-muted-foreground hover:border-accent/50'}`}>
                  {p.emoji} {p.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <button onClick={() => setForm(f => ({ ...f, plataformas: PLATAFORMAS_OPCOES.map(p => p.id) }))}
                className="text-xs text-accent hover:underline">Selecionar todas</button>
              <span className="text-muted-foreground text-xs">·</span>
              <button onClick={() => setForm(f => ({ ...f, plataformas: [] }))}
                className="text-xs text-muted-foreground hover:underline">Limpar</button>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={gerar} disabled={generating}>
              {generating
                ? <><RefreshCw className="w-4 h-4 animate-spin" />Gerando...</>
                : <><Zap className="w-4 h-4" />Gerar {form.plataformas.length} links</>
              }
            </Button>
          </div>
        </div>
      )}

      {/* Links agrupados por produto */}
      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="card-stat animate-pulse h-16" />)}</div>
      ) : Object.keys(porProduto).length === 0 ? (
        <div className="card-stat flex flex-col items-center justify-center py-16 text-center">
          <Link2 className="w-10 h-10 text-muted-foreground mb-3 opacity-30" />
          <p className="text-sm text-muted-foreground mb-4">Nenhum link gerado ainda.</p>
          <Button onClick={() => setShowForm(true)}><Plus className="w-4 h-4" />Gerar primeiros links</Button>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(porProduto).map(([nomeProd, prodLinks]) => {
            const isExpanded = expandedProd === nomeProd
            const cliquesTotal = prodLinks.reduce((s, l) => s + l.cliques, 0)
            return (
              <div key={nomeProd} className="card-stat space-y-3">
                <button className="w-full flex items-center justify-between"
                  onClick={() => setExpandedProd(isExpanded ? null : nomeProd)}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center">
                      <Link2 className="w-4 h-4 text-accent" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-white text-sm">{nomeProd}</p>
                      <p className="text-xs text-muted-foreground">
                        {prodLinks.length} links · {cliquesTotal} cliques
                      </p>
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>

                {isExpanded && (
                  <div className="border-t border-border pt-3 space-y-2">
                    {prodLinks.map(link => (
                      <div key={link.id} className="flex items-center gap-3 rounded-lg bg-background border border-border px-3 py-2.5">
                        <span className="text-lg">{PLAT_EMOJI[link.plataforma] ?? '🔗'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <code className="text-xs text-accent font-mono">
                              patrono.link/{link.slug}
                            </code>
                            <CopyBtn text={`http://localhost:3000/api/l/${link.slug}`} />
                          </div>
                          <p className="text-[10px] text-muted-foreground capitalize">{link.plataforma} · {link.tipo}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-semibold text-white">{link.cliques} cliques</p>
                          {link.comissao && <p className="text-[10px] text-accent">{link.comissao}% comissão</p>}
                        </div>
                      </div>
                    ))}
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
