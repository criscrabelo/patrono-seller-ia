/**
 * Emite o DDL que reproduz o estado ATUAL de produção num banco vazio.
 *
 * Uso:
 *   npx tsx scripts/ensaio-reconciliacao/gerar-estado-producao.ts > estado.sql
 *
 * ── DE ONDE VEM CADA PEDAÇO ─────────────────────────────────────────────
 * A auditoria read-only da P1.7.1 estabeleceu que produção É o estado do
 * `baseline_pre_workspace`, com duas diferenças:
 *
 *   1. `ModuloPermissao` NÃO existe em produção;
 *   2. `Conteudo` tem três colunas a mais — `linkUrl`, `videoResultUrl` e
 *      `videoStatusUrl` — que estão 100% nulas e que nenhuma migration
 *      menciona.
 *
 * Então o estado reproduzido é: o baseline, MENOS `ModuloPermissao`, MAIS
 * as três colunas, MAIS as dez tabelas legadas.
 *
 * Derivar do próprio arquivo do baseline (em vez de copiar 180 linhas)
 * garante que o ensaio acompanhe o repo: se o baseline mudar, a reprodução
 * muda junto.
 *
 * ── AS TABELAS LEGADAS SÃO STUBS, E ISSO ESTÁ DECLARADO ─────────────────
 * As dez tabelas legadas de produção (`Creator`, `Fornecedor`, …) nunca
 * existiram NESTE repositório — vêm de uma encarnação anterior do produto.
 * Não há de onde tirar a definição exata sem abrir conexão com produção, e
 * esta rodada não toca produção.
 *
 * O que importa para o ensaio é a topologia de chaves estrangeiras que elas
 * criam sobre `User` e `Fornecedor`, porque é isso que poderia interagir
 * com as migrations. Essa topologia veio do `DropForeignKey` que o
 * `prisma migrate diff` da rodada anterior produziu, e é reproduzida
 * exatamente. As colunas não essenciais não são reproduzidas — e as dez
 * tabelas estão vazias em produção, então não há dado a imitar.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const BASELINE = join(
  __dirname,
  '..',
  '..',
  'prisma',
  'migrations',
  '20260101000000_baseline_pre_workspace',
  'migration.sql'
)

/**
 * Tabelas legadas e as FKs que a auditoria encontrou em produção.
 * A ordem é a de dependência: quem é referenciado vem antes.
 */
const LEGADO: { tabela: string; fks: { coluna: string; alvo: string; nome: string }[] }[] = [
  { tabela: 'Fornecedor', fks: [{ coluna: 'userId', alvo: 'User', nome: 'Fornecedor_userId_fkey' }] },
  {
    tabela: 'Creator',
    fks: [
      { coluna: 'userId', alvo: 'User', nome: 'Creator_userId_fkey' },
      { coluna: 'fornecedorId', alvo: 'Fornecedor', nome: 'Creator_fornecedorId_fkey' },
    ],
  },
  { tabela: 'EntregaUGC', fks: [{ coluna: 'creatorId', alvo: 'Creator', nome: 'EntregaUGC_creatorId_fkey' }] },
  {
    tabela: 'ImagemCriativo',
    fks: [
      { coluna: 'userId', alvo: 'User', nome: 'ImagemCriativo_userId_fkey' },
      { coluna: 'fornecedorId', alvo: 'Fornecedor', nome: 'ImagemCriativo_fornecedorId_fkey' },
    ],
  },
  { tabela: 'DecisaoMotor', fks: [{ coluna: 'userId', alvo: 'User', nome: 'DecisaoMotor_userId_fkey' }] },
  { tabela: 'LogCompliance', fks: [{ coluna: 'userId', alvo: 'User', nome: 'LogCompliance_userId_fkey' }] },
  { tabela: 'SerieFxa', fks: [{ coluna: 'userId', alvo: 'User', nome: 'SerieFxa_userId_fkey' }] },
  { tabela: 'TendenciaRadar', fks: [{ coluna: 'userId', alvo: 'User', nome: 'TendenciaRadar_userId_fkey' }] },
  { tabela: 'TermoJuridico', fks: [{ coluna: 'userId', alvo: 'User', nome: 'TermoJuridico_userId_fkey' }] },
  { tabela: 'VideoAutorizado', fks: [{ coluna: 'userId', alvo: 'User', nome: 'VideoAutorizado_userId_fkey' }] },
]

