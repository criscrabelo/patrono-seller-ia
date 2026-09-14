'use client'

import { useEffect, useState } from 'react'
import { Loader2, Sparkles, ShieldCheck, Mic, User as UserIcon, Cpu } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

interface StatusResposta {
  profile: { id: string; displayName: string; enabled: boolean; consentStatus: string } | null
  voiceProfile: { id: string; enabled: boolean; provider: string | null } | null
  identityConsent: { status: string } | null
  voiceConsent: { status: string } | null
  podeGerar: { permitido: boolean; motivo: string }
  runtime: { cpuCores: number; totalRamGB: number; gpuDetected: boolean; gpuName: string | null }
}

/**
 * Configurações → Digital Twin (Rodada 7). Só o essencial: status real do
 * perfil/consentimento/voz/infraestrutura e o CTA para começar o
 * onboarding — o fluxo completo de várias etapas (foto/vídeo/voz/prévia)
 * fica para telas seguintes; não há redesenho do restante do Patrono.
 */
export default function DigitalTwinPage() {
  const [carregando, setCarregando] = useState(true)
  const [status, setStatus] = useState<StatusResposta | null>(null)
  const [criando, setCriando] = useState(false)

  async function carregar() {
    setCarregando(true)
    const res = await fetch('/api/digital-twin')
    if (res.ok) setStatus(await res.json())
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  async function criarMeuDigitalTwin() {
    setCriando(true)
    const res = await fetch('/api/digital-twin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    setCriando(false)
    if (res.ok) {
      toast({ title: 'Perfil do Digital Twin criado — continue o onboarding quando quiser.', variant: 'success' })
      carregar()
    } else {
      toast({ title: 'Não consegui criar o perfil agora.', variant: 'destructive' })
    }
  }

  if (carregando) {
    return (
      <div className="flex items-center gap-2 text-white/60">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
      </div>
    )
  }

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5" /> Digital Twin
        </h1>
        <p className="text-sm text-white/60 mt-1">
          Representação digital autorizada da proprietária — mesma aparência, mesma voz. Nada é gerado sem consentimento explícito.
        </p>
      </div>

      {!status?.profile && (
        <button
          onClick={criarMeuDigitalTwin}
          disabled={criando}
          className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-black hover:opacity-90 disabled:opacity-50"
        >
          {criando ? 'Criando…' : 'Criar meu Digital Twin'}
        </button>
      )}

      {status?.profile && (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 text-sm text-white">
            <UserIcon className="w-4 h-4" /> {status.profile.displayName} — {status.profile.enabled ? 'Ativo' : 'Desativado'}
          </div>
          <div className="flex items-center gap-2 text-sm text-white/70">
            <ShieldCheck className="w-4 h-4" /> Consentimento de identidade: {status.identityConsent?.status ?? 'NOT_REQUESTED'}
          </div>
          <div className="flex items-center gap-2 text-sm text-white/70">
            <Mic className="w-4 h-4" /> Voz: {status.voiceProfile ? `${status.voiceProfile.enabled ? 'ativa' : 'inativa'}${status.voiceProfile.provider ? ` (${status.voiceProfile.provider})` : ''}` : 'não configurada'}
          </div>
          <div className="flex items-center gap-2 text-sm text-white/70">
            <Cpu className="w-4 h-4" /> Infraestrutura: {status.runtime.cpuCores} CPU · {status.runtime.totalRamGB}GB RAM · {status.runtime.gpuDetected ? status.runtime.gpuName : 'sem GPU detectada'}
          </div>
          <div className="text-xs text-white/50 pt-2 border-t border-border">
            {status.podeGerar.permitido ? 'Pronto para gerar conteúdo.' : status.podeGerar.motivo}
          </div>
        </div>
      )}
    </div>
  )
}
