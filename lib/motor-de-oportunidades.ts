/**
 * Motor de Oportunidades Reais (P1.1).
 *
 * Transforma o catálogo que JÁ EXISTE numa fila priorizada: quais produtos
 * valem uma publicação agora, por quê, e quais estão de fato prontos para
 * virar conteúdo.
 *
 * ── NÃO É UM SCORE NOVO ─────────────────────────────────────────────────
 * A fórmula final continua sendo `calcularOpportunityScoreComposto()`, em
 * lib/opportunity-score-composite.ts. Este módulo não inventa uma segunda
 * nota concorrente: ele ALIMENTA a que existe com dados reais do catálogo e
 * do histórico de publicações, e acrescenta o que a nota sozinha não diz —
 * se a oportunidade está pronta para publicar.
 *
 * ── AS DUAS PERGUNTAS SÃO DIFERENTES ────────────────────────────────────
 *   OPORTUNIDADE_COMERCIAL   vale a pena vender isto?
 *   PRONTA_PARA_PUBLICACAO   dá para fazer conteúdo disto hoje, legalmente?
 *
 * Um produto com comissão ótima e mídia sem direito de uso é a primeira
 * coisa e não é a segunda. Misturar as duas produziria uma fila que manda
 * publicar o que não pode ser publicado.
 *
 * ── NADA SINTÉTICO ──────────────────────────────────────────────────────
 * Só produto real do catálogo entra. `SEED`, `TEST_FIXTURE`, `DEMO` e
 * `SYNTHETIC_TEST` são recusados por construção — a fila de produção não
 * pode recomendar um produto que não existe para vender.
 *
 * ── CAMPO AUSENTE É `null` ──────────────────────────────────────────────
 * Cada provider entrega um subconjunto diferente. O que não vier fica
 * `null` e aparece em `dadosAusentes`, nunca preenchido com média, zero ou
 * palpite. A confiança cai; o número não mente.
 */

import { prisma } from './prisma'
import {
  calcularOpportunityScoreComposto,
  type OpportunityScoreComponents,
} from './opportunity-score-composite'
import type { AffiliateOpportunity, OrigemOportunidade } from './affiliate-discovery'
import { produtoPodeAparecerNoVideo } from './media-rights-produto'
import { ML_DATA_ORIGINS } from './ml-types'
import { calcularMetricasPorProduto } from './metricas-clique'

// ── Vocabulário ─────────────────────────────────────────────────────────

export const CLASSIFICACOES = ['PRONTA_PARA_PUBLICACAO', 'OPORTUNIDADE_COMERCIAL', 'NAO_ELEGIVEL'] as const
export type ClassificacaoDaOportunidade = (typeof CLASSIFICACOES)[number]

export const NIVEIS_DE_CONFIANCA = ['ALTA', 'MEDIA', 'BAIXA', 'SEM_HISTORICO_REAL'] as const
export type NivelDeConfianca = (typeof NIVEIS_DE_CONFIANCA)[number]

/**
 * Por que um produto não está pronto para publicação. Cada motivo aponta
 * para uma ação concreta — nenhum é "não deu".
 */
export const MOTIVOS_NAO_PRONTA = [
  /** `Produto.status` não é ativo, ou o provider removeu da origem. */
  'INDISPONIVEL',
  /** Sem imagem, ou mídia sem direito de uso verificado. */
  'MIDIA_SEM_DIREITO',
  /** Sem URL de destino: não há para onde mandar o clique. */
  'SEM_DESTINO',
  /** Nenhum canal do workspace consegue publicar isto hoje. */
  'SEM_CANAL_CAPAZ',
] as const
export type MotivoNaoPronta = (typeof MOTIVOS_NAO_PRONTA)[number]

/** Origens de REGISTRO que nunca viram oportunidade de produção. */
export const ORIGENS_SINTETICAS = ML_DATA_ORIGINS.filter((o) => o !== 'REAL_OPERATION')

