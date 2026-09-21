/**
 * CostSafetyGate — guardião de CUSTO ZERO POR PADRÃO (Rodada 14, P0.1).
 *
 * MOTIVO: a auditoria encontrou quatro integrações que podem gerar cobrança
 * (fal.ai, Anthropic, Resend, Z-API) e NENHUMA verificação de política antes
 * de chamar. O `AI_MONTHLY_BUDGET` estava documentado como teto de custo mas
 * não era lido em lugar nenhum do código. Na prática, quem tivesse a chave
 * configurada gastava sem limite — a única barreira era a ausência da
 * variável de ambiente, que é acidente, não política.
 *
 * O risco cresce na mesma proporção que a autonomia: um Revenue Autopilot que
 * decide "gerar mais conteúdo" chamaria fal.ai em laço, sem teto.
 *
 * ── PRINCÍPIO ──────────────────────────────────────────────────────────
 * Não é um sistema que gasta até bater num teto. É um sistema que NÃO PODE
 * gastar nada por padrão. Liberar é ato deliberado da proprietária.
 *
 * DUAS CHAVES SIMULTÂNEAS para qualquer chamada paga:
 *   PAID_AI_ENABLED=true   E   AI_MONTHLY_BUDGET > 0
 * Só uma delas não libera nada. Um `AI_MONTHLY_BUDGET=50` esquecido num .env
 * de teste não pode virar autorização que ninguém concedeu.
 *
 * ── FAIL-CLOSED EM TUDO ────────────────────────────────────────────────
 * Variável ausente → bloqueado. Provedor desconhecido → bloqueado. Política
 * ilegível → bloqueado. É o oposto do `db-resiliencia`, onde o desconhecido é
 * fatal e para o processo; aqui o desconhecido é simplesmente NEGADO.
 *
 * ── SOBERANIA ──────────────────────────────────────────────────────────
 * Não existe parâmetro de "forçar", "ignorar" ou "prioridade". ML, worker,
 * cron, provider e Autopilot não têm como argumentar com este gate. Mesmo
 * que um modelo decida "gere 500 vídeos", a resposta continua sendo a
 * política. Só as variáveis de ambiente mudam isso.
 *
 * As funções de DECISÃO (`lerPoliticaDeCusto`, `avaliarCusto`) são puras:
 * recebem política e gasto acumulado, não consultam banco. É o que torna
 * "variável ausente", "orçamento estourado" e "workspace A ≠ workspace B"
 * testáveis sem tocar em nada externo.
 *
 * `guardarChamadaPaga()` é o único ponto impuro — ele orquestra decisão,
 * fallback e auditoria. Existe para que os call sites NÃO espalhem `if` de
 * política: cada integração paga chama uma função só.
 */

export type ProvedorPago = 'fal.ai' | 'anthropic' | 'resend' | 'z-api'

/** Catálogo explícito. O que não está aqui é desconhecido — e negado. */
export const PROVEDORES_PAGOS: Record<ProvedorPago, { descricao: string; unidade: string }> = {
  'fal.ai': { descricao: 'Geração de vídeo por IA (Kling)', unidade: 'por vídeo' },
  anthropic: { descricao: 'Geração de texto/roteiro por IA', unidade: 'por token' },
  resend: { descricao: 'Envio de e-mail transacional', unidade: 'por e-mail acima do free tier' },
  'z-api': { descricao: 'Envio de WhatsApp', unidade: 'por instância/mensagem' },
}

export function ehProvedorPagoConhecido(provider: string): provider is ProvedorPago {
  return Object.prototype.hasOwnProperty.call(PROVEDORES_PAGOS, provider)
}

export interface PoliticaDeCusto {
  /** `PAID_AI_ENABLED === 'true'`. Qualquer outro valor é `false`. */
  pagoHabilitado: boolean
  /** `AI_MONTHLY_BUDGET`. Ausente, inválido ou negativo vira 0. */
  orcamentoMensal: number
}

export const POLITICA_PADRAO: PoliticaDeCusto = {
  pagoHabilitado: false,
  orcamentoMensal: 0,
}

