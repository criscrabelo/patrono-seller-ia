'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, ExternalLink, Loader2, AlertCircle, RefreshCw, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { useGuardModulo } from '@/hooks/useGuardModulo'

interface Integracao {
  plataforma: string
  status: string
  accountName?: string
  accountId?: string
  tokenExpiry?: string
  /** P1.5.1 — o que a conta comprovadamente autorizou. Nunca traz token. */
  autorizacao?: {
    estado: string
    scopes: string[] | null
    scopesFaltando: string[]
    scopesComprovadosEm: string | null
  }
  /** P1.5.2 — por que este canal ainda nao publica. */
  preflight?: {
    pronto: boolean
    executavelAgora: boolean
    bloqueio: string | null
    oQueFalta: string | null
    adapterLigado: boolean
  }
}

interface Plataforma {
  id: string
  nome: string
  logo: string
  cor: string
  descricao: string
  tipo: 'oauth' | 'token' | 'chaves'
  campos?: { key: string; label: string; placeholder: string; secret?: boolean }[]
  urlDocs: string
  urlOAuth?: string
  urlDedicada?: string
}

const PLATAFORMAS: Plataforma[] = [
  {
    id: 'instagram',
    nome: 'Instagram',
    logo: '📸',
    cor: 'from-pink-500 to-purple-600',
    descricao: 'Publique posts, reels e stories automaticamente',
    tipo: 'oauth',
    urlDocs: 'https://developers.facebook.com/docs/instagram-api',
    campos: [
      { key: 'accessToken', label: 'Access Token de longa duração (EAA... ou IGAA...)', placeholder: 'EAABsbCS... ou IGAAxxxx...', secret: true },
      { key: 'accountId', label: 'Instagram Business Account ID (ou Instagram User ID)', placeholder: '17841400...' },
      { key: 'appId', label: 'Meta App ID (para renovação automática)', placeholder: '123456789012345' },
      { key: 'appSecret', label: 'Meta App Secret (para renovação automática)', placeholder: 'abc123def456...', secret: true },
    ],
  },
  {
    id: 'tiktok',
    nome: 'TikTok',
    logo: '🎵',
    cor: 'from-gray-900 to-gray-700',
    descricao: 'Publique vídeos e gerencie sua conta',
    tipo: 'token',
    urlDocs: 'https://developers.tiktok.com',
    campos: [
      { key: 'accessToken', label: 'Access Token (TikTok for Business)', placeholder: 'act.example...', secret: true },
      { key: 'accountName', label: 'Nome da conta TikTok', placeholder: '@suaconta' },
    ],
  },
  {
    id: 'mercadolivre',
    nome: 'Mercado Livre',
    logo: '🛒',
    cor: 'from-yellow-400 to-yellow-500',
    descricao: 'Gerencie anúncios e vendas automaticamente',
    tipo: 'chaves',
    urlDocs: 'https://developers.mercadolivre.com.br',
    campos: [
      { key: 'accessToken', label: 'Access Token', placeholder: 'APP_USR-...', secret: true },
      { key: 'accountId', label: 'Seller ID', placeholder: '123456789' },
      { key: 'accountName', label: 'Nome da loja', placeholder: 'Minha Loja ML' },
    ],
  },
  {
    id: 'shopee',
    nome: 'Shopee',
    logo: '🛍️',
    cor: 'from-orange-500 to-red-500',
    descricao: 'Afiliado ou vendedor — gere links rastreáveis para todos os produtos',
    tipo: 'chaves',
    urlDocs: 'https://affiliate.shopee.com.br',
    urlDedicada: '/integracoes/shopee',
    campos: [
      { key: 'accessToken', label: 'Access Token (Shopee Open Platform)', placeholder: 'access_token...', secret: true },
      { key: 'accountId', label: 'Shop ID', placeholder: '123456' },
      { key: 'accountName', label: 'Nome da loja', placeholder: 'Minha Loja Shopee' },
    ],
  },
  {
    id: 'hotmart',
    nome: 'Hotmart',
    logo: '🔥',
    cor: 'from-red-500 to-orange-400',
    descricao: 'Gerencie produtos digitais e afiliados',
    tipo: 'chaves',
    urlDocs: 'https://developers.hotmart.com',
    campos: [
      { key: 'accessToken', label: 'Bearer Token (Hotmart API)', placeholder: 'eyJhbGci...', secret: true },
      { key: 'accountId', label: 'Client ID', placeholder: 'seu-client-id' },
      { key: 'accountName', label: 'Nome da conta', placeholder: 'Minha Conta Hotmart' },
    ],
  },
  {
    id: 'amazon',
    nome: 'Amazon',
    logo: '📦',
    cor: 'from-yellow-500 to-orange-400',
    descricao: 'Gerencie produtos e vendas na Amazon / Amazon Afiliados',
    tipo: 'chaves',
    urlDocs: 'https://developer-docs.amazon.com/sp-api',
    campos: [
      { key: 'accessToken', label: 'LWA Access Token (SP-API)', placeholder: 'Atza|...', secret: true },
      { key: 'accountId', label: 'Seller ID / Associate Tag', placeholder: 'A1XXXXX ou seu-tag-22' },
      { key: 'accountName', label: 'Nome da loja', placeholder: 'Minha Loja Amazon' },
    ],
  },
  {
    id: 'whatsapp',
    nome: 'WhatsApp (Z-API)',
    logo: '💬',
    cor: 'from-[#25D366] to-[#128C7E]',
    descricao: 'Envie conteúdos em massa para sua lista de contatos via Z-API',
    tipo: 'chaves',
    urlDocs: 'https://developer.z-api.io',
    urlDedicada: '/whatsapp',
    campos: [
      { key: 'accountId', label: 'Instance ID (Z-API)', placeholder: '3ABC1...', secret: false },
      { key: 'accessToken', label: 'Token (Z-API)', placeholder: 'F0...', secret: true },
      { key: 'clientToken', label: 'Client-Token (segurança — opcional)', placeholder: 'F0...', secret: true },
      { key: 'accountName', label: 'Identificação (ex: WhatsApp da Loja)', placeholder: 'Loja Principal' },
    ],
  },
]

