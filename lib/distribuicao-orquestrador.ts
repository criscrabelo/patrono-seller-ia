/**
 * P1.5 — Distribuição autônoma segura.
 *
 * O fio que liga peça pronta a distribuição real:
 *
 *   Conteudo pronto → contexto → decisão → adapter → Publicacao
 *
 * ── O QUE FOI REUSADO ───────────────────────────────────────────────────
 * A fila é a MESMA do P1.3 (`AutomationJob`), com a mesma porta de escrita
 * e o mesmo claim. `Publicacao` e `LinkDinamico` entram pelo fluxo do P1.0
 * (`prepararTentativaDePublicacao`), que já resolve link rastreado,
 * fallback e idempotência por `chaveDaTentativa`. Direitos de mídia vêm de
 * `media-rights-produto`, compatibilidade de formato de `FORMATOS`, e
 * disclosure de `compliance-engine`. Nada disso é reimplementado aqui.
 *
 * ── A REGRA QUE ESTE ARQUIVO EXISTE PARA APLICAR ────────────────────────
 * Peça pronta NÃO é autorização para publicar. Entre uma e outra estão a
 * decisão do `distribuicao-decisao` e um adapter LIGADO. Faltando qualquer
 * um, o job espera e diz o que falta — nunca inventa a publicação.
 *
 * ── NENHUMA CHAMADA EXTERNA ─────────────────────────────────────────────
 * Este módulo não conhece TikTok nem Meta. Ele conhece uma PORTA
 * (`AdaptadorDeCanal`). O registro real está vazio: até alguém ligar um
 * adapter de verdade, a orquestração roda inteira contra mocks.
 */

import { prisma } from './prisma'
import {
  decidirDistribuicao,
  implementacaoDoCanal,
  type ContextoDaDistribuicao,
  type VereditoDaDistribuicao,
  type EstadoDeDistribuicao,
} from './distribuicao-decisao'
import { capacidadeDoCanal } from './channel-registry'
import { FORMATOS } from './plano-de-acao'
import { resolverDireitosDoProduto } from './media-rights-produto'
import { textoDisclosure } from './creative-factory'
import {
  prepararTentativaDePublicacao,
  confirmarDistribuicao,
  registrarFalhaDaTentativa,
} from './publicacao-fluxo'
import { chaveDoJob, type JobDesejado } from './automation-queue-contrato'
import { lerAutorizacao } from './autorizacao-da-conta'
import {
  avaliarPecaParaOAdapter,
  capacidadeRealDoAdapter,
  urlVaiNaLegenda,
  estrategiaDeLinkDoCanal,
  type EstrategiaDeLink,
} from './capacidade-real-do-adapter'
import { avaliarMidiaParaPublicacao, lerEvidenciaDeMidia } from './evidencia-de-midia'
import { pendenciasDeCopy } from './copy-por-canal'
import { pendenciaDePrecoNaLegenda, dataDaVerificacaoDoPreco } from './preco-verificado'
import { urlDaTentativa, avaliarLinkNaBio } from './link-na-bio'
import type { LinhaDaFila } from './automation-queue-repositorio'

/** Tipo de job desta rodada. Vocabulário único, na fila que já existe. */
export const TIPO_JOB_DISTRIBUICAO = 'DISTRIBUIR_CONTEUDO'

// ── A porta dos canais ──────────────────────────────────────────────────

export interface PedidoDeDistribuicao {
  canal: string
  /**
   * De quem é a conta. O adapter busca a credencial por aqui, em vez de
   * recebê-la pronta — é o que mantém o token fora da orquestração.
   */
  workspaceId: string
  /** Identidade da tentativa. O adapter NÃO cria publicação. */
  publicacaoId: string
  legenda: string
  /** Rastreada quando deu; direta quando não deu. Já decidida acima. */
  urlParaDivulgar: string
  assetUrl: string | null
  /**
   * P1.9.1. O formato da peça. O adapter real confere contra a mesma
   * declaração que o preflight usou (`lib/capacidade-real-do-adapter.ts`).
   */
  formato?: string | null
}

