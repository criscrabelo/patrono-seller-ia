/**
 * P2.14.5.13 — Fase 2: curadoria de produtos.
 *
 *   Patrono encontra candidatos → ranqueia → mostra os 3 melhores →
 *   titular escolhe 1 → Patrono cadastra o produto.
 *
 * O ranking é o do motor de oportunidades EXISTENTE
 * (lib/motor-de-oportunidades.ts: `montarFilaDeOportunidades`,
 * `pontuarProduto`, `ordenarFila`, `selecionarParaModo`). Este módulo não
 * calcula score: só grava o retrato do motor e cuida do ciclo de vida do
 * candidato.
 *
 * Fontes nesta fase: catálogo real do workspace e produtos informados pela
 * titular ("Informar produto", fallback). Sem scraping, sem ranking externo
 * inventado, sem vendas/comissão inventadas.
 *
 * Nada aqui muda `automationMode`/`automationPaused`, cria tarefa, gera
 * conteúdo, publica ou chama IA.
 */

import { randomUUID } from 'node:crypto'
import type { CandidatoDeProduto, Prisma } from '@prisma/client'
import { prisma } from './prisma'
import {
  calcularDesempenhoHistorico,
  comissaoDaOferta,
  montarFilaDeOportunidades,
  ordenarFila,
  pontuarProduto,
  selecionarParaModo,
  type OportunidadePontuada,
  type ProdutoDoCatalogo,
} from './motor-de-oportunidades'
import { obterPerfilDaLoja } from './perfil-da-loja'
import { registrarAuditoria } from './audit-log'

// ── Vocabulário ─────────────────────────────────────────────────────────

export const FONTE_CATALOGO = 'CATALOGO'
export const FONTE_TITULAR = 'USER_PROVIDED'

/** Status que tiram o candidato da tela (DESCARTADO só por 30 dias). */
export const STATUS_TERMINAIS = ['ESCOLHIDO', 'DESCARTADO', 'CADASTRADO'] as const
/** Encerrados para sempre: já viraram (ou já eram) Produto escolhido. */
export const STATUS_DEFINITIVOS = ['ESCOLHIDO', 'CADASTRADO'] as const

/**
 * P2.14.5.13.1 — DESCARTADO não é permanente: fica fora das coletas por 30
 * dias e depois pode voltar a concorrer, se ainda for elegível. O início da
 * quarentena é o `updatedAt` do candidato (a última escrita é o descarte:
 * coleta e escolha não tocam em candidato descartado). Se algo o atualizar,
 * a quarentena só fica mais longa — nunca mais curta.
 */
export const QUARENTENA_DO_DESCARTE_DIAS = 30

const HORA = 60 * 60 * 1000
const DIA = 24 * HORA

/** Validade por tipo de fonte (decisão da titular em 08/10/2026). */
export const VALIDADE_POR_TIPO = {
  /** Fonte oficial/externa com dados de mercado. */
  EXTERNA: 48 * HORA,
  CATALOGO: 7 * DIA,
  USER_PROVIDED: 7 * DIA,
} as const
export type TipoDeFonte = keyof typeof VALIDADE_POR_TIPO

/**
 * FUNÇÃO PURA. Fim da validade do candidato. Se a fonte trouxer validade
 * própria MENOR, vale a menor.
 */
export function calcularValidade(p: { tipo: TipoDeFonte; coletadoEm: Date; validadeDaFonte?: Date | null }): Date {
  const padrao = new Date(p.coletadoEm.getTime() + VALIDADE_POR_TIPO[p.tipo])
  if (p.validadeDaFonte && p.validadeDaFonte.getTime() < padrao.getTime()) return new Date(p.validadeDaFonte)
  return padrao
}

/** FUNÇÃO PURA. Tipo de fonte de um produto do catálogo, pela origem do registro. */
export function tipoDeFonteDoCatalogo(o: Pick<OportunidadePontuada, 'origem'>, origemDados: string | null): TipoDeFonte {
  if (o.origem === 'OFFICIAL_API' || o.origem === 'AUTHORIZED_PARTNER_API') return 'EXTERNA'
  if ((origemDados ?? '').toUpperCase() === FONTE_TITULAR) return 'USER_PROVIDED'
  return 'CATALOGO'
}

