import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Iniciando seed...')

  const hashedPassword = await bcrypt.hash('Admin@2025', 12)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@patronosellerai.com' },
    update: {},
    create: {
      email: 'admin@patronosellerai.com',
      password: hashedPassword,
      name: 'Administrador',
    },
  })

  console.log('Usuário admin criado:', admin.email)

  const conta =
    (await prisma.conta.findFirst({ where: { userId: admin.id } })) ??
    (await prisma.conta.create({ data: { userId: admin.id, nome: 'BoraComprar' } }))

  console.log('Conta:', conta.nome)

  const produto1 = await prisma.produto.upsert({
    where: { id: 'produto-exemplo-1' },
    update: {},
    create: {
      id: 'produto-exemplo-1',
      userId: admin.id,
      contaId: conta.id,
      nome: 'Power Bank 20000mAh',
      categoria: 'Eletronicos',
      preco: 49.9,
      linkProduto: 'https://shopee.com.br/exemplo',
      descricao:
        'Carregador portátil de alta capacidade com carregamento rápido e 3 portas USB.',
      publicoAlvo: ['Jovens 13-18', 'Adultos 25-45', 'Profissionais'],
      origemConteudo: 'Licenciado',
      tipoVenda: 'Afiliado',
      observacoes: 'Produto com ótima relação custo-benefício.',
      beneficios: [
        'Carga rápida 22W',
        'Capacidade para 4 cargas de celular',
        'Indicador LED de bateria',
      ],
      pontosNegativos: ['Carregamento do banco em si é lento'],
      imagens: [],
      videos: [],
      status: 'ativo',
    },
  })

  const produto2 = await prisma.produto.upsert({
    where: { id: 'produto-exemplo-2' },
    update: {},
    create: {
      id: 'produto-exemplo-2',
      userId: admin.id,
      contaId: conta.id,
      nome: 'Fone Bluetooth Premium',
      categoria: 'Eletronicos',
      preco: 89.9,
      linkProduto: 'https://mercadolivre.com.br/exemplo',
      descricao:
        'Fone de ouvido sem fio com cancelamento de ruído e até 30h de bateria.',
      publicoAlvo: ['Adultos 25-45', 'Profissionais', 'Estudantes'],
      origemConteudo: 'De fornecedor',
      tipoVenda: 'Marketplace',
      observacoes: 'Qualidade surpreendente para o preço.',
      beneficios: [
        'Cancelamento ativo de ruído',
        '30h de bateria',
        'Conectividade multipoint',
      ],
      pontosNegativos: ['Case de carregamento um pouco grande'],
      imagens: [],
      videos: [],
      status: 'ativo',
    },
  })

  console.log('Produtos criados:', produto1.nome, '|', produto2.nome)
  console.log('Seed concluído com sucesso!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
