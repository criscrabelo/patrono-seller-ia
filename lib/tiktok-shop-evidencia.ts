/**
 * P2.15.3 — TikTok Shop: o item "Liberar a descoberta automática" só sai de
 * "Precisa de você" com EVIDÊNCIA real no sistema — nunca pela palavra de
 * ninguém (botão, Copilot ou API).
 *
 * Evidência = uma Integracao do TikTok Shop (linha `tiktok-shop` ou a futura
 * `tiktok-shop-creator`, P2.14.5.14 §6.8) com status `conectado`, token
 * guardado e não vencido. Hoje o callback OAuth responde 501, então essa
 * evidência ainda não tem como existir: o item fica pendente — de propósito.
 */
import { prisma } from './prisma'

export const CHAVE_TIKTOK_SHOP = 'estrategia:tiktok-shop-descoberta'
export const PLATAFORMAS_TIKTOK_SHOP = ['tiktok-shop', 'tiktok-shop-creator'] as const

/** Itens que nenhum clique tira da fila: só a evidência real. */
export function exigeEvidencia(chave: string): boolean {
  return chave === CHAVE_TIKTOK_SHOP
}

/** O que a titular faz, em ordem (resumo de P2.14.5.14 §6, sem segredo). */
export const PASSOS_TIKTOK_SHOP = [
  'Entre no TikTok Shop Partner Center (partner.tiktokshop.com) — não é o TikTok for Developers.',
  'Cadastre a empresa como parceira (Service Partner / App Developer) e crie um app do tipo Affiliate, região Brasil.',
  'Peça a liberação da Affiliate API e o escopo "Read Creator Affiliate Collaborations" (1021508). Ela vem desligada e depende de aprovação do TikTok.',
  'Com o app aprovado, guarde App Key e App Secret direto nas variáveis do site — nunca cole em conversa.',
  'Depois disso, o Patrono libera a conexão do TikTok Shop em Integrações (ainda não está disponível) e você autoriza a sua conta de criadora. Quando a conexão estiver ativa, este item sai sozinho.',
]

/** FUNÇÃO PURA: há evidência válida? Devolve a frase da evidência ou null. */
export function avaliarEvidencia(
  integracoes: { plataforma: string; status: string; temToken: boolean; tokenExpiry: Date | null }[],
  agora: Date
): string | null {
  const valida = integracoes.find(
    (i) =>
      (PLATAFORMAS_TIKTOK_SHOP as readonly string[]).includes(i.plataforma) &&
      i.status === 'conectado' &&
      i.temToken &&
      (!i.tokenExpiry || i.tokenExpiry.getTime() > agora.getTime())
  )
  return valida ? `Integração ${valida.plataforma} conectada, com acesso válido.` : null
}

export async function evidenciaDoTikTokShop(workspaceId: string, agora = new Date()): Promise<string | null> {
  const linhas = await prisma.integracao.findMany({
    where: { workspaceId, plataforma: { in: [...PLATAFORMAS_TIKTOK_SHOP] } },
    select: { plataforma: true, status: true, accessToken: true, tokenExpiry: true },
  })
  return avaliarEvidencia(
    linhas.map((l) => ({ plataforma: l.plataforma, status: l.status, temToken: !!l.accessToken, tokenExpiry: l.tokenExpiry })),
    agora
  )
}
