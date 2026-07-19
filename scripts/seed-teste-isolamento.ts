// SOMENTE PARA TESTE LOCAL — cria 1 usuário com 2 contas (marcas) e
// produtos exclusivos de cada uma, pra testar isolamento entre contas nas
// rotas da Etapa 3. Nunca roda em produção.
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const senha = await bcrypt.hash('teste123', 12)
  const user = await prisma.user.upsert({
    where: { email: 'teste@boracomprar.com' },
    update: {},
    create: { email: 'teste@boracomprar.com', password: senha, name: 'Usuária Teste', role: 'admin', status: 'ativo' },
  })

  const contaA = await prisma.conta.create({ data: { userId: user.id, nome: 'BoraComprar' } })
  const contaB = await prisma.conta.create({ data: { userId: user.id, nome: 'Marca B' } })

  const produtosA = []
  for (let i = 1; i <= 3; i++) {
    produtosA.push(await prisma.produto.create({
      data: {
        userId: user.id, contaId: contaA.id,
        nome: `Produto A${i}`, categoria: 'Eletronicos', origemConteudo: 'Licenciado', tipoVenda: 'Afiliado',
        publicoAlvo: [], beneficios: [], pontosNegativos: [], imagens: [], videos: [],
      },
    }))
  }
  const produtosB = []
  for (let i = 1; i <= 2; i++) {
    produtosB.push(await prisma.produto.create({
      data: {
        userId: user.id, contaId: contaB.id,
        nome: `Produto B${i}`, categoria: 'Moda', origemConteudo: 'Proprio', tipoVenda: 'Proprio',
        publicoAlvo: [], beneficios: [], pontosNegativos: [], imagens: [], videos: [],
      },
    }))
  }

  for (let i = 1; i <= 2; i++) {
    await prisma.conteudo.create({
      data: {
        userId: user.id, contaId: contaA.id, produtoId: produtosA[i - 1].id,
        status: 'roteiro_gerado', redeSocial: 'Instagram Reels',
        hashtags: [], pontosPositivos: [], pontosNegativos: [], alertasCompliance: [],
      },
    })
  }
  await prisma.conteudo.create({
    data: {
      userId: user.id, contaId: contaB.id, produtoId: produtosB[0].id,
      status: 'roteiro_gerado', redeSocial: 'TikTok',
      hashtags: [], pontosPositivos: [], pontosNegativos: [], alertasCompliance: [],
    },
  })

  console.log(`user=${user.email}`)
  console.log(`contaA=${contaA.nome} (${contaA.id}) — 3 produtos (A1,A2,A3), 2 conteudos`)
  console.log(`contaB=${contaB.nome} (${contaB.id}) — 2 produtos (B1,B2), 1 conteudo`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