/** Início da janela de quarentena: quem foi descartado depois disto ainda está fora. */
export function inicioDaQuarentena(agora: Date): Date {
  return new Date(agora.getTime() - QUARENTENA_DO_DESCARTE_DIAS * DIA)
}

/**
 * FUNÇÃO PURA. O candidato pode voltar a concorrer?
 *
 * Ponto de extensão (fase futura): reavaliar ANTES dos 30 dias quando
 * preço, comissão, disponibilidade ou outro dado relevante mudar. Nesta
 * fase vale só a quarentena.
 */
export function podeVoltarAConcorrer(c: Pick<CandidatoDeProduto, 'status' | 'updatedAt'>, agora: Date): boolean {
  if ((STATUS_DEFINITIVOS as readonly string[]).includes(c.status)) return false
  if (c.status === 'DESCARTADO') return c.updatedAt.getTime() <= inicioDaQuarentena(agora).getTime()
  return true
}

/**
 * FUNÇÃO PURA. Comprou OU usou → USER_PROVIDED (o produto é da experiência
 * da titular). Nenhum dos dois → MANUAL, como qualquer cadastro à mão. Os
 * dois sinais continuam separados na afinidade (comprado +5 OU usado +10).
 */
export function origemDoInformado(c: { compradoPelaTitular: boolean; usadoPelaTitular: boolean }): string {
  return c.compradoPelaTitular || c.usadoPelaTitular ? FONTE_TITULAR : 'MANUAL'
}

// ── Retrato do motor → candidato ────────────────────────────────────────

/** Dados reais do item, como a fonte os entrega. Ausente = null. */
export interface DadosReaisDoItem {
  nome: string
  linkProduto: string | null
  imagem: string | null
  categoria: string | null
  preco: number | null
  providerId: string | null
  externalId: string | null
  comissaoPercentual: number | null
  /** A fonte informa? Catálogo interno e titular: não → null. */
  vendas: number | null
  velocidadeDeVendas: number | null
  avaliacao: number | null
  numeroDeAvaliacoes: number | null
  estoque: number | null
}

export type RetratoDoCandidato = Omit<
  Prisma.CandidatoDeProdutoUncheckedCreateInput,
  'id' | 'workspaceId' | 'chaveDeOrigem' | 'fonte' | 'produtoId' | 'status' | 'posicao' | 'createdAt' | 'updatedAt'
>

/**
 * FUNÇÃO PURA. Grava o que o motor sabia — sem completar nada. Comissão em
 * R$ só quando preço E percentual são reais.
 */
export function retratoDoCandidato(
  o: OportunidadePontuada,
  item: DadosReaisDoItem,
  datas: { coletadoEm: Date; validoAte: Date }
): RetratoDoCandidato {
  const comissaoValor =
    item.preco !== null && item.comissaoPercentual !== null
      ? Math.round(item.preco * item.comissaoPercentual) / 100
      : null
  return {
    providerId: item.providerId,
    externalId: item.externalId,
    nome: item.nome,
    linkProduto: item.linkProduto,
    imagem: item.imagem,
    // Imagem só conta como autorizada se existe E o motor não impediu a mídia.
    imagemAutorizada: item.imagem !== null && o.publicacaoImpedida === false,
    categoria: item.categoria,
    preco: item.preco,
    comissaoPercentual: item.comissaoPercentual,
    comissaoValor,
    vendas: item.vendas,
    velocidadeDeVendas: item.velocidadeDeVendas,
    avaliacao: item.avaliacao,
    numeroDeAvaliacoes: item.numeroDeAvaliacoes,
    estoque: item.estoque,
    score: o.score,
    baseDeEvidencia: o.componentes.base,
    aderencia: o.componentes.aderenciaAoPerfil,
    aderenciaDoPerfil: o.aderenciaDoPerfil ?? null,
    afinidade: o.afinidadeDaTitular ?? 0,
    confianca: o.confianca,
    nivelDeRisco: o.nivelDeRisco ?? null,
    complianceBloqueante: o.complianceBloqueante ?? false,
    publicacaoImpedida: o.publicacaoImpedida ?? false,
    compradoPelaTitular: o.compradoPelaTitular ?? false,
    usadoPelaTitular: o.usadoPelaTitular ?? false,
    motivosPositivos: o.motivosPositivos ?? [],
    riscos: o.riscos ?? [],
    desconhecidos: desconhecidosDoItem(o.desconhecidos ?? [], item),
    porqueDestaPosicao: o.porqueDestaPosicao,
    coletadoEm: datas.coletadoEm,
    validoAte: datas.validoAte,
  }
}

