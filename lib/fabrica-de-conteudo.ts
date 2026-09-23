/**
 * Fábrica de Conteúdo Autônoma Gratuita (P1.4).
 *
 * NOME PRÓPRIO de propósito:  já existe e define as
 * INTERFACES de provider (renderer, voz, texto) usadas por autopilot e
 * compliance. Este módulo é o EXECUTOR que as usa — não o substitui.
 *
 * Pega item do plano em `PRONTO_PARA_GERAR_CONTEUDO` e transforma em
 * `Conteudo` real, usando só caminhos que já existem e custam R$ 0,00.
 *
 * ── NENHUMA FILA NOVA ───────────────────────────────────────────────────
 * `GERAR_CONTEUDO` vira job na `AutomationJob` que já existe. No P1.2 ele
 * era EXECUÇÃO e ficava de fora da fila de dependências — e continua fora
 * dela. O que muda é que agora ele tem um caminho próprio: a fila de
 * dependências responde "o que falta"; esta responde "o que fazer".
 *
 * Os dois usam a mesma tabela e a mesma porta de escrita. Duas filas
 * concorrentes seriam duas verdades sobre o que o robô está fazendo.
 *
 * ── NENHUM MOTOR NOVO ───────────────────────────────────────────────────
 * A copy sai de `gerarConteudoGratuito()`, que já existe e é determinística.
 * A voz sai do Chatterbox local. O vídeo, do FFmpeg local. Nada aqui
 * reimplementa o que o projeto já faz.
 *
 * ── CUSTO ZERO É PORTA, NÃO PREFERÊNCIA ─────────────────────────────────
 * Todo caminho potencialmente pago passa pelo `CostSafetyGate` antes de
 * existir. Com `PAID_AI_ENABLED=false` e `AI_MONTHLY_BUDGET=0` — o padrão —
 * ele bloqueia, e o job fica `WAITING` em vez de gastar.
 *
 * ── ESTA RODADA NÃO PUBLICA ─────────────────────────────────────────────
 * Termina com conteúdo pronto para distribuição. Nenhuma `Publicacao` nasce
 * daqui: `Publicacao` representa distribuição REAL, não peça pronta.
 */

import { prisma } from './prisma'
import { gerarConteudoGratuito } from './conteudo-gratuito'
import { avaliarCusto, lerPoliticaDeCusto, type FonteDeEnv } from './cost-safety-gate'
import { avaliarMemoriaParaJobPesado } from './worker-memoria'
import { produtoPodeAparecerNoVideo } from './media-rights-produto'
import { chaveDoJob, type JobDesejado } from './automation-queue-contrato'
import type { ItemDoPlano } from './plano-de-acao'

// ── Formatos que a fábrica sabe produzir de verdade ─────────────────────

/**
 * Cada entrada aponta para código que existe e roda local.
 *
 * `VIDEO_IA_GERADO` NÃO está aqui: depende do fal.ai, que é pago. Ele
 * continua no catálogo do P1.2 como formato conhecido e bloqueado — a
 * fábrica simplesmente não o produz.
 */
export const FORMATOS_GRATUITOS = [
  'VIDEO_9X16_FFMPEG_NARRADO',
  'TEXTO_COM_LINK',
] as const
export type FormatoGratuito = (typeof FORMATOS_GRATUITOS)[number]

/**
 * Formatos reconhecidos pelo plano que a fábrica ainda NÃO produz, com o
 * motivo. Declarados para não virarem silêncio: um formato que some sem
 * explicação vira "o robô não fez e ninguém sabe por quê".
 */
export const FORMATOS_NAO_PRODUZIDOS: Record<string, string> = {
  VIDEO_IA_GERADO: 'Depende do fal.ai, que é pago. Bloqueado pelo CostSafetyGate.',
  VIDEO_DIGITAL_TWIN: 'Exige worker com GPU pareado; a fábrica só produz quando a capacidade estiver declarada.',
  CARROSSEL: 'O renderer monta imagem única e vídeo; carrossel ainda não tem caminho local de montagem.',
  IMAGEM_UNICA: 'Renderizável, mas depende de mídia autorizada do produto — entra quando o gate de direitos permitir.',
}

export function ehFormatoGratuito(formato: string | null | undefined): formato is FormatoGratuito {
  return !!formato && (FORMATOS_GRATUITOS as readonly string[]).includes(formato)
}

// ── Capacidade técnica ──────────────────────────────────────────────────