export type FonteDeEnv = Record<string, string | undefined>

/**
 * Lê a política do ambiente. AUSÊNCIA NUNCA É PERMISSÃO: qualquer variável
 * faltando, ilegível ou negativa resulta na política padrão, que bloqueia.
 */
export function lerPoliticaDeCusto(env: FonteDeEnv = process.env): PoliticaDeCusto {
  const pagoHabilitado = env.PAID_AI_ENABLED === 'true'

  const bruto = env.AI_MONTHLY_BUDGET
  let orcamentoMensal = 0
  if (bruto !== undefined && bruto.trim() !== '') {
    const valor = Number(bruto)
    // Não-numérico ou negativo cai em 0 — nunca "libera por engano".
    if (Number.isFinite(valor) && valor > 0) orcamentoMensal = valor
  }

  return { pagoHabilitado, orcamentoMensal }
}

export type MotivoBloqueio =
  | 'PROVEDOR_DESCONHECIDO'
  | 'PAGO_NAO_HABILITADO'
  | 'ORCAMENTO_ZERO'
  | 'ORCAMENTO_ESGOTADO'
  | 'CUSTO_EXCEDE_SALDO'

export interface ConsultaDeCusto {
  provider: string
  /** Ex.: 'gerar-video', 'gerar-roteiro', 'enviar-email'. Vai para auditoria. */
  operacao: string
  workspaceId: string
  /** Em BRL, quando estimável. `null` = desconhecido (tratado como > 0). */
  custoEstimado: number | null
  /** Gasto já realizado por ESTE workspace no período. Nunca somado entre negócios. */
  gastoAcumulado: number
  politica: PoliticaDeCusto
}

export interface DecisaoDeCusto {
  permitido: boolean
  /** `BLOCKED_BY_COST_POLICY` quando negado. */
  decisao: 'ALLOWED' | 'BLOCKED_BY_COST_POLICY'
  motivo: MotivoBloqueio | null
  /** Texto pronto para log e auditoria. Nunca contém credencial. */
  explicacao: string
  saldoDisponivel: number
}

export function avaliarCusto(consulta: ConsultaDeCusto): DecisaoDeCusto {
  const { politica } = consulta
  const saldoDisponivel = Math.max(0, politica.orcamentoMensal - consulta.gastoAcumulado)

  const negar = (motivo: MotivoBloqueio, explicacao: string): DecisaoDeCusto => ({
    permitido: false,
    decisao: 'BLOCKED_BY_COST_POLICY',
    motivo,
    explicacao,
    saldoDisponivel,
  })

  // 1) Provedor fora do catálogo: negado. Um serviço pago novo não pode
  //    entrar em produção só porque ninguém o cadastrou aqui.
  if (!ehProvedorPagoConhecido(consulta.provider)) {
    return negar(
      'PROVEDOR_DESCONHECIDO',
      `Provedor "${consulta.provider}" não está no catálogo de provedores pagos conhecidos — bloqueado por precaução.`
    )
  }

  // 2) e 3) As DUAS chaves, avaliadas separadamente para o log dizer qual
  //    delas falta — sem isso, diagnosticar exigiria adivinhação.
  if (!politica.pagoHabilitado) {
    return negar(
      'PAGO_NAO_HABILITADO',
      'Serviços pagos não estão habilitados (PAID_AI_ENABLED). Custo zero por padrão — liberar exige ato explícito da proprietária.'
    )
  }
  if (politica.orcamentoMensal <= 0) {
    return negar(
      'ORCAMENTO_ZERO',
      'Orçamento mensal é R$ 0,00 (AI_MONTHLY_BUDGET). Habilitar serviços pagos sem orçamento não autoriza gasto nenhum.'
    )
  }

  // 4) Orçamento já consumido por ESTE workspace.
  if (saldoDisponivel <= 0) {
    return negar(
      'ORCAMENTO_ESGOTADO',
      `Orçamento mensal de R$ ${politica.orcamentoMensal.toFixed(2)} já foi consumido neste workspace (gasto: R$ ${consulta.gastoAcumulado.toFixed(2)}).`
    )
  }

  // 5) Custo desconhecido é tratado como "não cabe": autorizar o que não se
  //    sabe medir é exatamente como se estoura orçamento.
  if (consulta.custoEstimado === null) {
    return negar(
      'CUSTO_EXCEDE_SALDO',
      'Custo estimado desconhecido para esta operação — bloqueado, porque autorizar gasto não mensurável é como não ter teto.'
    )
  }
  if (consulta.custoEstimado > saldoDisponivel) {
    return negar(
      'CUSTO_EXCEDE_SALDO',
      `Custo estimado de R$ ${consulta.custoEstimado.toFixed(2)} excede o saldo de R$ ${saldoDisponivel.toFixed(2)} neste workspace.`
    )
  }

  return {
    permitido: true,
    decisao: 'ALLOWED',
    motivo: null,
    explicacao: `Autorizado: R$ ${consulta.custoEstimado.toFixed(2)} dentro do saldo de R$ ${saldoDisponivel.toFixed(2)}.`,
    saldoDisponivel,
  }
}

