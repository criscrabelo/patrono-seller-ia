/**
 * O que a Creative Factory REALMENTE produz hoje — autoridade única.
 *
 * ── POR QUE ESTE ARQUIVO EXISTE ─────────────────────────────────────────
 * Havia duas listas de formatos em dois módulos diferentes. `FORMATOS`, em
 * lib/plano-de-acao.ts, dizia o que o PLANO pode escolher. `FORMATOS_GRATUITOS`,
 * em lib/fabrica-de-conteudo.ts, dizia o que a FÁBRICA sabe montar. Elas
 * discordavam: o plano escolhia CARROSSEL e a fábrica não produz carrossel.
 * O resultado observado em 24/09 foi um plano marcado
 * PRONTO_PARA_GERAR_CONTEUDO com fila vazia — execução fantasma.
 *
 * A lista de quem PRODUZ é esta. O planejador pergunta, não repete.
 *
 * ── ESTE ARQUIVO É PURO E SEM DEPENDÊNCIA ───────────────────────────────
 * De propósito. lib/plano-de-acao.ts é determinístico e testável sem
 * Postgres; importar a fábrica inteira arrastaria prisma, worker de memória
 * e gate de custo para dentro do planejador. Aqui só existe a declaração.
 *
 * ── COMO ACRESCENTAR UM FORMATO ─────────────────────────────────────────
 * Escreva o caminho de geração na fábrica PRIMEIRO. Só depois mova o
 * formato de FORMATOS_NAO_PRODUZIDOS para ORDEM_DE_PRODUCAO. Inverter a
 * ordem recria exatamente o bug que este arquivo fecha.
 */

/**
 * Formatos que a fábrica monta, em ordem de preferência.
 *
 * A ordem é a do valor entregue: vídeo 9:16 narrado converte mais que
 * texto, então vem primeiro; texto é o piso que funciona sem capacidade
 * nenhuma e sem depender da mídia do produto.
 *
 * Cada entrada aponta para código que existe em `gerarConteudoDoJob`.
 * Nenhuma é aspiracional.
 */
export const ORDEM_DE_PRODUCAO = [
  'VIDEO_9X16_FFMPEG_NARRADO',
  'TEXTO_COM_LINK',
] as const
export type FormatoProduzido = (typeof ORDEM_DE_PRODUCAO)[number]

/**
 * Formatos reconhecidos pelo catálogo que a fábrica NÃO produz, e por quê.
 *
 * `VIDEO_DIGITAL_TWIN` merece nota: declarar a GPU disponível NÃO o torna
 * produzível. `avaliarCapacidade()` recusa qualquer formato fora de
 * `ORDEM_DE_PRODUCAO` antes mesmo de olhar capacidade, e não existe caminho
 * de geração para ele em `gerarConteudoDoJob`. Enquanto esse caminho não
 * for escrito, ele é tão não-produzível quanto o carrossel.
 */
export const FORMATOS_NAO_PRODUZIDOS: Record<string, string> = {
  VIDEO_IA_GERADO: 'Depende do fal.ai, que é pago. Bloqueado pelo CostSafetyGate.',
  VIDEO_DIGITAL_TWIN:
    'Não há caminho de geração na fábrica. Exigiria worker com GPU pareado E o código de render do avatar, que não existe. Declarar a GPU não basta.',
  CARROSSEL: 'O renderer monta imagem única e vídeo; carrossel ainda não tem caminho local de montagem.',
  IMAGEM_UNICA: 'Renderizável, mas depende de mídia autorizada do produto — entra quando o gate de direitos permitir.',
}

/** `true` só para o que a fábrica sabe montar agora. */
export function ehFormatoProduzivel(formato: string | null | undefined): formato is FormatoProduzido {
  return !!formato && (ORDEM_DE_PRODUCAO as readonly string[]).includes(formato)
}

/** Por que este formato não é produzido. `null` quando ele é produzido. */
export function motivoNaoProduzido(formato: string | null | undefined): string | null {
  if (ehFormatoProduzivel(formato)) return null
  if (!formato) return 'Nenhum formato indicado.'
  return FORMATOS_NAO_PRODUZIDOS[formato] ?? `Formato "${formato}" não está no catálogo da fábrica.`
}

/**
 * Posição do formato na ordem de produção. Não produzido vai para o fim.
 *
 * É o que faz o planejador percorrer primeiro o que dá para fazer, sem
 * precisar conhecer a lista — ele só ordena por este número.
 */
export function posicaoNaProducao(formato: string): number {
  const i = (ORDEM_DE_PRODUCAO as readonly string[]).indexOf(formato)
  return i === -1 ? Number.MAX_SAFE_INTEGER : i
}

/**
 * REGRA PERMANENTE.
 *
 * O plano nunca escolhe como execução automática um formato que a fábrica
 * não produz. Quando nenhum produzível é viável, o item vai para
 * AGUARDANDO_CAPACIDADE — e não para PRONTO_PARA_GERAR_CONTEUDO com fila
 * vazia, que é a execução fantasma.
 */
export const PLANO_SO_ESCOLHE_O_QUE_A_FABRICA_PRODUZ = {
  chave: 'formatos:autoridade-unica',
  autoridade: 'lib/capacidades-da-fabrica.ts',
  consultadoPor: ['lib/plano-de-acao.ts', 'lib/fabrica-de-conteudo.ts'],
  porque:
    'Duas listas divergentes produziram um plano que dizia "pronto" e uma fila vazia. Com uma autoridade só, a divergência deixa de ser possível.',
} as const
