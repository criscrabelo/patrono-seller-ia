import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validarCredenciaisInstagram, descobrirExpiracaoToken } from '@/lib/instagram'
import { registrarAuditoria } from '@/lib/audit-log'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const integracoes = await prisma.integracao.findMany({
    where: { workspaceId: session.user.workspaceId },
  })

  return NextResponse.json(integracoes)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const { plataforma, accessToken, accountId, extraData } = body
  let { accountName } = body

  let tokenExpiry: Date | undefined

  if (plataforma === 'instagram' && accessToken) {
    // Confere com a Meta se o token realmente funciona ANTES de salvar como
    // conectado — senão a tela mostraria "conectado / válido por 59d" para um
    // token morto, e a falha só apareceria na hora de publicar.
    if (!accountId) {
      return NextResponse.json(
        { error: 'Informe o Instagram Business Account ID (ou Instagram User ID).' },
        { status: 400 }
      )
    }
    try {
      const { username } = await validarCredenciaisInstagram({ accessToken, igUserId: accountId })
      if (username && !accountName) accountName = `@${username}`
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Token inválido'
      return NextResponse.json(
        {
          error:
            `O Instagram recusou essas credenciais: ${msg}. ` +
            'Confira se o token é de longa duração (não o de 1 hora) e se o ID da conta está correto.',
        },
        { status: 400 }
      )
    }

    // Usa a expiração real do token quando dá para descobrir; senão, assume 59 dias.
    const extra = (extraData ?? {}) as Record<string, string>
    const real = await descobrirExpiracaoToken({
      accessToken,
      appId: extra.appId,
      appSecret: extra.appSecret,
    })
    tokenExpiry = real ?? new Date(Date.now() + 59 * 24 * 60 * 60 * 1000)
  }

  const integracao = await prisma.integracao.upsert({
    where: { workspaceId_plataforma: { workspaceId: session.user.workspaceId, plataforma } },
    update: { accessToken, accountId, accountName, extraData, status: 'conectado', tokenExpiry, updatedAt: new Date() },
    create: { userId: session.user.id, workspaceId: session.user.workspaceId, plataforma, accessToken, accountId, accountName, extraData, status: 'conectado', tokenExpiry },
  })

  await registrarAuditoria({
    workspaceId: session.user.workspaceId,
    userId: session.user.id,
    action: 'integracao.conectada',
    entityType: 'Integracao',
    entityId: integracao.id,
    metadata: { plataforma },
  })

  return NextResponse.json(integracao)
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const plataforma = searchParams.get('plataforma')
  if (!plataforma) return NextResponse.json({ error: 'Plataforma obrigatória' }, { status: 400 })

  await prisma.integracao.updateMany({
    where: { workspaceId: session.user.workspaceId, plataforma },
    data: { status: 'desconectado', accessToken: null, refreshToken: null, accountId: null, accountName: null },
  })

  return NextResponse.json({ success: true })
}
