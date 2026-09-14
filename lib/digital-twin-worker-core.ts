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

import { verificarDisponibilidadeChatterbox, ChatterboxVoiceCloneProvider } from './chatterbox-adapter'
import { verificarDisponibilidadeMuseTalk, MuseTalkLipSyncProvider } from './lipsync-provider'
import { detectarCapacidadesRuntime, classificarRuntime } from './digital-twin-runtime'
import { selecionarCreativePresenterMode, type CreativePresenterMode } from './creative-presenter-mode'
import { deveAbortarPorKillSwitch, type DigitalTwinJobType, type DigitalTwinJobState } from './digital-twin-job'
import { carregarContextoDigitalTwin, listarAssetsDigitalTwin, BUCKET_DIGITAL_TWIN_PRIVADO } from './digital-twin-store'
import { gerarPreviaDeVoz } from './digital-twin-voice-job'
import { gerarPreviaLipSync, gerarPreviaVozSomente } from './digital-twin-lipsync-job'
import { criarUrlAssinada } from './supabase'
import { baixarComRetomada } from './digital-twin-model-cache'
import { RendererFFmpeg } from './renderer-ffmpeg'
import type { RendererProvider } from './creative-factory'
import { prisma } from './prisma'
import { tmpdir } from 'os'
import { join } from 'path'

/** Terceiro kill switch (regra 34) — lido direto do banco a cada job, nunca cacheado. */
async function workerEstaPausado(profileId: string): Promise<boolean> {
  const profile = await prisma.digitalTwinProfile.findUnique({ where: { id: profileId }, select: { workerPaused: true } })
  return profile?.workerPaused ?? false
}

