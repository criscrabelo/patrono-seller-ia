/**
 * ChatterboxVoiceCloneProvider (Rodada 7) — primeiro provider REAL de
 * `VoiceCloneProvider` (lib/digital-twin.ts), usando o Chatterbox TTS
 * oficial da Resemble AI: open source, licença MIT, clonagem de voz,
 * execução local, sem API paga (ver `DIGITAL-TWIN-MODEL-LICENSES.md`).
 *
 * REGRA CRÍTICA: nunca usar a API paga da Resemble, nunca enviar a voz da
 * proprietária para um serviço externo — só a versão self-hosted/local.
 *
 * Este ambiente de desenvolvimento não tem GPU nem acesso à internet
 * externa para instalar o pacote Python do Chatterbox — por isso
 * `verificarDisponibilidade()` faz uma checagem REAL (tenta importar o
 * pacote via um subprocesso Python) e nunca finge que está disponível.
 * Sem ele, `clonarVoz()`/`sintetizar()` lançam erro claro — nunca simulam
 * um áudio gerado.
 */

import { execFile } from 'child_process'
import { promisify } from 'util'
import type { VoiceCloneProvider } from './digital-twin'

const execFileAsync = promisify(execFile)

export type ChatterboxAvailability =
  | { available: false; reason: string }
  | { available: true; pythonVersion: string }

/** Nunca assume que o Chatterbox está instalado — tenta importar de verdade. */
export async function verificarDisponibilidadeChatterbox(pythonBin: string = 'python3'): Promise<ChatterboxAvailability> {
  try {
    const { stdout } = await execFileAsync(pythonBin, ['-c', 'import chatterbox_tts; import sys; print(sys.version)'])
    return { available: true, pythonVersion: stdout.trim() }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Falha desconhecida'
    return { available: false, reason: `Chatterbox TTS não encontrado no ambiente (${msg}). Instale o pacote oficial da Resemble AI (self-hosted) antes de usar.` }
  }
}

/**
 * Texto de teste padronizado em pt-BR (Rodada 7, regra 13) — cobre
 * pronúncia, naturalidade, ritmo, pausas, nome de marca, número, preço e
 * CTA num único trecho, para avaliar a mesma frase toda vez que o
 * Chatterbox for testado/reavaliado.
 */
export const TEXTO_TESTE_PT_BR =
  'Oi! Encontrei uma opção interessante na categoria eletrônicos. ' +
  'O produto da marca AcmeTech custa R$ 149,90 — um preço bem em conta. ' +
  'Ele vem com bateria de 20 horas e conexão sem fio. ' +
  'Confira o preço atual no link da bio.'

export class ChatterboxVoiceCloneProvider implements VoiceCloneProvider {
  constructor(private pythonBin: string = 'python3') {}

  async clonarVoz(params: { referenceAudio: string; consentId: string }): Promise<{ voiceId: string; provider: string }> {
    const disponibilidade = await verificarDisponibilidadeChatterbox(this.pythonBin)
    if (!disponibilidade.available) throw new Error(disponibilidade.reason)
    if (!params.consentId) throw new Error('Clonagem de voz exige consentId válido — nunca clonar sem consentimento registrado.')

    // Chamada real ficaria aqui (subprocesso Python com o script oficial do
    // Chatterbox). Como o pacote não está instalado neste ambiente, a
    // verificação acima já teria lançado erro antes de chegar aqui.
    throw new Error('verificarDisponibilidadeChatterbox() indicou disponível, mas a chamada real ao Chatterbox ainda não está implementada neste ambiente.')
  }

  async sintetizar(params: { voiceId: string; texto: string }): Promise<{ audioUrl: string }> {
    const disponibilidade = await verificarDisponibilidadeChatterbox(this.pythonBin)
    if (!disponibilidade.available) throw new Error(disponibilidade.reason)
    throw new Error('verificarDisponibilidadeChatterbox() indicou disponível, mas a síntese real ainda não está implementada neste ambiente.')
  }
}
