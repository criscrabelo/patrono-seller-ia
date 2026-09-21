/**
 * Comprovação e promoção auditada para `REAL_OPERATION` (P0.2 — Bloco 3.1).
 *
 * ── A LACUNA QUE ESTE MÓDULO FECHA ──────────────────────────────────────
 * Depois do Bloco 3 o sistema estava corretamente fail-closed e, por isso
 * mesmo, travado: a tela cria `USER_REPORTED`, a autoridade exige
 * `REAL_OPERATION` mais evidência, e nada no código produzia nenhum dos
 * dois. Não existia caminho legítimo para a primeira operação real.
 *
 * Este é o caminho. Ele NÃO afrouxa a regra do Bloco 3 — pelo contrário:
 * exige evidência externa verificável ANTES de mudar qualquer coisa, e
 * depois submete a venda à mesma autoridade de sempre.
 *
 * ── PROMOVER ≠ SER ELEGÍVEL ─────────────────────────────────────────────
 * Promover muda a ORIGEM do registro. Elegibilidade continua dependendo de
 * venda CONFIRMED, comissão reconhecida e relações coerentes. Uma venda
 * pode ser promovida com evidência impecável e continuar inelegível porque
 * ainda está PENDING — e isso é correto, não é bug. Por isso a função
 * devolve o veredito da autoridade, nunca a própria conclusão.
 *
 * ── TUDO OU NADA ────────────────────────────────────────────────────────
 * Validar → registrar evidência → promover origem → auditar acontecem na
 * MESMA transação, protegida por advisory lock na chave da evidência. Uma
 * venda promovida sem evidência registrada, ou evidência registrada sem
 * promoção, seria pior que não ter o mecanismo: pareceria comprovada.
 *
 * ── CORREÇÃO MANUAL É EXCEÇÃO, NÃO ROTINA ───────────────────────────────
 * `CORRECAO_MANUAL_AUDITADA` existe para destravar o primeiro ciclo real
 * sem depender da Affiliate API do TikTok. Ela não é, e não pode virar, o
 * jeito normal de confirmar venda — ver `PENDENCIA_DE_AUTOMACAO` no fim
 * deste arquivo.
 */

import { prisma } from './prisma'
import {
  EVIDENCIAS_ACEITAS_PARA_OPERACAO_REAL,
  normalizarOrigemDeRegistro,
  type EvidenciaDeOperacaoReal,
  type OrigemDeRegistro,
} from './proveniencia'
import {
  ACAO_AUDIT_EVIDENCIA,
  avaliarVendaParaOperacaoReal,
  type VereditoDeOperacaoReal,
} from './real-operation'

export const ACAO_AUDIT_PROMOCAO = 'venda.promovida_para_operacao_real'

/**
 * Origens que PODEM ser promovidas.
 *
 * `USER_REPORTED` é relato de boa-fé da proprietária; `UNVERIFIED` é
 * registro cuja origem nunca foi estabelecida. Ambos são afirmações sobre
 * uma venda que pode muito bem ter acontecido — só faltava prova.
 *
 * `SEED`, `TEST_FIXTURE`, `DEMO` e `SYNTHETIC_TEST` estão FORA e nunca
 * entram: não são afirmações sobre o mundo, são dados que o próprio sistema
 * fabricou. Nenhuma evidência externa pode tornar real o que nasceu
 * sintético — promover um deles seria falsificar a procedência, não
 * comprová-la.
 */
export const ORIGENS_PROMOVIVEIS = ['USER_REPORTED', 'UNVERIFIED'] as const

export const MOTIVOS_RECUSA_PROMOCAO = [
  'VENDA_NAO_ENCONTRADA',
  'ORIGEM_SINTETICA_NAO_PROMOVIVEL',
  'ORIGEM_NAO_PROMOVIVEL',
  'JA_ERA_OPERACAO_REAL',
  'TIPO_DE_EVIDENCIA_INVALIDO',
  'REFERENCIA_AUSENTE',
  'RESPONSAVEL_AUSENTE',
  'MOTIVO_AUSENTE',
  'MOTIVO_INSUFICIENTE',
  'SEM_COMISSAO_PARA_A_EVIDENCIA',
  'WORKSPACE_AUSENTE',
] as const

