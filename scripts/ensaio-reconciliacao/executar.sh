#!/usr/bin/env bash
# =====================================================================
# ENSAIO COMPLETO DA RECONCILIAÇÃO (P1.7.2)
# =====================================================================
# Roda, de verdade, num Postgres descartável local, o procedimento que um
# dia rodará em produção. Nada aqui toca produção: a única URL usada é a
# do cluster local, e há uma guarda que recusa qualquer outra.
#
# Uso:
#   bash scripts/ensaio-reconciliacao/executar.sh
#
# Pré-requisito: cluster descartável no ar em 127.0.0.1:55432.
set -euo pipefail

PGBIN="/c/Program Files/PostgreSQL/16/bin"
PORTA=55432
BANCO=patrono_ensaio
URL="postgresql://postgres@127.0.0.1:${PORTA}/${BANCO}"

# ── GUARDA ───────────────────────────────────────────────────────────
# Este roteiro só aceita um alvo local. Se a URL apontar para qualquer
# outro host, ele para antes de executar a primeira linha.
case "$URL" in
  postgresql://postgres@127.0.0.1:*) : ;;
  *) echo "RECUSANDO: o ensaio só roda contra 127.0.0.1." >&2; exit 1 ;;
esac

export DATABASE_URL="$URL"
export DIRECT_URL="$URL"

psql() { "$PGBIN/psql.exe" -h 127.0.0.1 -p "$PORTA" -U postgres -d "$BANCO" "$@"; }
titulo() { printf '\n%s\n%s\n%s\n' "======================================================================" "$1" "======================================================================"; }

titulo "ETAPA 0 — banco descartável do zero"
"$PGBIN/psql.exe" -h 127.0.0.1 -p "$PORTA" -U postgres -d postgres -q \
  -c "DROP DATABASE IF EXISTS ${BANCO};" -c "CREATE DATABASE ${BANCO};"
echo "  banco ${BANCO} recriado"

titulo "ETAPA 0.1 — reproduzir o estado ATUAL de produção"
npx tsx scripts/ensaio-reconciliacao/gerar-estado-producao.ts > /tmp/estado-producao.sql
psql -q -v ON_ERROR_STOP=1 -f /tmp/estado-producao.sql
psql -q -v ON_ERROR_STOP=1 -f scripts/ensaio-reconciliacao/fixtures-sinteticas.sql
echo "  estado reproduzido e fixtures aplicadas"

titulo "ETAPA 0.2 — conferir que a reprodução bate com a auditoria"
psql -tA -c "
  SELECT 'tabelas=' || count(*) FROM information_schema.tables
   WHERE table_schema='public' AND table_type='BASE TABLE';"
psql -tA -c "
  SELECT table_name || '=' || count(*)
    FROM information_schema.columns
   WHERE table_schema='public'
     AND table_name IN ('User','Produto','Conteudo','LinkDinamico','EventoLink','Integracao')
   GROUP BY table_name ORDER BY table_name;"
psql -tA -c "SELECT 'ModuloPermissao existe=' || count(*) FROM information_schema.tables
             WHERE table_schema='public' AND table_name='ModuloPermissao';"
psql -tA -c "SELECT '_prisma_migrations existe=' || count(*) FROM information_schema.tables
             WHERE table_schema='public' AND table_name='_prisma_migrations';"

