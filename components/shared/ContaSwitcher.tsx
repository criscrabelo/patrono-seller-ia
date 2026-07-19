'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Check, Plus } from 'lucide-react'

interface Conta {
  id: string
  nome: string
}

export function ContaSwitcher() {
  const router = useRouter()
  const [contas, setContas] = useState<Conta[]>([])
  const [contaAtivaId, setContaAtivaId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [criando, setCriando] = useState(false)
  const [nomeNovaConta, setNomeNovaConta] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function carregar() {
    const res = await fetch('/api/contas')
    if (res.ok) {
      const data = await res.json()
      setContas(data.contas ?? [])
      setContaAtivaId(data.contaAtivaId ?? null)
    }
    setLoading(false)
  }

  useEffect(() => { carregar() }, [])

  function fechar() {
    setOpen(false)
    setCriando(false)
    setNomeNovaConta('')
  }

  async function ativar(id: string) {
    if (id === contaAtivaId) { fechar(); return }
    setContaAtivaId(id)
    fechar()
    await fetch('/api/contas/ativar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contaId: id }),
    })
    router.refresh()
  }

  async function criarConta() {
    const nome = nomeNovaConta.trim()
    if (!nome) return
    setSalvando(true)
    const res = await fetch('/api/contas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome }),
    })
    setSalvando(false)
    if (res.ok) {
      const nova = await res.json()
      setContas((cs) => [...cs, nova])
      setContaAtivaId(nova.id)
      fechar()
      router.refresh()
    }
  }

  const contaAtiva = contas.find((c) => c.id === contaAtivaId) ?? null

  if (loading) return null

  return (
    <div className="relative px-4 pb-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm hover:bg-secondary transition-colors"
      >
        <span className="truncate text-white font-medium">
          {contaAtiva?.nome ?? 'Selecionar marca'}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={fechar} />
          <div className="absolute left-4 right-4 z-50 mt-1.5 rounded-lg border border-border bg-card shadow-lg py-1.5 max-h-64 overflow-y-auto">
            {contas.length === 0 && (
              <p className="px-3 py-2 text-xs text-muted-foreground">Nenhuma marca ainda.</p>
            )}
            {contas.map((c) => (
              <button
                key={c.id}
                onClick={() => ativar(c.id)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-white hover:bg-secondary transition-colors"
              >
                <span className="truncate">{c.nome}</span>
                {c.id === contaAtivaId && <Check className="w-3.5 h-3.5 text-accent shrink-0" />}
              </button>
            ))}

            <div className="border-t border-border mt-1 pt-1 px-2">
              {criando ? (
                <div className="flex items-center gap-1.5 py-1">
                  <input
                    autoFocus
                    value={nomeNovaConta}
                    onChange={(e) => setNomeNovaConta(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') criarConta() }}
                    placeholder="Nome da marca"
                    className="flex-1 min-w-0 rounded-md border border-border bg-background px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                  <button
                    onClick={criarConta}
                    disabled={salvando}
                    className="text-xs text-accent hover:text-accent-light px-2 py-1 shrink-0 disabled:opacity-50"
                  >
                    {salvando ? '...' : 'Criar'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setCriando(true)}
                  className="w-full flex items-center gap-1.5 px-1 py-1.5 text-xs text-accent hover:text-accent-light transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Nova marca
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
