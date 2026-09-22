/**
 * Captura prospectiva + rotulagem negativa (P0.2 — Bloco 4.1).
 *
 * ── O QUE MUDA EM RELAÇÃO AO BLOCO 4 ────────────────────────────────────
 * O Bloco 4 criava a amostra QUANDO A VENDA CHEGAVA, reextraindo as
 * features do conteúdo naquele momento. Duas consequências ruins:
 *
 *  1. as features descreviam o conteúdo COMO ELE ESTÁ HOJE, não como estava
 *     quando foi publicado — se a proprietária editou o hook depois, a
 *     observação histórica era reescrita em silêncio;
 *  2. só existiam amostras positivas, porque nada acontecia quando um
 *     conteúdo era publicado e não convertia.
 *
 * Agora a ordem é a correta:
 *
 *   conteúdo publicado → captura features → snapshot SEM label
 *                      → resultado futuro → label (positivo ou negativo)
 *
 * ── IMUTABILIDADE ───────────────────────────────────────────────────────
 * Depois de capturada, uma amostra NUNCA tem as features reescritas. O
 * rótulo é a única coisa que muda. Uma observação histórica que se altera
 * depois não é observação, é opinião atual disfarçada de dado.
 *
 * ── CONTEÚDO LEGADO ─────────────────────────────────────────────────────
 * Conteúdo publicado ANTES desta rodada não tem snapshot, e não há como
 * criar um honestamente: `Conteudo` não guarda histórico de revisões, então
 * qualquer reconstrução usaria campos que podem ter sido editados. A lacuna
 * é registrada (`listarLacunasDeCaptura`) em vez de preenchida com palpite.
 */

import { prisma } from './prisma'
import { FEATURE_VERSION, extrairFeaturesDeConteudo } from './ml-feature-store'
import { verificarSemDadosBiometricos } from './ml-privacy'
import {
  ENTIDADE_DA_AMOSTRA,
  chaveDaAmostra,
  verificarSemVazamentoDeResultado,
  type LabelDeOperacaoReal,
} from './ml-operacao-real'
import { avaliarVendaParaOperacaoReal } from './real-operation'

// ── Janela de observação ────────────────────────────────────────────────

/**
 * POLÍTICA INTERNA DO PATRONO — não é regra de provider.
 *
 * Nenhum provider integrado hoje publica uma janela oficial de atribuição
 * para o Patrono. Apresentar um número interno como se fosse "a janela do
 * TikTok" produziria um dado que parece oficial e não é.
 *
 * 30 dias é uma escolha conservadora: cobre com folga as janelas típicas de
 * programas de afiliado e erra para o lado de esperar mais antes de declarar
 * que um conteúdo não converteu. Rotular negativo cedo demais ensinaria ao
 * modelo que um criativo falhou quando ele só ainda não tinha dado retorno.
 *
 * Configurável por `ML_CONVERSION_OBSERVATION_WINDOW_DAYS`. Quando um
 * provider publicar a regra dele, ela entra como política PRÓPRIA daquele
 * provider, nunca substituindo esta em silêncio.
 */
export const JANELA_OBSERVACAO_PADRAO_DIAS = 30

export interface PoliticaDeObservacao {
  dias: number
  origem: 'PADRAO_INTERNO' | 'CONFIGURADO'
  /** Sempre `false` nesta fase: nenhum provider forneceu regra oficial. */
  oficialDeProvider: boolean
}

export function lerPoliticaDeObservacao(
  env: Record<string, string | undefined> = process.env
): PoliticaDeObservacao {
  const bruto = env.ML_CONVERSION_OBSERVATION_WINDOW_DAYS
  if (bruto !== undefined && bruto.trim() !== '') {
    const valor = Number(bruto)
    if (Number.isFinite(valor) && valor > 0) {
      return { dias: valor, origem: 'CONFIGURADO', oficialDeProvider: false }
    }
  }
  return { dias: JANELA_OBSERVACAO_PADRAO_DIAS, origem: 'PADRAO_INTERNO', oficialDeProvider: false }
}