/** Acrescenta à lista do motor o que a fonte deste item não informou. */
function desconhecidosDoItem(doMotor: string[], item: DadosReaisDoItem): string[] {
  const extra: string[] = []
  if (item.imagem === null) extra.push('imagem do produto')
  if (item.categoria === null) extra.push('categoria (cadastrada como "Outros")')
  return [...new Set([...doMotor, ...extra])]
}

// ── Candidato → Produto ─────────────────────────────────────────────────

/**
 * FUNÇÃO PURA. Produto a criar na escolha, SÓ com dado real do candidato.
 * Campos obrigatórios do cadastro sem dado ficam vazios; categoria ausente
 * vira "Outros". A origem da imagem não é verificada → "De fornecedor"
 * (direito de uso desconhecido; a mídia não é usada até alguém verificar).
 */
export function dadosDoProdutoACriar(
  c: Pick<
    CandidatoDeProduto,
    'nome' | 'categoria' | 'preco' | 'linkProduto' | 'imagem' | 'providerId' | 'externalId' | 'fonte' | 'compradoPelaTitular' | 'usadoPelaTitular'
  >,
  quem: { workspaceId: string; userId: string }
): Prisma.ProdutoUncheckedCreateInput {
  const daTitular = c.fonte === FONTE_TITULAR
  return {
    workspaceId: quem.workspaceId,
    userId: quem.userId,
    nome: c.nome,
    categoria: c.categoria ?? 'Outros',
    preco: c.preco,
    linkProduto: c.linkProduto,
    descricao: null,
    publicoAlvo: [],
    origemConteudo: 'De fornecedor',
    tipoVenda: 'Afiliado',
    // Fase 1: "#usei" em Observações marca uso pela titular (até a Fase 2b).
    observacoes: c.usadoPelaTitular ? '#usei' : null,
    beneficios: [],
    pontosNegativos: [],
    imagens: c.imagem ? [c.imagem] : [],
    videos: [],
    providerId: c.providerId,
    externalId: c.externalId,
    // Comprou ou usou → USER_PROVIDED; nenhum dos dois → MANUAL.
    // Fonte externa → o id da fonte.
    origemDados: daTitular ? origemDoInformado(c) : c.fonte,
  }
}

/** FUNÇÃO PURA. Por que este candidato não pode ser escolhido agora (ou null). */
export function impedimentoParaEscolha(
  c: Pick<CandidatoDeProduto, 'status' | 'validoAte' | 'complianceBloqueante'>,
  agora: Date
): string | null {
  if (c.status !== 'APRESENTADO') return `Candidato em "${c.status}": só um dos 3 apresentados pode ser escolhido.`
  if (c.complianceBloqueante) return 'Candidato bloqueado por compliance.'
  if (c.validoAte.getTime() < agora.getTime()) return 'Candidato vencido: atualize os candidatos antes de escolher.'
  return null
}

// ── Produto informado pela titular (fallback) ───────────────────────────

export interface ProdutoInformado {
  nome: string
  link: string
  categoria?: string | null
  preco?: number | null
  imagem?: string | null
  comprei: boolean
  usei: boolean
}

/**
 * FUNÇÃO PURA. O informado no formato do motor. A imagem informada não tem
 * direito de uso verificado ("De fornecedor"). Comprei OU Usei → origem
 * USER_PROVIDED; "Usei" também vira `#usei` — os sinais da Fase 1.
 */
