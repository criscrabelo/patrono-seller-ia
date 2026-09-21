/**
 * Proveniência de registro comercial (P0.2 — Bloco 1).
 *
 * ── O PROBLEMA ──────────────────────────────────────────────────────────
 * `Sale` só tinha `source` ('manual' | 'webhook'), que responde COMO a venda
 * entrou no sistema. Não respondia a pergunta que importa para o ML: ESTA
 * VENDA REPRESENTA OPERAÇÃO COMERCIAL REAL? Uma venda de teste registrada
 * pela tela também é 'manual'. Sem essa distinção, ligar o feature store
 * transformaria em REAL_OPERATION qualquer linha que existisse no banco,
 * incluindo as criadas para testar o próprio sistema.
 *
 * ── A REGRA ─────────────────────────────────────────────────────────────
 * A origem é DECLARADA por quem cria o registro, nunca inferida. Quem chama
 * `registrarResultado()` é obrigado a informar — não há valor padrão no
 * parâmetro, então esquecer não compila. O ônus fica em quem cria dado
 * sintético (seed, teste, demo), que é código nosso, e não na proprietária.
 *
 * ── POR QUE `UNVERIFIED` É O DEFAULT DO BANCO ───────────────────────────
 * Toda linha que já existe passou a valer como "origem não demonstrável".
 * Promover histórico a REAL_OPERATION por conveniência seria ensinar o ML
 * com dado de procedência duvidosa. Perder dado de treino é reversível;
 * modelo contaminado, não. Fail-closed.
 *
 * `UNVERIFIED` não pertence a `MLDataOrigin` de propósito: é um estado do
 * REGISTRO COMERCIAL ("ainda não classificado"), não uma origem de dado de
 * ML. Nada que esteja `UNVERIFIED` pode virar amostra de treino.
 */

import { ML_DATA_ORIGINS, type MLDataOrigin } from './ml-types'

/**
 * Estado de proveniência ainda não estabelecido. Nunca é elegível para ML,
 * nunca é promovido automaticamente, e só sai daqui por correção explícita
 * e auditada de quem tenha como demonstrar a origem.
 */
export const ORIGEM_NAO_VERIFICADA = 'UNVERIFIED' as const

export const ORIGENS_DE_REGISTRO = [...ML_DATA_ORIGINS, ORIGEM_NAO_VERIFICADA] as const
export type OrigemDeRegistro = (typeof ORIGENS_DE_REGISTRO)[number]

export function ehOrigemDeRegistro(valor: unknown): valor is OrigemDeRegistro {
  return typeof valor === 'string' && (ORIGENS_DE_REGISTRO as readonly string[]).includes(valor)
}

/**
 * Normaliza o que veio do banco. Valor desconhecido, nulo ou corrompido vira
 * `UNVERIFIED` — nunca `REAL_OPERATION`. Um registro que não se consegue
 * classificar é, por definição, um registro cuja origem não foi demonstrada.
 */
export function normalizarOrigemDeRegistro(valor: unknown): OrigemDeRegistro {
  return ehOrigemDeRegistro(valor) ? valor : ORIGEM_NAO_VERIFICADA
}

/**
 * A única origem que pode alimentar treino/promoção de modelo de produção.
 *
 * Deliberadamente NÃO recebe "modo permissivo", "incluir demo" ou qualquer
 * parâmetro de afrouxamento: se um dia for preciso treinar com dado
 * sintético, isso é um caminho separado e explícito, não um booleano aqui.
 */
export function ehOperacaoReal(valor: unknown): boolean {
  return normalizarOrigemDeRegistro(valor) === 'REAL_OPERATION'
}

/** Só para relatório/UI — nunca para decisão. */
export const DESCRICAO_DA_ORIGEM: Record<OrigemDeRegistro, string> = {
  REAL_OPERATION: 'Operação comercial real, registrada por usuária autenticada no workspace de produção.',
  TEST_FIXTURE: 'Dado criado por teste automatizado.',
  DEMO: 'Dado criado para demonstração do sistema.',
  SEED: 'Dado criado por script de carga inicial.',
  SYNTHETIC_TEST: 'Dado sintético gerado para validar o motor tecnicamente.',
  UNVERIFIED: 'Origem não demonstrável — registro anterior à exigência de proveniência, ou criado sem declaração. Nunca conta como operação real.',
}

export type { MLDataOrigin }
