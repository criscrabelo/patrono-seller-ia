/**
 * Dois níveis de kill switch (Rodada 8, regra 53) — SEMPRE independentes:
 *
 *  - `Workspace.automationPaused` (lib/autopilot.ts, Rodada 5): pausa
 *    PUBLICAÇÕES do Autopilot em geral (qualquer canal/modo).
 *  - `DigitalTwinProfile.enabled` (lib/digital-twin.ts, Rodada 6/7): pausa
 *    especificamente o uso de IDENTIDADE/VOZ da proprietária.
 *
 * Desligar um nunca desliga o outro — a usuária pode pausar só o Digital
 * Twin (o Autopilot continua publicando com Motion Graphics/produto) ou
 * só o Autopilot (o Digital Twin continua disponível para prévia manual).
 */

export interface AvaliacaoKillSwitches {
  autopilotPausado: boolean
  digitalTwinPausado: boolean
  podePublicarAutopilot: boolean
  podeUsarIdentidadeOuVoz: boolean
}

export function avaliarKillSwitches(params: { automationPaused: boolean; digitalTwinEnabled: boolean }): AvaliacaoKillSwitches {
  return {
    autopilotPausado: params.automationPaused,
    digitalTwinPausado: !params.digitalTwinEnabled,
    podePublicarAutopilot: !params.automationPaused,
    podeUsarIdentidadeOuVoz: params.digitalTwinEnabled,
  }
}
