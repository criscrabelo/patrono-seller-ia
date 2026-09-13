import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { registrarAuditoria } from '@/lib/audit-log'
import { lerCredenciaisOAuthTikTok, validarState, trocarCodigoPorToken } from '@/lib/tiktok-oauth'

/**
 * Callback real do OAuth do TikTok Channel. Nunca confia no `state` sem
 * verificar a assinatura — é a única coisa que amarra este código à
 * usuária que iniciou o fluxo (o TikTok não manda sessão nossa de volta).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const erro = searchParams.get('error')

  if (erro) {
    return NextResponse.json({ error: `TikTok recusou a autorização: ${erro}` }, { status: 400 })
  }
  if (!code || !state) {
    return NextResponse.json({ error: 'Callback do TikTok sem code/state.' }, { status: 400 })
  }

  const stateValido = validarState(state)
  if (!stateValido) {
    return NextResponse.json({ error: 'State inválido ou expirado — reinicie a autorização do TikTok.' }, { status: 400 })
  }

  const creds = lerCredenciaisOAuthTikTok()
  if (!creds) {
    return NextResponse.json({ error: 'TikTok não configurado no servidor.' }, { status: 400 })
  }

  let tokens
  try {
    tokens = await trocarCodigoPorToken(creds, code)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Falha ao trocar código por token.'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const integracao = await prisma.integracao.upsert({
    where: { workspaceId_plataforma: { workspaceId: stateValido.workspaceId, plataforma: 'tiktok' } },
    update: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accountId: tokens.openId,
      tokenExpiry: new Date(Date.now() + tokens.expiresInSeconds * 1000),
      extraData: { scope: tokens.scope, refreshExpiresInSeconds: tokens.refreshExpiresInSeconds },
      status: 'conectado',
      updatedAt: new Date(),
    },
    create: {
      // OAuth não retorna userId nosso — usa a primeira usuária do workspace
      // (mesma limitação já existente para 1 usuária = 1 workspace, Rodada 2).
      userId: (await prisma.user.findFirstOrThrow({ where: { workspaceId: stateValido.workspaceId } })).id,
      workspaceId: stateValido.workspaceId,
      plataforma: 'tiktok',
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accountId: tokens.openId,
      tokenExpiry: new Date(Date.now() + tokens.expiresInSeconds * 1000),
      extraData: { scope: tokens.scope, refreshExpiresInSeconds: tokens.refreshExpiresInSeconds },
      status: 'conectado',
    },
  })

  await registrarAuditoria({
    workspaceId: stateValido.workspaceId,
    userId: integracao.userId,
    action: 'integracao.conectada',
    entityType: 'Integracao',
    entityId: integracao.id,
    metadata: { plataforma: 'tiktok' }, // nunca token/segredo
  })

  return NextResponse.redirect(new URL('/integracoes?tiktok=conectado', req.url))
}
