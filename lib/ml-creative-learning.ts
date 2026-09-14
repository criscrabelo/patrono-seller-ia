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

export interface DesempenhoPorGrupo<T extends string> {
  grupo: T
  amostras: number
  cliques: number
  vendasConfirmadas: number
  taxaConversao: number | null
  decisionType: MLDecisionType
}

/** Amostras mínimas por grupo para reportar uma taxa (nunca conclui algo de 1-2 publicações). */
export const MINIMO_AMOSTRAS_POR_GRUPO = 5

interface ConteudoParaAprendizado {
  roteiro: string | null
  chamadaAcao: string | null
  cliquesLink: number
  vendasConfirmadas: number
}

async function carregarConteudosComVendas(workspaceId: string): Promise<ConteudoParaAprendizado[]> {
  const conteudos = await prisma.conteudo.findMany({
    where: { workspaceId },
    select: {
      roteiro: true,
      chamadaAcao: true,
      cliquesLink: true,
      sales: { where: { status: 'CONFIRMED' }, select: { id: true } },
    },
  })
  return conteudos.map((c) => ({
    roteiro: c.roteiro,
    chamadaAcao: c.chamadaAcao,
    cliquesLink: c.cliquesLink,
    vendasConfirmadas: c.sales.length,
  }))
}

function agruparEDescrever<T extends string>(
  itens: ConteudoParaAprendizado[],
  classificar: (item: ConteudoParaAprendizado) => T
): DesempenhoPorGrupo<T>[] {
  const grupos = new Map<T, { amostras: number; cliques: number; vendas: number }>()
  for (const item of itens) {
    const grupo = classificar(item)
    const atual = grupos.get(grupo) ?? { amostras: 0, cliques: 0, vendas: 0 }
    atual.amostras += 1
    atual.cliques += item.cliquesLink
    atual.vendas += item.vendasConfirmadas
    grupos.set(grupo, atual)
  }

  return [...grupos.entries()].map(([grupo, v]) => ({
    grupo,
    amostras: v.amostras,
    cliques: v.cliques,
    vendasConfirmadas: v.vendas,
    taxaConversao: v.amostras >= MINIMO_AMOSTRAS_POR_GRUPO && v.cliques > 0 ? v.vendas / v.cliques : null,
    decisionType: 'STATISTICAL_LEARNING' as const,
  }))
}

/** Nunca inventa taxa para um grupo com poucas amostras — `taxaConversao` fica `null` até `MINIMO_AMOSTRAS_POR_GRUPO`. */
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
