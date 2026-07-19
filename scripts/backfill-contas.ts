// Etapa 1 do multi-conta (Fase A): cria uma Conta padrão para cada usuário
// que ainda não tem uma, e preenche contaId em Produto/Conteudo/Integracao/
// LinkDinamico onde ainda estiver nulo. Idempotente — pode rodar de novo
// sem duplicar Conta nem sobrescrever contaId já preenchido.
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const NOME_CONTA_PADRAO = process.env.NOME_CONTA_PADRAO || 'BoraComprar'

async function main() {
  const usuarios = await prisma.user.findMany()
  console.log(`Encontrados ${usuarios.length} usuário(s).`)

  for (const user of usuarios) {
    let conta = await prisma.conta.findFirst({ where: { userId: user.id } })
    if (!conta) {
      conta = await prisma.conta.create({ data: { userId: user.id, nome: NOME_CONTA_PADRAO } })
      console.log(`  + Conta criada para ${user.email}: "${conta.nome}" (${conta.id})`)
    } else {
      console.log(`  = Usuário ${user.email} já tem conta "${conta.nome}" (${conta.id}), reaproveitando`)
    }

    const [produtos, conteudos, integracoes, links] = await Promise.all([
      prisma.produto.updateMany({ where: { userId: user.id, contaId: null }, data: { contaId: conta.id } }),
      prisma.conteudo.updateMany({ where: { userId: user.id, contaId: null }, data: { contaId: conta.id } }),
      prisma.integracao.updateMany({ where: { userId: user.id, contaId: null }, data: { contaId: conta.id } }),
      prisma.linkDinamico.updateMany({ where: { userId: user.id, contaId: null }, data: { contaId: conta.id } }),
    ])
    console.log(
      `    produtos+${produtos.count} conteudos+${conteudos.count} integracoes+${integracoes.count} links+${links.count}`
    )
  }

  const [prodSemConta, contSemConta, integSemConta, linkSemConta] = await Promise.all([
    prisma.produto.count({ where: { contaId: null } }),
    prisma.conteudo.count({ where: { contaId: null } }),
    prisma.integracao.count({ where: { contaId: null } }),
    prisma.linkDinamico.count({ where: { contaId: null } }),
  ])

  if (prodSemConta || contSemConta || integSemConta || linkSemConta) {
    throw new Error(
      `Sobrou linha sem contaId — produtos=${prodSemConta} conteudos=${contSemConta} integracoes=${integSemConta} links=${linkSemConta}`
    )
  }

  console.log('Backfill concluído: todas as linhas têm contaId.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
