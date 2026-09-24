# P1.7.4 — Janela final: migração + deploy em produção

**Concluída sem incidente. As 11 migrations aplicaram em 5,3 s, o deploy
saiu 4 minutos depois e a aplicação responde. Nenhum dado mudou de valor.
Nenhuma publicação. Custo R$ 0,00.**

Produção saiu de uma implantação de **61 dias atrás** com schema de antes do
`Workspace`, e chegou ao schema completo com o código atual no ar.

Data: 24/09/2026 · Commit `904d465` · Branch `claude/pronto-para-trabalhar-jiij19`

---

## 1. Pré-check — todos os 14 itens

| Item | Resultado |
|---|---|
| Branch | `claude/pronto-para-trabalhar-jiij19` |
| Commit | `904d465` |
| Working tree | limpa |
| Sincronizado com `origin` | sim — mesmo SHA |
| Build de produção | **exit 0** |
| `npx tsc --noEmit` | **exit 0** |
| Suíte completa | **1.768 testes, 0 falhas**, exit 0 |
| Projeto Vercel | `patrono-seller-ia` — `prj_4cayueFe5iJ51swlj2LRUyMXVfTD` |
| Preview já validado | sim, na Etapa 3B |
| `PUBLICACAO_REAL_*` | não existe |
| `ADAPTADORES_LIGADOS` / `RENOVADORES_LIGADOS` | `{}` / `{}` |
| Provider pago inalcançável por cron | provado por grafo de imports |
| `CRON_SECRET` em produção | **ausente** |
| Migrations pendentes | **11** |
| Backup da Etapa 1 íntegro | sha256 confere, TOC legível |

Nenhum item divergiu.

## 2. Backup imediatamente antes da janela

| | |
|---|---|
| Arquivo | `patrono-prod-20260924T172225Z-pre-janela.dump` |
| Timestamp UTC | `2026-09-24T17:22:25Z` |
| Tamanho | **83.955 bytes** (formato custom) |
| SHA-256 | `a80fde542061f5c12830fb7a4af916949b263674bd650fcb339b0d21f08d7cf2` |
| Local | `C:\Users\jurid\backups-patrono\` — fora do repositório e fora do OneDrive |
| Validação | `pg_restore --list`: **23 tabelas com dado, 148 entradas**, `Workspace` presente |

Este é o segundo backup. O primeiro
(`...20260924T162302Z-public.dump`, 60.711 bytes) retrata o estado **antes**
da migration nº 2 e continua guardado. Os dois cobrem pontos de retorno
diferentes.

## 3. As 11 migrations

Aplicadas por `npx prisma migrate deploy`, na ordem cronológica, numa única
execução. **Tempo de parede total: 5.336 ms** — incluindo carregar o CLI e
conectar ao pooler em `sa-east-1`.

| Ordem | Migration | Resultado | Compatibilidade com o app antigo |
|---|---|---|---|
| 3 | `sale_idempotency_key` | aplicada | mantém |
| 4 | `workspace_automation_controls` | aplicada | mantém |
| 5 | `digital_twin_persistence` | aplicada | mantém |
| 6 | `digital_twin_worker_and_prefs` | aplicada | mantém |
| 7 | `digital_twin_worker_pairing` | aplicada | mantém |
| 8 | `ml_engine` | aplicada | mantém |
| 9 | `ml_data_provenance` | aplicada | mantém |
| 10 | `produto_identidade_externa` | aplicada | mantém (leituras seguem) |
| **11** | **`venda_proveniencia_e_atribuicao_clique`** | aplicada | **QUEBRA** — `EventoLink.workspaceId` |
| 12 | `publicacao_entidade_de_distribuicao` | aplicada | mantém |
| 13 | `automation_queue_persistente` | aplicada | mantém |

`All migrations have been successfully applied.` · exit 0

### O ponto de incompatibilidade

**Migration nº 11.** É ela que dá `workspaceId` a `EventoLink` — anulável,
backfill a partir de `LinkDinamico`, depois `SET NOT NULL`.

A partir dela, o `app/api/l/[slug]/route.ts` da aplicação de 61 dias atrás
não conseguiria mais gravar o evento de clique. **O redirecionamento
continuaria funcionando** — a gravação é fire-and-forget com
`.catch(() => {})` e o `redirect` está fora da cadeia —, mas o evento se
perderia, em silêncio.

**A janela real de exposição foi de cerca de 4 minutos**, entre a aplicação
da nº 11 e o fim do deploy. Com **0 cliques registrados em 126 links**, a
chance de alguém ter clicado nesse intervalo é desprezível, e `EventoLink`
segue com 0 linhas depois de tudo.

## 4. Validação mínima pós-migration

Feita antes do deploy, curta de propósito:

| Verificação | Resultado |
|---|---|
| `prisma migrate status` | **`Database schema is up to date!`** |
| Migrations pendentes | **0** |
| Registros em `_prisma_migrations` | 13 |
| Falhadas (`finished_at` nulo) | **0** |
| Com rollback | **0** |
| `Workspace` | existe |
| `AutomationJob` | existe |
| `Publicacao` | existe |
| `EventoLink.workspaceId` | existe, **`NOT NULL`** |
| Enums | `EstadoDaPublicacao`, `EstadoDoAutomationJob` |
| Somas de verificação do dado | **idênticas** às de antes |

## 5. Deploy

```
npx vercel deploy --prod --yes
```

| | |
|---|---|
| Resultado | **exit 0** |
| Duração | **106 s** |
| Implantação | `patrono-seller-1pff27lo8-...` — **Ready** |
| Domínio | `https://patrono-seller-ia.vercel.app` |
| Anterior | a de 61 dias atrás, agora substituída |