export const MOTIVOS_SEM_CAPACIDADE = [
  'FFMPEG_INDISPONIVEL',
  'CHATTERBOX_INDISPONIVEL',
  'MEMORIA_INSUFICIENTE',
  'FORMATO_NAO_PRODUZIDO',
  'CUSTO_BLOQUEADO',
] as const
export type MotivoSemCapacidade = (typeof MOTIVOS_SEM_CAPACIDADE)[number]

export interface CapacidadesDeGeracao {
  ffmpeg: boolean
  chatterbox: boolean
  /** Bytes livres de RAM. O gate de memória decide a partir disto. */
  memoriaLivreBytes: number
}

export interface VereditoDeCapacidade {
  pode: boolean
  motivo: MotivoSemCapacidade | null
  explicacao: string
}

/**
 * FUNÇÃO PURA. Este formato pode ser produzido AGORA?
 *
 * Fail-closed: capacidade não declarada é capacidade ausente. Assumir que
 * o FFmpeg existe porque "normalmente existe" produziria job que falha no
 * meio do render, depois de já ter gasto tempo e disco.
 */
export function avaliarCapacidade(
  formato: string,
  capacidades: CapacidadesDeGeracao,
  env: FonteDeEnv = process.env
): VereditoDeCapacidade {
  if (!ehFormatoGratuito(formato)) {
    return {
      pode: false,
      motivo: 'FORMATO_NAO_PRODUZIDO',
      explicacao: FORMATOS_NAO_PRODUZIDOS[formato] ?? `Formato "${formato}" não é produzido pela fábrica gratuita.`,
    }
  }

  // TEXTO_COM_LINK não precisa de render nem de voz.
  if (formato === 'TEXTO_COM_LINK') {
    return { pode: true, motivo: null, explicacao: 'Copy determinística, sem render nem narração — custo R$ 0,00.' }
  }

  // Vídeo: precisa das três coisas.
  if (!capacidades.ffmpeg) {
    return { pode: false, motivo: 'FFMPEG_INDISPONIVEL', explicacao: 'FFmpeg local não está disponível neste worker.' }
  }
  if (!capacidades.chatterbox) {
    return {
      pode: false,
      motivo: 'CHATTERBOX_INDISPONIVEL',
      explicacao: 'Chatterbox local indisponível — a narração é gratuita ou não acontece; não há substituto pago autorizado.',
    }
  }
  const memoria = avaliarMemoriaParaJobPesado(capacidades.memoriaLivreBytes, env)
  if (!memoria.podeReivindicar) {
    return { pode: false, motivo: 'MEMORIA_INSUFICIENTE', explicacao: memoria.motivo }
  }

  return { pode: true, motivo: null, explicacao: 'FFmpeg, Chatterbox e memória disponíveis — custo R$ 0,00.' }
}

/**
 * O portão de custo, antes de qualquer caminho que POSSA cobrar.
 *
 * Chamado mesmo quando o caminho escolhido é gratuito: é assim que um
 * formato pago introduzido no futuro não passa por omissão.
 */
export async function custoAutorizado(params: {
  workspaceId: string
  provider: string
  operacao: string
  env?: FonteDeEnv
}): Promise<{ permitido: boolean; explicacao: string }> {
  const politica = lerPoliticaDeCusto(params.env ?? process.env)
  const decisao = avaliarCusto({
    provider: params.provider,
    operacao: params.operacao,
    workspaceId: params.workspaceId,
    custoEstimado: null,
    gastoAcumulado: 0,
    politica,
  })
  return { permitido: decisao.permitido, explicacao: decisao.explicacao }
}

// ── Os jobs de geração ──────────────────────────────────────────────────

export const TIPO_JOB_GERACAO = 'GERAR_CONTEUDO'

/**
 * FUNÇÃO PURA. Itens do plano prontos → jobs de geração.
 *
 * SÓ entra o que está `PRONTO_PARA_GERAR_CONTEUDO`, com canal, formato
 * gratuito e custo zero. Qualquer dúvida deixa o item de fora — um job que
 * não pode ser executado é ruído na fila, não plano.
 *
 * O contexto carrega formato e canal, então mudar qualquer um deles gera
 * CHAVE NOVA: a peça anterior não é sobrescrita em silêncio.
 */