export type MotivoRecusaPromocao = (typeof MOTIVOS_RECUSA_PROMOCAO)[number]

/** Tamanho mínimo de um motivo de correção manual: uma frase, não uma letra. */
export const TAMANHO_MINIMO_DO_MOTIVO = 10

export interface PedidoDePromocao {
  workspaceId: string
  saleId: string
  tipoEvidencia: string
  /**
   * Identificador externo conferível: id do evento de webhook, número do
   * repasse/extrato, id da integração que confirmou. É o que permite alguém
   * auditar depois — evidência sem referência é afirmação, não prova.
   */
  referencia: string
  /** Quem/o quê está comprovando. */
  ator: {
    tipo: 'USUARIA' | 'INTEGRACAO' | 'SISTEMA'
    /** Obrigatório quando `tipo === 'USUARIA'` e na correção manual. */
    userId?: string | null
  }
  /** Obrigatório em `CORRECAO_MANUAL_AUDITADA`. */
  motivo?: string | null
}

export interface ResultadoDaPromocao {
  promovido: boolean
  /** `true` quando a MESMA evidência já havia promovido esta venda antes. */
  idempotente: boolean
  motivo: MotivoRecusaPromocao | null
  explicacao: string
  saleId: string
  workspaceId: string
  origemAnterior: OrigemDeRegistro | null
  origemNova: OrigemDeRegistro | null
  evidencia: { tipo: string; referencia: string } | null
  /** Veredito da autoridade única APÓS a promoção. `null` se nada mudou. */
  veredito: VereditoDeOperacaoReal | null
}

