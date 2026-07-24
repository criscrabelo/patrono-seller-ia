import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// Troca de senha pelo próprio usuário logado. Exige a senha atual
// correta antes de aplicar a nova (não precisa de email/serviço externo).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { senhaAtual, novaSenha } = await req.json()

  if (!senhaAtual || !novaSenha) {
    return NextResponse.json({ error: 'Preencha a senha atual e a nova senha' }, { status: 400 })
  }
  if (String(novaSenha).length < 6) {
    return NextResponse.json({ error: 'A nova senha precisa ter pelo menos 6 caracteres' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { password: true },
  })
  if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

  const confere = await bcrypt.compare(String(senhaAtual), user.password)
  if (!confere) {
    return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 400 })
  }

  const hash = await bcrypt.hash(String(novaSenha), 12)
  await prisma.user.update({ where: { id: session.user.id }, data: { password: hash } })

  return NextResponse.json({ ok: true })
}
