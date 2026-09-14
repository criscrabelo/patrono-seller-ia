/**
 * DigitalTwinRuntimeCapabilities (Rodada 7) — detecção REAL do que a
 * máquina onde o Patrono está rodando consegue fazer, antes de tentar
 * instalar/chamar qualquer modelo pesado (Chatterbox, MuseTalk). Nunca
 * assume que existe GPU — a detecção sempre confere de verdade (via
 * `os` nativo do Node e, quando disponível, `nvidia-smi`).
 */

import os from 'os'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { statfs } from 'fs/promises'

const execFileAsync = promisify(execFile)

export interface DigitalTwinRuntimeCapabilities {
  cpuCores: number
  totalRamGB: number
  freeRamGB: number
  gpuDetected: boolean
  gpuName: string | null
  vramGB: number | null
  cudaAvailable: boolean
  freeDiskGB: number | null
  verificadoEm: string
}

/** Tenta consultar `nvidia-smi` — se não existir/falhar, considera "sem GPU NVIDIA detectada" (nunca assume presença). */
async function detectarGpuNvidia(): Promise<{ nome: string | null; vramGB: number | null; cuda: boolean }> {
  try {
    const { stdout } = await execFileAsync('nvidia-smi', ['--query-gpu=name,memory.total', '--format=csv,noheader,nounits'])
    const linha = stdout.trim().split('\n')[0]
    if (!linha) return { nome: null, vramGB: null, cuda: false }
    const [nome, memoriaMB] = linha.split(',').map((s) => s.trim())
    const vramGB = memoriaMB ? Math.round((parseInt(memoriaMB, 10) / 1024) * 10) / 10 : null
    return { nome: nome || null, vramGB, cuda: true }
  } catch {
    return { nome: null, vramGB: null, cuda: false }
  }
}

async function detectarDiscoLivreGB(caminho: string): Promise<number | null> {
  try {
    const info = await statfs(caminho)
    return Math.round(((info.bfree * info.bsize) / 1024 ** 3) * 10) / 10
  } catch {
    return null
  }
}

/** Detecção real, sem I/O de rede — segura para rodar a qualquer momento (ex.: tela de configuração do Digital Twin). */
export async function detectarCapacidadesRuntime(): Promise<DigitalTwinRuntimeCapabilities> {
  const gpu = await detectarGpuNvidia()
  const freeDiskGB = await detectarDiscoLivreGB(os.tmpdir())

  return {
    cpuCores: os.cpus().length,
    totalRamGB: Math.round((os.totalmem() / 1024 ** 3) * 10) / 10,
    freeRamGB: Math.round((os.freemem() / 1024 ** 3) * 10) / 10,
    gpuDetected: gpu.nome != null,
    gpuName: gpu.nome,
    vramGB: gpu.vramGB,
    cudaAvailable: gpu.cuda,
    freeDiskGB,
    verificadoEm: new Date().toISOString(),
  }
}

/** Requisitos mínimos considerados razoáveis para tentar rodar um motor de avatar/lip-sync local. Nunca hardcoded como garantia — só um corte de bom senso. */
export const REQUISITOS_MINIMOS_AVATAR_LOCAL = {
  vramGBMinima: 8,
  discoLivreGBMinimo: 10,
}

export function atendeRequisitosMinimosAvatar(caps: DigitalTwinRuntimeCapabilities): boolean {
  if (!caps.gpuDetected || !caps.cudaAvailable) return false
  if (caps.vramGB == null || caps.vramGB < REQUISITOS_MINIMOS_AVATAR_LOCAL.vramGBMinima) return false
  if (caps.freeDiskGB != null && caps.freeDiskGB < REQUISITOS_MINIMOS_AVATAR_LOCAL.discoLivreGBMinimo) return false
  return true
}
