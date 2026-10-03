import { PrismaClient } from '@prisma/client'
import { bancoPermitidoNoAmbiente, resumoDoAmbiente } from './guarda-de-ambiente'

// P2.5: Preview/teste nunca abrem o banco de produção — ver
// lib/guarda-de-ambiente.ts. Falha aqui derruba o ambiente errado inteiro,
// que é exatamente o que se quer: melhor um Preview quebrado que um Preview
// escrevendo em produção.
const veredito = bancoPermitidoNoAmbiente(process.env)
// P2.6: uma linha por processo, sem nenhum valor — a prova do isolamento
// nos logs de cada deploy. Fora das suítes de teste.
if (process.env.NODE_ENV !== 'test') console.info(`[ambiente] ${resumoDoAmbiente(process.env)}`)
if (!veredito.ok) throw new Error(`[prisma] ${veredito.explicacao}`)

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
