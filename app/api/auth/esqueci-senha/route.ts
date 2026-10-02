import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { gerarTokenReset } from '@/lib/reset-token'
import { enviarEmailReset } from '@/lib/email'
import { basePublicaParaExibir } from '@/lib/link-de-publicacao'

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
      // P2.5: a base vem da função central (PUBLIC_BASE_URL → NEXTAUTH_URL).
      // A origem da requisição só vale em DESENVOLVIMENTO: em produção ela
      // viria do cabeçalho Host, que quem pede controla — e o link com o
      // token iria para o domínio de outra pessoa.
      const base = basePublicaParaExibir(process.env, new URL(req.url).origin)
      if (!base.ok) {
        console.error('[esqueci-senha] sem base pública configurada — e-mail NÃO enviado:', base.motivo)
      } else {
        const link = `${base.baseUrl}/redefinir-senha?token=${encodeURIComponent(token)}`
        try {
          await enviarEmailReset(user.email, link)
        } catch (e) {
          console.error('[esqueci-senha] falha ao enviar email:', e)
        }
      }
    }
  }

  return NextResponse.json({ ok: true })
}