export function informadoComoProduto(
  c: Pick<CandidatoDeProduto, 'id' | 'nome' | 'categoria' | 'preco' | 'linkProduto' | 'imagem' | 'compradoPelaTitular' | 'usadoPelaTitular' | 'createdAt'>
): ProdutoDoCatalogo {
  return {
    id: c.id,
    nome: c.nome,
    categoria: c.categoria ?? 'Outros',
    preco: c.preco,
    linkProduto: c.linkProduto,
    imagens: c.imagem ? [c.imagem] : [],
    origemConteudo: 'De fornecedor',
    origemDados: origemDoInformado(c),
    providerId: null,
    status: 'ativo',
    removidoDaOrigemEm: null,
    createdAt: c.createdAt,
    comissaoPercentual: null,
    observacoes: c.usadoPelaTitular ? '#usei' : null,
  }
}

const SEM_HISTORICO = () =>
  calcularDesempenhoHistorico({ taxaConversao: null, receitaPorClique: null, cliques: 0, vendasElegiveis: 0, publicacoesRecentes: 0 })

/**
 * No informado, comprado/usado são o que a titular MARCOU. A origem
 * USER_PROVIDED vale para os dois; sem isto, "só usei" apareceria como
 * "comprado" também.
 */
function sinaisMarcados(c: Pick<CandidatoDeProduto, 'compradoPelaTitular' | 'usadoPelaTitular'>) {
  return { compradoPelaTitular: c.compradoPelaTitular, usadoPelaTitular: c.usadoPelaTitular }
}

function itemDoInformado(c: Pick<CandidatoDeProduto, 'nome' | 'linkProduto' | 'imagem' | 'categoria' | 'preco'>): DadosReaisDoItem {
  return {
    nome: c.nome,
    linkProduto: c.linkProduto,
    imagem: c.imagem,
    categoria: c.categoria,
    preco: c.preco,
    providerId: null,
    externalId: null,
    comissaoPercentual: null,
    vendas: null,
    velocidadeDeVendas: null,
    avaliacao: null,
    numeroDeAvaliacoes: null,
    estoque: null,
  }
}

async function canaisConectados(workspaceId: string): Promise<string[]> {
  const integracoes = await prisma.integracao.findMany({
    where: { workspaceId, status: 'conectado' },
    select: { plataforma: true },
  })
  return integracoes.map((i) => i.plataforma)
}

export class ErroDeCuradoria extends Error {
  constructor(public readonly status: 400 | 404 | 409, mensagem: string) {
    super(mensagem)
  }
}

export async function informarProduto(params: {
  workspaceId: string
  userId: string
  dados: ProdutoInformado
  agora?: Date
}): Promise<CandidatoDeProduto> {
  const agora = params.agora ?? new Date()
  const { workspaceId, dados } = params
  const link = dados.link.trim()

  const jaInformado = await prisma.candidatoDeProduto.findFirst({
    where: { workspaceId, fonte: FONTE_TITULAR, linkProduto: link, status: { notIn: [...STATUS_TERMINAIS] } },
    select: { id: true },
  })
  if (jaInformado) throw new ErroDeCuradoria(409, 'Este link já foi informado e está entre os candidatos.')
  const noCatalogo = await prisma.produto.findFirst({
    where: { workspaceId, linkProduto: link, status: { not: 'descartado' } },
    select: { id: true },
  })
  if (noCatalogo) throw new ErroDeCuradoria(409, 'Este link já é de um produto do catálogo.')

  const base = {
    id: randomUUID(),
    nome: dados.nome.trim(),
    categoria: dados.categoria?.trim() || null,
    preco: typeof dados.preco === 'number' ? dados.preco : null,
    linkProduto: link,
    imagem: dados.imagem?.trim() || null,
    compradoPelaTitular: dados.comprei,
    usadoPelaTitular: dados.usei,
    createdAt: agora,
  }
  const pontuada = pontuarProduto(informadoComoProduto(base), SEM_HISTORICO(), {
    canaisCapazes: await canaisConectados(workspaceId),
    agora,
    perfil: (await obterPerfilDaLoja(workspaceId, { criarSeAusente: true })).perfil,
  })
  const retrato = {
    ...retratoDoCandidato(pontuada, itemDoInformado(base), {
      coletadoEm: agora,
      validoAte: calcularValidade({ tipo: 'USER_PROVIDED', coletadoEm: agora }),
    }),
    ...sinaisMarcados(base),
  }

  const candidato = await prisma.candidatoDeProduto.create({
    data: {
      ...retrato,
      id: base.id,
      workspaceId,
      chaveDeOrigem: `titular:${base.id}`,
      fonte: FONTE_TITULAR,
      produtoId: null,
      status: 'NOVO',
      createdAt: agora,
    },
  })
  await registrarAuditoria({
    workspaceId,
    userId: params.userId,
    action: 'curadoria.produto_informado',
    entityType: 'CandidatoDeProduto',
    entityId: candidato.id,
    metadata: { comprei: dados.comprei, usei: dados.usei },
  })
  return candidato
}

