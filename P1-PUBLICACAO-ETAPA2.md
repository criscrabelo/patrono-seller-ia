# P1.0 Etapa 2 — desenho da migration e plano

> **Nada disto foi aplicado.** Este documento é o desenho que acompanha o
> contrato de domínio em `lib/publicacao-contrato.ts` (Etapa 1). A migration
> abaixo precisa da sua aprovação antes de existir como arquivo.

---

## 1. Migration proposta

Puramente **aditiva**: nenhuma coluna existente é alterada, renomeada ou
removida, e nenhuma linha atual muda de significado.

```sql
-- ── Publicacao: uma distribuição concreta de um Conteudo ────────────────
CREATE TABLE "Publicacao" (
  "id"                  TEXT PRIMARY KEY,
  "workspaceId"         TEXT NOT NULL,
  "contentId"           TEXT NOT NULL,

  -- Destino: quem distribuiu e onde apareceu. São coisas diferentes.
  "provider"            TEXT NOT NULL,
  "canal"               TEXT NOT NULL,

  -- PREPARADA | DISTRIBUINDO | DISTRIBUIDA | FALHOU | REMOVIDA
  "estado"              TEXT NOT NULL DEFAULT 'PREPARADA',

  -- Chave de idempotência da TENTATIVA. Sempre existe: é gerada por quem
  -- inicia a publicação e reenviada em cada retry.
  "chaveDaTentativa"    TEXT NOT NULL,

  -- Id no provider. NULL até existir, e pode nunca existir.
  "publicacaoExternaId" TEXT,

  -- Instante REAL da distribuição, espelho de evidencia.confirmadaEm.
  "distribuidaEm"       TIMESTAMP(3),

  -- Evidência de que a publicação circulou (tipo, referência, adapter,
  -- responsável, motivo). NUNCA credencial.
  "evidencia"           JSONB,

  -- Proveniência do REGISTRO, mesmo vocabulário do P0.2. Default
  -- conservador: UNVERIFIED nunca conta como operação real.
  "dataOrigin"          TEXT NOT NULL DEFAULT 'UNVERIFIED',

  "criadaEm"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadaEm"        TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Publicacao_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id"),
  CONSTRAINT "Publicacao_contentId_fkey"
    FOREIGN KEY ("contentId") REFERENCES "Conteudo"("id")
);

-- CHAVE PRIMÁRIA DE IDEMPOTÊNCIA: sempre existe, distingue retry de
-- republicação. É o que impede `contentId + canal + externalId` de colapsar
-- duas publicações quando o id externo é NULL.
CREATE UNIQUE INDEX "Publicacao_workspaceId_chaveDaTentativa_key"
  ON "Publicacao"("workspaceId", "chaveDaTentativa");

-- CHAVE EXTERNA: protege do caso oposto — o mesmo post do provider chegando
-- duas vezes sob chaves de tentativa diferentes. Parcial, porque o id
-- externo é NULL com frequência e NULLs não colidem em UNIQUE.
CREATE UNIQUE INDEX "Publicacao_workspaceId_provider_externo_key"
  ON "Publicacao"("workspaceId", "provider", "publicacaoExternaId")
  WHERE "publicacaoExternaId" IS NOT NULL;

CREATE INDEX "Publicacao_workspaceId_estado_idx"
  ON "Publicacao"("workspaceId", "estado");
CREATE INDEX "Publicacao_workspaceId_contentId_idx"
  ON "Publicacao"("workspaceId", "contentId");
CREATE INDEX "Publicacao_workspaceId_distribuidaEm_idx"
  ON "Publicacao"("workspaceId", "distribuidaEm");

-- ── Link pertence a no máximo uma publicação ────────────────────────────
ALTER TABLE "LinkDinamico" ADD COLUMN "publicacaoId" TEXT;

ALTER TABLE "LinkDinamico"
  ADD CONSTRAINT "LinkDinamico_publicacaoId_fkey"
  FOREIGN KEY ("publicacaoId") REFERENCES "Publicacao"("id")
  ON DELETE SET NULL;

-- Cardinalidade 0..1 imposta pelo banco, não só pela regra: uma publicação
-- tem no máximo um link porque Conteudo.produtoId é FK única.
CREATE UNIQUE INDEX "LinkDinamico_publicacaoId_key"
  ON "LinkDinamico"("publicacaoId")
  WHERE "publicacaoId" IS NOT NULL;
```

### Por que não há backfill

Conteúdos já publicados têm `dataPublicacao` e `publicacaoExternaId` em
`Conteudo`. Seria tecnicamente possível criar uma `Publicacao` para cada um.