export function janelaEncerrada(
  dataPublicacao: Date | null | undefined,
  agora: Date,
  dias: number
): boolean {
  if (!(dataPublicacao instanceof Date) || !Number.isFinite(dataPublicacao.getTime())) return false
  const fim = dataPublicacao.getTime() + dias * 24 * 60 * 60 * 1000
  return agora.getTime() >= fim
}

// ── Captura na publicação ───────────────────────────────────────────────

export const MOTIVOS_CAPTURA = [
  'CAPTURADO',
  /** Já havia amostra desta versão de features para este conteúdo. */
  'JA_CAPTURADO',
  'CONTEUDO_NAO_ENCONTRADO',
  'FEATURES_INDISPONIVEIS',
] as const

export type MotivoCaptura = (typeof MOTIVOS_CAPTURA)[number]

export interface ResultadoDaCaptura {
  capturado: boolean
  motivo: MotivoCaptura
  snapshotId: string | null
  workspaceId: string
  contentId: string
  explicacao: string
}

/**
 * Captura a amostra no instante da publicação — SEM label.
 *
 * Idempotente pela mesma chave do Bloco 4
 * (`workspaceId + Conteudo + contentId + featureVersion`): publicar o mesmo
 * conteúdo duas vezes, ou o cron reprocessar, converge na mesma linha.
 *
 * NUNCA lança: publicação real não pode falhar porque o ML não conseguiu
 * observar. O erro vai para o log e a lacuna fica visível.
 */
