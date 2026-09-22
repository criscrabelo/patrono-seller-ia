/**
 * Métricas reais de clique e conversão (P0.3).
 *
 * ── O QUE A AUDITORIA ENCONTROU ─────────────────────────────────────────
 * `Conteudo.cliquesLink` NUNCA é escrito por código de produção — só por
 * fixtures de teste. Em operação ele vale 0 para sempre. Como
 * `calcularConversaoHistoricaPorCategoria()` dividia vendas por ele, a
 * feature `historical_conversion_rate` era `null` em 100% dos casos reais.
 *
 * Enquanto isso, `EventoLink` registra clique a clique, com workspace, link
 * e carimbo de tempo — é o log real, e estava sendo ignorado.
 *
 * ── UMA VERDADE, UMA FONTE ──────────────────────────────────────────────
 * `EventoLink` passa a ser a fonte primária de clique. Nenhum contador
 * incremental paralelo: contador que ninguém incrementa mente em silêncio,
 * e contador que alguém precisa lembrar de atualizar é trabalho manual
 * recorrente — dívida de automação, não métrica.
 *
 * ── ATÉ ONDE O DADO SUSTENTA ────────────────────────────────────────────
 * Não existe relação entre `EventoLink` e `Conteudo`. O caminho é
 * `EventoLink → LinkDinamico → Produto`. Um link aponta para um PRODUTO, e
 * vários conteúdos podem falar do mesmo produto.
 *
 * Logo: clique é atribuível a PRODUTO/CATEGORIA, nunca a conteúdo. Dizer
 * "este clique veio deste vídeo" exigiria heurística, e heurística aqui
 * seria uma causalidade inventada dentro de uma feature de treino. Por isso
 * a métrica para no nível que o dado sustenta, e isso está declarado em
 * `LIMITACAO_DE_ATRIBUICAO` no fim do arquivo.
 */

import { prisma } from './prisma'
import { avaliarVendaParaOperacaoReal } from './real-operation'

/** Só este tipo de evento é clique. Qualquer outro fica de fora. */
export const TIPO_DE_EVENTO_CLIQUE = 'clique'

/**
 * Divisão que nunca inventa número.
 *
 * Sem base, devolve `null` — "não sei" —, nunca `0`. Zero afirmaria que a
 * conversão foi medida e deu zero; `null` diz que não houve o que medir. A
 * diferença importa: o modelo trata `0` como sinal, e `null` como ausência.
 */
export function dividirOuNull(numerador: number, denominador: number): number | null {
  if (!Number.isFinite(numerador) || !Number.isFinite(denominador)) return null
  if (denominador <= 0) return null
  return numerador / denominador
}

export interface MetricasDeClique {
  /** Eventos de clique reais, do log. */
  cliques: number
  /** Vendas aprovadas pela autoridade de operação real. */
  vendasElegiveis: number
  /** `vendasElegiveis / cliques`. `null` quando não houve clique. */
  taxaConversao: number | null
  /** Soma do que foi efetivamente RECEBIDO nas vendas elegíveis. */
  receitaRealizada: number
  /** `receitaRealizada / cliques`. `null` quando não houve clique. */
  receitaPorClique: number | null
}

export interface JanelaDeMetrica {
  workspaceId: string
  /** Corte temporal: só conta o que aconteceu ANTES deste instante. */
  antesDe: Date
  /** Restringe a uma categoria de produto. Omitido = todas. */
  categoria?: string
  /**
   * Conteúdo a EXCLUIR das vendas. Obrigatório quando a métrica vira
   * feature de um conteúdo: sem isso ele vazaria o próprio resultado.
   */
  excluirContentId?: string | null
}

function dataValida(d: unknown): d is Date {
  return d instanceof Date && Number.isFinite(d.getTime())
}

/**
 * Conta cliques REAIS no log de eventos.
 *
 * Filtra por workspace (isolamento), tipo `clique` (um evento de outro tipo
 * não é clique) e instante anterior ao corte (nada do futuro). A categoria,
 * quando informada, é resolvida pelo caminho real link → produto.
 */
export async function contarCliquesReais(janela: JanelaDeMetrica): Promise<number> {
  if (!janela?.workspaceId?.trim() || !dataValida(janela?.antesDe)) return 0
  return prisma.eventoLink.count({
    where: {
      workspaceId: janela.workspaceId,
      tipo: TIPO_DE_EVENTO_CLIQUE,
      createdAt: { lt: janela.antesDe },
      ...(janela.categoria
        ? { link: { workspaceId: janela.workspaceId, produto: { categoria: janela.categoria } } }
        : {}),
    },
  })
}

interface VendaContada {
  id: string
  receitaRealizada: number
}

