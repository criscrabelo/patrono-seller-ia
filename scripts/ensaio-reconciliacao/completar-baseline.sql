-- ======================================================================
-- ETAPA 1 DA RECONCILIAÇÃO — completar o baseline
-- ======================================================================
-- Este é o ÚNICO DDL que precisa rodar em produção antes do baselining.
-- Ele é idêntico ao que a migration `20260101000000_baseline_pre_workspace`
-- declara para `ModuloPermissao` — copiado de lá, não reinventado.
--
-- ── POR QUE ELE EXISTE ────────────────────────────────────────────────
-- A auditoria comparou produção com o baseline coluna a coluna. Das sete
-- tabelas do baseline, cinco conferem exatamente, `Conteudo` tem três
-- colunas mortas a mais, e `ModuloPermissao` simplesmente não está lá.
--
-- Registrar o baseline como aplicado sem criar esta tabela deixaria um
-- buraco permanente: o Prisma passaria a acreditar que ela existe, e
-- nenhuma migration futura a criaria.
--
-- ── POR QUE É SEGURO ──────────────────────────────────────────────────
-- É puramente aditivo. Cria uma tabela nova e vazia, sem nenhuma chave
-- estrangeira, que nenhuma outra tabela referencia. Não toca em nenhuma
-- linha existente e não bloqueia nenhuma tabela com dado.
--
-- `IF NOT EXISTS` para que rodar duas vezes não seja um acidente.

CREATE TABLE IF NOT EXISTS "ModuloPermissao" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "modulo" TEXT NOT NULL,
    "liberado" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModuloPermissao_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ModuloPermissao_role_modulo_key"
    ON "ModuloPermissao"("role", "modulo");
