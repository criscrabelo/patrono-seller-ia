import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { gerarTokenReset } from '@/lib/reset-token'
import { enviarEmailReset } from '@/lib/email'

// Recebe um email e, SE existir uma conta com ele, envia um link de
// redefinição. Sempre responde ok — não revela se o email existe ou não
// (evita enumeração de contas).
export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({}))

  if (email && typeof email === 'string') {
    const emailNormalizado = email.trim().toLowerCase()
    const user = await prisma.user.findUnique({
      where: { email: emailNormalizado },
      select: { id: true, email: true, password: true },
    })

    if (user) {
      const token = gerarTokenReset(user.id, user.password)
      const origin = process.env.NEXTAUTH_URL || new URL(req.url).origin
      const link = `${origin}/redefinir-senha?token=${encodeURIComponent(token)}`
      try {
        await enviarEmailReset(user.email, link)
      } catch (e) {
        console.error('[esqueci-senha] falha ao enviar email:', e)
      }
    }
  }

  return NextResponse.json({ ok: true })
}
