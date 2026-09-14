/**
 * Núcleo do Patrono Generation Worker (Rodada 8, regra 10) — lógica de
 * processamento de UM job, separada do loop de polling (`worker/digital-
 * twin-worker.ts`) para ser testável sem precisar rodar um processo
 * contínuo. Roda fora do request HTTP (Vercel/servidor web não é lugar
 * adequado para workload longo de IA).
 *
 * Decide entre `DIGITAL_TWIN` (voz clonada + lip-sync) e o fallback real
 * `MOTION_GRAPHICS`/`PRODUCT_ONLY` (só FFmpeg, sem GPU) conforme o que
 * está de fato disponível — nunca finge sucesso na cadeia que falta.
 */

import { verificarDisponibilidadeChatterbox } from './chatterbox-adapter'
import { verificarDisponibilidadeMuseTalk } from './lipsync-provider'
import { detectarCapacidadesRuntime, classificarRuntime } from './digital-twin-runtime'
import { selecionarCreativePresenterMode, type CreativePresenterMode } from './creative-presenter-mode'
import { deveAbortarPorKillSwitch, type DigitalTwinJobState } from './digital-twin-job'
import { carregarContextoDigitalTwin } from './digital-twin-store'
import { RendererFFmpeg } from './renderer-ffmpeg'
import type { RendererProvider } from './creative-factory'

export interface JobDeProducao {
  id: string
  workspaceId: string
  profileId: string
  mediaAssetUrl: string
  overlayTexto: string
  legenda: string
}

export interface ResultadoProcessamento {
  sucesso: boolean
  modo: CreativePresenterMode
  status: 'READY' | 'FAILED' | 'ABORTED_KILL_SWITCH'
  motivo: string
  contentUrl?: string
}

/**
 * Detecta o que está realmente disponível AGORA (nunca cacheado por muito
 * tempo — providers podem ficar disponíveis/indisponíveis entre execuções).
 */
export async function detectarCapacidadesDeGeracao() {
  const [chatterbox, musetalk, runtime] = await Promise.all([
    verificarDisponibilidadeChatterbox(),
    verificarDisponibilidadeMuseTalk(),
    detectarCapacidadesRuntime(),
  ])
  const classe = classificarRuntime(runtime)
  return {
    chatterboxDisponivel: chatterbox.available,
    musetalkDisponivel: musetalk.available,
    runtimeClasse: classe,
    digitalTwinDisponivel: chatterbox.available && musetalk.available && (classe === 'GPU_READY' || classe === 'GPU_LIMITED'),
    vozClonadaDisponivel: chatterbox.available,
  }
}

/**
 * Processa um job de verdade. Quando `DIGITAL_TWIN`/`VOICE_ONLY` não têm
 * provider disponível, cai para `MOTION_GRAPHICS` — que RODA de verdade
 * neste ambiente (FFmpeg, sem GPU) — em vez de falhar o job inteiro só
 * porque a parte mais avançada não está pronta.
 */
export async function processarJobDeVerdade(
  job: JobDeProducao,
  renderer: RendererProvider = new RendererFFmpeg()
): Promise<ResultadoProcessamento> {
  const contexto = await carregarContextoDigitalTwin(job.workspaceId)
  const abortoKillSwitch = deveAbortarPorKillSwitch({
    proximaEtapa: 'GENERATING_VOICE',
    profile: contexto.profile,
    voiceProfile: contexto.voiceProfile,
    identityConsent: contexto.identityConsent,
    voiceConsent: contexto.voiceConsent,
  })

  const capacidades = await detectarCapacidadesDeGeracao()
  const modo = selecionarCreativePresenterMode({
    digitalTwinDisponivel: capacidades.digitalTwinDisponivel && !abortoKillSwitch.abortar,
    vozClonadaDisponivel: capacidades.vozClonadaDisponivel && !abortoKillSwitch.abortar,
    motionGraphicsDisponivel: true, // FFmpeg sempre disponível nesta stack
  })

  if ((modo === 'DIGITAL_TWIN' || modo === 'VOICE_ONLY') && abortoKillSwitch.abortar) {
    return { sucesso: false, modo, status: 'ABORTED_KILL_SWITCH', motivo: abortoKillSwitch.motivo ?? 'Kill switch ativo.' }
  }

  if (modo === 'DIGITAL_TWIN' || modo === 'VOICE_ONLY') {
    // Caminho real ficaria aqui (Chatterbox + MuseTalk) — só chega até
    // aqui quando ambos os providers reportaram disponibilidade real.
    return {
      sucesso: false,
      modo,
      status: 'FAILED',
      motivo: 'Providers reportaram disponibilidade, mas a chamada real de geração ainda não está implementada neste ambiente (sem GPU/pesos neste ambiente de desenvolvimento).',
    }
  }

  // MOTION_GRAPHICS / PRODUCT_ONLY — roda de verdade, sem GPU.
  try {
    const resultado = await renderer.render({
      mediaAssetIds: [job.mediaAssetUrl],
      format: 'reel-simples',
      overlays: [
        { texto: job.overlayTexto, posicao: 'topo' },
        { texto: job.legenda, posicao: 'rodape' },
      ],
    })
    return { sucesso: true, modo, status: 'READY', motivo: `Gerado via ${modo} (fallback sem GPU).`, contentUrl: resultado.url }
  } catch (e) {
    return { sucesso: false, modo, status: 'FAILED', motivo: e instanceof Error ? e.message : 'Falha ao renderizar.' }
  }
}
