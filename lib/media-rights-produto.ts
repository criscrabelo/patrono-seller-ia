/**
 * Direitos de mídia de um Produto (Rodada 10) — resolvidos a partir do que o
 * cadastro JÁ guarda (`Produto.origemConteudo`), sem coluna nova e sem
 * migration.
 *
 * `mediaRightsGate()` (lib/media-rights.ts) sempre existiu como função pura,
 * mas nada no banco dizia qual a policy da mídia de um produto: na prática
 * ninguém conseguia chamar o portão com um produto real. Este módulo é a
 * ponte que faltava.
 *
 * A regra segue a mesma filosofia do resto do projeto — **nunca assumir
 * autorização**. Só duas origens liberam derivar/compor em vídeo:
 *
 * - `Próprio`       — a mídia é da própria proprietária.
 * - `Gerado por IA` — gerado legitimamente por nós (entra em
 *                     `PRIORIDADE_FONTE_MIDIA` como `GERADA_LEGITIMAMENTE`).
 *
 * `Licenciado` e `De fornecedor` caem em `UNKNOWN` de propósito: a licença
 * pode até permitir, mas os termos não estão registrados em lugar nenhum do
 * sistema (o modelo `TermoJuridico` ainda não existe). Tratar como permitido
 * seria inventar uma autorização que ninguém conferiu. Quando o termo de
 * cessão for modelado, é aqui que ele entra.
 */

import { direitosDaPolicy, type MediaRightsRecord, type MediaUsagePolicy } from './media-rights'

export interface ProdutoParaDireitos {
  id: string
  nome: string
  origemConteudo: string
  imagens: string[]
}

/** Compara origem sem depender de acento/caixa — o cadastro aceita texto livre. */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
}

const POLICY_POR_ORIGEM: Record<string, MediaUsagePolicy> = {
  proprio: 'DERIVATIVE_ALLOWED',
  'gerado por ia': 'DERIVATIVE_ALLOWED',
  licenciado: 'UNKNOWN',
  'de fornecedor': 'UNKNOWN',
}

/**
 * Identificador do asset para o registro de direitos. Sem imagem cadastrada,
 * o id aponta para o próprio produto: o portão continua decidindo sobre algo
 * concreto em vez de receber string vazia.
 */
function idDoAsset(produto: ProdutoParaDireitos): string {
  return produto.imagens[0] ?? `produto:${produto.id}:sem-midia`
}

export function resolverDireitosDoProduto(produto: ProdutoParaDireitos): MediaRightsRecord {
  const origem = normalizar(produto.origemConteudo || '')
  // Origem não reconhecida nunca vira "permitido por omissão".
  const policy = POLICY_POR_ORIGEM[origem] ?? 'UNKNOWN'

  return direitosDaPolicy(policy, {
    assetId: idDoAsset(produto),
    source: `cadastro-do-produto:${origem || 'nao-informada'}`,
    authorizingSource: produto.origemConteudo || 'origem não informada no cadastro',
    storageExpiresAt: null,
  })
}

/**
 * O produto pode APARECER no vídeo? Exige mídia cadastrada E direito de
 * derivar. Sem imagem, o vídeo ainda é gerado — só não mostra o produto
 * (mesma decisão que `digital-twin-autopilot-integration.ts` já tomava para
 * o avatar), e o preset é avisado por `produtoVisivelNoAsset: false`.
 */
export function produtoPodeAparecerNoVideo(produto: ProdutoParaDireitos): {
  visivel: boolean
  motivo: string
  record: MediaRightsRecord
} {
  const record = resolverDireitosDoProduto(produto)

  if (produto.imagens.length === 0) {
    return {
      visivel: false,
      motivo: 'Produto sem imagem cadastrada — o vídeo usa fundo neutro e não exibe o produto.',
      record,
    }
  }

  const permitido = record.canDerive && record.canTransform
  return {
    visivel: permitido,
    motivo: permitido
      ? `Mídia do produto autorizada a compor vídeo (origem: ${produto.origemConteudo}).`
      : `Mídia do produto não autorizada a compor vídeo (origem: ${produto.origemConteudo}) — vídeo segue com fundo neutro.`,
    record,
  }
}
