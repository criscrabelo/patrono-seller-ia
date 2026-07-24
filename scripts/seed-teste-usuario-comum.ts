import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const senhaHash = await bcrypt.hash('senha123', 10)
  const user = await prisma.user.upsert({
    where: { email: 'usuario.teste@patronosellerai.com' },
    update: { role: 'usuario', status: 'ativo', password: senhaHash },
    create: {
      name: 'Usuário Teste',
      email: 'usuario.teste@patronosellerai.com',
      password: senhaHash,
      role: 'usuario',
      status: 'ativo',
    },
  })
  console.log('Usuário comum criado:', user.email)
}

main().finally(() => prisma.$disconnect())
