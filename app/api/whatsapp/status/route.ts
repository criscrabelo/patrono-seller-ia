import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { verificarConexao } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const integracao = await prisma.integracao.findUnique({
    where: { workspaceId_plataforma: { workspaceId: session.user.workspaceId, plataforma: 'whatsapp' } },
  })

  if (!integracao || integracao.status !== 'conectado' || !integracao.accountId || !integracao.accessToken) {
    return NextResponse.json({ configurado: false })
  }

  const extra = (integracao.extraData ?? {}) as Record<string, string>

  try {
    const { conectado, numero } = await verificarConexao({
      instanceId: integracao.accountId,
      token: integracao.accessToken,
      clientToken: extra.clientToken,
    })
    return NextResponse.json({ configurado: true, conectado, numero })
  } catch {
    return NextResponse.json({ configurado: true, conectado: false })
  }
}