**Não faço isso**, pela mesma razão do Bloco 4.1: o registro atual não
guarda quantas vezes o conteúdo foi ao ar, nem em que canais. Criar uma
publicação a partir do estado de hoje inventaria um histórico que o dado não
sustenta — exatamente o vazamento que já foi eliminado uma vez.

O legado fica legível como legado. `LinkDinamico.publicacaoId = NULL` em todos
os links existentes: eles continuam funcionando e continuam atribuíveis a
produto, que é o que sempre foram.

### O que NÃO muda

- `Sale` — nenhuma coluna. A publicação é derivada por
  `Sale.clickEventId → EventoLink → LinkDinamico.publicacaoId`.
- `EventoLink` — nenhuma coluna. A origem vem do link.
- `Conteudo` — os campos de publicação permanecem, agora como legado.
- `MLFeatureSnapshot` — nenhuma coluna. A transição usa `featureVersion`.

---

## 2. Impacto nos módulos atuais

| Módulo | Impacto |
|---|---|
| `lib/ml-captura-publicacao.ts` | `avaliarDistribuicaoReal(conteudo)` passa a receber `Publicacao`. `capturedAt` vira `Publicacao.distribuidaEm`. A janela de observação conta da publicação, não do conteúdo. |
| `lib/ml-operacao-real.ts` | `ENTIDADE_DA_AMOSTRA` vira `'Publicacao'`; `chaveDaAmostra` passa a usar `publicacaoId`. Sob `featureVersion` nova. |
| `lib/metricas-clique.ts` | `GRANULARIDADES_COM_CLIQUE_REAL` ganha `CONTEUDO` e `CANAL`. `LIMITACAO_DE_ATRIBUICAO` é resolvida e removida. |
| `lib/learning-engine.ts` | `ResumoPorConteudo.cliques` deixa de ser `null`. `ResumoPorCanal.taxaConversao` idem. |
| `lib/ml-creative-learning.ts` | Hook e CTA voltam a ter taxa de conversão real. |
| `lib/ml-financial-metrics.ts` | `clicksPerView`, `saleConversionRate` e `commissionPerClick` voltam a existir em CONTEUDO/PUBLICACAO. |
| `lib/dossie-operacao.ts` | Ganha a publicação na cadeia; `descreverCadeia` inclui o elo. |
| 3 rotas de publicação | Criam `Publicacao` antes de distribuir; gravam evidência ao confirmar. |
| `app/api/l/[slug]` | Nenhuma mudança — a origem vem do link, não da URL. |

---

## 3. Plano da Etapa 2

**2.a — Link rastreado na publicação (sem schema).** A legenda publicada passa
a carregar `/api/l/{slug}` em vez de `Produto.linkProduto`. Exige
`PUBLIC_BASE_URL` validada; sem ela, publica sem link e registra a lacuna —
link apontando para `localhost` é pior que link nenhum. Também corrige o
`localhost` hardcoded em `app/(dashboard)/links/page.tsx:344`.

> **Esta é a etapa que destrava dado.** Hoje nenhum clique de conteúdo
> publicado passa pelo nosso redirect, então toda a cadeia abaixo mediria zero
> sem ela.

**2.b — Migration acima**, apresentada e aprovada antes de aplicar.

**2.c — Fluxo de publicação.** Criar `Publicacao` (PREPARADA) → criar/reusar o
link daquela publicação → `DISTRIBUINDO` → provider confirma → evidência +
`DISTRIBUIDA`. Idempotente pela chave de tentativa.

**2.d — Migrar captura e métricas** para a publicação, sob `featureVersion`
nova. Sem backfill.

**2.e — Slug mais forte.** O gerador usa sufixo de 3 dígitos aleatórios
(`app/api/links/route.ts:22`) com `slug @unique` global. Com um link por
publicação o volume cresce e a colisão deixa de ser teórica.

---

## 4. Riscos abertos

1. **Sem a Etapa 2.a nada mede.** É o pré-requisito de tudo.
2. **Prontidão do ML recomeça** na geração nova. As gerações não se somam —
   é o preço honesto de trocar a unidade de observação.
3. **Link compartilhado fora do post** continua contando para a publicação de
   origem. É a semântica correta (o link nasceu ali), mas precisa estar clara
   em qualquer relatório que a proprietária leia.
4. **Colisão de slug** (item 2.e).
5. **Proliferação de links**: hoje a rota cria 18 por produto. Na Etapa 2 é a
   chance de criar sob demanda, na publicação.
6. **Republicação sem `chaveDaTentativa` distinta** colapsaria duas publicações
   numa só. Quem inicia a publicação é responsável por gerar a chave — mesmo
   contrato de `Sale.idempotencyKey`, que já está em uso.
