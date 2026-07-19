// SOMENTE TESTE LOCAL — 1 usuário, 2 contas, cada uma com produtos e links
// dinâmicos próprios (com vendas já registradas), pra testar isolamento de
// Links Dinâmicos/Monetização e do painel de Lucro e Escala (Dashboard).
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

  const produtoA = await prisma.produto.create({
    data: {
      userId: user.id, contaId: contaA.id, nome: 'Produto A', categoria: 'Eletronicos',
      linkProduto: 'https://shopee.com.br/produto-a', origemConteudo: 'Licenciado', tipoVenda: 'Afiliado',
      publicoAlvo: [], beneficios: [], pontosNegativos: [], imagens: [], videos: [],
    },
  })
  const produtoB = await prisma.produto.create({
    data: {
      userId: user.id, contaId: contaB.id, nome: 'Produto B', categoria: 'Moda',
      linkProduto: 'https://shopee.com.br/produto-b', origemConteudo: 'Proprio', tipoVenda: 'Proprio',
      publicoAlvo: [], beneficios: [], pontosNegativos: [], imagens: [], videos: [],
    },
  })

  const linkA = await prisma.linkDinamico.create({
    data: {
      userId: user.id, contaId: contaA.id, produtoId: produtoA.id,
      slug: 'link-produto-a', plataforma: 'instagram', urlDestino: 'https://shopee.com.br/produto-a',
      tipo: 'afiliado', comissao: 10, cliques: 50, conversoes: 2, receitaTotal: 20,
    },
  })
  const linkB = await prisma.linkDinamico.create({
    data: {
      userId: user.id, contaId: contaB.id, produtoId: produtoB.id,
      slug: 'link-produto-b', plataforma: 'tiktok', urlDestino: 'https://shopee.com.br/produto-b',
      tipo: 'loja-propria', cliques: 30, conversoes: 1, receitaTotal: 89.9,
    },
  })

  console.log(JSON.stringify({
    user: user.email,
    contaA: { id: contaA.id, nome: contaA.nome, linkId: linkA.id, produtoId: produtoA.id },
    contaB: { id: contaB.id, nome: contaB.nome, linkId: linkB.id, produtoId: produtoB.id },
  }, null, 2))
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