export interface JobDeProducao {
  id: string
  workspaceId: string
  profileId: string
  mediaAssetUrl: string
  overlayTexto: string
  legenda: string
  /**
   * Finalidade real do job (regra 31 da Retomada da Rodada 9) — antes,
   * `DIGITAL_TWIN`/`VOICE_ONLY` sempre caíam no mesmo placeholder "não
   * implementado", independente do que o job realmente pedia.
   * `VOICE_PREVIEW`/`AVATAR_PREVIEW` agora chamam de verdade os pipelines
   * já existentes (`gerarPreviaDeVoz`/`gerarPreviaLipSync`/
   * `gerarPreviaVozSomente`). `PRODUCT_PREVIEW`/`PUBLISH` continuam fora
   * do escopo desta retomada (prioridade explícita: voz e avatar primeiro).
   */
  jobType: DigitalTwinJobType
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
  const workerPausado = await workerEstaPausado(job.profileId)
  const abortoKillSwitch = deveAbortarPorKillSwitch({
    proximaEtapa: 'GENERATING_VOICE',
    profile: contexto.profile,
    voiceProfile: contexto.voiceProfile,
    identityConsent: contexto.identityConsent,
    voiceConsent: contexto.voiceConsent,
    workerPaused: workerPausado,
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
    return processarEtapaDeVozOuAvatar(job, modo, contexto, capacidades)
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

/**
 * Baixa um asset do bucket PRIVADO (Supabase Storage) para um arquivo
 * local temporário. Necessário porque os providers reais (Chatterbox/
 * MuseTalk) rodam como subprocessos Python NESTA MESMA MÁQUINA (worker
 * local, regra do Rodada 8/9) e precisam de um caminho de arquivo — não
 * de uma URL remota.
 */
async function baixarAssetParaArquivoLocal(storagePath: string, sufixo: string): Promise<string> {
  const url = await criarUrlAssinada(BUCKET_DIGITAL_TWIN_PRIVADO, storagePath, 300)
  const destino = join(tmpdir(), `digital-twin-asset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${sufixo}`)
  const resultado = await baixarComRetomada(url, destino)
  if (!resultado.concluido) throw new Error(`Falha ao baixar asset do storage privado: ${resultado.motivo}`)
  return destino
}

/**
 * Chama de verdade os pipelines de voz/avatar já existentes
 * (`gerarPreviaDeVoz`/`gerarPreviaLipSync`/`gerarPreviaVozSomente`),
 * roteando pelo `jobType` (regra 31 da Retomada da Rodada 9) — antes,
 * QUALQUER job em modo `DIGITAL_TWIN`/`VOICE_ONLY` caía no mesmo
 * placeholder "não implementado". Nunca finge sucesso: quando o provider
 * real falha (ex.: Hugging Face bloqueado nesta sandbox), o motivo real do
 * provider é repassado como motivo de falha do job.
 */
export async function processarEtapaDeVozOuAvatar(
  job: JobDeProducao,
  modo: CreativePresenterMode,
  contexto: Awaited<ReturnType<typeof carregarContextoDigitalTwin>>,
  capacidades: Awaited<ReturnType<typeof detectarCapacidadesDeGeracao>>
): Promise<ResultadoProcessamento> {
  if (!contexto.voiceProfile) {
    return { sucesso: false, modo, status: 'FAILED', motivo: 'Nenhum VoiceProfile configurado para este workspace.' }
  }

  if (job.jobType === 'VOICE_PREVIEW') {
    const resultado = await gerarPreviaDeVoz({
      provider: new ChatterboxVoiceCloneProvider(),
      // O voiceId devolvido pelo provider real ainda não é persistido em
      // nenhum campo (a clonagem real nunca completou nesta sandbox —
      // Hugging Face bloqueado); o id do VoiceProfile serve como
      // identificador estável nesse meio-tempo.
      voiceId: contexto.voiceProfile.id,
      texto: job.legenda || undefined,
      resolverParaCaminhoLocal: async (caminho) => caminho, // provider local (subprocesso na mesma máquina) já devolve caminho local
    })
    if (resultado.status !== 'READY') {
      return { sucesso: false, modo, status: 'FAILED', motivo: resultado.motivo }
    }
    return { sucesso: true, modo, status: 'READY', motivo: resultado.motivo, contentUrl: resultado.audioPath ?? undefined }
  }

  if (job.jobType === 'AVATAR_PREVIEW') {
    if (!job.mediaAssetUrl) {
      return { sucesso: false, modo, status: 'FAILED', motivo: 'Áudio da voz ainda não foi gerado — gere e aprove a prévia de voz antes do avatar.' }
    }

    const assets = await listarAssetsDigitalTwin(job.workspaceId, job.profileId)

    if (modo === 'DIGITAL_TWIN') {
      const referenceVideo = assets.find((a) => a.type === 'REFERENCE_VIDEO' && a.active)
      if (!referenceVideo) {
        return { sucesso: false, modo, status: 'FAILED', motivo: 'Nenhum vídeo de referência (REFERENCE_VIDEO) encontrado para este perfil.' }
      }
      let referenceVideoLocal: string
      try {
        referenceVideoLocal = await baixarAssetParaArquivoLocal(referenceVideo.storagePath, '.mp4')
      } catch (e) {
        return { sucesso: false, modo, status: 'FAILED', motivo: e instanceof Error ? e.message : 'Falha ao obter o vídeo de referência.' }
      }
      const resultado = await gerarPreviaLipSync({
        disponivel: capacidades.musetalkDisponivel,
        provider: new MuseTalkLipSyncProvider(),
        referenceVideoUrl: referenceVideoLocal,
        audioUrl: job.mediaAssetUrl,
        resolverParaCaminhoLocal: async (caminho) => caminho,
      })
      if (resultado.status !== 'READY_LIP_SYNC_PREVIEW') {
        return { sucesso: false, modo, status: 'FAILED', motivo: resultado.motivo }
      }
      return { sucesso: true, modo, status: 'READY', motivo: resultado.motivo, contentUrl: resultado.videoUrl ?? undefined }
    }

    // VOICE_ONLY — fallback real sem GPU (foto + voz clonada + motion graphics), nunca rotulado como lip-sync.
    const faceImage = assets.find((a) => a.type === 'FACE_IMAGE' && a.active)
    if (!faceImage) {
      return { sucesso: false, modo, status: 'FAILED', motivo: 'Nenhuma foto de rosto (FACE_IMAGE) encontrada para este perfil.' }
    }
    let faceImageUrl: string
    try {
      faceImageUrl = await criarUrlAssinada(BUCKET_DIGITAL_TWIN_PRIVADO, faceImage.storagePath, 300)
    } catch (e) {
      return { sucesso: false, modo, status: 'FAILED', motivo: e instanceof Error ? e.message : 'Falha ao gerar URL assinada da foto de rosto.' }
    }
    const resultado = await gerarPreviaVozSomente({ faceImageUrl, audioLocalPath: job.mediaAssetUrl, legenda: job.legenda })
    if (resultado.status !== 'READY_VOICE_ONLY_PREVIEW') {
      return { sucesso: false, modo, status: 'FAILED', motivo: resultado.motivo }
    }
    return { sucesso: true, modo, status: 'READY', motivo: resultado.motivo, contentUrl: resultado.videoUrl ?? undefined }
  }

  return {
    sucesso: false,
    modo,
    status: 'FAILED',
    motivo: `jobType "${job.jobType}" ainda não tem processamento real no worker (fora do escopo desta retomada — prioridade explícita foi voz e avatar primeiro).`,
  }
}