// ── Coleta e ranking ────────────────────────────────────────────────────

export interface ResultadoDaColeta {
  avaliados: number
  candidatosAtivos: number
  apresentados: number
  bloqueados: number
  origemDoPerfil: string
}

/**
 * Coleta e ranqueia com o motor existente e marca os 3 melhores como
 * APRESENTADO. Roda em qualquer modo de automação (é ação da titular) e
 * não altera o modo, não cria tarefa, não gera conteúdo, não publica.
 */
export async function coletarCandidatos(params: { workspaceId: string; userId?: string; agora?: Date }): Promise<ResultadoDaColeta> {
  const agora = params.agora ?? new Date()
  const { workspaceId } = params
  const { perfil, origem: origemDoPerfil } = await obterPerfilDaLoja(workspaceId, { criarSeAusente: true })
  const canais = await canaisConectados(workspaceId)

  // Fora da coleta: escolhidos/cadastrados (para sempre) e descartados nos
  // últimos 30 dias. Descartado há mais tempo volta a concorrer.
  const foraDaQuarentena = { OR: [{ status: { notIn: ['DESCARTADO' as const] } }, { updatedAt: { lte: inicioDaQuarentena(agora) } }] }
  const emQuarentena = { status: 'DESCARTADO' as const, updatedAt: { gt: inicioDaQuarentena(agora) } }
  const encerrados = await prisma.candidatoDeProduto.findMany({
    where: { workspaceId, produtoId: { not: null }, OR: [{ status: { in: [...STATUS_DEFINITIVOS] } }, emQuarentena] },
    select: { produtoId: true },
  })
  const produtosEncerrados = new Set(encerrados.map((c) => c.produtoId as string))

  // 1) Catálogo real (o motor já exclui sintéticos e descartados).
  const filaDoCatalogo = (await montarFilaDeOportunidades({ workspaceId, agora, canaisCapazes: canais, perfil })).filter(
    (o) => !produtosEncerrados.has(o.produtoId)
  )
  const brutos = await prisma.produto.findMany({
    where: { workspaceId, id: { in: filaDoCatalogo.map((o) => o.produtoId) } },
    select: {
      id: true, nome: true, categoria: true, preco: true, linkProduto: true, imagens: true,
      providerId: true, externalId: true, origemDados: true,
      linksDinamicos: { select: { comissao: true }, take: 5 },
    },
  })
  const brutoPorId = new Map(brutos.map((b) => [b.id, b]))

  // 2) Informados pela titular, ainda em aberto: repontuados agora.
  const informados = await prisma.candidatoDeProduto.findMany({
    where: { workspaceId, fonte: FONTE_TITULAR, produtoId: null, status: { notIn: [...STATUS_DEFINITIVOS] }, ...foraDaQuarentena },
  })
  const filaDosInformados = informados.map((c) => ({
    ...pontuarProduto(informadoComoProduto(c), SEM_HISTORICO(), { canaisCapazes: canais, agora, perfil }),
    workspaceId,
  }))
  const informadoPorId = new Map(informados.map((c) => [c.id, c]))

  // 3) Uma fila só, na ordem do motor; os 3 melhores pela regra do ASSISTED.
  const fila = ordenarFila([...filaDoCatalogo, ...filaDosInformados])
  const selecao = selecionarParaModo(fila, { automationMode: 'ASSISTED', automationPaused: false })
  const posicaoPorProduto = new Map(selecao.candidatos.map((c) => [c.produtoId, c]))
  const elegiveis = fila.filter((o) => !o.complianceBloqueante && o.classificacao !== 'NAO_ELEGIVEL')

  const idsGravados: { id: string; produtoId: string }[] = []
  for (const o of elegiveis) {
    const escolhido = posicaoPorProduto.get(o.produtoId)
    const comPosicao = escolhido ? { ...o, porqueDestaPosicao: [escolhido.motivoDaPosicao, ...o.porqueDestaPosicao] } : o
    const informado = informadoPorId.get(o.produtoId)
    if (informado) {
      const retrato = {
        ...retratoDoCandidato(comPosicao, itemDoInformado(informado), {
          coletadoEm: agora,
          validoAte: calcularValidade({ tipo: 'USER_PROVIDED', coletadoEm: agora }),
        }),
        ...sinaisMarcados(informado),
        // Descartado com a quarentena cumprida volta a concorrer.
        ...(informado.status === 'DESCARTADO' ? { status: 'NOVO' as const, posicao: null } : {}),
      }
      await prisma.candidatoDeProduto.update({ where: { id: informado.id }, data: retrato })
      idsGravados.push({ id: informado.id, produtoId: o.produtoId })
      continue
    }
    const b = brutoPorId.get(o.produtoId)
    if (!b) continue
    const retrato = retratoDoCandidato(
      comPosicao,
      {
        nome: b.nome,
        linkProduto: b.linkProduto,
        imagem: b.imagens[0] ?? null,
        categoria: b.categoria,
        preco: b.preco,
        providerId: b.providerId,
        externalId: b.externalId,
        comissaoPercentual: comissaoDaOferta(b.linksDinamicos),
        vendas: null,
        velocidadeDeVendas: null,
        avaliacao: null,
        numeroDeAvaliacoes: null,
        estoque: null,
      },
      { coletadoEm: agora, validoAte: calcularValidade({ tipo: tipoDeFonteDoCatalogo(o, b.origemDados), coletadoEm: agora }) }
    )
    const chaveDeOrigem = `produto:${b.id}`
    const gravado = await prisma.candidatoDeProduto.upsert({
      where: { workspaceId_chaveDeOrigem: { workspaceId, chaveDeOrigem } },
      create: { ...retrato, workspaceId, chaveDeOrigem, fonte: FONTE_CATALOGO, produtoId: b.id, status: 'NOVO' },
      update: retrato,
      select: { id: true, status: true },
    })
    // Escolhido/cadastrado nunca é reaberto (e já foi filtrado acima). Chegar
    // aqui como DESCARTADO = quarentena cumprida: volta a concorrer.
    if ((STATUS_DEFINITIVOS as readonly string[]).includes(gravado.status)) continue
    if (gravado.status === 'DESCARTADO') {
      await prisma.candidatoDeProduto.update({ where: { id: gravado.id }, data: { status: 'NOVO', posicao: null } })
    }
    idsGravados.push({ id: gravado.id, produtoId: o.produtoId })
  }

  // 4) Só os 3 de agora ficam APRESENTADO; os anteriores voltam a NOVO.
  const apresentar = idsGravados.filter((g) => posicaoPorProduto.has(g.produtoId))
  await prisma.$transaction([
    prisma.candidatoDeProduto.updateMany({
      where: { workspaceId, status: 'APRESENTADO' },
      data: { status: 'NOVO', posicao: null },
    }),
    ...apresentar.map((g) =>
      prisma.candidatoDeProduto.update({
        where: { id: g.id },
        data: { status: 'APRESENTADO', posicao: posicaoPorProduto.get(g.produtoId)!.posicao },
      })
    ),
  ])

  if (params.userId) {
    await registrarAuditoria({
      workspaceId,
      userId: params.userId,
      action: 'curadoria.candidatos_coletados',
      entityType: 'CandidatoDeProduto',
      entityId: workspaceId,
      metadata: { avaliados: fila.length, apresentados: apresentar.length },
    })
  }

  return {
    avaliados: fila.length,
    candidatosAtivos: idsGravados.length,
    apresentados: apresentar.length,
    bloqueados: fila.length - elegiveis.length,
    origemDoPerfil,
  }
}