/**
 * `Produto.origemDados` → proveniência da oportunidade.
 *
 * Mapa explícito: origem desconhecida vira `MANUAL`, o nível mais baixo de
 * confiança que ainda é real, nunca `OFFICIAL_API`. Promover confiança por
 * omissão seria exatamente o erro que o P0.2 eliminou nas vendas.
 */
export const ORIGEM_DO_REGISTRO_PARA_OPORTUNIDADE: Record<string, OrigemOportunidade> = {
  MANUAL: 'MANUAL',
  USER_PROVIDED: 'USER_PROVIDED',
  TIKTOK_SHOWCASE: 'AFFILIATE_PORTAL_IMPORT',
  SHOPEE_API: 'OFFICIAL_API',
  AMAZON_PA_API: 'OFFICIAL_API',
  MERCADO_LIVRE_API: 'OFFICIAL_API',
}

export function origemDaOportunidade(origemDados: string | null | undefined): OrigemOportunidade {
  const chave = (origemDados ?? '').trim().toUpperCase()
  return ORIGEM_DO_REGISTRO_PARA_OPORTUNIDADE[chave] ?? 'MANUAL'
}

// ── Desempenho histórico REAL ───────────────────────────────────────────

/** Janela em que uma publicação ainda conta como "recente" para saturação. */
export const JANELA_DE_SATURACAO_DIAS = 14
/** A partir daqui, publicar de novo o mesmo produto começa a render menos. */
export const PUBLICACOES_ANTES_DE_SATURAR = 3
/** Cliques mínimos para a taxa observada valer como sinal. */
export const CLIQUES_MINIMOS_PARA_HISTORICO = 5

export interface DesempenhoHistorico {
  /** 0–100, ou `null` quando não há base real. Vai para o score composto. */
  nota: number | null
  taxaConversao: number | null
  receitaPorClique: number | null
  cliques: number
  vendasElegiveis: number
  /** Publicações deste produto na janela de saturação. */
  publicacoesRecentes: number
  /** Multiplicador aplicado por excesso de publicação. 1 = sem penalidade. */
  fatorDeSaturacao: number
  partes: string[]
}

/**
 * FUNÇÃO PURA. Nota de desempenho a partir de observação real.
 *
 * Duas metades, ambas medidas: a taxa de conversão e a receita por clique.
 * A saturação entra aqui, e não como número separado, porque ela É um fato
 * observado — publicar a mesma coisa cinco vezes em duas semanas rende
 * menos, e isso aparece no desempenho, não num segundo placar.
 *
 * Sem cliques suficientes devolve `null`, nunca 0. O score composto então
 * reequilibra os pesos entre os componentes que existem — que é o
 * comportamento que ele já tinha para cold start.
 */
