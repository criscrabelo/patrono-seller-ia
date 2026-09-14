/**
 * ChatterboxVoiceCloneProvider (Rodada 7, corrigido na Rodada 8) —
 * primeiro provider REAL de `VoiceCloneProvider` (lib/digital-twin.ts),
 * usando o Chatterbox TTS oficial da Resemble AI: open source, MIT,
 * clonagem de voz, execução local, sem API paga.
 *
 * REGRA CRÍTICA: nunca usar a API paga da Resemble, nunca enviar a voz da
 * proprietária para um serviço externo — só a versão self-hosted/local.
 *
 * CORREÇÃO REAL (Rodada 8): a Rodada 7 checava `import chatterbox_tts`,
 * que está ERRADO — verificado baixando de verdade o pacote `chatterbox-tts`
 * do PyPI (pip index/download funcionam neste ambiente): o pacote Python se
 * chama `chatterbox-tts`, mas o MÓDULO importável é `chatterbox` (ex.:
 * `from chatterbox import ChatterboxMultilingualTTS`). `chatterbox/__init__.py`
 * exporta `ChatterboxTTS` (inglês, mono-idioma), `ChatterboxVC` (voice
 * conversion) e `ChatterboxMultilingualTTS` (multilíngue, inclui `pt`).
 *
 * NÃO EXISTE um repositório separado "ResembleAI/Chatterbox-Multilingual-pt-br"
 * — inspecionando `chatterbox/mtl_tts.py` de verdade, o único `REPO_ID` do
 * modelo multilíngue é `ResembleAI/chatterbox` (o mesmo repo do modelo em
 * inglês, com checkpoints diferentes), e `pt` (Portuguese genérico, não
 * "pt-BR" como variante própria) está em `SUPPORTED_LANGUAGES`. A Rodada 8
 * corrige a expectativa da Rodada 7 para refletir a realidade do projeto.
 *
 * Os PESOS do modelo (`ve.pt`, `t3_mtl23ls_v2.safetensors`, `s3gen.pt`,
 * `conds.pt` etc.) são baixados pelo próprio pacote via `huggingface_hub`
 * — e `huggingface.co` está bloqueado pela política de rede DESTE
 * ambiente de desenvolvimento específico (confirmado de novo na Rodada 9:
 * `curl` devolve 403 "connect_rejected"). Isso é
 * `CURRENT_ENVIRONMENT_NETWORK_RESTRICTION` (lib/digital-twin-network-access.ts)
 * — NUNCA documentado como o modelo estar indisponível globalmente
 * (`MODEL_UNAVAILABLE`). O repositório `ResembleAI/chatterbox` é público;
 * na máquina real da proprietária, sem esse bloqueio de proxy, a mesma
 * chamada deve funcionar — ver `DIGITAL-TWIN-BENCHMARK.md`.
 */

import { execFile } from 'child_process'
import { promisify } from 'util'
import type { VoiceCloneProvider } from './digital-twin'
import { verificarAcessoHuggingFace } from './digital-twin-network-access'

const execFileAsync = promisify(execFile)

export type ChatterboxAvailability =
  | { available: false; reason: string }
  | { available: true; pythonVersion: string }

/** Nunca assume que o Chatterbox está instalado — tenta importar de verdade (módulo correto: `chatterbox`). */
export async function verificarDisponibilidadeChatterbox(pythonBin: string = 'python3'): Promise<ChatterboxAvailability> {
  try {
    const { stdout } = await execFileAsync(pythonBin, ['-c', 'import chatterbox; import sys; print(sys.version)'])
    return { available: true, pythonVersion: stdout.trim() }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Falha desconhecida'
    return { available: false, reason: `Chatterbox TTS não encontrado no ambiente (${msg}). Instale o pacote oficial da Resemble AI (self-hosted) antes de usar — ver worker/requirements-chatterbox.txt.` }
  }
}

// ── Provider Selection (Rodada 8, regra 7) ────────────────────────────────
// Cadeia real de prioridade. `PT_BR_SINGLE_LANGUAGE` é mantido como conceito
// na cadeia (a documentação oficial pode vir a publicar um checkpoint
// dedicado no futuro), mas HOJE não existe — o código nunca finge que
// existe; `disponibilidadeDePtBrDedicado()` sempre devolve `false` até um
// repositório real e verificado ser confirmado.

