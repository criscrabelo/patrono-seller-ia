'use client'

import { useEffect, useState } from 'react'
import { Handshake, Plus, Loader2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { useGuardModulo } from '@/hooks/useGuardModulo'

interface Provider {
  id: string
  nome: string
  categoria: string
  cadastroDisponivel: boolean
  urlOficial: string
}

interface Programa {
  id: string
  platform: string
  status: string
  operationMode: string
  integrationStatus: string
  notes: string | null
  createdAt: string
}

const STATUS_LABEL: Record<string, { label: string; cor: string }> = {
  NOT_REGISTERED: { label: 'Não cadastrada', cor: 'text-muted-foreground bg-secondary' },
  REQUESTED: { label: 'Solicitado', cor: 'text-blue-400 bg-blue-400/10' },
  WAITING_APPROVAL: { label: 'Aguardando aprovação', cor: 'text-warning bg-warning/10' },
  ACTIVE: { label: 'Ativo', cor: 'text-accent bg-accent/10' },
  NEEDS_CONFIGURATION: { label: 'Precisa de configuração', cor: 'text-danger bg-danger/10' },
}

const INTEGRACAO_LABEL: Record<string, string> = {
  NOT_AVAILABLE: 'Sem integração disponível',
  FUTURE: 'Integração futura',
  CONFIGURED: 'Configurada, não conectada',
  CONNECTED: 'Conectada',
  ERROR: 'Erro de integração',
}

export default function ProgramasPage() {
  useGuardModulo('programas')
  const [providers, setProviders] = useState<Provider[]>([])
  const [programas, setProgramas] = useState<Programa[]>([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    platform: '',
    status: 'REQUESTED',
    accountName: '',
    accessLink: '',
    notes: '',
  })

  useEffect(() => {
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)
    const [pRes, gRes] = await Promise.all([fetch('/api/programas/providers'), fetch('/api/programas')])
    if (pRes.ok) setProviders(await pRes.json())
    if (gRes.ok) setProgramas(await gRes.json())
    setLoading(false)
  }

  async function salvar() {
    if (!form.platform) {
      setErro('Selecione uma plataforma para continuar')
      return
    }
    setErro('')
    setSalvando(true)
    const res = await fetch('/api/programas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      toast({ title: 'Programa salvo!', variant: 'success' })
      setShowForm(false)
      setForm({ platform: '', status: 'REQUESTED', accountName: '', accessLink: '', notes: '' })
      fetchAll()
    } else {
      const data = await res.json().catch(() => ({}))
      setErro(data.error ?? 'Não foi possível salvar. Tente novamente.')
    }
    setSalvando(false)
  }

  const jaCadastradas = new Set(programas.map((p) => p.platform))
  const providerNome = (id: string) => providers.find((p) => p.id === id)?.nome ?? id

  return (
    <div className="space-y-6 w-full max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Handshake className="w-5 h-5 text-accent" /> Meus Programas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Programa (sou afiliada) × Operação (manual/futura) × Integração (futura) — funcionam de forma independente.
          </p>
        </div>
        <Button onClick={() => setShowForm((s) => !s)}>
          <Plus className="w-4 h-4" /> Cadastrar programa
        </Button>
      </div>

      {showForm && (
        <div className="card-stat space-y-4 border-accent/30">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Plataforma</label>
            <select
              className="input mt-1 w-full"
              value={form.platform}
              onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}
            >
              <option value="">Selecione...</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id} disabled={jaCadastradas.has(p.id)}>
                  {p.nome}{jaCadastradas.has(p.id) ? ' (já cadastrada)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <select
                className="input mt-1 w-full"
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              >
                {Object.entries(STATUS_LABEL).map(([id, { label }]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Nome da conta (opcional)</label>
              <input
                className="input mt-1 w-full"
                value={form.accountName}
                onChange={(e) => setForm((f) => ({ ...f, accountName: e.target.value }))}
                placeholder="ex.: @boracomprar"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Link de acesso ao programa (opcional)</label>
            <input
              className="input mt-1 w-full"
              value={form.accessLink}
              onChange={(e) => setForm((f) => ({ ...f, accessLink: e.target.value }))}
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Observações (opcional)</label>
            <textarea
              className="input mt-1 w-full"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <p className="text-xs text-muted-foreground bg-secondary/50 rounded-lg p-2.5">
            Nesta fase a operação é sempre <strong>manual</strong> — nenhuma senha da plataforma é
            solicitada aqui, e nenhuma conta é conectada de verdade automaticamente.
          </p>
          {erro && <p className="text-xs text-danger">{erro}</p>}
          <div className="flex gap-2">
            <Button onClick={salvar} disabled={salvando}>
              {salvando ? <><Loader2 className="w-4 h-4 animate-spin" />Salvando...</> : 'Salvar programa'}
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)} disabled={salvando}>Cancelar</Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="card-stat animate-pulse h-16" />)}</div>
      ) : programas.length === 0 ? (
        <div className="card-stat flex flex-col items-center justify-center py-16 text-center">
          <Handshake className="w-8 h-8 text-muted-foreground mb-2 opacity-30" />
          <p className="text-sm text-muted-foreground">Nenhum programa cadastrado ainda.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Plataforma</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Programa</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">Operação</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground hidden sm:table-cell">Integração</th>
              </tr>
            </thead>
            <tbody>
              {programas.map((p) => {
                const status = STATUS_LABEL[p.status] ?? STATUS_LABEL.NOT_REGISTERED
                return (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium text-white">
                      <a
                        href={providers.find((x) => x.id === p.platform)?.urlOficial || '#'}
                        target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 hover:text-accent"
                      >
                        {providerNome(p.platform)} <ExternalLink className="w-3 h-3 opacity-50" />
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge-status ${status.cor}`}>{status.label}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">Manual</td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                      {INTEGRACAO_LABEL[p.integrationStatus] ?? p.integrationStatus}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