export function calcularDesempenhoHistorico(entrada: {
  taxaConversao: number | null
  receitaPorClique: number | null
  cliques: number
  vendasElegiveis: number
  publicacoesRecentes: number
}): DesempenhoHistorico {
  const partes: string[] = []
  const publicacoesRecentes = Math.max(0, entrada?.publicacoesRecentes ?? 0)

  // Saturação vale mesmo sem histórico de clique: ela mede repetição, não
  // resultado.
  const excesso = Math.max(0, publicacoesRecentes - PUBLICACOES_ANTES_DE_SATURAR)
  const fatorDeSaturacao = excesso === 0 ? 1 : Math.max(0.5, 1 - excesso * 0.1)
  if (excesso > 0) {
    partes.push(
      `saturação: ${publicacoesRecentes} publicações nos últimos ${JANELA_DE_SATURACAO_DIAS} dias reduzem a nota em ${Math.round((1 - fatorDeSaturacao) * 100)}%`
    )
  }

  if ((entrada?.cliques ?? 0) < CLIQUES_MINIMOS_PARA_HISTORICO) {
    partes.push(
      `sem base real: ${entrada?.cliques ?? 0} clique(s) medido(s), mínimo ${CLIQUES_MINIMOS_PARA_HISTORICO}`
    )
    return {
      nota: null,
      taxaConversao: entrada?.taxaConversao ?? null,
      receitaPorClique: entrada?.receitaPorClique ?? null,
      cliques: entrada?.cliques ?? 0,
      vendasElegiveis: entrada?.vendasElegiveis ?? 0,
      publicacoesRecentes,
      fatorDeSaturacao,
      partes,
    }
  }

  // Conversão: 5% já pontua no teto. Acima disso o ganho marginal é ruído.
  const notaConversao =
    entrada.taxaConversao === null ? null : Math.min(100, (entrada.taxaConversao / 0.05) * 100)
  // Receita por clique: R$ 2,00 por clique é excelente para afiliado.
  const notaReceita =
    entrada.receitaPorClique === null ? null : Math.min(100, (entrada.receitaPorClique / 2) * 100)

  const disponiveis = [notaConversao, notaReceita].filter((n): n is number => n !== null)
  if (disponiveis.length === 0) {
    partes.push('cliques medidos, mas sem conversão nem receita observadas')
    return {
      nota: null,
      taxaConversao: entrada.taxaConversao,
      receitaPorClique: entrada.receitaPorClique,
      cliques: entrada.cliques,
      vendasElegiveis: entrada.vendasElegiveis,
      publicacoesRecentes,
      fatorDeSaturacao,
      partes,
    }
  }

  const media = disponiveis.reduce((s, n) => s + n, 0) / disponiveis.length
  const nota = Math.round(media * fatorDeSaturacao)
  if (notaConversao !== null) partes.push(`conversão observada ${(entrada.taxaConversao! * 100).toFixed(2)}%`)
  if (notaReceita !== null) partes.push(`receita por clique R$ ${entrada.receitaPorClique!.toFixed(2)}`)
  partes.push(`base: ${entrada.cliques} clique(s), ${entrada.vendasElegiveis} venda(s) elegível(is)`)

  return {
    nota,
    taxaConversao: entrada.taxaConversao,
    receitaPorClique: entrada.receitaPorClique,
    cliques: entrada.cliques,
    vendasElegiveis: entrada.vendasElegiveis,
    publicacoesRecentes,
    fatorDeSaturacao,
    partes,
  }
}

// ── Confiança ───────────────────────────────────────────────────────────

/**
 * FUNÇÃO PURA. Quanta fé se pode ter nesta posição da fila.
 *
 * `SEM_HISTORICO_REAL` é um nível próprio, e não "baixa": produto novo não
 * tem desempenho ruim, tem desempenho desconhecido. As duas coisas levam a
 * decisões diferentes — uma pede substituição, a outra pede teste.
 */
export function classificarConfianca(p: {
  temHistoricoReal: boolean
  dadosAusentes: string[]
  origem: OrigemOportunidade
}): NivelDeConfianca {
  if (!p.temHistoricoReal) return 'SEM_HISTORICO_REAL'
  const oficial = p.origem === 'OFFICIAL_API' || p.origem === 'AUTHORIZED_PARTNER_API'
  if (p.dadosAusentes.length === 0 && oficial) return 'ALTA'
  if (p.dadosAusentes.length <= 2) return 'MEDIA'
  return 'BAIXA'
}

// ── Receita potencial ───────────────────────────────────────────────────

/**
 * FUNÇÃO PURA. Estimativa de receita — só com base real, e sempre rotulada.
 *
 * Exige preço, comissão e taxa de conversão OBSERVADA. Faltando qualquer
 * uma, devolve `null`. Uma estimativa com conversão chutada não é
 * estimativa, é ficção com casas decimais.
 */
