'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { CheckCircle, XCircle, Trash2, Shield, User, Clock, Loader2, Pencil, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { formatDateShort } from '@/lib/utils'

interface Usuario {
  id: string
  name: string | null
  email: string
  role: string
  status: string
  createdAt: string
}

const statusLabel: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  ativo:    { label: 'Ativo',    color: 'text-success border-success/30 bg-success/10',  icon: <CheckCircle className="w-3 h-3" /> },
  pendente: { label: 'Pendente', color: 'text-warning border-warning/30 bg-warning/10',  icon: <Clock className="w-3 h-3" /> },
  bloqueado:{ label: 'Bloqueado',color: 'text-danger border-danger/30 bg-danger/10',     icon: <XCircle className="w-3 h-3" /> },
}

export default function UsuariosAdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [editandoEmailId, setEditandoEmailId] = useState<string | null>(null)
  const [emailEditado, setEmailEditado] = useState('')
  const [salvandoEmail, setSalvandoEmail] = useState(false)

  useEffect(() => {
    if (status === 'loading') return
    if (!session || session.user.role !== 'admin') {
      router.replace('/dashboard')
      return
    }
    fetchUsuarios()
  }, [session, status])

  async function fetchUsuarios() {
    setLoading(true)
    const res = await fetch('/api/admin/usuarios')
    const data = await res.json()
    setUsuarios(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  async function atualizar(id: string, payload: { status?: string; role?: string }) {
    const res = await fetch('/api/admin/usuarios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...payload }),
    })
    if (res.ok) {
      toast({ title: 'Usuário atualizado', variant: 'success' })
      fetchUsuarios()
    } else {
      toast({ title: 'Erro ao atualizar', variant: 'destructive' })
    }
  }

  function iniciarEdicaoEmail(u: Usuario) {
    setEditandoEmailId(u.id)
    setEmailEditado(u.email)
  }

  function cancelarEdicaoEmail() {
    setEditandoEmailId(null)
    setEmailEditado('')
  }

  async function salvarEmail(id: string) {
    const novoEmail = emailEditado.trim()
    if (!novoEmail) {
      toast({ title: 'Informe um email', variant: 'destructive' }); return
    }
    setSalvandoEmail(true)
    const res = await fetch('/api/admin/usuarios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, email: novoEmail }),
    })
    setSalvandoEmail(false)
    if (res.ok) {
      toast({ title: 'Email atualizado', variant: 'success' })
      setEditandoEmailId(null)
      setEmailEditado('')
      fetchUsuarios()
    } else {
      const d = await res.json().catch(() => ({}))
      toast({ title: d.error || 'Erro ao atualizar email', variant: 'destructive' })
    }
  }

  async function excluir(id: string, email: string) {
    if (!confirm(`Excluir usuário ${email}? Todos os dados serão perdidos.`)) return
    const res = await fetch(`/api/admin/usuarios?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast({ title: 'Usuário excluído', variant: 'success' })
      fetchUsuarios()
    } else {
      const d = await res.json()
      toast({ title: d.error || 'Erro ao excluir', variant: 'destructive' })
    }
  }

  const pendentes = usuarios.filter((u) => u.status === 'pendente')
  const demais   = usuarios.filter((u) => u.status !== 'pendente')

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Gerenciar Usuários</h2>
        <p className="text-sm text-muted-foreground">{usuarios.length} usuário(s) cadastrado(s)</p>
      </div>

      {loading ? (
        <div className="card-stat flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Pendentes */}
          {pendentes.length > 0 && (
            <div className="card-stat space-y-4">
              <h3 className="text-sm font-semibold text-warning flex items-center gap-2">
                <Clock className="w-4 h-4" /> Aguardando aprovação ({pendentes.length})
              </h3>
              {pendentes.map((u) => (
                <div key={u.id} className="flex items-center justify-between gap-3 rounded-lg border border-warning/20 bg-warning/5 p-3">
                  <div>
                    <p className="text-sm font-medium text-white">{u.name || '—'}</p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Solicitado em {formatDateShort(u.createdAt)}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" onClick={() => atualizar(u.id, { status: 'ativo' })}>
                      <CheckCircle className="w-3.5 h-3.5" /> Aprovar
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => atualizar(u.id, { status: 'bloqueado' })}>
                      <XCircle className="w-3.5 h-3.5" /> Rejeitar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Todos os usuários */}
          <div className="card-stat space-y-3">
            <h3 className="text-sm font-semibold text-white">Todos os usuários</h3>
            {demais.length === 0 && pendentes.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum usuário cadastrado.</p>
            )}
            {demais.map((u) => {
              const st = statusLabel[u.status] ?? statusLabel.bloqueado
              const isSelf = u.id === session?.user.id
              return (
                <div key={u.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                      {u.role === 'admin' ? <Shield className="w-4 h-4 text-accent" /> : <User className="w-4 h-4 text-muted-foreground" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">
                        {u.name || '—'}
                        {isSelf && <span className="ml-2 text-[10px] text-accent">(você)</span>}
                      </p>
                      {editandoEmailId === u.id ? (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <input
                            autoFocus
                            type="email"
                            value={emailEditado}
                            onChange={(e) => setEmailEditado(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') salvarEmail(u.id) }}
                            className="rounded-md border border-accent/40 bg-background px-2 py-1 text-xs text-white
                              focus:outline-none focus:ring-1 focus:ring-accent w-56"
                          />
                          <button onClick={() => salvarEmail(u.id)} disabled={salvandoEmail}
                            className="text-accent hover:text-accent-light p-1 disabled:opacity-50">
                            <Save className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={cancelarEdicaoEmail} disabled={salvandoEmail}
                            className="text-muted-foreground hover:text-white p-1">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                          <button onClick={() => iniciarEdicaoEmail(u)} title="Editar email"
                            className="text-muted-foreground hover:text-accent shrink-0">
                            <Pencil className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${st.color}`}>
                      {st.icon}{st.label}
                    </span>
                    {!isSelf && (
                      <>
                        {u.role !== 'admin' && (
                          <Button size="sm" variant="outline" onClick={() => atualizar(u.id, { role: 'admin' })}
                            title="Promover a admin">
                            <Shield className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {u.role === 'admin' && (
                          <Button size="sm" variant="outline" onClick={() => atualizar(u.id, { role: 'usuario' })}
                            title="Remover admin">
                            <User className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {u.status === 'ativo' && (
                          <Button size="sm" variant="outline" onClick={() => atualizar(u.id, { status: 'bloqueado' })}>
                            <XCircle className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {u.status === 'bloqueado' && (
                          <Button size="sm" variant="outline" onClick={() => atualizar(u.id, { status: 'ativo' })}>
                            <CheckCircle className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        <Button size="sm" variant="destructive" onClick={() => excluir(u.id, u.email)}
                          className="w-8 p-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
