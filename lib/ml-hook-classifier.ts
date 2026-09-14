/**
 * Classificação de hook (Rodada 9, complemento ML, regra 14) —
 * RULE_BASED (regra 1): casamento de palavras-chave, nenhum parâmetro
 * aprendido. A camada estatística fica em `ml-feature-store.ts`
 * (`historicalConversionRate` por `hook_type`, quando houver dados reais).
 */

import type { MLDecisionType } from './ml-types'

export const HOOK_TYPES = [
  'CURIOSIDADE',
  'PROBLEMA_SOLUCAO',
  'PRECO',
  'BENEFICIO',
  'COMPARACAO',
  'URGENCIA',
  'DESCOBERTA',
  'LISTA',
  'DEMONSTRACAO',
  'NAO_CLASSIFICADO',
] as const
export type HookType = (typeof HOOK_TYPES)[number]

interface RegraHook {
  tipo: HookType
  padroes: RegExp[]
}

// Ordem importa: a primeira regra que casar decide — evita ambiguidade
// silenciosa. Palavras em pt-BR, sem acento fixo (regex já cobre variação).
const REGRAS_HOOK: RegraHook[] = [
  { tipo: 'URGENCIA', padroes: [/\b(últim[oa]s?|corre|agora|hoje|acaba|s[oó] hoje|enquanto durar)\b/i] },
  { tipo: 'PRECO', padroes: [/\b(por apenas|de\s*r\$|desconto|preço|barato|promoção)\b/i] },
  { tipo: 'COMPARACAO', padroes: [/\b(melhor que|comparado|versus|vs\.?|diferença entre)\b/i] },
  { tipo: 'PROBLEMA_SOLUCAO', padroes: [/\b(cansad[oa] de|resolve|nunca mais|acabou com|pare de)\b/i] },
  { tipo: 'LISTA', padroes: [/\b(\d+\s*(motivos|raz[oõ]es|dicas|jeitos|formas))\b/i] },
  { tipo: 'DEMONSTRACAO', padroes: [/\b(veja como|olha (s[oó])?|assista|mostrando|na prática)\b/i] },
  { tipo: 'DESCOBERTA', padroes: [/\b(achei|descobri|encontrei|ningu[eé]m fala|segredo)\b/i] },
  { tipo: 'BENEFICIO', padroes: [/\b(voc[eê] vai|ajuda a|benef[ií]cio|resultado)\b/i] },
  { tipo: 'CURIOSIDADE', padroes: [/\b(voc[eê] sabia|imagina|e se eu|adivinha)\b/i] },
]

/** Nunca inventa: string vazia/ausente vira NAO_CLASSIFICADO, nunca um palpite. */
export function classificarHook(texto: string | null | undefined): { tipo: HookType; decisionType: MLDecisionType } {
  if (!texto || !texto.trim()) return { tipo: 'NAO_CLASSIFICADO', decisionType: 'RULE_BASED' }
  for (const regra of REGRAS_HOOK) {
    if (regra.padroes.some((p) => p.test(texto))) {
      return { tipo: regra.tipo, decisionType: 'RULE_BASED' }
    }
  }
  return { tipo: 'NAO_CLASSIFICADO', decisionType: 'RULE_BASED' }
}
