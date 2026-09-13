'use client'

import { useEffect, useState } from 'react'
import { Receipt, Plus, Loader2, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { formatCurrency, formatDateShort } from '@/lib/utils'
import { useGuardModulo } from '@/hooks/useGuardModulo'

interface Produto { id: string; nome: string }
interface Programa { id: string; platform: string }
interface Venda {
  id: string
  status: string
  amount: number | null
  date: string
  notes: string | null
  product: { nome: string } | null
  affiliateProgram: { platform: string } | null
  commissions: Array<{ id: string; status: string; expectedAmount: number | null; confirmedAmount: number | null; receivedAmount: number | null }>
}

const VENDA_STATUS: Record<string, { label: string; cor: string }> = {
  PENDING: { label: 'Pendente', cor: 'text-warning bg-warning/10' },
  CONFIRMED: { label: 'Confirmada', cor: 'text-accent bg-accent/10' },
  CANCELLED: { label: 'Cancelada', cor: 'text-danger bg-danger/10' },
}

export default function VendasComissoesPage() {
  useGuardModulo('vendas-comissoes')
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [programas, setProgramas] = useState<Programa[]>([])
  const [vendas, setVendas] = useState<Venda[]>([])
  const [resumoComissoes, setResumoComissoes] = useState({ prevista: 0, confirmada: 0, recebida: 0 })
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [form, setForm] = useState({
    productId: '', affiliateProgramId: '', amount: '', status: 'CONFIRMED', expectedCommission: '', notes: '',
  })

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [prodRes, progRes, vendasRes, comRes] = await Promise.all([
      fetch('/api/produtos'), fetch('/api/programas'), fetch('/api/vendas'), fetch('/api/comissoes'),
    ])
    if (prodRes.ok) setProdutos(await prodRes.json())
    if (progRes.ok) setProgramas(await progRes.json())
    if (vendasRes.ok) setVendas(await vendasRes.json())
    if (comRes.ok) {
      const data = await comRes.json()
      setResumoComissoes(data.resumo)
    }
    setLoading(false)
  }

  async function registrar() {
    if (!form.productId) { setErro('Selecione um produto para continuar'); return }
    setErro('')
    setSalvando(true)
    const res = await fetch('/api/vendas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: form.productId,
        affiliateProgramId: form.affiliateProgramId || undefined,
        amount: form.amount ? parseFloat(form.amount.replace(',', '.')) : undefined,
        status: form.status,
        expectedCommission: form.expectedCommission ? parseFloat(form.expectedCommission.replace(',', '.')) : undefined,
        notes: form.notes || undefined,
      }),
    })
    if (res.ok) {
      toast({ title: 'Resultado registrado com sucesso', variant: 'success' })
      setShowForm(false)
      setForm({ productId: '', affiliateProgramId: '', amount: '', status: 'CONFIRMED', expectedCommission: '', notes: '' })
      fetchAll()
    } else {
      const data = await res.json().catch(() => ({}))
      setErro(data.error ?? 'Não foi possível registrar. Tente novamente.')
    }
    setSalvando(false)
  }

  const contagem = { PENDING: 0, CONFIRMED: 0, CANCELLED: 0 }
  for (const v of vendas) contagem[v.status as keyof typeof contagem] = (contagem[v.status as keyof typeof contagem] ?? 0) + 1

  return (
    <div className="space-y-6 w-full max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Receipt className="w-5 h-5 text-accent" /> Vendas e Comissões
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Registre resultados manuais e acompanhe suas comissões.</p>
        </div>
        <Button onClick={() => setShowForm((s) => !s)}>
          <Plus className="w-4 h-4" /> Registrar resultado
        </Button>
      </div>

      {showForm && (
        <div className="card-stat space-y-4 border-accent/30">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Produto</label>
              <select className="input mt-1 w-full" value={form.productId} onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))}>
                <option value="">Selecione...</option>
                {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Programa (opcional)</label>
              <select className="input mt-1 w-full" value={form.affiliateProgramId} onChange={(e) => setForm((f) => ({ ...f, affiliateProgramId: e.target.value }))}>
                <option value="">Nenhum</option>
                {programas.map((p) => <option key={p.id} value={p.id}>{p.platform}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Valor da venda (opcional)</label>
              <input className="input mt-1 w-full" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="R$" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Comissão prevista (opcional)</label>
              <input className="input mt-1 w-full" value={form.expectedCommission} onChange={(e) => setForm((f) => ({ ...f, expectedCommission: e.target.value }))} placeholder="R$" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <select className="input mt-1 w-full" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                <option value="PENDING">Pendente</option>
                <option value="CONFIRMED">Confirmada</option>
                <option value="CANCELLED">Cancelada</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Observações (opcional)</label>
            <textarea className="input mt-1 w-full" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
          {erro && <p className="text-xs text-danger">{erro}</p>}
          <div className="flex gap-2">
            <Button onClick={registrar} disabled={salvando}>
              {salvando ? <><Loader2 className="w-4 h-4 animate-spin" />Salvando resultado...</> : 'Registrar'}
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)} disabled={salvando}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Comissões */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Comissões</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Prevista', valor: resumoComissoes.prevista, icon: DollarSign, color: 'text-blue-400', bg: 'bg-blue-400/10' },
            { label: 'Confirmada', valor: resumoComissoes.confirmada, icon: DollarSign, color: 'text-warning', bg: 'bg-warning/10' },
            { label: 'Recebida', valor: resumoComissoes.recebida, icon: DollarSign, color: 'text-accent', bg: 'bg-accent/10' },
          ].map(({ label, valor, icon: Icon, color, bg }) => (
            <div key={label} className="card-stat flex items-center gap-4">
              <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${bg}`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div>
                <p className="text-lg font-bold text-white">{loading ? '—' : formatCurrency(valor)}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Vendas */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Vendas · {contagem.PENDING} pendentes · {contagem.CONFIRMED} confirmadas · {contagem.CANCELLED} canceladas
        </h2>
        {loading ? (
          <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="card-stat animate-pulse h-16" />)}</div>
        ) : vendas.length === 0 ? (
          <div className="card-stat flex flex-col items-center justify-center py-16 text-center">
            <Receipt className="w-8 h-8 text-muted-foreground mb-2 opacity-30" />
            <p className="text-sm text-muted-foreground">Nenhuma venda registrada ainda.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Produto</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Valor</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">Data</th>
                </tr>
              </thead>
              <tbody>
                {vendas.map((v) => {
                  const status = VENDA_STATUS[v.status] ?? VENDA_STATUS.PENDING
                  return (
                    <tr key={v.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-medium text-white">{v.product?.nome ?? '—'}</td>
                      <td className="px-4 py-3"><span className={`badge-status ${status.cor}`}>{status.label}</span></td>
                      <td className="px-4 py-3 text-right text-muted-foreground">{v.amount != null ? formatCurrency(v.amount) : '—'}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground hidden sm:table-cell">{formatDateShort(v.date)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
