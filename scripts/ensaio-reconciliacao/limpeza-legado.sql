-- ======================================================================
-- ETAPA 5 — limpeza do legado (OPCIONAL e ADIÁVEL)
-- ======================================================================
-- Esta é a ÚNICA etapa destrutiva de toda a reconciliação, e por isso está
-- separada das outras. O sistema funciona sem ela. Ela pode esperar
-- semanas sem custo nenhum.
--
-- ── O QUE ELA APAGA, E POR QUE É SEGURO ───────────────────────────────
-- Dez tabelas de uma encarnação anterior do produto e três colunas de
-- `Conteudo` que o schema atual não declara mais.
--
-- A auditoria read-only da P1.7.1 mediu cada uma delas em produção:
--   - as dez tabelas somam ZERO linhas;
--   - `linkUrl`, `videoResultUrl` e `videoStatusUrl` têm ZERO valores
--     preenchidos nas 17 linhas de `Conteudo`.
--
-- Ou seja: não há dado a perder. Ainda assim, rodar isto exige conferir os
-- números de novo na hora — dado vazio hoje pode não estar vazio amanhã.
--
-- ── A GUARDA ──────────────────────────────────────────────────────────
-- O bloco abaixo ABORTA se qualquer uma das tabelas tiver ganhado linha,
-- ou se qualquer uma das três colunas tiver ganhado valor. Fail-closed: na
-- dúvida, não apaga.

DO $$
DECLARE
  t text;
  n bigint;
  total bigint := 0;
BEGIN
  FOREACH t IN ARRAY ARRAY['Creator','DecisaoMotor','EntregaUGC','Fornecedor','ImagemCriativo',
                           'LogCompliance','SerieFxa','TendenciaRadar','TermoJuridico','VideoAutorizado']
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables
                WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
      IF n > 0 THEN
        RAISE EXCEPTION 'ABORTADO: a tabela % tem % linha(s). Nada foi apagado.', t, n;
      END IF;
      total := total + 1;
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema='public' AND table_name='Conteudo' AND column_name='linkUrl') THEN
    EXECUTE 'SELECT count("linkUrl") + count("videoResultUrl") + count("videoStatusUrl") FROM "Conteudo"' INTO n;
    IF n > 0 THEN
      RAISE EXCEPTION 'ABORTADO: as colunas a remover de Conteudo têm % valor(es). Nada foi apagado.', n;
    END IF;
  END IF;

  RAISE NOTICE 'Guarda passou: % tabelas legadas vazias, colunas sem valor.', total;
END $$;

-- ── As dez tabelas ────────────────────────────────────────────────────
-- CASCADE cuida das chaves estrangeiras entre elas; como estão vazias,
-- não há efeito colateral sobre dado nenhum.
DROP TABLE IF EXISTS "EntregaUGC" CASCADE;
DROP TABLE IF EXISTS "Creator" CASCADE;
DROP TABLE IF EXISTS "ImagemCriativo" CASCADE;
DROP TABLE IF EXISTS "Fornecedor" CASCADE;
DROP TABLE IF EXISTS "DecisaoMotor" CASCADE;
DROP TABLE IF EXISTS "LogCompliance" CASCADE;
DROP TABLE IF EXISTS "SerieFxa" CASCADE;
DROP TABLE IF EXISTS "TendenciaRadar" CASCADE;
DROP TABLE IF EXISTS "TermoJuridico" CASCADE;
DROP TABLE IF EXISTS "VideoAutorizado" CASCADE;

-- ── As três colunas mortas ────────────────────────────────────────────
ALTER TABLE "Conteudo"
  DROP COLUMN IF EXISTS "linkUrl",
  DROP COLUMN IF EXISTS "videoResultUrl",
  DROP COLUMN IF EXISTS "videoStatusUrl";
