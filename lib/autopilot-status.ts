/**
 * Dados para o futuro widget "Piloto automático" da Home (Rodada 5, regra
 * 32) — SEM redesenhar a Home nesta rodada. Só a função que decide o
 * estado; a tela usa quando for construída.
 */

import type { WorkspaceAutomationControls } from './autopilot'

export type AutopilotStatusHome = 'ATIVO' | 'PAUSADO' | 'PRECISA_DE_CONFIGURACAO' | 'PRECISA_DE_VOCE' | 'BLOQUEADO_POR_REGRA'

export interface AutopilotStatusInput {
  controls: WorkspaceAutomationControls
  tiktokConfigured: boolean
  instagramConfigured: boolean
  hasPendingHumanAction: boolean
  lastRunBlockedByPolicy: boolean
}

export function calcularStatusAutopilotHome(input: AutopilotStatusInput): AutopilotStatusHome {
  if (input.controls.automationPaused) return 'PAUSADO'
  if (!input.tiktokConfigured && !input.instagramConfigured) return 'PRECISA_DE_CONFIGURACAO'
  if (input.hasPendingHumanAction) return 'PRECISA_DE_VOCE'
  if (input.lastRunBlockedByPolicy) return 'BLOQUEADO_POR_REGRA'
  if (input.controls.automationMode === 'AUTOMATIC') return 'ATIVO'
  return 'PRECISA_DE_CONFIGURACAO'
}
