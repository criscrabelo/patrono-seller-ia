/**
 * Estado do TikTok para o futuro widget "Piloto automático" da Home
 * (Rodada 6, regra 35) — sem redesenhar a Home nesta rodada. Distinto do
 * status de configuração (`lib/tiktok-config-status.ts`), que é mais
 * granular; este é o resumo de 7 estados que a Home mostraria.
 */

import type { TikTokConfigStatus } from './tiktok-config-status'
import type { WorkspaceAutomationControls } from './autopilot'

export const TIKTOK_HOME_STATUSES = [
  'NAO_CONFIGURADO',
  'AGUARDANDO_AUTORIZACAO',
  'AGUARDANDO_APROVACAO_DA_API',
  'TESTE_PRIVADO_DISPONIVEL',
  'PRECISA_DE_CONSENTIMENTO',
  'AUTOPILOT_ATIVO',
  'ERRO',
] as const
export type TikTokHomeStatus = (typeof TIKTOK_HOME_STATUSES)[number]

export interface TikTokHomeStatusInput {
  configStatus: TikTokConfigStatus
  controls: WorkspaceAutomationControls
  pendingConsent: boolean
}

export function calcularStatusHomeTikTok(input: TikTokHomeStatusInput): TikTokHomeStatus {
  if (input.configStatus === 'ERRO') return 'ERRO'
  if (input.configStatus === 'NAO_CONFIGURADO') return 'NAO_CONFIGURADO'
  if (input.configStatus === 'AUTORIZACAO_NECESSARIA' || input.configStatus === 'TOKEN_EXPIRADO') return 'AGUARDANDO_AUTORIZACAO'
  if (input.configStatus === 'ESCOPO_PENDENTE') return 'AGUARDANDO_APROVACAO_DA_API'
  if (input.pendingConsent) return 'PRECISA_DE_CONSENTIMENTO'
  if (input.configStatus === 'PRONTO_PARA_POSTAGEM_PRIVADA') return 'TESTE_PRIVADO_DISPONIVEL'
  if (input.configStatus === 'PRONTO_PARA_POSTAGEM_PUBLICA' && !input.controls.automationPaused && input.controls.automationMode === 'AUTOMATIC') {
    return 'AUTOPILOT_ATIVO'
  }
  return 'TESTE_PRIVADO_DISPONIVEL'
}