export async function listarApresentados(workspaceId: string) {
  return prisma.candidatoDeProduto.findMany({
    where: { workspaceId, status: 'APRESENTADO' },
    orderBy: { posicao: 'asc' },
  })
}

// ── Escolha e descarte ──────────────────────────────────────────────────

export interface ResultadoDaEscolha {
  status: 'ESCOLHIDO' | 'CADASTRADO'
  produtoId: string
  produtoCriado: boolean
}

/**
 * A titular escolhe 1 dos 3. Do catálogo → ESCOLHIDO (o produto já existe;
 * nada é duplicado). Informado/fonte externa → cria o Produto só com dado
 * real, preservando providerId/externalId → CADASTRADO. Clique duplo: o
 * segundo recebe 409 e nenhum produto a mais é criado.
 */
export async function escolherCandidato(params: {
  workspaceId: string
  userId: string
  candidatoId: string
  agora?: Date
}): Promise<ResultadoDaEscolha> {
  const agora = params.agora ?? new Date()
  const { workspaceId, userId, candidatoId } = params

  const c = await prisma.candidatoDeProduto.findFirst({ where: { id: candidatoId, workspaceId } })
  if (!c) throw new ErroDeCuradoria(404, 'Candidato não encontrado.')
  const impedimento = impedimentoParaEscolha(c, agora)
  if (impedimento) throw new ErroDeCuradoria(409, impedimento)

  const resultado = await prisma.$transaction(async (tx) => {
    // Reivindicação atômica: só um clique passa.
    const reivindicado = await tx.candidatoDeProduto.updateMany({
      where: { id: c.id, workspaceId, status: 'APRESENTADO', complianceBloqueante: false, validoAte: { gte: agora } },
      data: { status: 'ESCOLHIDO', escolhidoEm: agora, escolhidoPorUserId: userId },
    })
    if (reivindicado.count !== 1) throw new ErroDeCuradoria(409, 'Este candidato acabou de ser escolhido ou mudou de estado.')

    if (c.produtoId) return { status: 'ESCOLHIDO' as const, produtoId: c.produtoId, produtoCriado: false }

    // Mesmo item de uma fonte já cadastrado? Liga, não duplica.
    const existente =
      c.providerId && c.externalId
        ? await tx.produto.findFirst({
            where: { workspaceId, providerId: c.providerId, externalId: c.externalId },
            select: { id: true },
          })
        : null
    const produtoId = existente
      ? existente.id
      : (await tx.produto.create({ data: dadosDoProdutoACriar(c, { workspaceId, userId }), select: { id: true } })).id

    await tx.candidatoDeProduto.update({ where: { id: c.id }, data: { status: 'CADASTRADO', produtoId } })
    return { status: 'CADASTRADO' as const, produtoId, produtoCriado: !existente }
  })

  await registrarAuditoria({
    workspaceId,
    userId,
    action: 'curadoria.candidato_escolhido',
    entityType: 'CandidatoDeProduto',
    entityId: c.id,
    metadata: { status: resultado.status, produtoId: resultado.produtoId, produtoCriado: resultado.produtoCriado, score: c.score },
  })
  if (resultado.produtoCriado) {
    await registrarAuditoria({
      workspaceId,
      userId,
      action: 'produto.criado',
      entityType: 'Produto',
      entityId: resultado.produtoId,
      metadata: { nome: c.nome, origem: 'curadoria', fonte: c.fonte },
    })
  }
  return resultado
}

export async function descartarCandidato(params: { workspaceId: string; userId: string; candidatoId: string }): Promise<void> {
  const r = await prisma.candidatoDeProduto.updateMany({
    where: { id: params.candidatoId, workspaceId: params.workspaceId, status: { in: ['NOVO', 'APRESENTADO'] } },
    data: { status: 'DESCARTADO', posicao: null },
  })
  if (r.count !== 1) throw new ErroDeCuradoria(404, 'Candidato não encontrado ou já resolvido.')
  await registrarAuditoria({
    workspaceId: params.workspaceId,
    userId: params.userId,
    action: 'curadoria.candidato_descartado',
    entityType: 'CandidatoDeProduto',
    entityId: params.candidatoId,
  })
}
