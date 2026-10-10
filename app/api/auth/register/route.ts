import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { criarUsuarioComWorkspace } from '@/lib/workspace'
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(2),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6),
})

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  }

  const { name, email, password } = parsed.data

  const exists = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } })
  if (exists) {
    return NextResponse.json({ error: 'Este email já está cadastrado.' }, { status: 409 })
  }

  const hashed = await bcrypt.hash(password, 12)

  // Cria a usuária e o workspace dela junto (toda usuária precisa de um
  // workspace — é o que isola os dados dela dos de outras contas).
  await criarUsuarioComWorkspace(prisma, {
    name,
    email,
    password: hashed,
    role: 'usuario',
    status: 'pendente',
  })

  return NextResponse.json({ ok: true }, { status: 201 })
}