export function estimarReceitaPotencial(p: {
  preco: number | null
  comissaoPercentual: number | null
  taxaConversao: number | null
  cliquesEsperados?: number
}): { valor: number | null; base: string } {
  if (p.preco === null || p.comissaoPercentual === null || p.taxaConversao === null) {
    return { valor: null, base: 'SEM_BASE_REAL_SUFICIENTE' }
  }
  const cliques = p.cliquesEsperados ?? 100
  const valor = p.preco * (p.comissaoPercentual / 100) * p.taxaConversao * cliques
  return {
    valor: Math.round(valor * 100) / 100,
    base: `ESTIMATIVA: ${cliques} cliques × conversão observada ${(p.taxaConversao * 100).toFixed(2)}% × comissão ${p.comissaoPercentual}% sobre R$ ${p.preco.toFixed(2)}`,
  }
}

// ── Prontidão ───────────────────────────────────────────────────────────

export interface VereditoDeProntidao {
  classificacao: ClassificacaoDaOportunidade
  motivos: MotivoNaoPronta[]
  explicacoes: string[]
}

/**
 * FUNÇÃO PURA. Separa "vale vender" de "dá para publicar hoje".
 *
 * Produto indisponível não é nem uma coisa nem outra. Produto disponível
 * com mídia sem direito é oportunidade comercial — a dona pode divulgar do
 * jeito dela —, mas o robô não gera conteúdo com a imagem dele.
 */
export function classificarProntidao(p: {
  disponivel: boolean
  temDestino: boolean
  midiaAutorizada: boolean
  motivoDaMidia: string
  canaisCapazes: string[]
}): VereditoDeProntidao {
  const motivos: MotivoNaoPronta[] = []
  const explicacoes: string[] = []

  if (!p.disponivel) {
    motivos.push('INDISPONIVEL')
    explicacoes.push('Produto inativo ou removido da origem — não entra na fila de publicação.')
    return { classificacao: 'NAO_ELEGIVEL', motivos, explicacoes }
  }

  if (!p.temDestino) {
    motivos.push('SEM_DESTINO')
    explicacoes.push('Sem URL de destino cadastrada: não há para onde mandar o clique.')
  }
  if (!p.midiaAutorizada) {
    motivos.push('MIDIA_SEM_DIREITO')
    explicacoes.push(p.motivoDaMidia)
  }
  if (p.canaisCapazes.length === 0) {
    motivos.push('SEM_CANAL_CAPAZ')
    explicacoes.push('Nenhum canal conectado consegue publicar este produto hoje.')
  }

  return {
    classificacao: motivos.length === 0 ? 'PRONTA_PARA_PUBLICACAO' : 'OPORTUNIDADE_COMERCIAL',
    motivos,
    explicacoes,
  }
}

// ── A oportunidade pontuada ─────────────────────────────────────────────

export interface OportunidadePontuada {
  workspaceId: string
  produtoId: string
  produtoNome: string
  provider: string | null
  categoria: string
  origem: OrigemOportunidade

  /** A nota do motor existente. Nunca há uma segunda nota concorrente. */
  score: number
  componentes: OpportunityScoreComponents
  desempenho: DesempenhoHistorico

  classificacao: ClassificacaoDaOportunidade
  motivosDeProntidao: MotivoNaoPronta[]
  canaisElegiveis: string[]

  confianca: NivelDeConfianca
  dadosUsados: string[]
  dadosAusentes: string[]
  /** Por que está nesta posição, em frases. */
  porqueDestaPosicao: string[]

  receitaPotencialEstimada: number | null
  baseDaEstimativa: string
}

/** Campos que o score usa. O que não vier fica em `dadosAusentes`. */
const CAMPOS_RELEVANTES = [
  'preco',
  'comissaoPercentual',
  'taxaConversaoObservada',
  'receitaPorClique',
  'provider',
  'imagens',
  'linkProduto',
] as const

export interface ProdutoDoCatalogo {
  id: string
  nome: string
  categoria: string
  preco: number | null
  linkProduto: string | null
  imagens: string[]
  origemConteudo: string
  origemDados: string | null
  providerId: string | null
  status: string
  removidoDaOrigemEm: Date | null
  createdAt: Date
  /** Taxa da oferta, quando algum link do produto a registra. */
  comissaoPercentual: number | null
}

export interface ContextoDoWorkspace {
  /** Canais conectados que conseguem publicar hoje. */
  canaisCapazes: string[]
  agora: Date
}

