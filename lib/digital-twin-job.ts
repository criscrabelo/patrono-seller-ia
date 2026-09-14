/**
 * Job `GENERATE_DIGITAL_TWIN_VIDEO` (Rodada 7, regras 36-38) — todo
 * processamento pesado do Digital Twin roda desacoplado do request HTTP
 * (persistido em `DigitalTwinJob`, processado por um worker/cron
 * separado — nunca dentro de uma requisição web que ficaria minutos
 * aberta).
 */

import { podeGerarComDigitalTwin, type DigitalTwinProfile, type VoiceProfile, type IdentityConsent, type VoiceConsent } from './digital-twin'

export const DIGITAL_TWIN_JOB_STATUSES = [
  'QUEUED',
  'PREPARING_AUDIO',
  'GENERATING_VOICE',
  'GENERATING_AVATAR',
  'LIP_SYNC',
  'RENDERING',
  'VALIDATING',
  'READY',
  'FAILED',
  'CANCELLED',
] as const
export type DigitalTwinJobStatus = (typeof DIGITAL_TWIN_JOB_STATUSES)[number]

/** Etapas em que é seguro tentar de novo sem custo computacional desperdiçado (regra 38). */
export const ETAPAS_RETRYAVEIS: DigitalTwinJobStatus[] = ['PREPARING_AUDIO', 'GENERATING_VOICE', 'GENERATING_AVATAR', 'LIP_SYNC', 'RENDERING']

/** Etapas ANTES das quais o kill switch precisa ser checado de novo (regra 40) — geração real de voz/avatar. */
const ETAPAS_CRITICAS: DigitalTwinJobStatus[] = ['GENERATING_VOICE', 'GENERATING_AVATAR']

export interface DigitalTwinJobState {
  id: string
  status: DigitalTwinJobStatus
  attempts: number
  resultAssetId: string | null
  error: string | null
}

/**
 * Nunca reexecuta uma etapa que já produziu um artefato válido — se
 * `resultAssetId` já existe e o job está em `READY`, um retry é ignorado
 * (regra 38: "não repetir geração indiscriminadamente se já houver
 * artefato válido").
 */
export function podeTentarNovamente(job: DigitalTwinJobState, maxTentativas: number = 3): { pode: boolean; motivo: string } {
  if (job.status === 'READY' && job.resultAssetId) {
    return { pode: false, motivo: 'Job já tem um artefato válido — retry seria desperdício computacional.' }
  }
  if (job.status === 'CANCELLED') {
    return { pode: false, motivo: 'Job cancelado — nunca reprocessado automaticamente.' }
  }
  if (!ETAPAS_RETRYAVEIS.includes(job.status) && job.status !== 'FAILED') {
    return { pode: false, motivo: `Etapa "${job.status}" não é retryável.` }
  }
  if (job.attempts >= maxTentativas) {
    return { pode: false, motivo: `Máximo de ${maxTentativas} tentativas atingido.` }
  }
  return { pode: true, motivo: 'Etapa retryável dentro do limite de tentativas.' }
}

/**
 * Checagem de kill switch imediatamente antes de uma etapa crítica —
 * nunca confia num status verificado no início do job (regra 40).
 */
export function deveAbortarPorKillSwitch(params: {
  proximaEtapa: DigitalTwinJobStatus
  profile: DigitalTwinProfile | null
  voiceProfile: VoiceProfile | null
  identityConsent: IdentityConsent | null
  voiceConsent: VoiceConsent | null
}): { abortar: boolean; motivo: string | null } {
  if (!ETAPAS_CRITICAS.includes(params.proximaEtapa)) return { abortar: false, motivo: null }

  const decisao = podeGerarComDigitalTwin({
    profile: params.profile,
    voiceProfile: params.voiceProfile,
    identityConsent: params.identityConsent,
    voiceConsent: params.voiceConsent,
  })
  if (!decisao.permitido) return { abortar: true, motivo: decisao.motivo }
  return { abortar: false, motivo: null }
}
