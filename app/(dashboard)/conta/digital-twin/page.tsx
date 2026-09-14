'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Sparkles, ShieldCheck, Mic, User as UserIcon, Cpu, Square, CircleDot, Upload } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

interface StatusResposta {
  profile: {
    id: string
    displayName: string
    enabled: boolean
    approvedAt: string | null
    autoUseDigitalTwin: boolean
    autoUseVoice: boolean
    allowFallback: boolean
    priorityChannel: string
    defaultStyle: string
  } | null
  voiceProfile: { id: string; enabled: boolean; provider: string | null } | null
  identityConsent: { status: string } | null
  voiceConsent: { status: string } | null
  podeGerar: { permitido: boolean; motivo: string }
  runtime: { cpuCores: number; totalRamGB: number; gpuDetected: boolean; gpuName: string | null }
  workers: { workerId: string; gpuDetected: boolean; gpuName: string | null; vramGB: number | null; version: string | null; lastSeenAt: string }[]
}

const TEXTO_GUIADO_VOZ =
  'Olá! Esta é a minha voz para o Patrono. Hoje é um bom dia para encontrar ofertas incríveis, ' +
  'com números como 10, 25 e 100, e preços como R$ 49,90. Espero que você aproveite!'

/**
 * Configurações → Digital Twin (Rodada 8) — onboarding completo:
 * consentimento → minha imagem → minha voz (gravar ou enviar) → aprovar
 * o perfil. Sem exigir nenhum comando técnico da proprietária.
 */