export async function capturarSnapshotDePublicacao(params: {
  workspaceId: string
  contentId: string
  agora?: Date
}): Promise<ResultadoDaCaptura> {
  const base = {
    workspaceId: params?.workspaceId ?? '',
    contentId: params?.contentId ?? '',
  }
  const falhar = (motivo: MotivoCaptura, explicacao: string): ResultadoDaCaptura => ({
    capturado: false,
    motivo,
    snapshotId: null,
    ...base,
    explicacao,
  })

  if (!base.workspaceId || !base.contentId) {
    return falhar('CONTEUDO_NAO_ENCONTRADO', 'workspaceId e contentId são obrigatórios juntos.')
  }

  try {
    const extraido = await extrairFeaturesDeConteudo(base.workspaceId, base.contentId)
    if (!extraido) {
      return falhar('CONTEUDO_NAO_ENCONTRADO', 'Conteúdo não encontrado neste workspace.')
    }

    const asRecord = extraido.features as unknown as Record<string, unknown>
    verificarSemDadosBiometricos(asRecord)
    verificarSemVazamentoDeResultado(asRecord)

    const chave = chaveDaAmostra({ workspaceId: base.workspaceId, entityId: base.contentId })
    const agora = params.agora ?? new Date()

    return await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS ok FROM (SELECT pg_advisory_xact_lock(hashtext(${chave}))) AS trava`

      const existente = await tx.mLFeatureSnapshot.findFirst({
        where: {
          workspaceId: base.workspaceId,
          entityType: ENTIDADE_DA_AMOSTRA,
          entityId: base.contentId,
          featureVersion: FEATURE_VERSION,
        },
        select: { id: true },
      })
      if (existente) {
        // Republicação NÃO reescreve a observação original. Ver
        // `LIMITACAO_DE_REVISAO` no fim deste arquivo.
        return {
          capturado: false,
          motivo: 'JA_CAPTURADO' as const,
          snapshotId: existente.id,
          ...base,
          explicacao: 'Já existe amostra desta versão de features para este conteúdo — a observação original é preservada.',
        }
      }

      const novo = await tx.mLFeatureSnapshot.create({
        data: {
          workspaceId: base.workspaceId,
          entityType: ENTIDADE_DA_AMOSTRA,
          entityId: base.contentId,
          featureVersion: FEATURE_VERSION,
          // A publicação não prova nada sobre a venda. A origem da AMOSTRA é
          // a operação real do workspace; o que decide se ela conta é o
          // LABEL, que só chega depois e só pela autoridade.
          dataOrigin: 'REAL_OPERATION',
          features: extraido.features as never,
          capturedAt: agora,
          // O resultado ainda não existe. Rotular agora seria inventá-lo.
          label: undefined,
          labeledAt: null,
        },
        select: { id: true },
      })

      return {
        capturado: true,
        motivo: 'CAPTURADO' as const,
        snapshotId: novo.id,
        ...base,
        explicacao: `Amostra capturada na publicação do conteúdo ${base.contentId}, sem rótulo.`,
      }
    })
  } catch (e) {
    console.error(`[ml-captura] falha ao capturar amostra do conteúdo ${base.contentId}:`, e)
    return falhar('FEATURES_INDISPONIVEIS', e instanceof Error ? e.message : 'Falha ao capturar a amostra.')
  }
}

/**
 * Captura em lote, para os pontos que publicam vários conteúdos de uma vez.
 * Cada falha é isolada: um conteúdo problemático não impede os outros.
 */
export async function capturarSnapshotsDePublicacao(
  workspaceId: string,
  contentIds: string[],
  agora?: Date
): Promise<ResultadoDaCaptura[]> {
  const resultados: ResultadoDaCaptura[] = []
  for (const contentId of contentIds ?? []) {
    resultados.push(await capturarSnapshotDePublicacao({ workspaceId, contentId, agora }))
  }
  return resultados
}

// ── Rotulagem negativa ──────────────────────────────────────────────────

export const MOTIVOS_NEGATIVO = [
  'ROTULADO_NEGATIVO',
  /** A janela de observação ainda não terminou. */
  'JANELA_ABERTA',
  /** Sem data de publicação não há janela a contar. */
  'SEM_DATA_DE_PUBLICACAO',
  /** Não há amostra capturada — conteúdo legado. Nunca criada retroativamente. */
  'SEM_AMOSTRA_CAPTURADA',
  /** A amostra já tem rótulo. */
  'JA_ROTULADO',
  /**
   * Há venda ligada a este conteúdo que não está resolvida — relatada e não
   * comprovada, ou comprovada e ainda sem comissão reconhecida. Declarar
   * "não converteu" aqui seria afirmar mais do que se sabe.
   */
  'RESULTADO_EM_DUVIDA',
] as const

export type MotivoNegativo = (typeof MOTIVOS_NEGATIVO)[number]

export interface ResultadoDoNegativo {
  rotulado: boolean
  motivo: MotivoNegativo
  snapshotId: string | null
  workspaceId: string
  contentId: string
  explicacao: string
}

/** Label de ausência de conversão. Zeros explícitos, nunca `null` disfarçado. */
export function montarLabelNegativo(agora: Date = new Date()): LabelDeOperacaoReal {
  return {
    converted: false,
    vendasElegiveis: 0,
    valorBrutoVendas: 0,
    comissaoEsperada: 0,
    comissaoConfirmada: 0,
    comissaoRecebida: 0,
    receitaRealizada: 0,
    atribuicaoDeClique: { comClique: 0, semClique: 0 },
    origemDoLabel: 'JANELA_DE_OBSERVACAO_ENCERRADA',
    featureVersion: FEATURE_VERSION,
    labeledAt: agora.toISOString(),
  }
}

/**
 * Rotula um conteúdo como NÃO convertido — mas só quando a janela fechou e
 * não há dúvida nenhuma sobre o resultado.
 *
 * Na dúvida, deixa sem rótulo. Uma amostra sem rótulo apenas não entra no
 * treino; uma amostra rotulada errado ensina o contrário do que aconteceu.
 */
export async function rotularNegativoSeJanelaEncerrada(params: {
  workspaceId: string
  contentId: string
  agora?: Date
  env?: Record<string, string | undefined>
}): Promise<ResultadoDoNegativo> {
  const base = { workspaceId: params?.workspaceId ?? '', contentId: params?.contentId ?? '' }
  const agora = params.agora ?? new Date()
  const politica = lerPoliticaDeObservacao(params.env ?? process.env)

  const negar = (motivo: MotivoNegativo, explicacao: string, snapshotId: string | null = null): ResultadoDoNegativo => ({
    rotulado: false,
    motivo,
    snapshotId,
    ...base,
    explicacao,
  })

  const conteudo = await prisma.conteudo.findFirst({
    where: { id: base.contentId, workspaceId: base.workspaceId },
    select: { dataPublicacao: true },
  })
  if (!conteudo?.dataPublicacao) {
    return negar('SEM_DATA_DE_PUBLICACAO', 'Conteúdo sem data de publicação — não há janela a contar.')
  }
  if (!janelaEncerrada(conteudo.dataPublicacao, agora, politica.dias)) {
    return negar('JANELA_ABERTA', `A janela de ${politica.dias} dias ainda não terminou.`)
  }

  const amostra = await prisma.mLFeatureSnapshot.findFirst({
    where: {
      workspaceId: base.workspaceId,
      entityType: ENTIDADE_DA_AMOSTRA,
      entityId: base.contentId,
      featureVersion: FEATURE_VERSION,
    },
    select: { id: true, labeledAt: true },
  })
  if (!amostra) {
    // Conteúdo legado: nunca criamos a amostra retroativamente.
    return negar(
      'SEM_AMOSTRA_CAPTURADA',
      'Não há amostra capturada na publicação deste conteúdo. Criar uma agora usaria campos possivelmente editados — a lacuna fica registrada em vez de preenchida com palpite.'
    )
  }
  if (amostra.labeledAt) {
    return negar('JA_ROTULADO', 'Esta amostra já tem rótulo.', amostra.id)
  }

  // Qualquer venda não cancelada ligada ao conteúdo cria dúvida: ou já é
  // operação real elegível (e então o positivo é que deve rotular), ou é
  // relato/promessa ainda não resolvida.
  const vendas = await prisma.sale.findMany({
    where: { workspaceId: base.workspaceId, contentId: base.contentId, status: { not: 'CANCELLED' } },
    select: { id: true },
  })
  if (vendas.length > 0) {
    return negar(
      'RESULTADO_EM_DUVIDA',
      `Há ${vendas.length} venda(s) não cancelada(s) ligada(s) a este conteúdo. Declarar "não converteu" seria afirmar mais do que se sabe.`,
      amostra.id
    )
  }

  const label = montarLabelNegativo(agora)
  await prisma.mLFeatureSnapshot.update({
    where: { id: amostra.id },
    // SÓ o rótulo. As features capturadas na publicação nunca são tocadas.
    data: { label: label as never, labeledAt: new Date(label.labeledAt) },
  })

  return {
    rotulado: true,
    motivo: 'ROTULADO_NEGATIVO',
    snapshotId: amostra.id,
    ...base,
    explicacao: `Janela de ${politica.dias} dias encerrada sem nenhuma venda: conteúdo rotulado como não convertido.`,
  }
}

/**
 * Varredura do gatilho D: fecha a janela de todos os conteúdos elegíveis.
 * Idempotente — rodar duas vezes não cria nem rotula nada de novo.
 */
export async function fecharJanelasDeObservacao(params?: {
  workspaceId?: string
  agora?: Date
  env?: Record<string, string | undefined>
  limite?: number
}): Promise<{ examinados: number; rotulados: number; porMotivo: Record<string, number> }> {
  const agora = params?.agora ?? new Date()
  const politica = lerPoliticaDeObservacao(params?.env ?? process.env)
  const limiteDaJanela = new Date(agora.getTime() - politica.dias * 24 * 60 * 60 * 1000)

  const candidatos = await prisma.mLFeatureSnapshot.findMany({
    where: {
      ...(params?.workspaceId ? { workspaceId: params.workspaceId } : {}),
      entityType: ENTIDADE_DA_AMOSTRA,
      featureVersion: FEATURE_VERSION,
      // Só o que ainda não tem rótulo: rotulado não é reexaminado.
      labeledAt: null,
      capturedAt: { lte: limiteDaJanela },
    },
    select: { workspaceId: true, entityId: true },
    take: params?.limite ?? 500,
  })

  const porMotivo: Record<string, number> = {}
  let rotulados = 0
  for (const c of candidatos) {
    if (!c.entityId) continue
    const r = await rotularNegativoSeJanelaEncerrada({
      workspaceId: c.workspaceId,
      contentId: c.entityId,
      agora,
      env: params?.env,
    })
    porMotivo[r.motivo] = (porMotivo[r.motivo] ?? 0) + 1
    if (r.rotulado) rotulados++
  }

  return { examinados: candidatos.length, rotulados, porMotivo }
}

// ── Lacunas e limitações declaradas ─────────────────────────────────────

/**
 * Conteúdos publicados SEM amostra capturada — o legado desta rodada.
 *
 * Diagnóstico, não conserto: não existe forma honesta de reconstruir a
 * observação. `Conteudo` não guarda revisões, então qualquer reconstrução
 * usaria o estado ATUAL dos campos, que pode ter sido editado depois da
 * publicação. Isso é exatamente o vazamento que o Bloco 4.1 veio corrigir.
 */
export async function listarLacunasDeCaptura(
  workspaceId: string,
  limite = 200
): Promise<Array<{ contentId: string; dataPublicacao: Date | null }>> {
  const publicados = await prisma.conteudo.findMany({
    where: { workspaceId, status: 'publicado' },
    select: { id: true, dataPublicacao: true },
    orderBy: { dataPublicacao: 'desc' },
    take: limite,
  })
  if (publicados.length === 0) return []

  const comAmostra = await prisma.mLFeatureSnapshot.findMany({
    where: {
      workspaceId,
      entityType: ENTIDADE_DA_AMOSTRA,
      featureVersion: FEATURE_VERSION,
      entityId: { in: publicados.map((p) => p.id) },
    },
    select: { entityId: true },
  })
  const jaTem = new Set(comAmostra.map((a) => a.entityId))
  return publicados.filter((p) => !jaTem.has(p.id)).map((p) => ({ contentId: p.id, dataPublicacao: p.dataPublicacao }))
}

/**
 * FILA DE AUTOMAÇÃO — limitação conhecida e declarada.
 *
 * `featureVersion` versiona o ESQUEMA de features, não a revisão do
 * conteúdo. Se a proprietária editar um conteúdo já publicado e publicar de
 * novo, a chave de idempotência continua a mesma e a observação ORIGINAL é
 * preservada — que é o comportamento seguro, porque reescrever apagaria um
 * dado histórico.
 *
 * O custo é real: uma venda vinda da segunda publicação será atribuída às
 * features da primeira. Resolver isso exige um conceito de REVISÃO de
 * conteúdo que o schema não tem, e inventá-lo aqui seria mudança grande
 * fora do escopo desta rodada.
 */
export const LIMITACAO_DE_REVISAO = {
  chave: 'ml:revisao-de-conteudo-republicado',
  explicacao:
    'Conteúdo editado e republicado reaproveita a amostra da primeira publicação. Preservar a observação original é o comportamento seguro, mas a atribuição fica imprecisa. Resolver exige versionar a revisão do Conteudo — não existe no schema hoje.',
} as const

/** Reexporta para quem orquestra os gatilhos. */
export { avaliarVendaParaOperacaoReal }
