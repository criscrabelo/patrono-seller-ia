/**
 * Primeiro teste de voz real (Rodada 9, regra 8) — Reference Audio →
 * Chatterbox → texto novo em pt-BR → WAV → Voice Quality Gate → prévia
 * privada. Nunca publica; é sempre um preview.
 */

import type { VoiceCloneProvider } from './digital-twin'
import { avaliarQualidadeVoz, type VoiceQualityGateResultado } from './voice-quality-gate'
import { statSync } from 'fs'

/**
 * Texto inicial de teste (Rodada 9, regra 8) — usado apenas para prévia,
 * nunca publicado.
 */
export const TEXTO_PREVIA_VOZ =
  'Oi! Esta é uma prévia da minha voz digital no Patrono Seller. Os próximos conteúdos poderão ser produzidos automaticamente para mim.'

export interface VoicePreviewJobResultado {
  status: 'READY' | 'FAILED'
  audioPath: string | null
  qualidade: VoiceQualityGateResultado | null
  motivo: string
}

export interface VoicePreviewJobDeps {
  provider: VoiceCloneProvider
  voiceId: string
  texto?: string
  /** Resolve a URL/caminho devolvido pelo provider para um arquivo local (necessário para o Voice Quality Gate via FFmpeg). */
  resolverParaCaminhoLocal: (audioUrl: string) => Promise<string>
}

/**
 * Reference Audio já foi usado na clonagem (etapa anterior, fora deste
 * job) — aqui só a síntese de um texto novo + validação. Nunca publica;
 * só marca READY/FAILED para uma PRÉVIA privada.
 */
export async function gerarPreviaDeVoz(deps: VoicePreviewJobDeps): Promise<VoicePreviewJobResultado> {
  let audioUrl: string
  try {
    const resultado = await deps.provider.sintetizar({ voiceId: deps.voiceId, texto: deps.texto ?? TEXTO_PREVIA_VOZ })
    audioUrl = resultado.audioUrl
  } catch (e) {
    return { status: 'FAILED', audioPath: null, qualidade: null, motivo: e instanceof Error ? e.message : 'Falha ao sintetizar voz.' }
  }

  let caminhoLocal: string
  try {
    caminhoLocal = await deps.resolverParaCaminhoLocal(audioUrl)
  } catch (e) {
    return { status: 'FAILED', audioPath: null, qualidade: null, motivo: e instanceof Error ? e.message : 'Falha ao obter o arquivo gerado.' }
  }

  const tamanhoBytes = statSync(caminhoLocal).size
  const qualidade = await avaliarQualidadeVoz(caminhoLocal, tamanhoBytes)

  if (!qualidade.aprovado) {
    return { status: 'FAILED', audioPath: caminhoLocal, qualidade, motivo: `Voice Quality Gate reprovou: ${qualidade.problemas.join('; ')}` }
  }

  return { status: 'READY', audioPath: caminhoLocal, qualidade, motivo: 'Prévia de voz gerada e aprovada no Quality Gate — pronta para a usuária ouvir (nunca publicada).' }
}
