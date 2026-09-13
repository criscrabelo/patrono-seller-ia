import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        })

        if (!user) return null

        const passwordMatch = await bcrypt.compare(credentials.password, user.password)
        if (!passwordMatch) return null

        if (user.status === 'pendente') throw new Error('PENDENTE')
        if (user.status === 'bloqueado') throw new Error('BLOQUEADO')

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          workspaceId: user.workspaceId,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as { role?: string }).role ?? 'usuario'
        token.workspaceId = (user as { workspaceId?: string }).workspaceId
      } else if (!token.workspaceId && token.id) {
        // Sessão emitida antes desta versão (sem workspaceId no token).
        // Busca uma vez e completa o token, em vez de forçar logout de
        // quem já estava logado quando este campo foi introduzido.
        const atual = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { workspaceId: true },
        })
        if (atual) token.workspaceId = atual.workspaceId
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        // Todo dado operacional (produto, link, conteúdo, integração,
        // programa, venda, comissão) é isolado por workspaceId — nunca por
        // userId sozinho. Ver lib/workspace.ts e DOCUMENTACAO-PATRONO-SELLER.md.
        session.user.workspaceId = token.workspaceId as string
      }
      return session
    },
  },
}

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      role: string
      workspaceId: string
    }
  }
}