export interface RespostaDoAdaptador {
  ok: boolean
  /** Id devolvido pela plataforma. `null` quando ela não devolve um. */
  publicacaoExternaId: string | null
  /** Mensagem JÁ higienizada pelo adapter — nunca payload bruto. */
  erro: string | null
  /** `true` quando repetir não adianta (peça recusada, por exemplo). */
  fatal?: boolean
  /**
   * `true` quando a requisição PODE ter chegado ao canal e não sabemos o
   * que aconteceu depois — timeout, conexão cortada, resposta ilegível.
   *
   * Isto NÃO é o mesmo que falha. Uma recusa do canal (400, mídia
   * rejeitada) é resposta: o post não existe, e repetir é seguro. Um
   * timeout não é resposta: o post pode estar no ar. Repetir aí publicaria
   * duas vezes — e um post duplicado não se desfaz sozinho.
   */
  envioIncerto?: boolean
}

/**
 * O contrato de um canal. Um adapter implementa o que sabe fazer — e só.
 *
 * Um canal que só sabe rascunho não ganha `publicar`, e é isso que impede
 * o orquestrador de chamar publicação onde ela não existe.
 */
export interface AdaptadorDeCanal {
  canal: string
  publicar?: (p: PedidoDeDistribuicao) => Promise<RespostaDoAdaptador>
  enviarDraft?: (p: PedidoDeDistribuicao) => Promise<RespostaDoAdaptador>
}

/**
 * VAZIO DE PROPÓSITO.
 *
 * `IMPLEMENTACAO_POR_CANAL` diz que o código EXISTE. Este registro diz que
 * ele está LIGADO. São coisas diferentes: o publisher do TikTok existe e
 * nenhuma rota o chama; o Instagram publica e ainda não teve os escopos
 * comprovados. Enquanto isto estiver vazio, nenhuma chamada externa parte
 * daqui — e a orquestração se prova inteira contra adapters injetados.
 */
export const ADAPTADORES_LIGADOS: Record<string, AdaptadorDeCanal> = {}

export const NENHUM_ADAPTADOR_REAL_LIGADO = {
  chave: 'distribuicao:adaptadores-desligados',
  estado: 'Nenhum adapter real está registrado nesta rodada.',
  porque:
    'Ligar TikTok ou Meta faria chamada externa de verdade, que depende de autorização específica da proprietária.',
  comoLigar:
    'Registrar o adapter em ADAPTADORES_LIGADOS. A decisão e a orquestração já estão prontas e não mudam.',
} as const

export function adaptadorDoCanal(
  canal: string,
  registro: Record<string, AdaptadorDeCanal> = ADAPTADORES_LIGADOS
): AdaptadorDeCanal | null {
  return registro[(canal ?? '').trim().toLowerCase()] ?? null
}

// ── Higiene ─────────────────────────────────────────────────────────────

/**
 * Nenhum segredo entra em log, evidência ou contexto de job.
 *
 * Um erro de provider costuma trazer a URL chamada — e a URL costuma trazer
 * `access_token=...`. Cortar aqui é mais barato do que confiar que todo
 * adapter futuro se lembrará de cortar.
 */