/**
 * Vendas que a AUTORIDADE aprova como operação real, dentro da janela.
 *
 * O filtro `dataOrigin: 'REAL_OPERATION'` na consulta é um pré-filtro, não
 * uma segunda versão da regra: a autoridade já EXIGE essa origem, então ele
 * só reduz o conjunto de candidatas, nunca amplia. Quem decide continua
 * sendo `avaliarVendaParaOperacaoReal()`, chamada uma vez por candidata —
 * inclusive para conferir evidência, comissão reconhecida e coerência de
 * workspace, que nenhuma cláusula de consulta saberia reproduzir.
 */
export async function listarVendasElegiveis(janela: JanelaDeMetrica): Promise<VendaContada[]> {
  if (!janela?.workspaceId?.trim() || !dataValida(janela?.antesDe)) return []

  const candidatas = await prisma.sale.findMany({
    where: {
      workspaceId: janela.workspaceId,
      dataOrigin: 'REAL_OPERATION',
      date: { lt: janela.antesDe },
      ...(janela.categoria ? { product: { categoria: janela.categoria } } : {}),
      // O próprio conteúdo nunca entra na sua própria feature histórica.
      //
      // O `OR` é necessário, não decorativo: em SQL, `contentId <> 'x'` é
      // NULL para linhas em que `contentId` é NULL, e NULL não satisfaz o
      // WHERE. Um `{ not: id }` sozinho descartaria TODAS as vendas sem
      // conteúdo — que são a maioria — e a métrica desabaria para zero.
      ...(janela.excluirContentId
        ? { OR: [{ contentId: null }, { contentId: { not: janela.excluirContentId } }] }
        : {}),
    },
    select: {
      id: true,
      commissions: { select: { status: true, receivedAmount: true } },
    },
  })

  const elegiveis: VendaContada[] = []
  for (const venda of candidatas) {
    const veredito = await avaliarVendaParaOperacaoReal(janela.workspaceId, venda.id)
    if (!veredito?.elegivel) continue
    // Receita REALIZADA: só o que foi recebido. Confirmada não é caixa.
    const receitaRealizada = venda.commissions.reduce(
      (soma, c) =>
        c.status === 'RECEIVED' && typeof c.receivedAmount === 'number' && Number.isFinite(c.receivedAmount)
          ? soma + c.receivedAmount
          : soma,
      0
    )
    elegiveis.push({ id: venda.id, receitaRealizada })
  }
  return elegiveis
}

/**
 * Métricas separadas — cliques, vendas, taxa e receita por clique.
 *
 * Os quatro números ficam distintos de propósito: uma taxa sozinha esconde
 * se ela veio de 1 clique ou de 10.000, e essa diferença decide se dá para
 * confiar nela.
 */
export async function calcularMetricasDeClique(janela: JanelaDeMetrica): Promise<MetricasDeClique> {
  const [cliques, vendas] = await Promise.all([contarCliquesReais(janela), listarVendasElegiveis(janela)])
  const receitaRealizada = vendas.reduce((s, v) => s + v.receitaRealizada, 0)
  return {
    cliques,
    vendasElegiveis: vendas.length,
    taxaConversao: dividirOuNull(vendas.length, cliques),
    receitaRealizada,
    receitaPorClique: dividirOuNull(receitaRealizada, cliques),
  }
}

/**
 * FILA DE AUTOMAÇÃO — limitação declarada, não escondida.
 *
 * O clique não se liga a conteúdo porque `LinkDinamico` aponta para produto,
 * e vários conteúdos podem divulgar o mesmo produto. Para medir conversão
 * POR CRIATIVO seria preciso um link por conteúdo (ou um parâmetro de
 * origem no redirect), o que é mudança de modelo — não de cálculo.
 *
 * Enquanto isso não existir, a métrica para em produto/categoria. É menos
 * preciso e é verdadeiro; o contrário seria mais preciso e inventado.
 */
export const LIMITACAO_DE_ATRIBUICAO = {
  chave: 'metricas:clique-por-conteudo',
  explicacao:
    'Cliques são atribuíveis a produto/categoria, nunca a um conteúdo específico: LinkDinamico aponta para produto e vários conteúdos divulgam o mesmo produto. Medir conversão por criativo exige um link por conteúdo ou um parâmetro de origem no redirect.',
  nivelSustentadoHoje: 'PRODUTO_CATEGORIA',
} as const

/**
 * `Conteudo.cliquesLink` é LEGADO e não deve ser lido como contagem de
 * clique. Nenhum código de produção o incrementa — em operação vale 0 —, e
 * a coluna permanece no schema só para não quebrar registros antigos.
 *
 * A contagem confiável vem de `contarCliquesReais()`.
 */
export const CLIQUES_LINK_E_LEGADO = true