/**
 * FUNÇÃO PURA. Pontua UM produto real.
 *
 * Determinística: os mesmos dados produzem exatamente o mesmo score. Nada
 * de `Math.random`, nada de `Date.now()` dentro do cálculo — o instante
 * entra por `contexto.agora` para que o resultado seja reproduzível.
 */
export function pontuarProduto(
  produto: ProdutoDoCatalogo,
  desempenho: DesempenhoHistorico,
  contexto: ContextoDoWorkspace
): OportunidadePontuada {
  const dadosUsados: string[] = []
  const dadosAusentes: string[] = []
  const registrar = (campo: string, presente: boolean) =>
    presente ? dadosUsados.push(campo) : dadosAusentes.push(campo)

  registrar('preco', produto.preco !== null)
  registrar('comissaoPercentual', produto.comissaoPercentual !== null)
  registrar('taxaConversaoObservada', desempenho.taxaConversao !== null)
  registrar('receitaPorClique', desempenho.receitaPorClique !== null)
  registrar('provider', !!produto.providerId)
  registrar('imagens', produto.imagens.length > 0)
  registrar('linkProduto', !!produto.linkProduto)

  const disponivel = produto.status === 'ativo' && produto.removidoDaOrigemEm === null
  const midia = produtoPodeAparecerNoVideo({
    id: produto.id,
    nome: produto.nome,
    origemConteudo: produto.origemConteudo,
    imagens: produto.imagens,
    origemDados: produto.origemDados ?? undefined,
  })

  const prontidao = classificarProntidao({
    disponivel,
    temDestino: !!produto.linkProduto,
    midiaAutorizada: midia.visivel,
    motivoDaMidia: midia.motivo,
    canaisCapazes: contexto.canaisCapazes,
  })

  const origem = origemDaOportunidade(produto.origemDados)
  const comissaoEstimadaBRL =
    produto.preco !== null && produto.comissaoPercentual !== null
      ? produto.preco * (produto.comissaoPercentual / 100)
      : null

  // NOVIDADE: produto recém-cadastrado ainda não teve chance. Isso entra
  // como `trending` indefinido — nunca como `true`, que afirmaria uma
  // tendência que ninguém mediu.
  const diasNoCatalogo = Math.floor(
    (contexto.agora.getTime() - produto.createdAt.getTime()) / (24 * 60 * 60 * 1000)
  )

  const oportunidade: AffiliateOpportunity = {
    providerId: produto.providerId ?? 'MANUAL',
    productName: produto.nome,
    category: produto.categoria,
    price: produto.preco,
    commissionPercent: produto.comissaoPercentual,
    estimatedCommissionBRL: comissaoEstimadaBRL,
    salesVolumeRank: null,
    trending: null,
    historicalConversionRate: desempenho.taxaConversao,
    channelFit: contexto.canaisCapazes,
    origin: origem,
    source: produto.providerId ?? 'catalogo-interno',
    lastVerifiedAt: contexto.agora.toISOString(),
    canGenerateLinkAutomatically: !!produto.linkProduto,
    authorizedMediaAvailable: midia.visivel,
    canGenerateContent: prontidao.classificacao === 'PRONTA_PARA_PUBLICACAO',
    canAutoPublish: false,
    requiresUserConsent: true,
    rulesConfidence: origem === 'OFFICIAL_API' ? 'HIGH' : 'MEDIUM',
    automationCost: 'FREE',
  }

  // A NOTA vem do motor que já existe. Este módulo não calcula outra.
  const componentes = calcularOpportunityScoreComposto(oportunidade, {
    historicalPerformance: desempenho.nota,
    mlPrediction: null,
  })

  const confianca = classificarConfianca({
    temHistoricoReal: desempenho.nota !== null,
    dadosAusentes,
    origem,
  })

  const receita = estimarReceitaPotencial({
    preco: produto.preco,
    comissaoPercentual: produto.comissaoPercentual,
    taxaConversao: desempenho.taxaConversao,
  })

  const porqueDestaPosicao = [
    `Sinais de mercado: ${componentes.externalMarketSignals}/100.`,
    `Capacidade de automatizar: ${componentes.automationFeasibility}/100.`,
    desempenho.nota === null
      ? 'Sem histórico real suficiente — a nota vem só do que dá para saber antes de publicar.'
      : `Desempenho observado: ${desempenho.nota}/100.`,
    ...desempenho.partes,
    ...prontidao.explicacoes,
    diasNoCatalogo <= 7 ? `Produto novo no catálogo (${diasNoCatalogo} dia(s)) — ainda sem chance de provar.` : '',
  ].filter(Boolean)

  return {
    workspaceId: '',
    produtoId: produto.id,
    produtoNome: produto.nome,
    provider: produto.providerId,
    categoria: produto.categoria,
    origem,
    score: componentes.final,
    componentes,
    desempenho,
    classificacao: prontidao.classificacao,
    motivosDeProntidao: prontidao.motivos,
    canaisElegiveis: prontidao.classificacao === 'PRONTA_PARA_PUBLICACAO' ? contexto.canaisCapazes : [],
    confianca,
    dadosUsados,
    dadosAusentes,
    porqueDestaPosicao,
    receitaPotencialEstimada: receita.valor,
    baseDaEstimativa: receita.base,
  }
}