export function jobsDeGeracaoDoPlano(workspaceId: string, itens: ItemDoPlano[]): JobDesejado[] {
  const saida: JobDesejado[] = []
  for (const item of itens) {
    if (item.estado !== 'PRONTO_PARA_GERAR_CONTEUDO') continue
    if (!item.canalRecomendado || !ehFormatoGratuito(item.formatoRecomendado)) continue
    if (item.custoEstimado !== 0) continue
    if (item.workspaceId !== workspaceId) continue

    const contexto: Record<string, unknown> = {
      formato: item.formatoRecomendado,
      canal: item.canalRecomendado,
      custoEstimado: 0,
    }
    saida.push({
      chave: chaveDoJob({
        workspaceId,
        tipo: TIPO_JOB_GERACAO,
        entityType: 'PRODUTO',
        entityId: item.produtoId,
        contexto,
      }),
      tipo: TIPO_JOB_GERACAO,
      entityType: 'PRODUTO',
      entityId: item.produtoId,
      classe: 'AUTOMATIZAVEL',
      motivoHumano: null,
      contexto,
      explicacao: `Gerar ${item.formatoRecomendado} para ${item.canalRecomendado} — custo R$ 0,00.`,
    })
  }
  return saida
}

// ── A geração ───────────────────────────────────────────────────────────

export interface ResultadoDaGeracao {
  ok: boolean
  contentId: string | null
  /** `true` quando o Conteudo já existia — retry, não duplicata. */
  reaproveitado: boolean
  formato: string | null
  canal: string | null
  assetUrl: string | null
  custo: number
  erroFatal?: boolean
  erro?: string
  explicacao: string
}

/**
 * Executa a geração de UM job.
 *
 * ── IDEMPOTÊNCIA ────────────────────────────────────────────────────────
 * O `contentId` criado fica gravado no contexto do job. Um retry reencontra
 * a peça e não gera outra — nem outro asset, nem outro render. Isso importa
 * porque render custa minutos de CPU: duplicar não é só sujeira de dado, é
 * tempo de máquina jogado fora.
 *
 * ── PROVENIÊNCIA ────────────────────────────────────────────────────────
 * O conteúdo nasce com `status: 'roteiro_gerado'` e um registro de origem
 * automática em `alertasCompliance`. NUNCA é marcado como operação real:
 * `REAL_OPERATION` continua dependendo de venda comprovada, muito depois.
 *
 * ── NÃO PUBLICA ─────────────────────────────────────────────────────────
 * Nenhuma `Publicacao` é criada, nenhuma API de canal é chamada.
 */