titulo "ANTES — retrato do dado, para comparar depois da migration nº 2"
psql -tA -c "
  SELECT 'User=' || (SELECT count(*) FROM \"User\")
      || ' Produto=' || (SELECT count(*) FROM \"Produto\")
      || ' Conteudo=' || (SELECT count(*) FROM \"Conteudo\")
      || ' LinkDinamico=' || (SELECT count(*) FROM \"LinkDinamico\")
      || ' Integracao=' || (SELECT count(*) FROM \"Integracao\")
      || ' EventoLink=' || (SELECT count(*) FROM \"EventoLink\");"
echo "  índice único de Integracao hoje:"
psql -tA -c "SELECT '    ' || indexname || ' -> ' || indexdef FROM pg_indexes
             WHERE tablename='Integracao' AND indexname LIKE '%plataforma%';"
echo "  soma de verificação do dado (para provar que nada mudou de valor):"
psql -tA -c "SELECT '    produtos_md5=' || md5(string_agg(\"id\" || '|' || \"nome\" || '|' || coalesce(\"preco\"::text,''), ',' ORDER BY \"id\")) FROM \"Produto\";"
psql -tA -c "SELECT '    links_md5=' || md5(string_agg(\"id\" || '|' || \"slug\" || '|' || \"urlDestino\", ',' ORDER BY \"id\")) FROM \"LinkDinamico\";"

titulo "ETAPA 1 — completar o baseline (único DDL antes do baselining)"
psql -q -v ON_ERROR_STOP=1 -f scripts/ensaio-reconciliacao/completar-baseline.sql
psql -tA -c "SELECT '  ModuloPermissao agora existe=' || count(*) FROM information_schema.tables
             WHERE table_schema='public' AND table_name='ModuloPermissao';"

titulo "ETAPA 2 — registrar o baseline como aplicado"
echo "  comando:"
echo "    npx prisma migrate resolve --applied 20260101000000_baseline_pre_workspace"
npx prisma migrate resolve --applied 20260101000000_baseline_pre_workspace
echo "  _prisma_migrations depois do resolve:"
psql -tA -c "SELECT '    ' || migration_name || ' | finished=' || coalesce(finished_at::text,'NULL')
             || ' | steps=' || applied_steps_count FROM _prisma_migrations ORDER BY started_at;"

titulo "ETAPA 3 — aplicar as 12 migrations restantes"
npx prisma migrate deploy

titulo "ETAPA 3.1 — nenhuma migration foi reaplicada?"
psql -tA -c "
  SELECT '  registros=' || count(*) || '  distintos=' || count(DISTINCT migration_name)
    FROM _prisma_migrations;"
psql -tA -c "
  SELECT '  DUPLICADA: ' || migration_name FROM _prisma_migrations
   GROUP BY migration_name HAVING count(*) > 1;"
echo "  (nenhuma linha acima = nenhuma duplicata)"

titulo "ETAPA 3.2 — tempo e passos de cada migration"
psql -tA -c "
  SELECT '  ' || rpad(migration_name, 56)
      || ' | ' || lpad(round(extract(epoch FROM (finished_at - started_at)) * 1000)::text, 6) || ' ms'
      || ' | steps=' || applied_steps_count
      || ' | ' || CASE WHEN rolled_back_at IS NOT NULL THEN 'ROLLED BACK'
                       WHEN finished_at IS NULL THEN 'FALHADA' ELSE 'aplicada' END
    FROM _prisma_migrations ORDER BY started_at;"

titulo "DEPOIS — o mesmo retrato, agora reconciliado"
psql -tA -c "
  SELECT 'User=' || (SELECT count(*) FROM \"User\")
      || ' Produto=' || (SELECT count(*) FROM \"Produto\")
      || ' Conteudo=' || (SELECT count(*) FROM \"Conteudo\")
      || ' LinkDinamico=' || (SELECT count(*) FROM \"LinkDinamico\")
      || ' Integracao=' || (SELECT count(*) FROM \"Integracao\")
      || ' EventoLink=' || (SELECT count(*) FROM \"EventoLink\")
      || ' Workspace=' || (SELECT count(*) FROM \"Workspace\");"
echo "  soma de verificação do dado (tem de bater com a de antes):"
psql -tA -c "SELECT '    produtos_md5=' || md5(string_agg(\"id\" || '|' || \"nome\" || '|' || coalesce(\"preco\"::text,''), ',' ORDER BY \"id\")) FROM \"Produto\";"
psql -tA -c "SELECT '    links_md5=' || md5(string_agg(\"id\" || '|' || \"slug\" || '|' || \"urlDestino\", ',' ORDER BY \"id\")) FROM \"LinkDinamico\";"

titulo "MIGRATION Nº 2 — o que ela fez com o dado"
echo "  workspace criado:"
psql -tA -c "SELECT '    id=' || \"id\" || ' name=' || \"name\" || ' ownerId=' || \"ownerId\"
             || ' automationPaused=' || \"automationPaused\" || ' automationMode=' || \"automationMode\"
             FROM \"Workspace\";"
echo "  linhas SEM workspaceId (tem de ser zero em todas):"
psql -tA -c "
  SELECT '    User=' || (SELECT count(*) FROM \"User\" WHERE \"workspaceId\" IS NULL)
      || ' Produto=' || (SELECT count(*) FROM \"Produto\" WHERE \"workspaceId\" IS NULL)
      || ' Conteudo=' || (SELECT count(*) FROM \"Conteudo\" WHERE \"workspaceId\" IS NULL)
      || ' LinkDinamico=' || (SELECT count(*) FROM \"LinkDinamico\" WHERE \"workspaceId\" IS NULL)
      || ' Integracao=' || (SELECT count(*) FROM \"Integracao\" WHERE \"workspaceId\" IS NULL);"
echo "  todas as linhas apontam para o MESMO workspace?"
psql -tA -c "
  SELECT '    workspaces distintos por tabela: User=' || (SELECT count(DISTINCT \"workspaceId\") FROM \"User\")
      || ' Produto=' || (SELECT count(DISTINCT \"workspaceId\") FROM \"Produto\")
      || ' Conteudo=' || (SELECT count(DISTINCT \"workspaceId\") FROM \"Conteudo\")
      || ' LinkDinamico=' || (SELECT count(DISTINCT \"workspaceId\") FROM \"LinkDinamico\")
      || ' Integracao=' || (SELECT count(DISTINCT \"workspaceId\") FROM \"Integracao\");"
echo "  o workspace de cada linha é o da dona?"
psql -tA -c "
  SELECT '    divergentes: Produto=' || (SELECT count(*) FROM \"Produto\" p JOIN \"Workspace\" w ON w.\"ownerId\" = p.\"userId\" WHERE p.\"workspaceId\" <> w.\"id\")
      || ' LinkDinamico=' || (SELECT count(*) FROM \"LinkDinamico\" l JOIN \"Workspace\" w ON w.\"ownerId\" = l.\"userId\" WHERE l.\"workspaceId\" <> w.\"id\")
      || ' Conteudo=' || (SELECT count(*) FROM \"Conteudo\" c JOIN \"Workspace\" w ON w.\"ownerId\" = c.\"userId\" WHERE c.\"workspaceId\" <> w.\"id\")
      || ' Integracao=' || (SELECT count(*) FROM \"Integracao\" i JOIN \"Workspace\" w ON w.\"ownerId\" = i.\"userId\" WHERE i.\"workspaceId\" <> w.\"id\");"
echo "  nullability de workspaceId (tem de ser NOT NULL em todas):"
psql -tA -c "
  SELECT '    ' || table_name || '=' || is_nullable FROM information_schema.columns
   WHERE table_schema='public' AND column_name='workspaceId'
     AND table_name IN ('User','Produto','Conteudo','LinkDinamico','Integracao','EventoLink')
   ORDER BY table_name;"
echo "  semântica de Integracao — o índice único mudou de eixo:"
psql -tA -c "SELECT '    ' || indexname || ' -> ' || indexdef FROM pg_indexes
             WHERE tablename='Integracao' AND indexdef LIKE '%UNIQUE%';"

titulo "IDEMPOTÊNCIA — rodar migrate deploy de novo não faz nada"
npx prisma migrate deploy
psql -tA -c "SELECT '  Workspace agora=' || count(*) || ' (tem de continuar 1)' FROM \"Workspace\";"
psql -tA -c "SELECT '  registros em _prisma_migrations=' || count(*) FROM _prisma_migrations;"

titulo "ISOLAMENTO — um segundo workspace não enxerga o primeiro"
psql -q -v ON_ERROR_STOP=1 -c "
  INSERT INTO \"Workspace\" (\"id\",\"name\",\"ownerId\",\"updatedAt\") VALUES ('ws_ensaio_b','Workspace B','usr_ensaio_b',now());
  INSERT INTO \"User\" (\"id\",\"email\",\"password\",\"role\",\"status\",\"updatedAt\",\"workspaceId\")
    VALUES ('usr_ensaio_b','b@exemplo.invalid','nao-e-um-hash','admin','ativo',now(),'ws_ensaio_b');
  INSERT INTO \"Produto\" (\"id\",\"userId\",\"nome\",\"categoria\",\"origemConteudo\",\"tipoVenda\",\"updatedAt\",\"workspaceId\")
    VALUES ('prd_ensaio_b','usr_ensaio_b','Produto do B','casa','Licenciado','afiliado',now(),'ws_ensaio_b');"
psql -tA -c "
  SELECT '  produtos do workspace A=' || (SELECT count(*) FROM \"Produto\" WHERE \"workspaceId\" = (SELECT \"id\" FROM \"Workspace\" WHERE \"ownerId\"='usr_ensaio_0001'))
      || '  do B=' || (SELECT count(*) FROM \"Produto\" WHERE \"workspaceId\"='ws_ensaio_b')
      || '  total=' || (SELECT count(*) FROM \"Produto\");"
echo "  o índice único de Integracao permite a MESMA plataforma em workspace diferente?"
psql -q -c "INSERT INTO \"Integracao\" (\"id\",\"userId\",\"plataforma\",\"status\",\"updatedAt\",\"workspaceId\")
            VALUES ('itg_ensaio_b','usr_ensaio_b','instagram','desconectado',now(),'ws_ensaio_b');" \
  && echo "    SIM — inseriu 'instagram' no workspace B convivendo com o do A (isolamento correto)"
echo "  e recusa a mesma plataforma DUAS VEZES no mesmo workspace?"
if psql -q -c "INSERT INTO \"Integracao\" (\"id\",\"userId\",\"plataforma\",\"status\",\"updatedAt\",\"workspaceId\")
               VALUES ('itg_ensaio_b2','usr_ensaio_b','instagram','desconectado',now(),'ws_ensaio_b');" 2>/dev/null; then
  echo "    NÃO RECUSOU — o índice único não está fazendo efeito"; exit 1
else
  echo "    SIM — recusou, como deve"
fi
psql -q -c "DELETE FROM \"Integracao\" WHERE \"workspaceId\"='ws_ensaio_b';
            DELETE FROM \"Produto\" WHERE \"workspaceId\"='ws_ensaio_b';
            DELETE FROM \"User\" WHERE \"workspaceId\"='ws_ensaio_b';
            DELETE FROM \"Workspace\" WHERE \"id\"='ws_ensaio_b';"
echo "  workspace B removido; o ensaio volta ao estado de produção reconciliada"

titulo "ETAPA 4 — migrate status"
npx prisma migrate status || true

titulo "FIM DA PARTE 1"