// ── Ponto de entrada único das integrações pagas ────────────────────────

import { registrarAuditoria } from './audit-log'
import { escolherFallback, type Fallback } from './cost-fallback'

export interface ResultadoGuarda {
  permitido: boolean
  decisao: DecisaoDeCusto
  /** Alternativa gratuita escolhida quando a chamada foi bloqueada. */
  fallback: Fallback | null
}

/**
 * Chamado ANTES de qualquer requisição que possa gerar cobrança.
 *
 * Quando nega, registra a tentativa em `AuditLog` com timestamp, workspace,
 * provedor, operação, motivo, custo estimado, fallback e decisão final —
 * NUNCA com chave de API, token ou credencial (nada disso sequer chega até
 * aqui: a função não recebe credencial como parâmetro).
 *
 * `gastoAcumulado` entra por parâmetro e é sempre de UM workspace. Não há
 * como somar consumo de negócios diferentes por engano.
 */
export async function guardarChamadaPaga(params: {
  provider: string
  operacao: string
  /**
   * `null` quando quem chama não tem workspace em mãos. Nesse caso a
   * auditoria vai para o log estruturado em vez do banco — `AuditLog` tem
   * chave estrangeira para `Workspace`, e inventar um id só para registrar
   * criaria dado falso.
   */
  workspaceId: string | null
  custoEstimado: number | null
  gastoAcumulado?: number
  env?: FonteDeEnv
}): Promise<ResultadoGuarda> {
  const politica = lerPoliticaDeCusto(params.env ?? process.env)
  const decisao = avaliarCusto({
    provider: params.provider,
    operacao: params.operacao,
    workspaceId: params.workspaceId ?? 'nao-informado',
    custoEstimado: params.custoEstimado,
    gastoAcumulado: params.gastoAcumulado ?? 0,
    politica,
  })

  if (decisao.permitido) return { permitido: true, decisao, fallback: null }

  const fallback = escolherFallback(params.provider, params.operacao)

  if (!params.workspaceId) {
    console.warn(
      `[cost-safety-gate] BLOCKED_BY_COST_POLICY provider=${params.provider} operacao=${params.operacao} motivo=${decisao.motivo} fallback=${fallback.tipo} — ${decisao.explicacao}`
    )
    return { permitido: false, decisao, fallback }
  }

  await registrarAuditoria({
    workspaceId: params.workspaceId,
    action: 'custo.bloqueado_por_politica',
    entityType: 'CostSafetyGate',
    entityId: `${params.provider}:${params.operacao}`,
    metadata: {
      provider: params.provider,
      operacao: params.operacao,
      motivo: decisao.motivo,
      explicacao: decisao.explicacao,
      custoEstimado: params.custoEstimado,
      saldoDisponivel: decisao.saldoDisponivel,
      decisao: decisao.decisao,
      fallbackTipo: fallback.tipo,
      fallbackAlternativa: fallback.alternativa,
      pendenciaDeAutomacao: fallback.pendenciaDeAutomacao,
    },
  })

  return { permitido: false, decisao, fallback }
}
