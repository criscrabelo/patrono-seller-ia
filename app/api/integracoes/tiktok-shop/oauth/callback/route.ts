import { NextResponse } from 'next/server'

/**
 * P2.5 — Callback OAuth do TikTok Shop (autorização do criador): RESERVADO
 * e BLOQUEADO.
 *
 * O caminho existe para poder ser cadastrado no Partner Center quando o
 * domínio definitivo existir:
 *   https://<DOMÍNIO>/api/integracoes/tiktok-shop/oauth/callback
 *
 * Por que bloqueado: a P2.0 não conseguiu confirmar no Partner Center os
 * parâmetros de retorno, a troca do código e os escopos da autorização de
 * criador (`NAO_CONFIRMADO`). Implementar sem isso seria inventar
 * protocolo. Até lá esta rota:
 *   - NÃO lê o `code` nem o `state` da URL (nada vai para log);
 *   - NÃO chama o TikTok, NÃO grava nada, NÃO exige credencial;
 *   - responde 501 com o motivo.
 *
 * Exige SESSÃO (o middleware não a libera): a volta do TikTok é uma
 * navegação no navegador da própria usuária, que traz o cookie — é isso que
 * vai prender a autorização ao workspace certo quando ela for implementada.
 */
const BLOQUEIO = {
  error:
    'A conexão com o TikTok Shop ainda não está disponível. Nenhum dado da autorização foi lido ou guardado.',
  bloqueio: 'TIKTOK_SHOP_OAUTH_NAO_IMPLEMENTADO',
} as const

export async function GET() {
  return NextResponse.json(BLOQUEIO, { status: 501 })
}

export async function POST() {
  return NextResponse.json(BLOQUEIO, { status: 501 })
}
