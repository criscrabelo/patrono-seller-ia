// SOMENTE TESTE LOCAL — 1 usuário, 2 contas, cada uma com sua própria
// integração de Instagram e WhatsApp (tokens/contas diferentes) e conteúdos
// agendados (com e sem vídeo) pra testar o cron e o isolamento de
// integrações do Bloco 3. Nunca roda em produção.
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

  const igA = await prisma.integracao.create({
    data: {
      userId: user.id, contaId: contaA.id, plataforma: 'instagram', status: 'conectado',
      accessToken: 'token-instagram-CONTA-A', accountId: 'ig-conta-a-account',
    },
  })
  const igB = await prisma.integracao.create({
    data: {
      userId: user.id, contaId: contaB.id, plataforma: 'instagram', status: 'conectado',
      accessToken: 'token-instagram-CONTA-B', accountId: 'ig-conta-b-account',
    },
  })
  const waA = await prisma.integracao.create({
    data: {
      userId: user.id, contaId: contaA.id, plataforma: 'whatsapp', status: 'conectado',
      accessToken: 'token-whatsapp-CONTA-A', accountId: 'wa-conta-a-instance',
    },
  })
  const waB = await prisma.integracao.create({
    data: {
      userId: user.id, contaId: contaB.id, plataforma: 'whatsapp', status: 'conectado',
      accessToken: 'token-whatsapp-CONTA-B', accountId: 'wa-conta-b-instance',
    },
  })

  const produtoA = await prisma.produto.create({
    data: {
      userId: user.id, contaId: contaA.id, nome: 'Produto A', categoria: 'Eletronicos',
      origemConteudo: 'Licenciado', tipoVenda: 'Afiliado',
      publicoAlvo: [], beneficios: [], pontosNegativos: [], imagens: [], videos: [],
    },
  })
  const produtoB = await prisma.produto.create({
    data: {
      userId: user.id, contaId: contaB.id, nome: 'Produto B', categoria: 'Moda',
      origemConteudo: 'Proprio', tipoVenda: 'Proprio',
      publicoAlvo: [], beneficios: [], pontosNegativos: [], imagens: [], videos: [],
    },
  })

  const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000)

  // Conteúdos SEM vídeo (caminho "publica só no app", não toca Integracao) —
  // um por conta, agendado pro passado, pronto pro cron pegar.
  const conteudoAppA = await prisma.conteudo.create({
    data: {
      userId: user.id, contaId: contaA.id, produtoId: produtoA.id,
      status: 'agendado', dataAgendamento: ontem, redeSocial: 'Instagram Reels',
      hashtags: [], pontosPositivos: [], pontosNegativos: [], alertasCompliance: [],
    },
  })
  const conteudoAppB = await prisma.conteudo.create({
    data: {
      userId: user.id, contaId: contaB.id, produtoId: produtoB.id,
      status: 'agendado', dataAgendamento: ontem, redeSocial: 'Instagram Reels',
      hashtags: [], pontosPositivos: [], pontosNegativos: [], alertasCompliance: [],
    },
  })

  console.log(JSON.stringify({
    user: user.email,
    contaA: { id: contaA.id, nome: contaA.nome, igId: igA.id, waId: waA.id },
    contaB: { id: contaB.id, nome: contaB.nome, igId: igB.id, waId: waB.id },
    conteudoAppA: conteudoAppA.id,
    conteudoAppB: conteudoAppB.id,
  }, null, 2))
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