export default function IntegracoesPage() {
  useGuardModulo('integracoes')
  const [integracoes, setIntegracoes] = useState<Integracao[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [renovando, setRenovando] = useState(false)
  const [revalidando, setRevalidando] = useState(false)
  const [campos, setCampos] = useState<Record<string, Record<string, string>>>({})

  async function fetchIntegracoes() {
    const res = await fetch('/api/integracoes')
    const data = await res.json()
    setIntegracoes(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { fetchIntegracoes() }, [])

  function getStatus(id: string) {
    return integracoes.find((i) => i.plataforma === id)
  }

  function setCampo(plat: string, key: string, val: string) {
    setCampos((prev) => ({ ...prev, [plat]: { ...(prev[plat] ?? {}), [key]: val } }))
  }

  async function conectar(plataforma: Plataforma) {
    const data = campos[plataforma.id] ?? {}
    const accessToken = data.accessToken?.trim()
    if (!accessToken) {
      toast({ title: 'Preencha o Access Token', variant: 'destructive' })
      return
    }

    setSaving(plataforma.id)

    // Para o Instagram, guarda appId e appSecret em extraData para renovação automática
    // Para o WhatsApp, guarda clientToken em extraData
    const extraData =
      plataforma.id === 'instagram' && (data.appId || data.appSecret)
        ? { appId: data.appId?.trim(), appSecret: data.appSecret?.trim() }
        : plataforma.id === 'whatsapp' && data.clientToken
        ? { clientToken: data.clientToken.trim() }
        : undefined

    const res = await fetch('/api/integracoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plataforma: plataforma.id,
        accessToken,
        accountId: data.accountId,
        accountName: data.accountName,
        extraData,
      }),
    })

    if (res.ok) {
      toast({ title: `${plataforma.nome} conectado!`, variant: 'success' })
      setExpanded(null)
      setCampos((prev) => ({ ...prev, [plataforma.id]: {} }))
      fetchIntegracoes()
    } else {
      toast({ title: 'Erro ao conectar', variant: 'destructive' })
    }
    setSaving(null)
  }

  async function renovarTokenInstagram() {
    setRenovando(true)
    const res = await fetch('/api/integracoes/instagram/renovar', { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      const expiry = new Date(data.tokenExpiry)
      toast({
        title: 'Token renovado com sucesso!',
        description: `Válido até ${expiry.toLocaleDateString('pt-BR')}`,
        variant: 'success',
      })
      fetchIntegracoes()
    } else {
      toast({ title: 'Erro ao renovar token', description: data.error, variant: 'destructive' })
    }
    setRenovando(false)
  }

  async function revalidarInstagram() {
    setRevalidando(true)
    const res = await fetch('/api/integracoes/instagram/revalidar', { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      const quantos = data.autorizacao?.scopes?.length ?? 0
      toast({
        title: quantos > 0 ? 'Permissoes comprovadas' : 'Nao foi possivel comprovar as permissoes',
        description: quantos > 0 ? `${quantos} permissao(oes) confirmada(s) pela Meta.` : data.motivo,
        variant: quantos > 0 ? 'success' : 'destructive',
      })
      fetchIntegracoes()
    } else {
      toast({ title: 'Erro ao revalidar', description: data.error, variant: 'destructive' })
    }
    setRevalidando(false)
  }

  function tokenExpiryBadge(tokenExpiry?: string) {
    if (!tokenExpiry) return null
    const expiry = new Date(tokenExpiry)
    const diasRestantes = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    if (diasRestantes <= 0) {
      return { label: 'Token expirado', cls: 'border-danger/40 bg-danger/10 text-danger' }
    }
    if (diasRestantes <= 15) {
      return { label: `Expira em ${diasRestantes}d`, cls: 'border-warning/40 bg-warning/10 text-warning' }
    }
    return { label: `Válido por ${diasRestantes}d`, cls: 'border-accent/30 bg-accent/10 text-accent' }
  }

  async function desconectar(id: string, nome: string) {
    if (!confirm(`Deseja desconectar o ${nome}?`)) return
    setDisconnecting(id)
    await fetch(`/api/integracoes?plataforma=${id}`, { method: 'DELETE' })
    toast({ title: `${nome} desconectado` })
    fetchIntegracoes()
    setDisconnecting(null)
  }

  if (loading) return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(5)].map((_, i) => <div key={i} className="card-stat animate-pulse h-48" />)}
    </div>
  )

  const conectados = integracoes.filter((i) => i.status === 'conectado').length

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-lg font-semibold text-white">Integrações</h2>
        <p className="text-sm text-muted-foreground">
          {conectados} de {PLATAFORMAS.length} plataformas conectadas · Instagram, TikTok, Mercado Livre, Shopee, Hotmart, Amazon
        </p>
      </div>

      {/* Aviso */}
      <div className="flex gap-3 rounded-xl border border-warning/30 bg-warning/5 p-4">
        <AlertCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="text-warning font-medium mb-1">Como obter as credenciais</p>
          <p className="text-muted-foreground">
            Cada plataforma exige cadastro como desenvolvedor. Clique em "Ver documentação" em cada card para
            obter seu token de acesso. Os tokens são armazenados com segurança no banco de dados.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {PLATAFORMAS.map((plat) => {
          const status = getStatus(plat.id)
          const conectado = status?.status === 'conectado'
          const isExpanded = expanded === plat.id
          const isSaving = saving === plat.id
          const isDisconnecting = disconnecting === plat.id

          return (
            <div key={plat.id} className="card-stat flex flex-col gap-4">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn('w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-xl', plat.cor)}>
                    {plat.logo}
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm">{plat.nome}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      {conectado ? (
                        <>
                          <CheckCircle className="w-3 h-3 text-accent" />
                          <span className="text-xs text-accent">Conectado</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Desconectado</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">{plat.descricao}</p>

              {conectado && status?.accountName && (
                <div className="rounded-lg bg-accent/10 border border-accent/20 px-3 py-2">
                  <p className="text-xs text-accent font-medium">{status.accountName}</p>
                  {status.accountId && <p className="text-[10px] text-muted-foreground">ID: {status.accountId}</p>}
                </div>
              )}

              {/* P1.5.2 — a pergunta que a tela precisa responder sozinha:
                  "por que este canal ainda nao esta publicando?" */}
              {conectado && status?.preflight && (
                <div
                  className={cn(
                    'rounded-lg border px-3 py-2 space-y-1',
                    status.preflight.executavelAgora
                      ? 'border-accent/30 bg-accent/10'
                      : 'border-warning/40 bg-warning/10'
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    {status.preflight.executavelAgora ? (
                      <CheckCircle className="w-3.5 h-3.5 text-accent shrink-0" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-warning shrink-0" />
                    )}
                    <span
                      className={cn(
                        'text-xs font-medium',
                        status.preflight.executavelAgora ? 'text-accent' : 'text-warning'
                      )}
                    >
                      {status.preflight.executavelAgora
                        ? 'Publicacao liberada'
                        : status.preflight.pronto
                          ? 'Conta pronta, canal desligado'
                          : 'Publicacao bloqueada'}
                    </span>
                  </div>

                  <p className="text-[10px] text-muted-foreground">
                    Autorizacao: {status.autorizacao?.estado ?? 'desconhecida'}
                  </p>

                  {status.autorizacao?.scopes && status.autorizacao.scopes.length > 0 && (
                    <p className="text-[10px] text-muted-foreground break-words">
                      Permissoes: {status.autorizacao.scopes.join(', ')}
                    </p>
                  )}
                  {status.autorizacao?.scopesFaltando?.length ? (
                    <p className="text-[10px] text-warning break-words">
                      Falta conceder: {status.autorizacao.scopesFaltando.join(', ')}
                    </p>
                  ) : null}
                  {status.autorizacao?.scopesComprovadosEm && (
                    <p className="text-[10px] text-muted-foreground">
                      Comprovado em{' '}
                      {new Date(status.autorizacao.scopesComprovadosEm).toLocaleDateString('pt-BR')}
                    </p>
                  )}

                  {!status.preflight.executavelAgora && status.preflight.oQueFalta && (
                    <p className="text-[10px] text-warning break-words">{status.preflight.oQueFalta}</p>
                  )}

                  {plat.id === 'instagram' && (
                    <button
                      onClick={revalidarInstagram}
                      disabled={revalidando}
                      className="flex items-center gap-1 text-[10px] font-semibold text-accent opacity-80 hover:opacity-100 transition-opacity disabled:opacity-40"
                    >
                      {revalidando ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3 h-3" />
                      )}
                      Recomprovar permissoes
                    </button>
                  )}
                </div>
              )}

              {/* Badge de expiração do token + botão renovar (apenas Instagram) */}
              {conectado && plat.id === 'instagram' && (() => {
                const badge = tokenExpiryBadge(status?.tokenExpiry)
                return badge ? (
                  <div className={cn('rounded-lg border px-3 py-2 flex items-center justify-between gap-2', badge.cls)}>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span className="text-xs font-medium">{badge.label}</span>
                    </div>
                    <button
                      onClick={renovarTokenInstagram}
                      disabled={renovando}
                      className="flex items-center gap-1 text-[10px] font-semibold opacity-80 hover:opacity-100 transition-opacity disabled:opacity-40"
                    >
                      {renovando
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <RefreshCw className="w-3 h-3" />}
                      Renovar
                    </button>
                  </div>
                ) : null
              })()}

              {/* Form de credenciais */}
              {isExpanded && !conectado && (
                <div className="space-y-3 pt-2 border-t border-border">
                  {plat.campos?.map((campo) => (
                    <div key={campo.key}>
                      <label className="text-xs text-muted-foreground mb-1 block">{campo.label}</label>
                      <input
                        type={campo.secret ? 'password' : 'text'}
                        placeholder={campo.placeholder}
                        value={campos[plat.id]?.[campo.key] ?? ''}
                        onChange={(e) => setCampo(plat.id, campo.key, e.target.value)}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-white
                          placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Ações */}
              <div className="flex gap-2 mt-auto pt-2 border-t border-border">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  asChild
                >
                  <a href={plat.urlDocs} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3.5 h-3.5" />
                    Docs
                  </a>
                </Button>

                {conectado ? (
                  plat.urlDedicada ? (
                    <Button size="sm" className="flex-1" asChild>
                      <Link href={plat.urlDedicada}><CheckCircle className="w-3.5 h-3.5" />Gerenciar</Link>
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1"
                      disabled={isDisconnecting}
                      onClick={() => desconectar(plat.id, plat.nome)}
                    >
                      {isDisconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                      Desconectar
                    </Button>
                  )
                ) : plat.urlDedicada ? (
                  <Button size="sm" className="flex-1" asChild>
                    <Link href={plat.urlDedicada}><CheckCircle className="w-3.5 h-3.5" />Configurar</Link>
                  </Button>
                ) : isExpanded ? (
                  <Button
                    size="sm"
                    className="flex-1"
                    disabled={isSaving}
                    onClick={() => conectar(plat)}
                  >
                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                    Conectar
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => setExpanded(plat.id)}
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Configurar
                  </Button>
                )}
              </div>

              {isExpanded && !conectado && (
                <button
                  onClick={() => setExpanded(null)}
                  className="text-xs text-muted-foreground hover:text-white text-center"
                >
                  Cancelar
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
