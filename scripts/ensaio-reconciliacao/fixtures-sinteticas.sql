-- ======================================================================
-- FIXTURES SINTÉTICAS (P1.7.2)
-- ======================================================================
-- Reproduz os VOLUMES de produção, não o conteúdo dela.
--
--   produção          ensaio
--   1 User            1 User
--   25 Produto        25 Produto
--   17 Conteudo       17 Conteudo
--   126 LinkDinamico  126 LinkDinamico
--   3 Integracao      3 Integracao
--   0 EventoLink      0 EventoLink
--
-- Os volumes importam porque é sobre eles que o backfill da migration nº 2
-- age: `ADD COLUMN NOT NULL` só quebra quando há linha, e índice único só
-- colide quando há dado. Com as tabelas vazias o ensaio não provaria nada.
--
-- ── NADA AQUI VEM DE PRODUÇÃO ─────────────────────────────────────────
-- Nenhum dado pessoal, nenhum e-mail real, nenhum token, nenhuma senha.
-- O campo `password` recebe um literal que não é hash de nada.
-- Os tokens de `Integracao` ficam NULL, como convém a um ensaio.
--
-- ── AS TRÊS PLATAFORMAS SÃO DISTINTAS, DE PROPÓSITO ───────────────────
-- A migration nº 2 troca o índice único de `Integracao` de
-- (userId, plataforma) para (workspaceId, plataforma). Com um único
-- workspace, duas integrações da mesma plataforma colidiriam. A auditoria
-- confirmou que produção não tem plataforma repetida; o ensaio reproduz
-- essa condição para que o resultado seja comparável.

-- ── 1 usuária ─────────────────────────────────────────────────────────
INSERT INTO "User" ("id", "email", "password", "name", "role", "status", "updatedAt")
VALUES ('usr_ensaio_0001', 'ensaio@exemplo.invalid', 'nao-e-um-hash', 'Usuária do Ensaio', 'admin', 'ativo', now());

-- ── 25 produtos ───────────────────────────────────────────────────────
INSERT INTO "Produto" ("id", "userId", "nome", "categoria", "preco", "origemConteudo", "tipoVenda",
                       "publicoAlvo", "beneficios", "pontosNegativos", "imagens", "videos", "updatedAt")
SELECT
  'prd_ensaio_' || lpad(i::text, 4, '0'),
  'usr_ensaio_0001',
  'Produto de Ensaio ' || i,
  CASE WHEN i % 3 = 0 THEN 'casa' WHEN i % 3 = 1 THEN 'beleza' ELSE 'eletronicos' END,
  (19.9 + i * 7)::double precision,
  'Licenciado',
  'afiliado',
  ARRAY['publico-' || i],
  ARRAY['beneficio-' || i],
  ARRAY[]::text[],
  ARRAY[]::text[],
  ARRAY[]::text[],
  now()
FROM generate_series(1, 25) AS i;

-- ── 17 conteúdos ──────────────────────────────────────────────────────
INSERT INTO "Conteudo" ("id", "userId", "produtoId", "updatedAt")
SELECT
  'cnt_ensaio_' || lpad(i::text, 4, '0'),
  'usr_ensaio_0001',
  'prd_ensaio_' || lpad(i::text, 4, '0'),
  now()
FROM generate_series(1, 17) AS i;

-- ── 126 links dinâmicos ───────────────────────────────────────────────
INSERT INTO "LinkDinamico" ("id", "userId", "produtoId", "slug", "plataforma", "urlDestino", "updatedAt")
SELECT
  'lnk_ensaio_' || lpad(i::text, 4, '0'),
  'usr_ensaio_0001',
  'prd_ensaio_' || lpad((((i - 1) % 25) + 1)::text, 4, '0'),
  'slug-ensaio-' || lpad(i::text, 4, '0'),
  CASE WHEN i % 2 = 0 THEN 'instagram' ELSE 'tiktok' END,
  'https://exemplo.invalid/produto/' || i,
  now()
FROM generate_series(1, 126) AS i;

-- ── 3 integrações, plataformas distintas, sem token ───────────────────
INSERT INTO "Integracao" ("id", "userId", "plataforma", "status", "updatedAt")
VALUES
  ('itg_ensaio_0001', 'usr_ensaio_0001', 'instagram', 'desconectado', now()),
  ('itg_ensaio_0002', 'usr_ensaio_0001', 'tiktok',    'desconectado', now()),
  ('itg_ensaio_0003', 'usr_ensaio_0001', 'shopee',    'desconectado', now());

-- EventoLink fica vazia, como em produção.
