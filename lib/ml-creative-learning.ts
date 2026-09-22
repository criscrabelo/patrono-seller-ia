/**
 * Aprendizado de criativo (Rodada 9, complemento ML, regras 14-16) —
 * camada ESTATÍSTICA (STATISTICAL_LEARNING, nunca confundida com
 * MACHINE_LEARNING): correlaciona o `hook_type`/`cta_type` já
 * classificados (RULE_BASED, `ml-hook-classifier.ts`/`ml-cta-classifier.ts`)
 * com a conversão REAL (Sale/Commission via `Sale.contentId`) — só médias
 * por grupo, nenhum modelo paramétrico treinado aqui.
 */

import { prisma } from './prisma'
import { classificarHook, type HookType } from './ml-hook-classifier'
import { classificarCta, type CtaType } from './ml-cta-classifier'
import type { MLDecisionType } from './ml-types'
import type { Granularidade, MotivoCliqueIndisponivel } from './metricas-clique'

export interface DesempenhoPorGrupo<T extends string> {
  grupo: T
  amostras: number
  /**
   * SEMPRE `null`. Hook e CTA são atributos do CRIATIVO, e não existe
   * atribuição `EventoLink → Conteudo` — o link aponta para produto. Somar
   * cliques por hook exigiria saber de qual conteúdo veio cada clique.
   *
   * Até o P0.3 isto somava `Conteudo.cliquesLink`, contador que produção
   * nunca incrementa: na prática somava zeros e a taxa nascia `null` por
   * acidente. Agora é `null` por decisão, e o tipo diz isso.
   */
  cliques: null
  vendasConfirmadas: number
  /** SEMPRE `null` pelo mesmo motivo — ver `cliques`. */
  taxaConversao: null
  taxaIndisponivelPorque: MotivoCliqueIndisponivel
  granularidade: Granularidade
  decisionType: MLDecisionType
}

/** Amostras mínimas por grupo para reportar uma taxa (nunca conclui algo de 1-2 publicações). */
export const MINIMO_AMOSTRAS_POR_GRUPO = 5

interface ConteudoParaAprendizado {
  roteiro: string | null
  chamadaAcao: string | null
  vendasConfirmadas: number
}

async function carregarConteudosComVendas(workspaceId: string): Promise<ConteudoParaAprendizado[]> {
  const conteudos = await prisma.conteudo.findMany({
    where: { workspaceId },
    select: {
      roteiro: true,
      chamadaAcao: true,
      sales: { where: { status: 'CONFIRMED' }, select: { id: true } },
    },
  })
  return conteudos.map((c) => ({
    roteiro: c.roteiro,
    chamadaAcao: c.chamadaAcao,
    vendasConfirmadas: c.sales.length,
  }))
}

function agruparEDescrever<T extends string>(
  itens: ConteudoParaAprendizado[],
  classificar: (item: ConteudoParaAprendizado) => T
): DesempenhoPorGrupo<T>[] {
  // O que dá para contar honestamente: quantas publicações caíram em cada
  // grupo, e quantas vendas confirmadas estão ligadas a elas por
  // `Sale.contentId`. Taxa POR CLIQUE não entra: faltaria o denominador.
  const grupos = new Map<T, { amostras: number; vendas: number }>()
  for (const item of itens) {
    const grupo = classificar(item)
    const atual = grupos.get(grupo) ?? { amostras: 0, vendas: 0 }
    atual.amostras += 1
    atual.vendas += item.vendasConfirmadas
    grupos.set(grupo, atual)
  }

  return [...grupos.entries()].map(([grupo, v]) => ({
    grupo,
    amostras: v.amostras,
    cliques: null,
    vendasConfirmadas: v.vendas,
    taxaConversao: null,
    taxaIndisponivelPorque: 'SEM_ATRIBUICAO_POR_CONTEUDO' as const,
    granularidade: 'CONTEUDO' as const,
    decisionType: 'STATISTICAL_LEARNING' as const,
  }))
}

/**
 * Desempenho por hook. `amostras` e `vendasConfirmadas` são reais;
 * `taxaConversao` fica `null` enquanto não houver atribuição por criativo
 * (`LIMITACAO_DE_ATRIBUICAO` em lib/metricas-clique.ts). `MINIMO_AMOSTRAS_
 * POR_GRUPO` continua declarado para quando a taxa voltar a ser calculável.
 */
export async function correlacionarHookComPerformance(workspaceId: string): Promise<DesempenhoPorGrupo<HookType>[]> {
  const itens = await carregarConteudosComVendas(workspaceId)
  const primeiraFrase = (roteiro: string | null) => roteiro?.split(/[.!?\n]/).find((s) => s.trim().length > 0) ?? null
  return agruparEDescrever(itens, (item) => classificarHook(primeiraFrase(item.roteiro)).tipo)
}

export async function correlacionarCtaComPerformance(workspaceId: string): Promise<DesempenhoPorGrupo<CtaType>[]> {
  const itens = await carregarConteudosComVendas(workspaceId)
  return agruparEDescrever(itens, (item) => classificarCta(item.chamadaAcao).tipo)
}

// ── Features do roteiro (regra 16) — RULE_BASED, extração pura ─────────

export interface ScriptFeatures {
  tamanhoCaracteres: number
  numeroPalavras: number
  posicaoRelativaDoCta: number | null // 0-1, quão perto do fim do roteiro o texto do CTA aparece
  contemProduto: boolean
}

export function extrairFeaturesDoRoteiro(roteiro: string | null, nomeProduto: string | null, chamadaAcao: string | null): ScriptFeatures {
  const texto = roteiro ?? ''
  const numeroPalavras = texto.trim().length > 0 ? texto.trim().split(/\s+/).length : 0
  const contemProduto = !!(nomeProduto && texto.toLowerCase().includes(nomeProduto.toLowerCase()))

  let posicaoRelativaDoCta: number | null = null
  if (chamadaAcao && texto.length > 0) {
    const idx = texto.toLowerCase().indexOf(chamadaAcao.toLowerCase())
    if (idx >= 0) posicaoRelativaDoCta = idx / texto.length
  }

  return { tamanhoCaracteres: texto.length, numeroPalavras, posicaoRelativaDoCta, contemProduto }
}