// ── Leitura do catálogo real ────────────────────────────────────────────

/**
 * Monta a fila do workspace, do mais promissor ao menos.
 *
 * SÓ produto real: `status` diferente de descartado e origem de registro
 * que não seja sintética. Nada é criado, publicado ou alterado aqui — o
 * motor é somente leitura.
 */
export async function montarFilaDeOportunidades(params: {
  workspaceId: string
  agora?: Date
  /** Canais que conseguem publicar. Sem isso, nada fica PRONTA. */
  canaisCapazes?: string[]
  limite?: number
}): Promise<OportunidadePontuada[]> {
  const workspaceId = (params?.workspaceId ?? '').trim()
  if (!workspaceId) return []
  const agora = params?.agora ?? new Date()

  const produtos = await prisma.produto.findMany({
    where: {
      workspaceId,
      status: { not: 'descartado' },
      // Produto sintético NUNCA entra na fila de produção. `origemDados` é
      // NOT NULL com default 'MANUAL', então um `notIn` já cobre todo o
      // catálogo real — não há linha sem valor para tratar à parte.
      origemDados: { notIn: [...ORIGENS_SINTETICAS] },
    },
    select: {
      id: true,
      nome: true,
      categoria: true,
      preco: true,
      linkProduto: true,
      imagens: true,
      origemConteudo: true,
      origemDados: true,
      providerId: true,
      status: true,
      removidoDaOrigemEm: true,
      createdAt: true,
      linksDinamicos: { select: { comissao: true }, take: 5 },
    },
  })
  if (produtos.length === 0) return []

  // Métricas reais por produto, na granularidade que fecha numerador com
  // denominador (ver lib/metricas-clique.ts).
  const metricas = await calcularMetricasPorProduto(
    workspaceId,
    produtos.map((p) => p.id),
    agora
  )
  const porProduto = new Map(metricas.map((m) => [m.produtoId, m]))

  // Saturação: publicações distribuídas de cada produto na janela.
  const desde = new Date(agora.getTime() - JANELA_DE_SATURACAO_DIAS * 24 * 60 * 60 * 1000)
  const recentes = await prisma.publicacao.groupBy({
    by: ['contentId'],
    where: { workspaceId, estado: 'DISTRIBUIDA', distribuidaEm: { gte: desde, lt: agora } },
    _count: { _all: true },
  })
  const conteudos = await prisma.conteudo.findMany({
    where: { workspaceId, id: { in: recentes.map((r) => r.contentId) } },
    select: { id: true, produtoId: true },
  })
  const produtoDoConteudo = new Map(conteudos.map((c) => [c.id, c.produtoId]))
  const publicacoesPorProduto = new Map<string, number>()
  for (const r of recentes) {
    const pid = produtoDoConteudo.get(r.contentId)
    if (!pid) continue
    publicacoesPorProduto.set(pid, (publicacoesPorProduto.get(pid) ?? 0) + r._count._all)
  }

  const contexto: ContextoDoWorkspace = {
    canaisCapazes: params?.canaisCapazes ?? [],
    agora,
  }

  const fila = produtos.map((p) => {
    const m = porProduto.get(p.id)
    const desempenho = calcularDesempenhoHistorico({
      taxaConversao: m?.taxaConversao ?? null,
      receitaPorClique: m?.receitaPorClique ?? null,
      cliques: m?.cliques ?? 0,
      vendasElegiveis: m?.vendasElegiveis ?? 0,
      publicacoesRecentes: publicacoesPorProduto.get(p.id) ?? 0,
    })

    // A taxa da oferta vem do link, que é onde ela é registrada.
    const comissoes = p.linksDinamicos.map((l) => l.comissao).filter((c): c is number => typeof c === 'number')
    const comissaoPercentual = comissoes.length > 0 ? comissoes[0] : null

    const pontuada = pontuarProduto(
      { ...p, comissaoPercentual },
      desempenho,
      contexto
    )
    return { ...pontuada, workspaceId }
  })

  // Ordem: score desc. Empate desempata por confiança — entre duas notas
  // iguais, a que se apoia em dado real vem primeiro.
  const pesoDaConfianca: Record<NivelDeConfianca, number> = {
    ALTA: 3,
    MEDIA: 2,
    BAIXA: 1,
    SEM_HISTORICO_REAL: 0,
  }
  fila.sort(
    (a, b) => b.score - a.score || pesoDaConfianca[b.confianca] - pesoDaConfianca[a.confianca]
  )

  return typeof params?.limite === 'number' ? fila.slice(0, params.limite) : fila
}

