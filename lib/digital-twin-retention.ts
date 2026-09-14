/**
 * Retenção de prévias (Rodada 8, regra 42) — `GENERATED_PREVIEW` rejeitada
 * ou não usada expira (`DigitalTwinAsset.expiresAt`) e é limpa (Storage +
 * banco). Referências permanentes (FACE_IMAGE, REFERENCE_VIDEO,
 * VOICE_REFERENCE, CONSENT_EVIDENCE) nunca expiram por esta rotina.
 */

import { prisma } from './prisma'
import { deleteFilePrivado } from './supabase'

export const RETENCAO_PREVIEW_MS = 7 * 24 * 60 * 60 * 1000 // 7 dias
const BUCKET_PRIVADO = 'digital-twin-private'

/** Calcula a data de expiração para uma nova prévia — chamado ao criar o asset. */
export function calcularExpiracaoPreview(agora: Date = new Date()): Date {
  return new Date(agora.getTime() + RETENCAO_PREVIEW_MS)
}

/** Remove (Storage + banco) prévias já expiradas — nunca mexe em referência permanente (expiresAt sempre null nelas). */
export async function limparPreviewsExpiradas(agora: Date = new Date()): Promise<number> {
  const expiradas = await prisma.digitalTwinAsset.findMany({
    where: { type: 'GENERATED_PREVIEW', expiresAt: { lte: agora } },
  })

  for (const asset of expiradas) {
    await deleteFilePrivado(BUCKET_PRIVADO, asset.storagePath).catch(() => {}) // falha ao apagar do storage nunca impede limpar o registro
  }

  const resultado = await prisma.digitalTwinAsset.deleteMany({
    where: { id: { in: expiradas.map((a) => a.id) } },
  })
  return resultado.count
}
