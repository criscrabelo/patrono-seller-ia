/**
 * Patrono Generation Worker (Rodada 8, regra 10) — processo separado do
 * servidor web, feito para rodar numa máquina local ou servidor
 * compatível. Nunca dentro de uma requisição HTTP (Vercel não é lugar
 * para workload longo de IA).
 *
 * Uso:
 *   DATABASE_URL=... npx tsx worker/digital-twin-worker.ts            # loop contínuo
 *   DATABASE_URL=... npx tsx worker/digital-twin-worker.ts --once     # processa no máximo 1 job e sai (usado em teste manual)
 *
 * A instalação automatizada fica em setup-digital-twin-worker.ps1 /
 * start-digital-twin-worker.ps1 (Windows) — a proprietária nunca precisa
 * abrir terminal no dia a dia depois da instalação inicial.
 */

import { randomUUID } from 'crypto'
import { PrismaClient } from '@prisma/client'
import {
  reivindicarProximoJob,
  renovarHeartbeat,
  completarJob,
  falharJob,
  STALE_TIMEOUT_MS_PADRAO,
} from '../lib/digital-twin-job-queue'
import { processarJobDeVerdade, detectarCapacidadesDeGeracao, type JobDeProducao } from '../lib/digital-twin-worker-core'
import { detectarCapacidadesRuntime } from '../lib/digital-twin-runtime'
import { REQUIRED_WORKER_VERSION } from '../lib/digital-twin-worker-version'
import { verificarTokenWorker } from '../lib/digital-twin-worker-token'

const WORKER_ID = process.env.DIGITAL_TWIN_WORKER_ID || `worker-${randomUUID().slice(0, 8)}`
const HEARTBEAT_INTERVAL_MS = 30_000
const POLL_INTERVAL_MS = 5_000
/**
 * De quanto em quanto tempo o worker renova `GenerationWorkerHealth.lastSeenAt`.
 * Precisa ser bem menor que a janela de 5 min que a tela usa para dizer
 * "processador conectado" — antes disso a saúde só era gravada UMA vez, no
 * startup, e um worker rodando há mais de 5 minutos aparecia como
 * "nenhum conectado" mesmo processando jobs normalmente.
 */
const HEALTH_REFRESH_MS = 60_000
const MAX_TENTATIVAS = 3 // regra 31: máximo 2-3 tentativas automáticas

const prisma = new PrismaClient()

/**
 * Pairing (Rodada 9, regras 21-22): o worker se autentica com um token
 * PRÓPRIO (nunca a senha da usuária), escopado a um único workspace.
 * `DIGITAL_TWIN_WORKER_TOKEN` nunca é logado — só o resultado da
 * verificação (workspaceId).
 */
async function resolverWorkspacePareado(): Promise<string | null> {
  const token = process.env.DIGITAL_TWIN_WORKER_TOKEN
  if (!token) return null
  const resultado = await verificarTokenWorker(token)
  return resultado?.workspaceId ?? null
}

async function registrarSaudeWorker() {
  const caps = await detectarCapacidadesRuntime()
  await prisma.generationWorkerHealth.upsert({
    where: { workerId: WORKER_ID },
    create: {
      workerId: WORKER_ID,
      online: true,
      gpuDetected: caps.gpuDetected,
      gpuName: caps.gpuName,
      vramGB: caps.vramGB,
      version: REQUIRED_WORKER_VERSION,
      lastSeenAt: new Date(),
    },
    update: { online: true, gpuDetected: caps.gpuDetected, gpuName: caps.gpuName, vramGB: caps.vramGB, lastSeenAt: new Date() },
  })
}

/**
 * Texto falado pela prévia — vem do PRÓPRIO job, pelo `Conteudo` ligado em
 * `DigitalTwinJob.contentId`, nunca de uma frase fixa no código. Enquanto a
 * frase era constante (`'Confira o preço atual.'`), toda prévia saía com o
 * mesmo áudio de 2,5s: impossível avaliar a voz num texto de verdade e
 * impossível gerar duas prévias diferentes.
 *
 * `narracao` é o campo do que é FALADO; `roteiro` é o fallback natural. As
 * legendas de rede social não entram: são texto para ler na tela, com
 * hashtags e emojis que não se narra.
 */