// ── Detecção de mudança ─────────────────────────────────────────────────

export interface MudancaNaFila {
  novas: string[]
  queda: { produtoId: string; de: number; para: number }[]
  alta: { produtoId: string; de: number; para: number }[]
}

/**
 * FUNÇÃO PURA. O que mudou entre duas execuções.
 *
 * É o que permite o motor rodar sozinho e avisar só quando há novidade —
 * em vez de obrigar alguém a reler a fila inteira todo dia.
 */
export function compararFilas(
  anterior: { produtoId: string; score: number }[],
  atual: { produtoId: string; score: number }[],
  limiar = 10
): MudancaNaFila {
  const antes = new Map(anterior.map((o) => [o.produtoId, o.score]))
  const novas: string[] = []
  const queda: MudancaNaFila['queda'] = []
  const alta: MudancaNaFila['alta'] = []

  for (const o of atual) {
    const de = antes.get(o.produtoId)
    if (de === undefined) {
      novas.push(o.produtoId)
      continue
    }
    const delta = o.score - de
    if (delta <= -limiar) queda.push({ produtoId: o.produtoId, de, para: o.score })
    else if (delta >= limiar) alta.push({ produtoId: o.produtoId, de, para: o.score })
  }
  return { novas, queda, alta }
}

/**
 * FILA DE AUTOMAÇÃO — o que esta rodada deliberadamente NÃO faz.
 *
 * O motor recomenda; ninguém publica sozinho. Ligar a publicação autônoma
 * exige o Revenue Autopilot, que tem portão próprio e não é desta rodada.
 */
export const MOTOR_NAO_PUBLICA = {
  chave: 'motor-de-oportunidades:publicacao-autonoma',
  estado: 'DELIBERADAMENTE_FORA_DE_ESCOPO',
  porque:
    'Recomendar e publicar são decisões diferentes. A fila prioriza; a publicação autônoma depende do Revenue Autopilot e do consentimento da dona.',
  desbloqueiaCom: 'REVENUE_AUTOPILOT',
} as const
