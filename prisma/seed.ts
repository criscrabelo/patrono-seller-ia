import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { criarUsuarioComWorkspace } from '../lib/workspace'

/**
 * Seed — apenas o primeiro administrador.
 *
 * REGRA PERMANENTE: "zero significa zero".
 * Uma conta recém-criada começa com 0 produtos, 0 links, 0 cliques, 0 vendas,
 * R$ 0,00 de comissão e 0 publicações. Este arquivo NÃO cria produtos,
 * links, vendas nem qualquer número de exemplo.
 *
 * (Versões anteriores criavam "Power Bank 20000mAh" e "Fone Bluetooth Premium"
 * com IDs fixos. Removidos: eram dados fictícios entrando no banco real.)
 *
 * Dados de demonstração, quando necessários para teste, ficam em um banco
 * isolado e nunca neste arquivo.
 */

const prisma = new PrismaClient()

/**
 * Trava de segurança: o seed cria um usuário com senha conhecida.
 * Rodá-lo contra o banco de produção abriria uma porta de entrada.
 * Para rodar mesmo assim (primeiro provisionamento), use:
 *   PERMITIR_SEED_PRODUCAO=sim npm run db:seed
 */
function verificarAmbiente() {
  if (process.env.PERMITIR_SEED_PRODUCAO === 'sim') return

  const url = process.env.DATABASE_URL ?? ''
  const local = /localhost|127\.0\.0\.1|host\.docker\.internal/.test(url)

  if (!local) {
    console.error(
      '\nSeed bloqueado: DATABASE_URL não aponta para um banco local.\n' +
        'Este seed cria um usuário com senha padrão e não deve tocar produção.\n' +
        'Se este for mesmo o primeiro provisionamento, rode:\n' +
        '  PERMITIR_SEED_PRODUCAO=sim npm run db:seed\n'
    )
    process.exit(1)
  }
}

async function main() {
  verificarAmbiente()

  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@patronosellerai.com'
  const senha = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@2025'

  // upsert não serve aqui: criar a usuária exige criar o workspace dela
  // junto (ver lib/workspace.ts), então checamos manualmente se já existe.
  const existente = await prisma.user.findUnique({ where: { email } })

  const admin =
    existente ??
    (
      await criarUsuarioComWorkspace(prisma, {
        email,
        password: await bcrypt.hash(senha, 12),
        name: 'Administrador',
        role: 'admin',
        status: 'ativo',
      })
    ).user

  console.log(`Administrador pronto: ${admin.email}`)
  console.log('Nenhum produto, link ou venda foi criado (estado zerado).')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