async function textoFaladoDoJob(contentId: string | null): Promise<string | null> {
  if (!contentId) return null
  const conteudo = await prisma.conteudo.findUnique({
    where: { id: contentId },
    select: { narracao: true, roteiro: true },
  })
  return conteudo?.narracao?.trim() || conteudo?.roteiro?.trim() || null
}

async function processarUmJob(workspaceIdPareado: string | null): Promise<boolean> {
  const job = await reivindicarProximoJob(WORKER_ID, STALE_TIMEOUT_MS_PADRAO, prisma, workspaceIdPareado ?? undefined)
  if (!job) return false

  const heartbeat = setInterval(() => {
    renovarHeartbeat(job.id, WORKER_ID, prisma).catch(() => {})
  }, HEARTBEAT_INTERVAL_MS)

  try {
    // jobType, resultAssetId (entrada de áudio/vídeo já gerado por uma etapa
    // anterior) e agora também o TEXTO FALADO vêm de verdade do
    // `DigitalTwinJob` — o texto pelo `Conteudo` ligado em `contentId`.
    // Sem texto no job, `gerarPreviaDeVoz()` cai no `TEXTO_PREVIA_VOZ`
    // padrão do próprio pipeline; o worker não inventa frase nenhuma.
    const textoFalado = await textoFaladoDoJob(job.contentId)
    const resultado = await processarJobDeVerdade({
      id: job.id,
      workspaceId: job.workspaceId,
      profileId: job.profileId,
      jobType: job.jobType as JobDeProducao['jobType'],
      mediaAssetUrl: job.resultAssetId ?? '',
      overlayTexto: 'Patrono',
      legenda: textoFalado ?? '',
      contentId: job.contentId,
    })

    if (resultado.sucesso && resultado.contentUrl) {
      await completarJob(job.id, WORKER_ID, resultado.contentUrl, prisma)
    } else {
      await falharJob(job.id, WORKER_ID, resultado.motivo, MAX_TENTATIVAS, prisma)
    }
  } catch (e) {
    await falharJob(job.id, WORKER_ID, e instanceof Error ? e.message : 'Erro desconhecido', MAX_TENTATIVAS, prisma)
  } finally {
    clearInterval(heartbeat)
  }
  return true
}

async function main() {
  const modoUnico = process.argv.includes('--once')
  await registrarSaudeWorker()
  const capacidades = await detectarCapacidadesDeGeracao()

  const workspaceIdPareado = await resolverWorkspacePareado()
  if (process.env.DIGITAL_TWIN_WORKER_TOKEN && !workspaceIdPareado) {
    console.error('[digital-twin-worker] Token inválido/revogado — o worker não vai reivindicar nenhum job. Gere um novo token em Configurações → Digital Twin.')
    await prisma.$disconnect()
    process.exit(1)
  }

  console.log(
    `[digital-twin-worker] ${WORKER_ID} iniciado. Chatterbox=${capacidades.chatterboxDisponivel} MuseTalk=${capacidades.musetalkDisponivel} Runtime=${capacidades.runtimeClasse} Pareado=${workspaceIdPareado ? 'sim' : 'não (sem escopo — só para desenvolvimento)'}`
  )

  if (modoUnico) {
    const processou = await processarUmJob(workspaceIdPareado)
    console.log(`[digital-twin-worker] --once: ${processou ? 'processou 1 job' : 'nenhum job na fila'}`)
    await prisma.$disconnect()
    return
  }

  // Loop contínuo — processo de longa duração, nunca dentro de um request HTTP.
  // A saúde é renovada periodicamente aqui: sem isso `lastSeenAt` ficava
  // congelado no horário do startup e a tela passava a mentir "nenhum
  // processador conectado" depois de 5 minutos de worker no ar.
  const renovarSaude = setInterval(() => {
    registrarSaudeWorker().catch(() => {})
  }, HEALTH_REFRESH_MS)
  renovarSaude.unref?.()

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const processou = await processarUmJob(workspaceIdPareado)
    if (!processou) await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
  }
}

main().catch((e) => {
  console.error('[digital-twin-worker] erro fatal:', e)
  process.exit(1)
})
