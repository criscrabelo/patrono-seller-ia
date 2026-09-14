/**
 * Lip Sync (Rodada 7) — registro de motores avaliados e a primeira
 * implementação real de `LipSyncProvider` (lib/digital-twin.ts).
 *
 * Decisão registrada (ver `DIGITAL-TWIN-MODEL-LICENSES.md` para a tabela
 * completa):
 *  - MuseTalk: código MIT, modelos com uso comercial informado pelo
 *    projeto — candidato PRINCIPAL desta rodada. `verificarDisponibilidadeMuseTalk()`
 *    nunca assume presença — checa de verdade.
 *  - Wav2Lip (tradicional): BLOCKED_BY_LICENSE — os modelos publicados
 *    pelo projeto original são restritos a uso pessoal/acadêmico/pesquisa/
 *    não comercial. Como o Patrono é comercial, NUNCA integrado.
 *  - LivePortrait: BLOCKED_BY_LICENSE nesta rodada — cadeia de dependências
 *    (incluindo componentes de detecção facial) com restrições comerciais
 *    não totalmente esclarecidas. Só reavaliar se TODA a cadeia for
 *    confirmada compatível.
 */

import { execFile } from 'child_process'
import { promisify } from 'util'
import type { LipSyncProvider } from './digital-twin'

const execFileAsync = promisify(execFile)

export const LIP_SYNC_ENGINE_STATUSES = ['AVAILABLE_CANDIDATE', 'BLOCKED_BY_LICENSE', 'NOT_VERIFIED'] as const
export type LipSyncEngineStatus = (typeof LIP_SYNC_ENGINE_STATUSES)[number]

export interface LipSyncEngineDecision {
  engine: string
  status: LipSyncEngineStatus
  motivo: string
}

/**
 * Registro FIXO das decisões já tomadas — nunca mudar sem reavaliar a
 * licença de verdade. `bloquearMotor()` abaixo impede qualquer código de
 * rotear para um motor `BLOCKED_BY_LICENSE`, mesmo por engano.
 */
export const LIP_SYNC_ENGINE_REGISTRY: LipSyncEngineDecision[] = [
  {
    engine: 'musetalk',
    status: 'AVAILABLE_CANDIDATE',
    motivo: 'Código MIT; projeto informa modelos disponíveis para uso comercial. Ainda assim, verificar as licenças das dependências efetivamente usadas antes de integrar em produção.',
  },
  {
    engine: 'wav2lip',
    status: 'BLOCKED_BY_LICENSE',
    motivo: 'Modelos publicados pelo projeto original restritos a uso pessoal/acadêmico/pesquisa/não comercial — incompatível com a finalidade comercial do Patrono.',
  },
  {
    engine: 'liveportrait',
    status: 'BLOCKED_BY_LICENSE',
    motivo: 'Cadeia de dependências (incluindo componentes de detecção facial) com restrições comerciais não totalmente esclarecidas nesta rodada — só reavaliar se toda a cadeia for confirmada compatível.',
  },
]

export function decisaoDoMotor(engine: string): LipSyncEngineDecision {
  return LIP_SYNC_ENGINE_REGISTRY.find((e) => e.engine === engine) ?? { engine, status: 'NOT_VERIFIED', motivo: 'Motor não avaliado ainda — nunca usar sem registrar a licença primeiro.' }
}

/** Nunca deixa um motor BLOCKED_BY_LICENSE ser usado, mesmo se alguém tentar chamar direto. */
export function bloquearMotor(engine: string): void {
  const decisao = decisaoDoMotor(engine)
  if (decisao.status !== 'AVAILABLE_CANDIDATE') {
    throw new Error(`Motor de lip-sync "${engine}" está ${decisao.status} — ${decisao.motivo}`)
  }
}

export type MuseTalkAvailability = { available: false; reason: string } | { available: true; pythonVersion: string }

/** Nunca assume que o MuseTalk está instalado — tenta importar de verdade. */
export async function verificarDisponibilidadeMuseTalk(pythonBin: string = 'python3'): Promise<MuseTalkAvailability> {
  try {
    const { stdout } = await execFileAsync(pythonBin, ['-c', 'import musetalk; import sys; print(sys.version)'])
    return { available: true, pythonVersion: stdout.trim() }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Falha desconhecida'
    return { available: false, reason: `MuseTalk não encontrado no ambiente (${msg}).` }
  }
}

export class MuseTalkLipSyncProvider implements LipSyncProvider {
  constructor(private pythonBin: string = 'python3') {}

  async sincronizar(params: { videoUrl: string; audioUrl: string }): Promise<{ videoUrl: string }> {
    bloquearMotor('musetalk') // defesa em profundidade — nunca depende só do caller ter checado antes
    const disponibilidade = await verificarDisponibilidadeMuseTalk(this.pythonBin)
    if (!disponibilidade.available) throw new Error(disponibilidade.reason)
    throw new Error('MuseTalk disponível no ambiente, mas a chamada real ainda não está implementada nesta rodada.')
  }
}
