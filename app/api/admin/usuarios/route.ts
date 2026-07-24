import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session) return null
  if (session.user.role !== 'admin') return null
  return session
}

export async function GET() {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  const usuarios = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(usuarios)
}

export async function PATCH(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  const { id, status, role, email, name, password } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

  if (email !== undefined) {
    const emailNormalizado = String(email).trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalizado)) {
      return NextResponse.json({ error: 'Email inválido' }, { status: 400 })
    }
  }

  if (name !== undefined && !String(name).trim()) {
    return NextResponse.json({ error: 'Informe um nome' }, { status: 400 })
  }

  let passwordHash: string | undefined
  if (password !== undefined) {
    if (String(password).length < 6) {
      return NextResponse.json({ error: 'A senha precisa ter pelo menos 6 caracteres' }, { status: 400 })
    }
    passwordHash = await bcrypt.hash(String(password), 12)
  }

  // Trava de segurança: não deixar o sistema ficar sem nenhum admin.
  if (role && role !== 'admin') {
    const alvo = await prisma.user.findUnique({ where: { id }, select: { role: true } })
    if (alvo?.role === 'admin') {
      const totalAdmins = await prisma.user.count({ where: { role: 'admin' } })
      if (totalAdmins <= 1) {
        return NextResponse.json({ error: 'Não é possível remover o último administrador' }, { status: 400 })
      }
    }
  }

  try {
    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(role && { role }),
        ...(email !== undefined && { email: String(email).trim().toLowerCase() }),
        ...(name !== undefined && { name: String(name).trim() }),
        ...(passwordHash && { password: passwordHash }),
      },
      select: { id: true, name: true, email: true, role: true, status: true },
    })
    return NextResponse.json(updated)
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'Esse email já está em uso por outra conta' }, { status: 409 })
    }
    throw e
  }
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

  if (id === session.user.id) {
    return NextResponse.json({ error: 'Não é possível excluir sua própria conta' }, { status: 400 })
  }

  await prisma.user.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
