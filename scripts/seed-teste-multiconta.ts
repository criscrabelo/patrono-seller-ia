// Script SOMENTE PARA TESTE LOCAL — semeia um banco sintético parecido com a
// forma dos dados de produção (1 usuário, 25 produtos, integrações das 6
// plataformas, conteúdos, links dinâmicos) para validar o backfill de contas
// sem tocar em nenhum dado real. Não é usado em produção.
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const PLATAFORMAS = ['instagram', 'tiktok', 'mercadolivre', 'shopee', 'hotmart', 'whatsapp']

async function main() {
  const senha = await bcrypt.hash('teste123', 12)
  const user = await prisma.user.upsert({
    where: { email: 'teste@boracomprar.com' },
    update: {},
    create: { email: 'teste@boracomprar.com', password: senha, name: 'Usuária Teste', role: 'admin', status: 'ativo' },
  })

  for (let i = 1; i <= 25; i++) {
    const produto = await prisma.produto.create({
      data: {
        userId: user.id,
        nome: `Produto Teste ${i}`,
        categoria: 'Eletronicos',
        preco: 49.9 + i,
        origemConteudo: 'Licenciado',
        tipoVenda: 'Afiliado',
        publicoAlvo: [],
        beneficios: [],
        pontosNegativos: [],
        imagens: [],
        videos: [],
      },
    })

    if (i <= 5) {
      await prisma.conteudo.create({
        data: {
          userId: user.id,
          produtoId: produto.id,
          status: 'publicado',
          hashtags: [],
          pontosPositivos: [],
          pontosNegativos: [],
          alertasCompliance: [],
        },
      })
      await prisma.linkDinamico.create({
        data: {
          userId: user.id,
          produtoId: produto.id,
          slug: `produto-teste-${i}`,
          plataforma: 'shopee',
          urlDestino: 'https://shopee.com.br/exemplo',
        },
      })
    }
  }

  // contaId de propósito não informado aqui — este script simula o estado
  // pré-backfill (produção antes da Etapa 1 rodar lá).
  for (const plataforma of PLATAFORMAS) {
    await prisma.integracao.create({
      data: { userId: user.id, plataforma, status: 'conectado', accessToken: 'fake-token' },
    })
  }

  const [produtos, conteudos, integracoes, links] = await Promise.all([
    prisma.produto.count({ where: { userId: user.id } }),
    prisma.conteudo.count({ where: { userId: user.id } }),
    prisma.integracao.count({ where: { userId: user.id } }),
    prisma.linkDinamico.count({ where: { userId: user.id } }),
  ])
  console.log(`Semeado: user=${user.email} produtos=${produtos} conteudos=${conteudos} integracoes=${integracoes} links=${links}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
