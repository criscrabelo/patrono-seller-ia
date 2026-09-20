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
    voiceApprovedAt: string | null
    workerPaused: boolean
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
  ultimoJob: { id: string; jobType: string; status: string; statusAmigavel: string; emAndamento: boolean; erro: string | null } | null
}

interface TokenWorker {
  id: string
  label: string | null
  createdAt: string
  revokedAt: string | null
  lastUsedAt: string | null
}

/**
 * Janela de "visto recentemente" do processador local. Mesma usada pela rota
 * `GET /api/digital-twin`, para a tela nunca discordar do servidor.
 */
const JANELA_PROCESSADOR_MS = 5 * 60 * 1000

/** "há 12 segundos" / "há 3 minutos" — sem jargão técnico na tela. */
function vistoHa(iso: string): string {
  const segundos = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (segundos < 60) return `há ${segundos} segundo${segundos === 1 ? '' : 's'}`
  const minutos = Math.round(segundos / 60)
  return `há ${minutos} minuto${minutos === 1 ? '' : 's'}`
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
  const [assets, setAssets] = useState<{ id: string; type: string; purpose: string | null; url: string; createdAt: string }[]>([])
  const [tokens, setTokens] = useState<TokenWorker[]>([])
  const [gerandoToken, setGerandoToken] = useState(false)
  // Só existe enquanto a tela estiver aberta: o servidor guarda apenas o
  // hash, então este é o único momento em que o valor pode ser copiado.
  const [tokenRecemGerado, setTokenRecemGerado] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  async function carregar() {
    const res = await fetch('/api/digital-twin')
    if (res.ok) setStatus(await res.json())
    const resAssets = await fetch('/api/digital-twin/assets')
    if (resAssets.ok) setAssets(await resAssets.json())
    const resTokens = await fetch('/api/digital-twin/worker-token')
    if (resTokens.ok) setTokens(await resTokens.json())
    setCarregando(false)
  }

  /**
   * Gera um token de pareamento do processador local. O valor em texto puro
   * só volta NESTA resposta — o servidor guarda apenas o hash SHA-256 — por
   * isso ele fica na tela até a usuária sair, e a tela diz isso claramente.
   */
  async function gerarToken() {
    setGerandoToken(true)
    const res = await fetch('/api/digital-twin/worker-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'Este computador' }),
    })
    setGerandoToken(false)
    if (!res.ok) {
      toast({ title: 'Não consegui gerar o token agora.', variant: 'destructive' })
      return
    }
    const criado = await res.json()
    setTokenRecemGerado(criado.token)
    carregar()
  }

  async function revogarToken(id: string) {
    const res = await fetch(`/api/digital-twin/worker-token?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (res.ok) {
      toast({ title: 'Token revogado — o processador que o usava para de pegar tarefas.', variant: 'success' })
      carregar()
    } else {
      toast({ title: 'Não consegui revogar o token agora.', variant: 'destructive' })
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  // Progresso real do job (regra 12/13 da Continuação da Retomada da
  // Rodada 9) — enquanto houver um job em andamento, verifica de novo
  // periodicamente; nunca inventa um percentual, só reflete a etapa real
  // vinda do `DigitalTwinJob` (statusAmigavelParaUsuaria()).
  useEffect(() => {
    if (!status?.ultimoJob?.emAndamento) return
    const intervalo = setInterval(carregar, 5000)
    return () => clearInterval(intervalo)
  }, [status?.ultimoJob?.emAndamento])

  const gravacaoOriginal = assets.find((a) => a.type === 'VOICE_REFERENCE')
  // Sempre a prévia MAIS RECENTE: a rota já devolve ordenado por createdAt
  // desc, mas ordenar aqui também deixa a tela correta se essa ordem mudar
  // — uma prévia antiga no player faria a proprietária julgar a voz errada.
  const vozDigitalPreview = assets
    .filter((a) => a.type === 'GENERATED_PREVIEW' && a.purpose === 'voice_preview')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]

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

  async function aprovarVoz() {
    const res = await fetch('/api/digital-twin/voice-approve', { method: 'POST' })
    if (res.ok) {
      toast({ title: 'Voz aprovada! O Autopilot já pode reutilizá-la.', variant: 'success' })
      carregar()
    } else {
      const d = await res.json().catch(() => ({}))
      toast({ title: d.error || 'Ainda não é possível aprovar a voz.', variant: 'destructive' })
    }
  }

  async function refazerVoz() {
    await fetch('/api/digital-twin/voice-approve', { method: 'DELETE' })
    toast({ title: 'Aprovação da voz desfeita — envie uma nova referência quando quiser.' })
    carregar()
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

  // Processador conectado = VISTO RECENTEMENTE (`GenerationWorkerHealth.lastSeenAt`),
  // nunca o campo `online`: ele é gravado como `true` no startup e ninguém o
  // volta para `false` quando o processo morre — um worker desligado há dias
  // continuaria aparecendo como conectado. A rota já aplica a mesma janela,
  // mas repetir aqui mantém o indicador honesto enquanto a tela fica aberta
  // entre duas cargas.
  const processadores = (status?.workers ?? []).filter(
    (w) => Date.now() - new Date(w.lastSeenAt).getTime() < JANELA_PROCESSADOR_MS
  )
  const processadorConectado = processadores.length > 0

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

          {/* Comparação de voz (Rodada 9, regra 11/22) — aprovação ÚNICA, separada da aprovação do avatar completo. */}
          {gravacaoOriginal && (
            <section className="rounded-lg border border-border p-4 space-y-3">
              <h2 className="text-sm font-semibold text-white">Comparar minha voz</h2>
              <div className="space-y-2">
                <p className="text-xs text-white/60">Ouvir minha gravação</p>
                <audio controls src={gravacaoOriginal.url} className="w-full h-8" />
              </div>
              <div className="space-y-2">
                <p className="text-xs text-white/60">Ouvir minha voz digital</p>
                {vozDigitalPreview ? (
                  // O player fica na seção "Minha voz digital" logo abaixo,
                  // que continua visível depois da aprovação — aqui seria um
                  // segundo player com o mesmo áudio.
                  <p className="text-xs text-white/40">Prévia pronta — ouça em “Minha voz digital”, logo abaixo.</p>
                ) : (
                  <p className="text-xs text-white/40">
                    {processadorConectado
                      ? (status?.ultimoJob?.statusAmigavel ?? 'Aguardando o processador de vídeos')
                      : 'Aguardando o processador de vídeos'}
                    {status?.ultimoJob?.erro ? ` — ${status.ultimoJob.erro}` : ''}
                  </p>
                )}
              </div>
              {status?.profile?.voiceApprovedAt ? (
                <button onClick={refazerVoz} className="text-xs text-white/60 underline">
                  Refazer referência de voz
                </button>
              ) : (
                // Habilitado pela GRAVAÇÃO de referência, não pela prévia
                // gerada. Exigir a prévia criava um impasse circular: a
                // prévia só é gerada com a voz aprovada (`VoiceProfile.enabled`,
                // exigido por `podeGerarComDigitalTwin()`), e a voz só era
                // aprovável com a prévia pronta — na prática, nenhuma voz
                // jamais saía da primeira vez. Ouvir a prévia antes continua
                // recomendado, só deixou de ser pré-requisito.
                <button
                  onClick={aprovarVoz}
                  disabled={!gravacaoOriginal}
                  className="rounded-lg border border-border px-3 py-2 text-xs text-white disabled:opacity-40"
                >
                  Aprovar minha voz
                </button>
              )}
            </section>
          )}

          {identityOk && voiceConsentOk && (
            <button onClick={aprovarDigitalTwin} className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-primary-dark hover:bg-accent-light">
              Aprovar meu Digital Twin
            </button>
          )}
        </div>
      )}

      {/*
        Minha voz digital — FORA do bloco de onboarding (`!aprovado`), de
        propósito. Enquanto este player morava lá dentro, ele sumia no
        instante em que o Digital Twin era aprovado: a prévia real existia no
        banco e no bucket, mas a proprietária não tinha como ouvi-la de novo.
        A seção aparece sempre que existir uma prévia ativa, aprovada ou não.
      */}
      {status?.profile && vozDigitalPreview && (
        <section className="space-y-3 rounded-lg border border-border p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Mic className="w-4 h-4" /> Minha voz digital
          </h2>
          <p className="text-xs text-white/60">
            Esta é a prévia mais recente gerada a partir da sua gravação de referência.
          </p>
          <audio controls src={vozDigitalPreview.url} className="w-full h-8" />
          <p className="text-[11px] text-white/40">
            Gerada em {new Date(vozDigitalPreview.createdAt).toLocaleString('pt-BR')}
          </p>
          {gravacaoOriginal && (
            <div className="space-y-2 pt-2 border-t border-border">
              <p className="text-xs text-white/60">Comparar com a minha gravação original</p>
              <audio controls src={gravacaoOriginal.url} className="w-full h-8" />
            </div>
          )}
        </section>
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
            Processador local:{' '}
            {processadorConectado
              ? `${processadores.length} conectado(s) — visto ${vistoHa(processadores[0].lastSeenAt)}`
              : 'nenhum conectado — o Patrono usa o modo leve (sem GPU) enquanto isso'}
          </div>
          <div className="text-xs text-white/50 pt-2 border-t border-border">{status.podeGerar.permitido ? 'Pronto para gerar conteúdo.' : status.podeGerar.motivo}</div>
          {aprovado && (
            <button onClick={refazer} className="text-xs text-white/60 underline">
              Refazer referências
            </button>
          )}
        </div>
      )}

      {status?.profile && (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Cpu className="h-4 w-4" /> Processador de vídeos deste computador
          </h2>
          <p className="text-xs text-white/60">
            Para o programa instalado no seu computador processar seus vídeos, ele precisa de um código de
            pareamento. Gere um aqui e cole no arquivo de configuração do processador. Nunca use sua senha.
          </p>

          {tokenRecemGerado && (
            <div className="space-y-2 rounded-lg border border-accent/40 bg-accent/5 p-3">
              <p className="text-xs font-medium text-accent">
                Copie agora — este código não aparece de novo. Guardamos só uma versão embaralhada dele.
              </p>
              <code className="block break-all rounded bg-background px-2 py-1.5 font-mono text-[11px] text-white/90">
                {tokenRecemGerado}
              </code>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(tokenRecemGerado)
                    toast({ title: 'Código copiado.', variant: 'success' })
                  }}
                  className="text-xs text-accent underline"
                >
                  Copiar código
                </button>
                <button onClick={() => setTokenRecemGerado(null)} className="text-xs text-white/60 underline">
                  Já copiei, pode esconder
                </button>
              </div>
            </div>
          )}

          <button
            onClick={gerarToken}
            disabled={gerandoToken}
            className="rounded-lg border border-border px-3 py-2 text-xs text-white hover:bg-white/5 disabled:opacity-50"
          >
            {gerandoToken ? 'Gerando…' : 'Gerar código de pareamento'}
          </button>

          {tokens.length > 0 && (
            <ul className="space-y-1.5 pt-1">
              {tokens.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 text-xs text-white/70">
                  <span>
                    {t.label || 'Sem apelido'}
                    <span className="text-white/40">
                      {' · '}criado em {new Date(t.createdAt).toLocaleDateString('pt-BR')}
                      {t.lastUsedAt
                        ? ` · usado pela última vez em ${new Date(t.lastUsedAt).toLocaleDateString('pt-BR')}`
                        : ' · nunca usado'}
                    </span>
                  </span>
                  {t.revokedAt ? (
                    <span className="shrink-0 text-white/40">revogado</span>
                  ) : (
                    <button onClick={() => revogarToken(t.id)} className="shrink-0 text-white/60 underline hover:text-white">
                      Revogar
                    </button>
                  )}
                </li>
              ))}
            </ul>
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
            Pausar processador local (worker)
            <input type="checkbox" checked={status.profile.workerPaused} onChange={(e) => atualizarPreferencia('workerPaused', e.target.checked)} />
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