const PADROES_DE_SEGREDO: RegExp[] = [
  /access[_-]?token["'\s:=]+[^\s"'&,}]+/gi,
  /refresh[_-]?token["'\s:=]+[^\s"'&,}]+/gi,
  /client[_-]?secret["'\s:=]+[^\s"'&,}]+/gi,
  /bearer\s+[A-Za-z0-9._-]+/gi,
  /\b(EAA|act\.)[A-Za-z0-9._-]{10,}/g,
]

export function higienizar(texto: string | null | undefined): string {
  let saida = String(texto ?? '')
  for (const p of PADROES_DE_SEGREDO) saida = saida.replace(p, '[REDIGIDO]')
  return saida.slice(0, 500)
}

// ── O contexto, lido do banco ───────────────────────────────────────────

/**
 * Escopos concedidos. `null` quando a conexão não registra nenhum.
 *
 * A autoridade é `autorizacao-da-conta` (P1.5.1). Isto aqui é só o nome
 * antigo, mantido para quem já o importava — duas leituras diferentes do
 * mesmo `extraData` seria a receita para divergirem.
 */
export { lerScopesComprovados as lerScopesDaIntegracao } from './autorizacao-da-conta'

/** O formato desta peça é aceito por este canal? Autoridade: FORMATOS. */
export function formatoAceitoPeloCanal(formato: string | null, canal: string): boolean {
  const cap = capacidadeDoCanal(canal)
  if (!cap) return false
  const def = FORMATOS.find((f) => f.formato === formato)
  if (!def) return false
  return def.exigeDoCanal.some((c) => cap[c])
}

export interface ConteudoParaDistribuir {
  id: string
  produtoId: string
  legenda: string
  assetUrl: string | null
  formato: string | null
  urlDiretaDoProduto: string | null
  /** P1.9.1. Onde o link rastreado fica. `null` = não verificado: não vai na legenda. */
  estrategiaDeLink?: EstrategiaDeLink | null
  /** P1.9.1. Por que a mídia foi ou não aceita, em uma frase. */
  motivoDaMidia?: string | null
  /**
   * P1.9.2. Para a confirmação do link na bio: o nome entra no slug, o
   * agendamento na chave padrão, e os alertas guardam a confirmação.
   * Ausentes, a confirmação não é encontrada — fail-closed.
   */
  nomeProduto?: string | null
  dataAgendamento?: Date | null
  alertas?: unknown[] | null
}

/**
 * Monta o contexto da decisão a partir do estado REAL do workspace.
 *
 * Tudo que não puder ser lido vira o valor que bloqueia. Um `catch` que
 * devolvesse "ok" aqui transformaria falha de leitura em publicação.
 */
export async function montarContextoDaDistribuicao(params: {
  workspaceId: string
  contentId: string
  canal: string
  /** Para a custódia da mídia (host do storage do projeto). */
  env?: Record<string, string | undefined>
  /** Para a validade do preço. */
  agora?: Date
}): Promise<{ contexto: ContextoDaDistribuicao; conteudo: ConteudoParaDistribuir | null }> {
  const canal = (params.canal ?? '').trim().toLowerCase()

  const bloqueado = (): ContextoDaDistribuicao => ({
    canal,
    canalConectado: false,
    scopesConcedidos: null,
    appAprovadoPeloProvider: null,
    midiaAutorizada: false,
    formatoCompativel: false,
    pecaParaOAdapter: { aceita: false, bloqueios: [], explicacao: [] },
    disclosurePresente: false,
    pendenciasDeCompliance: ['Conteúdo não encontrado neste workspace.'],
    custoZero: true,
  })

  const conteudo = await prisma.conteudo.findFirst({
    where: { id: params.contentId, workspaceId: params.workspaceId },
    select: {
      id: true,
      produtoId: true,
      videoUrl: true,
      dataAgendamento: true,
      legendaInstagram: true,
      legendaTiktok: true,
      legendaFacebook: true,
      legendaYoutube: true,
      alertasCompliance: true,
      produto: {
        select: {
          id: true,
          nome: true,
          origemConteudo: true,
          origemDados: true,
          imagens: true,
          linkProduto: true,
          sincronizadoEm: true,
        },
      },
    },
  })

  // Inexistente e de outro workspace respondem igual: sem vazamento.
  if (!conteudo) return { contexto: bloqueado(), conteudo: null }

  const legenda =
    (canal === 'tiktok' ? conteudo.legendaTiktok : null) ??
    (canal === 'instagram' ? conteudo.legendaInstagram : null) ??
    (canal === 'facebook' ? conteudo.legendaFacebook : null) ??
    (canal === 'youtube' ? conteudo.legendaYoutube : null) ??
    ''

  const alertas = Array.isArray(conteudo.alertasCompliance) ? conteudo.alertasCompliance : []
  const assetUrl = conteudo.videoUrl ?? null
  // O registro de direito DESTE arquivo — a peça pode guardar outros.
  const evidencia = lerEvidenciaDeMidia(alertas, assetUrl)

  // O formato é o que o registro de direito declara para ESTE arquivo.
  // Sem registro, vale a inferência de sempre: vídeo renderizado ou texto.
  const formato =
    evidencia && assetUrl && evidencia.assetUrl === assetUrl && evidencia.formato
      ? evidencia.formato
      : assetUrl
        ? 'VIDEO_9X16_FFMPEG_NARRADO'
        : 'TEXTO_COM_LINK'

  // Autoridade única do que esta conta autorizou (P1.5.1). O orquestrador
  // não lê token nem extraData: ele pergunta, e o que volta já é público.
  const autorizacao = await lerAutorizacao({ workspaceId: params.workspaceId, canal })
  const conectado = autorizacao.estado !== 'DESCONECTADA' && !autorizacao.expirado

  // Direitos: a autoridade é media-rights-produto. Aqui só se pergunta.
  const direitos = resolverDireitosDoProduto({
    id: conteudo.produto.id,
    nome: conteudo.produto.nome,
    origemConteudo: conteudo.produto.origemConteudo,
    imagens: conteudo.produto.imagens ?? [],
    origemDados: conteudo.produto.origemDados ?? undefined,
  })
  const formatoUsaMidia = FORMATOS.find((f) => f.formato === formato)?.exigeMidiaAutorizada ?? true

  // P1.9.1. Canal com adapter REAL publica de verdade, e aí o que decide é
  // o direito do ARQUIVO, com evidência — não a origem do produto.
  // `comprei_e_testei` não prova autoria de foto nenhuma.
  const temAdapterReal = !!capacidadeRealDoAdapter(canal)
  const avaliacaoDaMidia = temAdapterReal
    ? avaliarMidiaParaPublicacao({ assetUrl, evidencia, env: params.env ?? process.env })
    : null
  const midiaAutorizada = !formatoUsaMidia
    ? true
    : avaliacaoDaMidia
      ? avaliacaoDaMidia.autorizada
      : direitos.canDerive && direitos.canTransform

  const pendencias = alertas
    .map((a) => {
      const item = (a ?? {}) as Record<string, unknown>
      const bloqueia = item.bloqueia === true || item.severidade === 'BLOQUEIO'
      return bloqueia ? String(item.mensagem ?? item.regra ?? 'alerta de compliance') : null
    })
    .filter((m): m is string => !!m)

  // P1.9.1. A legenda já escrita também passa pelas regras de copy e de
  // preço. É o que segura as peças geradas antes desta correção.
  pendencias.push(...pendenciasDeCopy({ canal, legenda }))
  const doPreco = pendenciaDePrecoNaLegenda({
    legenda,
    verificadoEm: dataDaVerificacaoDoPreco(conteudo.produto),
    agora: params.agora ?? new Date(),
  })
  if (doPreco) pendencias.push(doPreco)

  const disclosurePresente = ['afiliado', 'parceria', 'publicidade'].some((t) =>
    legenda.includes(textoDisclosure(t as 'afiliado' | 'parceria' | 'publicidade'))
  )

  return {
    contexto: {
      canal,
      canalConectado: conectado,
      scopesConcedidos: conectado ? autorizacao.scopesComprovados : null,
      // Nunca afirmado a partir do nosso lado: é a plataforma quem aprova.
      appAprovadoPeloProvider: autorizacao.aprovacaoDoApp,
      midiaAutorizada,
      formatoCompativel: formatoAceitoPeloCanal(formato, canal),
      pecaParaOAdapter: avaliarPecaParaOAdapter({ canal, formato, assetUrl }),
      disclosurePresente,
      pendenciasDeCompliance: pendencias,
      // A distribuição desta rodada não chama nenhum provider pago.
      custoZero: true,
    },
    conteudo: {
      id: conteudo.id,
      produtoId: conteudo.produtoId,
      legenda,
      assetUrl,
      formato,
      urlDiretaDoProduto: conteudo.produto.linkProduto ?? null,
      estrategiaDeLink: estrategiaDeLinkDoCanal(canal),
      motivoDaMidia: avaliacaoDaMidia?.motivo ?? null,
      nomeProduto: conteudo.produto.nome,
      dataAgendamento: conteudo.dataAgendamento,
      alertas,
    },
  }
}

// ── A execução ──────────────────────────────────────────────────────────

export const MOTIVOS_DE_ESPERA = [
  'DECISAO_NAO_EXECUTAVEL',
  'ADAPTADOR_NAO_LIGADO',
  'ADAPTADOR_SEM_A_ACAO',
  'CONTEUDO_INDISPONIVEL',
  /** P1.9.2. O link vai na bio e ninguém confirmou que ele está lá. */
  'LINK_NA_BIO_NAO_CONFIRMADO',
] as const
export type MotivoDeEspera = (typeof MOTIVOS_DE_ESPERA)[number]

export interface ResultadoDaDistribuicao {
  ok: boolean
  /** `true` quando não é falha: falta condição, e ela pode chegar. */
  aguardar: boolean
  /**
   * `true` quando o envio pode ter acontecido sem confirmação.
   *
   * Bloqueia o retry automático de propósito: é melhor uma publicação
   * pendente de conferência do que duas publicações no perfil da dona.
   */
  envioIncerto: boolean
  estado: EstadoDeDistribuicao | null
  acao: 'PUBLICAR' | 'DRAFT' | null
  publicacaoId: string | null
  publicacaoExternaId: string | null
  rastreada: boolean
  /**
   * `false` quando a plataforma aceitou e o REGISTRO local recusou gravar.
   *
   * Não vira `ok: false`: o post está no ar, e devolver falha faria a fila
   * tentar de novo e duplicar a publicação de verdade. Fica visível como
   * exceção operacional, que é o que de fato precisa de alguém.
   */
  registroConfirmado: boolean
  motivoDaEspera: MotivoDeEspera | null
  erroFatal: boolean
  explicacao: string
  veredito: VereditoDaDistribuicao | null
}

const espera = (
  motivo: MotivoDeEspera,
  explicacao: string,
  veredito: VereditoDaDistribuicao | null = null,
  estado: EstadoDeDistribuicao | null = null
): ResultadoDaDistribuicao => ({
  ok: false,
  aguardar: true,
  envioIncerto: false,
  estado: estado ?? veredito?.estado ?? null,
  acao: null,
  publicacaoId: null,
  publicacaoExternaId: null,
  rastreada: false,
  registroConfirmado: false,
  motivoDaEspera: motivo,
  erroFatal: false,
  explicacao,
  veredito,
})

/**
 * Distribui UMA peça em UM canal — ou explica por que não distribuiu.
 *
 * A `Publicacao` só nasce depois da decisão aprovar e do adapter existir.
 * Criá-la antes registraria como distribuição algo que nunca saiu, e é
 * `Publicacao` que o ML lê como evidência.
 */
export async function distribuirConteudo(params: {
  workspaceId: string
  contentId: string
  canal: string
  chaveDaTentativa: string
  adaptadores?: Record<string, AdaptadorDeCanal>
  /** Injetável em teste. Sem isto, é lido do banco. */
  contexto?: ContextoDaDistribuicao
  conteudo?: ConteudoParaDistribuir
  env?: Record<string, string | undefined>
}): Promise<ResultadoDaDistribuicao> {
  const canal = (params.canal ?? '').trim().toLowerCase()

  let contexto = params.contexto ?? null
  let conteudo = params.conteudo ?? null
  if (!contexto || !conteudo) {
    const lido = await montarContextoDaDistribuicao({
      workspaceId: params.workspaceId,
      contentId: params.contentId,
      canal,
      // O mesmo ambiente da execução: a custódia da mídia é verificada
      // contra o storage DESTE projeto.
      env: params.env,
    })
    contexto = contexto ?? lido.contexto
    conteudo = conteudo ?? lido.conteudo
  }
  if (!conteudo) {
    return espera('CONTEUDO_INDISPONIVEL', 'Conteúdo não encontrado neste workspace.')
  }

  // ── A decisão, antes de tudo ─────────────────────────────────────────
  const veredito = decidirDistribuicao(contexto)
  if (!veredito.podeExecutarSozinho) {
    return espera(
      'DECISAO_NAO_EXECUTAVEL',
      `${veredito.estado}: ${veredito.explicacao.join(' ')}`,
      veredito
    )
  }

  const acao = veredito.estado === 'AUTO_PUBLICAVEL' ? 'PUBLICAR' : 'DRAFT'

  // ── O adapter precisa estar LIGADO, não só existir ───────────────────
  const adapter = adaptadorDoCanal(canal, params.adaptadores ?? ADAPTADORES_LIGADOS)
  if (!adapter) {
    return espera(
      'ADAPTADOR_NAO_LIGADO',
      `A decisão autoriza ${acao.toLowerCase()} em ${canal}, mas nenhum adapter está ligado. ${NENHUM_ADAPTADOR_REAL_LIGADO.comoLigar}`,
      veredito
    )
  }
  const executar = acao === 'PUBLICAR' ? adapter.publicar : adapter.enviarDraft
  if (!executar) {
    return espera(
      'ADAPTADOR_SEM_A_ACAO',
      `O adapter de ${canal} não implementa ${acao.toLowerCase()}.`,
      veredito
    )
  }

  // ── P1.9.2: o link precisa estar onde a CTA manda ────────────────────
  //
  // No Instagram a CTA diz "Link na bio". Publicar sem que uma pessoa tenha
  // confirmado ESTE link na bio seria mandar o público para outro lugar.
  // Checado ANTES da Publicacao nascer: esperar não deixa rastro.
  const estrategia = estrategiaDeLinkDoCanal(canal)
  const daTentativa =
    estrategia === 'BIO'
      ? urlDaTentativa({
          workspaceId: params.workspaceId,
          contentId: params.contentId,
          canal,
          chaveDaTentativa: params.chaveDaTentativa,
          dataAgendamento: conteudo.dataAgendamento ?? null,
          nomeProduto: conteudo.nomeProduto ?? null,
          urlDiretaDoProduto: conteudo.urlDiretaDoProduto,
          env: params.env,
        })
      : null
  if (daTentativa) {
    const gerado = daTentativa.slug
      ? !!(await prisma.linkDinamico.findFirst({
          where: { slug: daTentativa.slug, workspaceId: params.workspaceId },
          select: { id: true },
        }))
      : true
    const naBio = avaliarLinkNaBio({
      canal,
      url: daTentativa.url,
      rastreada: daTentativa.rastreada,
      gerado,
      alertas: conteudo.alertas ?? null,
    })
    if (!naBio.liberaExecucao) {
      return espera('LINK_NA_BIO_NAO_CONFIRMADO', naBio.explicacao, veredito)
    }
  }

  // ── A Publicacao nasce aqui, com o link rastreado ────────────────────
  const tentativa = await prepararTentativaDePublicacao({
    workspaceId: params.workspaceId,
    contentId: params.contentId,
    canal,
    chaveDaTentativa: params.chaveDaTentativa,
    urlDiretaDoProduto: conteudo.urlDiretaDoProduto,
    env: params.env,
  })

  if (!tentativa.publicacao) {
    // Sem identidade da tentativa não há retry idempotente: um erro depois
    // da chamada externa produziria post duplicado na próxima rodada.
    return espera(
      'CONTEUDO_INDISPONIVEL',
      `Não foi possível registrar a tentativa: ${higienizar(tentativa.explicacao)}`,
      veredito
    )
  }

  const publicacaoId = tentativa.publicacao.id

  // Segunda conferência: o link que a tentativa REALMENTE obteve é o que
  // foi confirmado? Divergir aqui significa que algo mudou entre a
  // confirmação e agora — melhor não publicar do que publicar errado.
  if (daTentativa && tentativa.urlParaDivulgar !== daTentativa.url) {
    await registrarFalhaDaTentativa({ workspaceId: params.workspaceId, publicacaoId })
    return espera(
      'LINK_NA_BIO_NAO_CONFIRMADO',
      'O link obtido para a publicação não é o que foi confirmado na bio. Nada foi enviado.',
      veredito
    )
  }

  // P1.9.1. A URL só entra na legenda onde ela é clicável. No Instagram o
  // link rastreado vai na bio, e a legenda só aponta para ela — colar a URL
  // ali seria oferecer um link que não abre.
  const legenda =
    tentativa.urlParaDivulgar && urlVaiNaLegenda(canal)
      ? `${conteudo.legenda}\n\n${tentativa.urlParaDivulgar}`.trim()
      : conteudo.legenda

  let resposta: RespostaDoAdaptador
  try {
    resposta = await executar({
      canal,
      workspaceId: params.workspaceId,
      publicacaoId,
      legenda,
      urlParaDivulgar: tentativa.urlParaDivulgar ?? '',
      assetUrl: conteudo.assetUrl,
      formato: conteudo.formato,
    })
  } catch (e) {
    // A exceção escapou do adapter: ele não nos disse se a requisição
    // chegou a sair. Fail-closed — assumir "não saiu" é a suposição que
    // duplica post, e duplicar é o único erro aqui que não se desfaz.
    await registrarFalhaDaTentativa({ workspaceId: params.workspaceId, publicacaoId })
    return {
      ok: false,
      aguardar: false,
      envioIncerto: true,
      estado: veredito.estado,
      acao,
      publicacaoId,
      publicacaoExternaId: null,
      rastreada: tentativa.rastreada,
      registroConfirmado: false,
      motivoDaEspera: null,
      // Fatal NÃO significa "deu erro grave": significa "não repita
      // sozinho". Uma pessoa confere o perfil e decide.
      erroFatal: true,
      explicacao:
        `ENVIO INCERTO — o adapter falhou sem dizer se a requisição saiu. Confira o perfil antes de tentar de novo. ` +
        higienizar(e instanceof Error ? e.message : String(e)),
      veredito,
    }
  }

  if (!resposta.ok) {
    await registrarFalhaDaTentativa({ workspaceId: params.workspaceId, publicacaoId })
    const incerto = resposta.envioIncerto === true
    return {
      ok: false,
      aguardar: false,
      envioIncerto: incerto,
      estado: veredito.estado,
      acao,
      publicacaoId,
      publicacaoExternaId: null,
      rastreada: tentativa.rastreada,
      registroConfirmado: false,
      motivoDaEspera: null,
      // Recusa do canal é resposta, e repetir é seguro. Envio incerto não
      // é resposta: repetir pode publicar duas vezes.
      erroFatal: incerto || resposta.fatal === true,
      explicacao: incerto
        ? `ENVIO INCERTO — confira o perfil antes de tentar de novo. ${higienizar(resposta.erro)}`.trim()
        : higienizar(resposta.erro) || 'O canal recusou a distribuição.',
      veredito,
    }
  }

  const confirmacao = await confirmarDistribuicao({
    workspaceId: params.workspaceId,
    publicacaoId,
    publicacaoExternaId: resposta.publicacaoExternaId,
  })
  if (!confirmacao.ok) {
    // Acontece, por exemplo, quando o id externo já pertence a OUTRA
    // Publicacao: o guard da Etapa 2.c recusa o merge silencioso. Ignorar
    // isto aqui faria o sistema afirmar uma distribuição que o banco não
    // registrou — e o ML lê o banco, não esta resposta.
    console.error(
      `[distribuicao] post aceito por ${canal} e registro recusado para ${publicacaoId}: ${higienizar(confirmacao.explicacao)}`
    )
  }

  return {
    ok: true,
    aguardar: false,
    estado: veredito.estado,
    acao,
    publicacaoId,
    publicacaoExternaId: resposta.publicacaoExternaId,
    rastreada: tentativa.rastreada,
    envioIncerto: false,
    registroConfirmado: confirmacao.ok,
    motivoDaEspera: null,
    erroFatal: false,
    explicacao:
      (confirmacao.ok ? '' : `ATENÇÃO: o canal aceitou e o registro local recusou — ${higienizar(confirmacao.explicacao)} `) +
      (acao === 'PUBLICAR'
        ? `Publicado em ${canal}${tentativa.rastreada ? ' com link rastreado' : ' com link direto (sem rastreamento)'}.`
        : `Rascunho enviado a ${canal} — a publicação final é da proprietária.`),
    veredito,
  }
}

// ── A fila ──────────────────────────────────────────────────────────────

/**
 * Um job de distribuição por peça pronta.
 *
 * A entidade é `CONTEUDO`, não `PRODUTO`: o que se distribui é a peça. Isso
 * também faz o job morrer sozinho se a peça for apagada — o repositório
 * recusa job de entidade inexistente.
 */
export function jobDeDistribuicao(params: {
  workspaceId: string
  contentId: string
  canal: string
  /** Distingue republicação de retry. Mesma chave = mesma tentativa. */
  chaveDaTentativa: string
}): JobDesejado {
  const canal = (params.canal ?? '').trim().toLowerCase()
  const contexto: Record<string, unknown> = {
    canal,
    chaveDaTentativa: params.chaveDaTentativa,
    custoEstimado: 0,
  }
  return {
    chave: chaveDoJob({
      workspaceId: params.workspaceId,
      tipo: TIPO_JOB_DISTRIBUICAO,
      entityType: 'CONTEUDO',
      entityId: params.contentId,
      contexto,
    }),
    tipo: TIPO_JOB_DISTRIBUICAO,
    entityType: 'CONTEUDO',
    entityId: params.contentId,
    classe: 'AUTOMATIZAVEL',
    motivoHumano: null,
    contexto,
    explicacao: `Distribuir em ${canal} o que a decisão permitir — custo R$ 0,00.`,
  }
}

/**
 * A ação que o executor do P1.4.1 passa a conhecer.
 *
 * Espera (`aguardar`) e falha são coisas distintas: faltar escopo não gasta
 * tentativa, porque nenhuma quantidade de retentativas concede um escopo.
 */
export function acaoDeDistribuir(ctx: {
  workspaceId: string
  adaptadores?: Record<string, AdaptadorDeCanal>
  env?: Record<string, string | undefined>
}) {
  return async (job: LinhaDaFila) => {
    const contexto = job.contexto ?? {}
    const canal = String(contexto.canal ?? '')
    const chaveDaTentativa = String(contexto.chaveDaTentativa ?? '')

    if (!canal || !chaveDaTentativa) {
      return {
        ok: false,
        erroFatal: true,
        erro: 'Job de distribuição sem canal ou sem chave da tentativa — não dá para garantir idempotência.',
      }
    }

    const r = await distribuirConteudo({
      workspaceId: ctx.workspaceId,
      contentId: job.entityId,
      canal,
      chaveDaTentativa,
      adaptadores: ctx.adaptadores,
      env: ctx.env,
    })

    const resultado: Record<string, unknown> = {
      estado: r.estado,
      acao: r.acao,
      publicacaoId: r.publicacaoId,
      publicacaoExternaId: r.publicacaoExternaId,
      rastreada: r.rastreada,
      registroConfirmado: r.registroConfirmado,
      envioIncerto: r.envioIncerto,
      bloqueadoPor: r.veredito?.bloqueios ?? [],
      custo: 0,
      // O executor do P1.4.1 já sabe reavaliar quem marcou isto.
      reavaliarQuandoHouverCapacidade: r.aguardar,
    }

    if (r.ok) return { ok: true, resultado }
    if (r.aguardar) return { ok: false, aguardar: true, erro: r.explicacao, resultado }
    return { ok: false, erroFatal: r.erroFatal, erro: r.explicacao, resultado }
  }
}

/**
 * REGRA PERMANENTE desta rodada.
 *
 * O orquestrador não conhece nenhuma plataforma. Trocar de canal é
 * registrar outro adapter — o núcleo não muda.
 */
export const DISTRIBUICAO_NAO_CONHECE_PLATAFORMA = {
  chave: 'distribuicao:core-sem-provider',
  estado: 'Nenhum endpoint de TikTok ou Meta é citado neste módulo.',
  porque:
    'Regra de negócio no núcleo, especificidade de plataforma no adapter — é o que permite o segundo provider entrar sem reescrever a decisão.',
  proibido: ['scraping', 'automação de navegador', 'endpoint não oficial'],
} as const
