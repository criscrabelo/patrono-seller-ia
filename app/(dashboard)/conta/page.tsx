'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { KeyRound, Loader2, Eye, EyeOff, User as UserIcon } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

export default function ContaPage() {
  const { data: session } = useSession()
  const [senhaAtual, setSenhaAtual] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [showAtual, setShowAtual] = useState(false)
  const [showNova, setShowNova] = useState(false)
  const [salvando, setSalvando] = useState(false)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (novaSenha !== confirmar) {
      toast({ title: 'As senhas novas não coincidem', variant: 'destructive' })
      return
    }
    if (novaSenha.length < 6) {
      toast({ title: 'A nova senha precisa ter pelo menos 6 caracteres', variant: 'destructive' })
      return
    }
    setSalvando(true)
    const res = await fetch('/api/conta/senha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senhaAtual, novaSenha }),
    })
    setSalvando(false)
    if (res.ok) {
      toast({ title: 'Senha alterada com sucesso!', variant: 'success' })
      setSenhaAtual(''); setNovaSenha(''); setConfirmar('')
    } else {
      const d = await res.json().catch(() => ({}))
      toast({ title: d.error || 'Erro ao alterar senha', variant: 'destructive' })
    }
  }

  const inputClass = `w-full rounded-lg border border-border bg-background px-3.5 py-2.5 pr-10 text-sm
    text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-accent transition-colors`

  const OlhoBtn = ({ show, toggle }: { show: boolean; toggle: () => void }) => (
    <button
      type="button"
      onClick={toggle}
      tabIndex={-1}
      title={show ? 'Ocultar senha' : 'Mostrar senha'}
      aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
    >
      {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
    </button>
  )

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Minha Conta</h2>
        <p className="text-sm text-muted-foreground">Seus dados e segurança</p>
      </div>

      {/* Dados */}
      <div className="card-stat space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
            <UserIcon className="w-5 h-5 text-accent" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">{session?.user?.name || '—'}</p>
            <p className="text-xs text-muted-foreground truncate">{session?.user?.email}</p>
          </div>
        </div>
      </div>

      {/* Trocar senha */}
      <div className="card-stat space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-accent" /> Trocar senha
        </h3>
        <form onSubmit={salvar} className="space-y-4">
          <div>
            <label htmlFor="senhaAtual" className="text-sm font-medium text-white/70 block mb-1.5">Senha atual</label>
            <div className="relative">
              <input
                id="senhaAtual"
                type={showAtual ? 'text' : 'password'}
                autoComplete="current-password"
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value)}
                placeholder="••••••••"
                className={inputClass}
              />
              <OlhoBtn show={showAtual} toggle={() => setShowAtual((v) => !v)} />
            </div>
          </div>

          <div>
            <label htmlFor="novaSenha" className="text-sm font-medium text-white/70 block mb-1.5">Nova senha</label>
            <div className="relative">
              <input
                id="novaSenha"
                type={showNova ? 'text' : 'password'}
                autoComplete="new-password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="Pelo menos 6 caracteres"
                className={inputClass}
              />
              <OlhoBtn show={showNova} toggle={() => setShowNova((v) => !v)} />
            </div>
          </div>

          <div>
            <label htmlFor="confirmar" className="text-sm font-medium text-white/70 block mb-1.5">Confirmar nova senha</label>
            <div className="relative">
              <input
                id="confirmar"
                type={showNova ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                placeholder="••••••••"
                className={inputClass}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={salvando}
            className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-primary-dark
                       hover:bg-accent-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed
                       flex items-center justify-center gap-2"
          >
            {salvando ? <><Loader2 className="w-4 h-4 animate-spin" />Salvando...</> : 'Alterar senha'}
          </button>
        </form>
      </div>
    </div>
  )
}