**Não houve rejeição do plano Hobby** — sem a chave `crons` no
`vercel.json`, não há o que recusar. O bloqueio de 60 dias acabou.

`CRON_SECRET` **não** foi criado. Publicação real **não** foi habilitada.
Adapters reais **não** foram ligados.

## 6. Validação pós-deploy — somente leitura

### A aplicação responde

| Rota | HTTP |
|---|---|
| `/` | 307 (redireciona para login, sem sessão) |
| `/login` | **200** |
| `/register` | **200** |
| `/dashboard` | 307 (redireciona para login, sem sessão) |

### Os crons continuam fechados

| Endpoint | Resposta |
|---|---|
| `/api/cron/oportunidades?modo=ensaio` | **401** `{"error":"Não autorizado"}` |
| `/api/cron/executar-fila` | **401** |
| `/api/cron/publicar` | **401** |
| com `Authorization: Bearer invalido` | **401**, sem vazar nada |

Fail-closed funcionando na infraestrutura real, sem `CRON_SECRET`.

### O schema conversa com o código novo

`migrate status` verde diz que o schema está no ponto; não diz que o cliente
Prisma gerado conversa com ele. Testei os dois caminhos que a aplicação usa,
em leitura:

**Workspace** — lido com as colunas da migration nº 4:

```
ws_05a6d536ef185f39b738   pausado=true   modo=MANUAL
```

**O kill switch está ativo em produção.** O workspace está pausado e em modo
manual, confirmado pelo cliente novo.

**Catálogo** — 25 produtos, lidos com as colunas da migration nº 10:

```
Bastao De Cera Para Cabelo Stick Natural Hair Wax | Beleza | origemDados=MANUAL
Baralho Dolar Dourado Ouro Folheado Kit 2        | Outros | origemDados=MANUAL
Meias Silicone Spa dos Pes Kit 02 Pares          | Saude  | origemDados=MANUAL
```

**Conteúdo** — 17, todos legíveis, status `aprovado`.

**Tabelas novas** — todas legíveis: `AutomationJob` 0, `Publicacao` 0,
`MLModel` 0, `MLFeatureSnapshot` 0, `EventoLink` 0, `LinkDinamico` 126.

### Preflight

| Canal | `pronto` | `executavelAgora` | bloqueio | custo zero |
|---|---|---|---|---|
| instagram | false | **false** | `SCOPE_NAO_VERIFICAVEL` | sim |
| tiktok | false | **false** | `DESCONECTADA` | sim |

`capabilityEfetiva`: `publicar=false`, `draft=false` nos dois.

E o preflight já diz o que falta, em uma frase: *"Reconecte a conta
informando App ID e App Secret, para a plataforma confirmar as permissões"*
(Instagram) e *"Conecte a conta deste canal"* (TikTok).

**Nada é publicável hoje**, e o motivo é explícito.

### Nenhuma publicação