export default function DigitalTwinPage() {
  const [carregando, setCarregando] = useState(true)
  const [status, setStatus] = useState<StatusResposta | null>(null)
  const [criando, setCriando] = useState(false)
  const [enviando, setEnviando] = useState<string | null>(null)
  const [gravando, setGravando] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  async function carregar() {
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
      toast({ title: 'Perfil criado — continue quando quiser, não precisa terminar tudo agora.', variant: 'success' })
      carregar()
    } else {
      toast({ title: 'Não consegui criar o perfil agora.', variant: 'destructive' })
    }
  }

  async function autorizarConsentimento(tipo: 'identity' | 'voice') {
    const purpose = tipo === 'identity' ? 'Geração de vídeos de divulgação com minha imagem' : 'Clonagem da minha voz para vídeos de divulgação'
    const res = await fetch('/api/digital-twin/consent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, purpose }),
    })
    if (res.ok) {
      toast({ title: tipo === 'identity' ? 'Uso de imagem autorizado.' : 'Uso de voz autorizado.', variant: 'success' })
      carregar()
    } else {
      toast({ title: 'Não consegui registrar o consentimento.', variant: 'destructive' })
    }
  }

  async function enviarArquivo(type: string, file: File) {
    setEnviando(type)
    const form = new FormData()
    form.append('type', type)
    form.append('file', file)
    const res = await fetch('/api/digital-twin/assets', { method: 'POST', body: form })
    setEnviando(null)
    if (res.ok) {
      toast({ title: 'Arquivo enviado com sucesso.', variant: 'success' })
      carregar()
    } else {
      toast({ title: 'Não consegui enviar o arquivo.', variant: 'destructive' })
    }
  }

  async function iniciarGravacao() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data)
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const file = new File([blob], 'minha-voz.webm', { type: 'audio/webm' })
        await enviarArquivo('VOICE_REFERENCE', file)
        stream.getTracks().forEach((t) => t.stop())
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setGravando(true)
    } catch {
      toast({ title: 'Não consegui acessar o microfone — você pode enviar um arquivo de áudio em vez disso.', variant: 'destructive' })
    }
  }

  function pararGravacao() {
    mediaRecorderRef.current?.stop()
    setGravando(false)
  }

  async function aprovarDigitalTwin() {
    const res = await fetch('/api/digital-twin/approve', { method: 'POST' })
    if (res.ok) {
      toast({ title: 'Digital Twin aprovado! O Autopilot já pode reutilizá-lo.', variant: 'success' })
      carregar()
    } else {
      const d = await res.json().catch(() => ({}))
      toast({ title: d.error || 'Ainda não é possível aprovar.', variant: 'destructive' })
    }
  }

  async function atualizarPreferencia(campo: string, valor: boolean | string) {
    const res = await fetch('/api/digital-twin', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [campo]: valor }) })
    if (res.ok) carregar()
  }

  async function refazer() {
    await fetch('/api/digital-twin/approve', { method: 'DELETE' })
    toast({ title: 'Aprovação desfeita — envie novas referências quando quiser.' })
    carregar()
  }

  if (carregando) {
    return (
      <div className="flex items-center gap-2 text-white/60">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
      </div>
    )
  }

  const identityOk = status?.identityConsent?.status === 'GRANTED'
  const voiceConsentOk = status?.voiceConsent?.status === 'GRANTED'
  const aprovado = !!status?.profile?.approvedAt

  return (
    <div className="max-w-lg space-y-6 pb-12">
      <div>
        <h1 className="text-lg font-semibold text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5" /> Digital Twin
        </h1>
        <p className="text-sm text-white/60 mt-1">
          Representação digital autorizada da proprietária — mesma aparência, mesma voz. Nada é gerado sem consentimento explícito.
        </p>
      </div>

      {!status?.profile && (
        <button onClick={criarMeuDigitalTwin} disabled={criando} className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-black hover:opacity-90 disabled:opacity-50">
          {criando ? 'Criando…' : 'Criar meu Digital Twin'}
        </button>
      )}

      {status?.profile && !aprovado && (
        <div className="space-y-6">
          {/* Etapa 1 — Consentimento */}
          <section className="rounded-lg border border-border p-4 space-y-3">
            <h2 className="text-sm font-semibold text-white">Etapa 1 — Consentimento</h2>
            <p className="text-xs text-white/60">
              Vamos usar sua imagem e sua voz só para gerar vídeos de divulgação de produtos, com a sua identidade sempre reconhecível. Você pode revogar a qualquer momento em Configurações.
            </p>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => autorizarConsentimento('identity')}
                disabled={identityOk}
                className="rounded-lg border border-border px-3 py-2 text-xs text-white disabled:opacity-50"
              >
                {identityOk ? '✓ Imagem autorizada' : 'Autorizar imagem'}
              </button>
              <button
                onClick={() => autorizarConsentimento('voice')}
                disabled={voiceConsentOk}
                className="rounded-lg border border-border px-3 py-2 text-xs text-white disabled:opacity-50"
              >
                {voiceConsentOk ? '✓ Voz autorizada' : 'Autorizar voz'}
              </button>
            </div>
          </section>

          {/* Etapa 2 — Minha imagem */}
          {identityOk && (
            <section className="rounded-lg border border-border p-4 space-y-3">
              <h2 className="text-sm font-semibold text-white">Etapa 2 — Minha imagem</h2>
              <p className="text-xs text-white/60">
                Envie uma foto de rosto frontal e um vídeo curto de referência (rosto visível, boa iluminação, fundo simples, sem outras pessoas). Não precisa de equipamento profissional.
              </p>
              <label className="flex items-center gap-2 text-xs text-white cursor-pointer">
                <Upload className="w-4 h-4" /> Foto frontal
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && enviarArquivo('FACE_IMAGE', e.target.files[0])} />
                {enviando === 'FACE_IMAGE' && <Loader2 className="w-3 h-3 animate-spin" />}
              </label>
              <label className="flex items-center gap-2 text-xs text-white cursor-pointer">
                <Upload className="w-4 h-4" /> Vídeo de referência
                <input type="file" accept="video/*" className="hidden" onChange={(e) => e.target.files?.[0] && enviarArquivo('REFERENCE_VIDEO', e.target.files[0])} />
                {enviando === 'REFERENCE_VIDEO' && <Loader2 className="w-3 h-3 animate-spin" />}
              </label>
            </section>
          )}

          {/* Etapa 3 — Minha voz */}
          {voiceConsentOk && (
            <section className="rounded-lg border border-border p-4 space-y-3">
              <h2 className="text-sm font-semibold text-white">Etapa 3 — Minha voz</h2>
              <p className="text-xs text-white/60">Leia o texto abaixo em voz alta, num ambiente silencioso, sem música, falando naturalmente:</p>
              <blockquote className="text-sm text-white/90 italic border-l-2 border-accent pl-3">{TEXTO_GUIADO_VOZ}</blockquote>
              <div className="flex items-center gap-2">
                {!gravando ? (
                  <button onClick={iniciarGravacao} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-white">
                    <CircleDot className="w-4 h-4 text-red-400" /> Gravar no navegador
                  </button>
                ) : (
                  <button onClick={pararGravacao} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-white">
                    <Square className="w-4 h-4" /> Parar gravação
                  </button>
                )}
                <span className="text-xs text-white/40">ou</span>
                <label className="flex items-center gap-2 text-xs text-white cursor-pointer">
                  <Upload className="w-4 h-4" /> Enviar arquivo de áudio
                  <input type="file" accept="audio/*" className="hidden" onChange={(e) => e.target.files?.[0] && enviarArquivo('VOICE_REFERENCE', e.target.files[0])} />
                </label>
              </div>
            </section>
          )}

          {identityOk && voiceConsentOk && (
            <button onClick={aprovarDigitalTwin} className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-primary-dark hover:bg-accent-light">
              Aprovar meu Digital Twin
            </button>
          )}
        </div>
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
          <div className="text-xs text-white/60">
            Processador local: {status.workers.length > 0 ? `${status.workers.length} conectado(s)` : 'nenhum conectado — o Patrono usa o modo leve (sem GPU) enquanto isso'}
          </div>
          <div className="text-xs text-white/50 pt-2 border-t border-border">{status.podeGerar.permitido ? 'Pronto para gerar conteúdo.' : status.podeGerar.motivo}</div>
          {aprovado && (
            <button onClick={refazer} className="text-xs text-white/60 underline">
              Refazer referências
            </button>
          )}
        </div>
      )}

      {status?.profile && aprovado && (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <h2 className="text-sm font-semibold text-white">Preferências globais</h2>
          <label className="flex items-center justify-between text-xs text-white/80">
            Usar meu Digital Twin automaticamente
            <input type="checkbox" checked={status.profile.autoUseDigitalTwin} onChange={(e) => atualizarPreferencia('autoUseDigitalTwin', e.target.checked)} />
          </label>
          <label className="flex items-center justify-between text-xs text-white/80">
            Usar minha voz automaticamente
            <input type="checkbox" checked={status.profile.autoUseVoice} onChange={(e) => atualizarPreferencia('autoUseVoice', e.target.checked)} />
          </label>
          <label className="flex items-center justify-between text-xs text-white/80">
            Permitir fallback (sem GPU)
            <input type="checkbox" checked={status.profile.allowFallback} onChange={(e) => atualizarPreferencia('allowFallback', e.target.checked)} />
          </label>
          <label className="flex items-center justify-between text-xs text-white/80">
            Canal prioritário
            <select
              value={status.profile.priorityChannel}
              onChange={(e) => atualizarPreferencia('priorityChannel', e.target.value)}
              className="bg-background border border-border rounded px-2 py-1 text-white"
            >
              <option value="tiktok">TikTok</option>
              <option value="instagram">Instagram</option>
            </select>
          </label>
          <label className="flex items-center justify-between text-xs text-white/80">
            Estilo padrão
            <select
              value={status.profile.defaultStyle}
              onChange={(e) => atualizarPreferencia('defaultStyle', e.target.value)}
              className="bg-background border border-border rounded px-2 py-1 text-white"
            >
              <option value="presenter">Presenter</option>
              <option value="unboxing">Unboxing (virtual)</option>
            </select>
          </label>
        </div>
      )}
    </div>
  )
}
