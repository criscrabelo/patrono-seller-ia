// SOMENTE TESTE LOCAL — simula o pior cenario realista pra validar a troca
// da constraint @@unique([userId, plataforma]) -> @@unique([contaId, plataforma]):
// producao como esta HOJE, com contaId NULO em tudo (backfill da Etapa 1
// nunca rodou la). Nunca roda em producao.
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const PLATAFORMAS = ['instagram', 'tiktok', 'mercadolivre', 'shopee', 'hotmart', 'whatsapp']

async function main() {
  const senha = await bcrypt.hash('teste123', 12)
  const user = await prisma.user.upsert({
    where: { email: 'producao@boracomprar.com' },
    update: {},
    create: { email: 'producao@boracomprar.com', password: senha, name: 'Usuária Produção', role: 'admin', status: 'ativo' },
  })

  for (const plataforma of PLATAFORMAS) {
    await prisma.integracao.create({
      data: {
        userId: user.id,
        plataforma,
        status: 'conectado',
        accessToken: `token-${plataforma}`,
        // contaId de proposito NAO informado -> fica NULL, exatamente como
        // esta em producao hoje (backfill da Etapa 1 nunca foi executado la).
      },
    })
  }

  const total = await prisma.integracao.count({ where: { userId: user.id } })
  console.log(`Simulado: ${total} integracoes com contaId NULO (estado real de producao hoje)`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
