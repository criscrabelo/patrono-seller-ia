/**
 * Classificação de CTA (Rodada 9, complemento ML, regra 15) — RULE_BASED
 * (regra 1). Nunca produz um CTA enganoso: isso é responsabilidade de
 * quem GERA o texto (Presenter Mode, `lib/digital-twin.ts`); este módulo
 * só CLASSIFICA um CTA já existente para fins de aprendizado de
 * performance.
 */

import type { MLDecisionType } from './ml-types'

export const CTA_TYPES = ['CONFIRA_LINK', 'VEJA_PRECO', 'SAIBA_MAIS', 'VEJA_DETALHES', 'OUTRO', 'NAO_CLASSIFICADO'] as const
export type CtaType = (typeof CTA_TYPES)[number]

interface RegraCta {
  tipo: CtaType
  padroes: RegExp[]
}

const REGRAS_CTA: RegraCta[] = [
  { tipo: 'VEJA_PRECO', padroes: [/\bpre[cç]o (atual|de hoje)?\b/i, /\bveja o pre[cç]o\b/i] },
  { tipo: 'CONFIRA_LINK', padroes: [/\bconfira no link\b/i, /\blink na bio\b/i, /\bconfira o link\b/i] },
  { tipo: 'VEJA_DETALHES', padroes: [/\bveja os detalhes\b/i, /\bmais detalhes\b/i] },
  { tipo: 'SAIBA_MAIS', padroes: [/\bsaiba mais\b/i] },
]

export function classificarCta(texto: string | null | undefined): { tipo: CtaType; decisionType: MLDecisionType } {
  if (!texto || !texto.trim()) return { tipo: 'NAO_CLASSIFICADO', decisionType: 'RULE_BASED' }
  for (const regra of REGRAS_CTA) {
    if (regra.padroes.some((p) => p.test(texto))) {
      return { tipo: regra.tipo, decisionType: 'RULE_BASED' }
    }
  }
  return { tipo: 'OUTRO', decisionType: 'RULE_BASED' }
}