export const CHATTERBOX_PROVIDER_TIERS = ['PT_BR_SINGLE_LANGUAGE', 'MULTILINGUAL_PT', 'VOICE_ONLY_FALLBACK'] as const
export type ChatterboxProviderTier = (typeof CHATTERBOX_PROVIDER_TIERS)[number]

export interface ChatterboxProviderSelection {
  tier: ChatterboxProviderTier
  modelo: string | null
  motivo: string
}

/** Nunca assumido disponível — nenhum checkpoint pt-BR dedicado foi confirmado (ver comentário do arquivo). */
function disponibilidadeDePtBrDedicado(): boolean {
  return false
}

/**
 * Escolhe o tier real a usar, na ordem PT_BR_SINGLE_LANGUAGE → MULTILINGUAL_PT
 * → VOICE_ONLY_FALLBACK. Cada resultado registra QUAL modelo geraria o
 * áudio (regra 7: "registrar qual modelo gerou cada arquivo").
 */
export function selecionarProviderChatterbox(disponibilidade: ChatterboxAvailability): ChatterboxProviderSelection {
  if (disponibilidadeDePtBrDedicado()) {
    return { tier: 'PT_BR_SINGLE_LANGUAGE', modelo: 'chatterbox-pt-br (não confirmado nesta rodada)', motivo: 'Checkpoint dedicado pt-BR não existe/confirmado — nunca selecionado de verdade nesta rodada.' }
  }
  if (disponibilidade.available) {
    return { tier: 'MULTILINGUAL_PT', modelo: 'ChatterboxMultilingualTTS (ResembleAI/chatterbox, language_id="pt")', motivo: 'Pacote Chatterbox disponível — usaria o modelo multilíngue com idioma pt.' }
  }
  return { tier: 'VOICE_ONLY_FALLBACK', modelo: null, motivo: disponibilidade.reason }
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

/**
 * Texto guiado curto para a proprietária gravar UMA vez no onboarding
 * (Rodada 8, regra 4) — cobre variedade fonética suficiente sem exigir
 * gravação longa.
 */
export const TEXTO_GUIADO_ONBOARDING_VOZ =
  'Olá! Esta é a minha voz para o Patrono. Hoje é um bom dia para encontrar ofertas incríveis, ' +
  'com números como 10, 25 e 100, e preços como R$ 49,90. Espero que você aproveite!'

export class ChatterboxVoiceCloneProvider implements VoiceCloneProvider {
  constructor(private pythonBin: string = 'python3') {}

  /**
   * Zero-shot (regra 10 da Continuação da Retomada da Rodada 9) — sem
   * `clonarVoz()`/`voiceId`. Cada síntese recebe `audioPromptPath`
   * diretamente (o áudio de referência JÁ autorizado pela proprietária —
   * o consentimento é checado antes disso, no kill switch do worker;
   * nunca duplicado aqui). Confirmado inspecionando o código real do
   * pacote instalado (`chatterbox/mtl_tts.py`:
   * `generate(text, language_id, audio_prompt_path=...)`).
   */
  async sintetizar(params: { audioPromptPath: string; texto: string; idioma?: string }): Promise<{ audioUrl: string }> {
    if (!params.audioPromptPath) throw new Error('Síntese de voz exige audioPromptPath (áudio de referência autorizado) — nunca sintetizar sem ele.')
    const disponibilidade = await verificarDisponibilidadeChatterbox(this.pythonBin)
    const selecao = selecionarProviderChatterbox(disponibilidade)
    if (selecao.tier === 'VOICE_ONLY_FALLBACK') throw new Error(selecao.motivo)

    // Chamada real ficaria aqui (subprocesso Python com
    // ChatterboxMultilingualTTS.generate(texto, language_id=idioma,
    // audio_prompt_path=params.audioPromptPath)). Confere o acesso ao
    // Hugging Face antes de tentar — se o bloqueio for deste ambiente
    // (CURRENT_ENVIRONMENT_NETWORK_RESTRICTION), a mensagem nunca afirma
    // que o modelo está indisponível.
    const hf = await verificarAcessoHuggingFace()
    throw new Error(
      hf.status === 'CURRENT_ENVIRONMENT_NETWORK_RESTRICTION'
        ? `Provider selecionado (${selecao.tier} — ${selecao.modelo}), mas o Hugging Face Hub está bloqueado neste ambiente específico (${hf.detalhe}) — o modelo em si é público. Retestar na máquina real.`
        : `Provider selecionado (${selecao.tier} — ${selecao.modelo}), mas os pesos do modelo não puderam ser obtidos (${hf.detalhe}).`
    )
  }
}