function textoUtil(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

/**
 * Chave determinística da evidência: workspace + venda + tipo + referência.
 *
 * O MESMO evento de webhook reprocessado, ou a mesma linha de extrato
 * conferida duas vezes, produz a mesma chave — e a segunda tentativa não
 * cria auditoria duplicada nem promove de novo.
 */
export function chaveDaEvidencia(p: {
  workspaceId: string
  saleId: string
  tipoEvidencia: string
  referencia: string
}): string {
  return [p.workspaceId, p.saleId, p.tipoEvidencia, p.referencia.trim()].join('|')
}

export interface ContextoDeValidacao {
  origemAtual: string
  /** `true` quando a venda tem comissão CONFIRMED/RECEIVED neste workspace. */
  temComissaoReconhecida: boolean
}

export type ResultadoValidacao =
  | { ok: true }
  | { ok: false; motivo: MotivoRecusaPromocao; explicacao: string }

/**
 * VALIDAÇÃO PURA — exigências por tipo de evidência.
 *
 * Separada do banco de propósito: é a parte que decide, e decidir tem de
 * ser testável com os dados exatos de cada caso.
 */
export function validarPedidoDePromocao(
  pedido: PedidoDePromocao,
  contexto: ContextoDeValidacao
): ResultadoValidacao {
  const recusar = (motivo: MotivoRecusaPromocao, explicacao: string): ResultadoValidacao => ({
    ok: false,
    motivo,
    explicacao,
  })

  if (!textoUtil(pedido?.workspaceId) || !textoUtil(pedido?.saleId)) {
    return recusar(
      'WORKSPACE_AUSENTE',
      'Promoção exige workspaceId e saleId juntos — um id de venda solto não identifica de quem é a venda.'
    )
  }

  const origem = normalizarOrigemDeRegistro(contexto?.origemAtual)

  if (origem === 'REAL_OPERATION') {
    return recusar('JA_ERA_OPERACAO_REAL', 'Esta venda já está marcada como operação real.')
  }
  if (['SEED', 'TEST_FIXTURE', 'DEMO', 'SYNTHETIC_TEST'].includes(origem)) {
    // Dado que o sistema fabricou não vira real por evidência nenhuma:
    // isso seria falsificar a procedência, não comprová-la.
    return recusar(
      'ORIGEM_SINTETICA_NAO_PROMOVIVEL',
      `Origem ${origem} é dado sintético e nunca pode ser promovida — nem com evidência externa válida.`
    )
  }
  if (!(ORIGENS_PROMOVIVEIS as readonly string[]).includes(origem)) {
    return recusar('ORIGEM_NAO_PROMOVIVEL', `Origem ${origem} não está na lista de origens promovíveis.`)
  }

  if (!(EVIDENCIAS_ACEITAS_PARA_OPERACAO_REAL as readonly string[]).includes(pedido?.tipoEvidencia)) {
    return recusar(
      'TIPO_DE_EVIDENCIA_INVALIDO',
      `"${pedido?.tipoEvidencia}" não é um tipo de evidência aceito.`
    )
  }

  // Referência externa é exigida em TODOS os tipos. É o que separa prova de
  // afirmação, e vale inclusive para a correção manual.
  if (!textoUtil(pedido.referencia)) {
    return recusar(
      'REFERENCIA_AUSENTE',
      'Toda evidência precisa de referência externa conferível (id do evento, número do repasse, id da integração).'
    )
  }

  if (pedido.tipoEvidencia === 'COMISSAO_CONFIRMADA_COM_ORIGEM_VERIFICAVEL') {
    // `Commission.status = CONFIRMED` NÃO basta: na tela, confirmar a
    // comissão é a mesma pessoa repetindo a mesma declaração. O que
    // comprova é a referência externa de ONDE veio a confirmação — que já
    // foi exigida acima. Aqui só conferimos que existe a comissão de que a
    // evidência fala; sem ela, a referência não se refere a nada.
    if (!contexto?.temComissaoReconhecida) {
      return recusar(
        'SEM_COMISSAO_PARA_A_EVIDENCIA',
        'Não há comissão CONFIRMED ou RECEIVED nesta venda — a evidência afirma confirmar uma comissão que não existe.'
      )
    }
  }

  if (pedido.tipoEvidencia === 'CORRECAO_MANUAL_AUDITADA') {
    if (!textoUtil(pedido.ator?.userId)) {
      return recusar(
        'RESPONSAVEL_AUSENTE',
        'Correção manual exige o usuário responsável — uma correção sem quem assinou é indistinguível de alguém ter digitado "é real".'
      )
    }
    if (!textoUtil(pedido.motivo)) {
      return recusar('MOTIVO_AUSENTE', 'Correção manual exige o motivo por escrito.')
    }
    if (pedido.motivo!.trim().length < TAMANHO_MINIMO_DO_MOTIVO) {
      return recusar(
        'MOTIVO_INSUFICIENTE',
        `O motivo precisa explicar a correção (mínimo ${TAMANHO_MINIMO_DO_MOTIVO} caracteres) — "ok" não é justificativa.`
      )
    }
  }

  if (pedido.ator?.tipo === 'USUARIA' && !textoUtil(pedido.ator?.userId)) {
    return recusar('RESPONSAVEL_AUSENTE', 'Ator do tipo USUARIA exige o userId de quem comprovou.')
  }

  return { ok: true }
}

/**
 * Promove uma venda a `REAL_OPERATION` mediante evidência comprovada.
 *
 * Tudo ou nada, dentro de uma transação:
 *   1. trava a chave da evidência (advisory lock);
 *   2. lê a venda DESTE workspace;
 *   3. valida o pedido contra as exigências do tipo de evidência;
 *   4. registra a evidência em `AuditLog`;
 *   5. muda `Sale.dataOrigin` para `REAL_OPERATION`;
 *   6. registra a promoção, com estado anterior e novo.
 *
 * Depois — FORA da transação, já com o dado gravado — submete a venda à
 * autoridade única e devolve o veredito. Promover não decide elegibilidade.
 */
export async function promoverVendaParaRealOperation(
  pedido: PedidoDePromocao
): Promise<ResultadoDaPromocao> {
  const base = {
    saleId: pedido?.saleId ?? '',
    workspaceId: pedido?.workspaceId ?? '',
    origemAnterior: null,
    origemNova: null,
    evidencia: null,
    veredito: null,
  }

  if (!textoUtil(pedido?.workspaceId) || !textoUtil(pedido?.saleId)) {
    return {
      ...base,
      promovido: false,
      idempotente: false,
      motivo: 'WORKSPACE_AUSENTE',
      explicacao: 'Promoção exige workspaceId e saleId juntos.',
    }
  }

  const chave = chaveDaEvidencia({
    workspaceId: pedido.workspaceId,
    saleId: pedido.saleId,
    tipoEvidencia: String(pedido.tipoEvidencia),
    referencia: String(pedido.referencia ?? ''),
  })

  const resultado = await prisma.$transaction(async (tx) => {
    // Serializa por chave de evidência: duas entregas simultâneas do mesmo
    // webhook não conseguem promover duas vezes nem duplicar auditoria.
    await tx.$queryRaw`SELECT 1 AS ok FROM (SELECT pg_advisory_xact_lock(hashtext(${chave}))) AS trava`

    // A venda é buscada SEMPRE com o workspace junto — nunca por id solto.
    const venda = await tx.sale.findFirst({
      where: { id: pedido.saleId, workspaceId: pedido.workspaceId },
      select: {
        id: true,
        dataOrigin: true,
        commissions: { select: { status: true, workspaceId: true } },
      },
    })
    if (!venda) {
      return {
        ...base,
        promovido: false,
        idempotente: false,
        motivo: 'VENDA_NAO_ENCONTRADA' as const,
        explicacao: 'Venda não encontrada neste workspace.',
      }
    }

    // Idempotência: a MESMA evidência já registrada para esta venda.
    const jaRegistrada = await tx.auditLog.findFirst({
      where: {
        workspaceId: pedido.workspaceId,
        action: ACAO_AUDIT_EVIDENCIA,
        entityType: 'Sale',
        entityId: pedido.saleId,
        metadata: { path: ['chaveEvidencia'], equals: chave },
      },
      select: { id: true },
    })
    if (jaRegistrada) {
      return {
        ...base,
        promovido: false,
        idempotente: true,
        motivo: null,
        origemAnterior: normalizarOrigemDeRegistro(venda.dataOrigin),
        origemNova: normalizarOrigemDeRegistro(venda.dataOrigin),
        evidencia: { tipo: pedido.tipoEvidencia, referencia: pedido.referencia },
        explicacao: 'Esta evidência já havia sido registrada para esta venda — nada foi alterado nem duplicado.',
      }
    }

    const temComissaoReconhecida = venda.commissions.some(
      (c) => c.workspaceId === pedido.workspaceId && ['CONFIRMED', 'RECEIVED'].includes(c.status)
    )

    const validacao = validarPedidoDePromocao(pedido, {
      origemAtual: venda.dataOrigin,
      temComissaoReconhecida,
    })
    if (!validacao.ok) {
      return {
        ...base,
        promovido: false,
        idempotente: false,
        motivo: validacao.motivo,
        explicacao: validacao.explicacao,
        origemAnterior: normalizarOrigemDeRegistro(venda.dataOrigin),
      }
    }

    const origemAnterior = normalizarOrigemDeRegistro(venda.dataOrigin)
    const agora = new Date()

    // 4) Evidência primeiro: se algo falhar daqui em diante, a transação
    //    desfaz tudo e a venda NÃO fica promovida sem prova.
    await tx.auditLog.create({
      data: {
        workspaceId: pedido.workspaceId,
        userId: pedido.ator?.userId ?? null,
        action: ACAO_AUDIT_EVIDENCIA,
        entityType: 'Sale',
        entityId: pedido.saleId,
        metadata: {
          tipo: pedido.tipoEvidencia,
          referencia: pedido.referencia.trim(),
          chaveEvidencia: chave,
          atorTipo: pedido.ator?.tipo ?? 'SISTEMA',
          responsavelUserId: pedido.ator?.userId ?? null,
          motivo: pedido.motivo?.trim() ?? null,
          registradaEm: agora.toISOString(),
        } as never,
      },
    })

    // 5) Origem.
    await tx.sale.update({
      where: { id: pedido.saleId },
      data: { dataOrigin: 'REAL_OPERATION' },
    })

    // 6) Promoção auditada, com estado anterior e novo.
    await tx.auditLog.create({
      data: {
        workspaceId: pedido.workspaceId,
        userId: pedido.ator?.userId ?? null,
        action: ACAO_AUDIT_PROMOCAO,
        entityType: 'Sale',
        entityId: pedido.saleId,
        metadata: {
          estadoAnterior: origemAnterior,
          estadoNovo: 'REAL_OPERATION',
          tipoEvidencia: pedido.tipoEvidencia,
          referencia: pedido.referencia.trim(),
          chaveEvidencia: chave,
          atorTipo: pedido.ator?.tipo ?? 'SISTEMA',
          responsavelUserId: pedido.ator?.userId ?? null,
          motivo: pedido.motivo?.trim() ?? null,
          promovidaEm: agora.toISOString(),
        } as never,
      },
    })

    return {
      ...base,
      promovido: true,
      idempotente: false,
      motivo: null,
      origemAnterior,
      origemNova: 'REAL_OPERATION' as OrigemDeRegistro,
      evidencia: { tipo: pedido.tipoEvidencia, referencia: pedido.referencia.trim() },
      explicacao: `Venda promovida de ${origemAnterior} para REAL_OPERATION com evidência ${pedido.tipoEvidencia} (ref. ${pedido.referencia.trim()}).`,
    }
  })

  // Revalidação pela autoridade única, já com o dado gravado. Promover não
  // é o mesmo que ser elegível — a venda ainda precisa estar CONFIRMED, com
  // comissão reconhecida e relações coerentes.
  if (resultado.promovido || resultado.idempotente) {
    const veredito = await avaliarVendaParaOperacaoReal(pedido.workspaceId, pedido.saleId)
    return { ...resultado, veredito }
  }

  return resultado
}

/**
 * FILA DE AUTOMAÇÃO (regra permanente).
 *
 * `CORRECAO_MANUAL_AUDITADA` destrava o primeiro ciclo real sem depender da
 * Affiliate API do TikTok — e é exceção, não rotina. Se a proprietária
 * passar a comprovar venda a venda toda semana, isso deixou de ser exceção
 * e virou trabalho manual recorrente: dívida de automação, não "o jeito que
 * funciona".
 *
 * A confirmação recorrente precisa vir de `PROVIDER_OFICIAL` (webhook/API
 * do provider) ou `CONCILIACAO_FINANCEIRA` (importação de extrato/repasse).
 */
export const PENDENCIA_DE_AUTOMACAO = {
  chave: 'operacao-real:comprovacao-recorrente',
  explicacao:
    'A comprovação de venda real depende hoje de correção manual auditada. Recorrente, isso é dívida de automação: deve passar a vir de webhook/API oficial do provider ou de conciliação financeira importada.',
  evidenciaManualAceitaHoje: 'CORRECAO_MANUAL_AUDITADA' as EvidenciaDeOperacaoReal,
  substitutosAutomaticos: ['PROVIDER_OFICIAL', 'CONCILIACAO_FINANCEIRA'] as EvidenciaDeOperacaoReal[],
} as const