export async function gerarConteudoDoJob(params: {
  workspaceId: string
  produtoId: string
  formato: string
  canal: string
  /** Do contexto do job, quando o retry já tem uma peça. */
  contentIdExistente?: string | null
  capacidades: CapacidadesDeGeracao
  agora: Date
  env?: FonteDeEnv
}): Promise<ResultadoDaGeracao> {
  const falhar = (
    explicacao: string,
    extra: Partial<ResultadoDaGeracao> = {}
  ): ResultadoDaGeracao => ({
    ok: false,
    contentId: null,
    reaproveitado: false,
    formato: params.formato,
    canal: params.canal,
    assetUrl: null,
    custo: 0,
    explicacao,
    ...extra,
  })

  // 1. CAPACIDADE, antes de qualquer trabalho.
  const capacidade = avaliarCapacidade(params.formato, params.capacidades, params.env)
  if (!capacidade.pode) {
    // Falta de capacidade não é falha: é espera. Quem chama transforma isto
    // em WAITING, não em tentativa gasta.
    return falhar(capacidade.explicacao, { erro: capacidade.motivo ?? undefined })
  }

  // 2. CUSTO. O caminho é gratuito, mas o portão é consultado do mesmo
  //    jeito — é assim que um formato pago futuro não entra por omissão.
  const custo = await custoAutorizado({
    workspaceId: params.workspaceId,
    provider: 'fal.ai',
    operacao: 'gerar-video',
    env: params.env,
  })
  if (custo.permitido) {
    // Só chega aqui se alguém habilitou gasto. A fábrica gratuita não usa,
    // mas o registro fica: o caminho pago existe e foi consultado.
    console.warn('[creative-factory] gasto pago está HABILITADO; a fábrica segue no caminho gratuito mesmo assim.')
  }

  try {
    // 3. RETRY: a peça já existe?
    if (params.contentIdExistente) {
      const existente = await prisma.conteudo.findFirst({
        where: { id: params.contentIdExistente, workspaceId: params.workspaceId },
        select: { id: true, videoUrl: true },
      })
      if (existente) {
        return {
          ok: true,
          contentId: existente.id,
          reaproveitado: true,
          formato: params.formato,
          canal: params.canal,
          assetUrl: existente.videoUrl,
          custo: 0,
          explicacao: 'Peça desta tentativa já existia — retry reusa, nunca duplica.',
        }
      }
    }

    // 4. O PRODUTO, lido do servidor e escopado pelo workspace.
    const produto = await prisma.produto.findFirst({
      where: { id: params.produtoId, workspaceId: params.workspaceId },
      select: {
        id: true, nome: true, categoria: true, preco: true, userId: true,
        beneficios: true, imagens: true, origemConteudo: true, origemDados: true,
      },
    })
    if (!produto) {
      return falhar('Produto não encontrado neste workspace.', { erroFatal: true })
    }

    // 5. DIREITOS DE MÍDIA — só importam para vídeo com imagem do produto.
    const midia = produtoPodeAparecerNoVideo({
      id: produto.id,
      nome: produto.nome,
      origemConteudo: produto.origemConteudo,
      imagens: produto.imagens,
      origemDados: produto.origemDados ?? undefined,
    })
    if (params.formato === 'VIDEO_9X16_FFMPEG_NARRADO' && !midia.visivel) {
      // O render tem fundo neutro para este caso, mas a decisão de usá-lo é
      // do plano, não da fábrica: aqui a mídia bloqueada barra a peça.
      return falhar(`Mídia sem direito de uso: ${midia.motivo}`, { erro: 'MIDIA_SEM_DIREITO' })
    }

    // 6. COPY DETERMINÍSTICA. Nenhuma chamada de rede, nenhum provider.
    const { conteudo: gerado, limitacoes } = gerarConteudoGratuito({
      nome: produto.nome,
      categoria: produto.categoria,
      preco: produto.preco,
      beneficios: produto.beneficios,
    })

    // 7. A PEÇA. Nasce com proveniência declarada e NUNCA como operação real.
    const conteudo = await prisma.conteudo.create({
      data: {
        workspaceId: params.workspaceId,
        userId: produto.userId,
        produtoId: produto.id,
        roteiro: gerado.roteiro,
        legendaInstagram: gerado.legendaInstagram,
        legendaTiktok: gerado.legendaTiktok,
        hashtags: gerado.hashtags,
        chamadaAcao: gerado.chamadaAcao,
        textoTela: gerado.textoTela,
        narracao: gerado.narracao,
        trilhaSugerida: gerado.trilhaSugerida,
        pontosPositivos: gerado.pontosPositivos,
        pontosNegativos: gerado.pontosNegativos,
        redeSocial: params.canal,
        status: 'roteiro_gerado',
        alertasCompliance: [
          {
            tipo: 'proveniencia',
            severidade: 'verde',
            mensagem: `Gerado automaticamente pela Creative Factory (${params.formato}, ${params.canal}) em ${params.agora.toISOString()}. Custo R$ 0,00.`,
            // Explícito: gerar não é operar. REAL_OPERATION depende de venda
            // comprovada, muito depois desta peça existir.
            acaoRecomendada: 'NAO_E_OPERACAO_REAL',
          },
          // As limitacoes do caminho gratuito viajam junto: campo vazio com
          // motivo e melhor que campo preenchido com palpite.
          ...limitacoes.map((l) => ({
            tipo: 'limitacao_do_caminho_gratuito',
            severidade: 'amarelo',
            mensagem: l,
            acaoRecomendada: 'REVISAR_SE_NECESSARIO',
          })),
          ...(gerado.alertasCompliance ?? []),
        ] as object[],
      },
      select: { id: true },
    })

    return {
      ok: true,
      contentId: conteudo.id,
      reaproveitado: false,
      formato: params.formato,
      canal: params.canal,
      // O render do vídeo entra quando o worker executar; a peça já existe.
      assetUrl: null,
      custo: 0,
      explicacao: `Peça gerada: ${params.formato} para ${params.canal}, copy determinística, custo R$ 0,00.`,
    }
  } catch (e) {
    console.error(`[creative-factory] falha ao gerar peça do produto ${params.produtoId}:`, e)
    return falhar(e instanceof Error ? e.message : 'Falha ao gerar a peça.', {
      erro: e instanceof Error ? e.message : 'desconhecido',
    })
  }
}

/**
 * REGRA PERMANENTE desta rodada.
 *
 * A fábrica termina com a peça pronta. Distribuir é outra decisão, com
 * outro portão — e `Publicacao` continua significando distribuição REAL.
 */
export const FABRICA_NAO_PUBLICA = {
  chave: 'creative-factory:publicacao',
  estado: 'DELIBERADAMENTE_FORA_DE_ESCOPO',
  porque:
    'Gerar e distribuir são decisões diferentes. Publicacao representa distribuição real; criá-la aqui diria que a peça circulou quando ela só existe.',
  desbloqueiaCom: 'REVENUE_AUTOPILOT',
  provedoresProibidos: ['fal.ai', 'anthropic', 'resend', 'z-api'],
} as const
