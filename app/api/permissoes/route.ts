import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { MODULO_KEYS } from '@/lib/modulos'

// Retorna os módulos liberados para o papel do usuário logado.
// Admin sempre vê tudo, sem consultar o banco. Módulo sem registro
// explícito é considerado liberado (default-allow).
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  if (session.user.role === 'admin') {
    return NextResponse.json({ modulos: MODULO_KEYS })
  }

  const bloqueados = await prisma.moduloPermissao.findMany({
    where: { role: session.user.role, liberado: false },
    select: { modulo: true },
  })
  const bloqueadosSet = new Set(bloqueados.map((b) => b.modulo))

  return NextResponse.json({
    modulos: MODULO_KEYS.filter((m) => !bloqueadosSet.has(m)),
  })
}
