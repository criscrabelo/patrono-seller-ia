import { PrismaClient } from '@prisma/client'
import { bancoPermitidoNoAmbiente, resumoDoAmbiente } from './guarda-de-ambiente'
import { extensaoDoCofre } from './cofre-prisma'

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

// P2.14.7: o cofre (lib/cofre-prisma.ts) cifra/decifra os segredos de
// `Integracao` aqui, para nenhum caminho gravar token em texto puro. A
// extensão só muda comportamento, não tipos — por isso o cast é seguro.
export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  (new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  }).$extends(extensaoDoCofre) as unknown as PrismaClient)

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