`Publicacao` continua com **0 linhas**. Nenhum adapter ligado, nenhuma flag
definida, nenhum provider externo chamado.

**Uma coisa que deliberadamente não fiz:** exercitar `/api/l/<slug>` com um
slug real. Ele incrementa `cliques` e cria `EventoLink` — seria uma
**escrita** em produção, e você pediu checks somente leitura. A rota está no
build e o código dela não mudou nesta entrega.

## 7. Schema final

| Medida | Valor |
|---|---|
| Tabelas | **38** (27 models + `_prisma_migrations` + 10 legadas) |
| Índices | 88 |
| Índices únicos | 56 |
| Chaves estrangeiras | 58 |
| Enums | 2 |
| Migrations registradas | **13 de 13** |
| Migrations pendentes | **0** |

### Drift

`prisma migrate diff` contra o `schema.prisma`: **25 instruções, todas
descartes do legado** — 10 `DROP TABLE`, as 3 colunas mortas de `Conteudo` e
os `ALTER TABLE` que removem as chaves estrangeiras delas.

**Nenhum `CREATE TABLE`, `ADD COLUMN`, `CREATE INDEX` ou `CREATE TYPE`.**
Ou seja: não falta nada ao schema. O que sobra é o legado, que a limpeza
opcional resolve quando você quiser.

## 8. Contagens críticas antes/depois

| Tabela | Antes | Depois | Soma de verificação |
|---|---|---|---|
| `User` | 1 | **1** | idêntica |
| `Produto` | 25 | **25** | idêntica |
| `Conteudo` | 17 | **17** | idêntica |
| `LinkDinamico` | 126 | **126** | idêntica |
| `EventoLink` | 0 | **0** | idêntica |
| `Integracao` | 3 | **3** | idêntica |

**Nenhuma linha sumiu e nenhum valor mudou.** As somas cobrem `id`, nome,
categoria, preço, slug, URL de destino, cliques, conversões e receita — não
só a contagem.

## 9. Confirmações

| | |
|---|---|
| Migrations aplicadas | **11** (3 a 13) |
| Migrations pendentes | **0** |
| Migrations falhadas | **0** |
| Duração das migrations | **5,3 s** |
| Duração do deploy | **106 s** |
| Janela de incompatibilidade | **~4 minutos** |
| Deploy | **sucesso** |
| Aplicação responde | **sim** |
| Perda de dados | **nenhuma** |
| Publicação | **zero** — `Publicacao` com 0 linhas |
| Instagram / TikTok real | **zero** |
| Provider pago | **zero** |
| Treino / promoção de ML | **zero** — `MLModel` com 0 linhas |
| `CRON_SECRET` | **não criado** — produção segue com 11 variáveis |
| Adapters reais | **desligados** |
| GitHub Actions | no repositório, **inerte** |
| Merge / sync da `main` | **nenhum** |
| **Custo** | **R$ 0,00** |

---

## Onde o projeto está agora

O banco de produção está no schema completo. O código de hoje está no ar.
Os dois conversam, comprovado por leitura de catálogo, conteúdo e preflight.
O workspace nasceu pausado. Nada publica, nada gera, nada treina — e nenhum
cron consegue rodar, porque `CRON_SECRET` não existe.

Isto encerra a recuperação que começou na P1.7, quando descobrimos que
produção estava parada havia 60 dias.

## Próximo passo mínimo

**Criar o `CRON_SECRET`** — na Vercel (Production, Sensitive), redeploy, e o
mesmo valor como repository secret no GitHub, junto da variable
`PATRONO_BASE_URL`. Gerado por você, nunca por mim.

Com ele, o dry run que a P1.7 não pôde fazer finalmente roda:

```bash
npx tsx scripts/verificar-escrita-zero.ts antes
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  "https://patrono-seller-ia.vercel.app/api/cron/oportunidades?modo=ensaio"
npx tsx scripts/verificar-escrita-zero.ts depois
```

E aí sim saem os números reais do catálogo de produção, sem gravar nada.

**Atenção a uma consequência:** criar `CRON_SECRET` também destrava os
cinco crons no GitHub Actions — mas só depois do merge para `main`, porque
`schedule` só dispara na branch padrão. Enquanto não houver merge, o segredo
serve apenas para as chamadas manuais que você ou eu dispararmos.

Paro aqui para sua revisão.