/** Remove do baseline tudo que diz respeito a uma tabela. */
function removerTabela(sql: string, tabela: string): string {
  // O bloco CREATE TABLE inteiro, com o comentário que o precede.
  const semCreate = sql.replace(
    new RegExp(`(?:-- CreateTable\\r?\\n)?CREATE TABLE "${tabela}" \\([\\s\\S]*?\\n\\);\\r?\\n?`, 'g'),
    ''
  )
  // Índices e FKs que a citam.
  return semCreate
    .replace(new RegExp(`(?:-- CreateIndex\\r?\\n)?CREATE (?:UNIQUE )?INDEX [^;]*"${tabela}"[^;]*;\\r?\\n?`, 'g'), '')
    .replace(new RegExp(`(?:-- AddForeignKey\\r?\\n)?ALTER TABLE "${tabela}"[^;]*;\\r?\\n?`, 'g'), '')
}

function main() {
  let sql = readFileSync(BASELINE, 'utf8')

  const antes = sql.includes('CREATE TABLE "ModuloPermissao"')
  sql = removerTabela(sql, 'ModuloPermissao')
  if (!antes || sql.includes('ModuloPermissao')) {
    console.error('FALHOU: não consegui remover ModuloPermissao do baseline. Abortando.')
    process.exit(1)
  }

  const partes: string[] = []
  partes.push('-- ====================================================================')
  partes.push('-- ESTADO ATUAL DE PRODUÇÃO, REPRODUZIDO (P1.7.2)')
  partes.push('-- Gerado por scripts/ensaio-reconciliacao/gerar-estado-producao.ts')
  partes.push('-- Base: baseline_pre_workspace MENOS ModuloPermissao,')
  partes.push('--       MAIS 3 colunas mortas em Conteudo, MAIS 10 tabelas legadas.')
  partes.push('-- Nenhum dado de produção é copiado — as linhas são sintéticas.')
  partes.push('-- ====================================================================')
  partes.push('')
  partes.push(sql.trim())
  partes.push('')

  partes.push('-- ── As três colunas que produção tem e o baseline não declara ───────')
  partes.push('-- Em produção elas estão 100% nulas, e nenhuma migration as menciona.')
  partes.push('ALTER TABLE "Conteudo"')
  partes.push('  ADD COLUMN "linkUrl" TEXT,')
  partes.push('  ADD COLUMN "videoResultUrl" TEXT,')
  partes.push('  ADD COLUMN "videoStatusUrl" TEXT;')
  partes.push('')

  partes.push('-- ── As dez tabelas legadas (stubs com a topologia de FK real) ───────')
  for (const { tabela, fks } of LEGADO) {
    const colunas = ['    "id" TEXT NOT NULL', ...fks.map((f) => `    "${f.coluna}" TEXT`)]
    partes.push(`CREATE TABLE "${tabela}" (`)
    partes.push(colunas.join(',\n') + ',')
    partes.push(`\n    CONSTRAINT "${tabela}_pkey" PRIMARY KEY ("id")`)
    partes.push(');')
    for (const f of fks) {
      partes.push(
        `ALTER TABLE "${tabela}" ADD CONSTRAINT "${f.nome}" FOREIGN KEY ("${f.coluna}") ` +
          `REFERENCES "${f.alvo}"("id") ON DELETE SET NULL ON UPDATE CASCADE;`
      )
    }
    partes.push('')
  }

  console.log(partes.join('\n'))
}

main()
