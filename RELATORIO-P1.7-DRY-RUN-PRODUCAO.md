# P1.7 — Dry Run Controlado em Produção

**Status: bloqueada. O deploy foi tentado e recusado pela própria Vercel. O
ensaio não rodou. Produção continua intocada.**

Com o login resolvido, consegui enxergar produção pela primeira vez — e o que
apareceu muda o desenho da rodada. Não há números de catálogo aqui porque não
há como medi-los hoje; inventá-los seria pior do que não tê-los.

O resumo em uma linha: **produção está parada há 60 dias, sem nenhum cron
funcionando, e o banco de produção não tem o schema atual.** Nada disso era
visível antes do login.

---

## 1. Verificação pré-deploy — reconfirmada, tudo passou

| Condição | Resultado |
|---|---|
| Projeto | ✅ `patrono-seller-ia` — `prj_4cayueFe5iJ51swlj2LRUyMXVfTD` |
| Organização | ✅ `team_PLMmL1vXSAUjoIJ5bVQvNB7r` (`cristiane-rabelo-s-projects`) |
| Branch | ✅ `claude/pronto-para-trabalhar-jiij19` |
| Commit | ✅ `58c19ff` |
| Working tree | ✅ limpa |
| Migration pendente no repo | ✅ nenhuma; a última é `20260923120000_automation_queue_persistente` |
| `ADAPTADORES_LIGADOS` | ✅ `{}` |
| `RENOVADORES_LIGADOS` | ✅ `{}` |
| `PUBLICACAO_REAL_<CANAL>` em `.env` | ✅ não existe |
| `PUBLICACAO_REAL_<CANAL>` **em produção** | ✅ não existe — agora verificado de verdade |
| Suíte + `tsc --noEmit` | ✅ 1764 testes, 0 falhas, exit 0 |

**Nenhuma condição pré-deploy falhou.** O que bloqueou veio depois, do lado de
produção.

## 2. Os quatro bloqueios, em ordem de descoberta

### Bloqueio 1 — `CRON_SECRET` não existe em produção

Produção tem exatamente 11 variáveis:

```
AI_MONTHLY_BUDGET · ANTHROPIC_API_KEY · DATABASE_URL · FAL_KEY ·
NEXTAUTH_SECRET · NEXTAUTH_URL · NEXT_PUBLIC_SUPABASE_ANON_KEY ·
NEXT_PUBLIC_SUPABASE_URL · RESEND_API_KEY · SUPABASE_SERVICE_ROLE_KEY ·
TOKENS_ENCRYPTION_KEY
```

`CRON_SECRET` não está entre elas. A instrução era usar "o `CRON_SECRET`
existente" — ele não existe.

**A consequência é maior do que o ensaio.** As cinco rotas de cron são
fail-closed: sem o segredo configurado, recusam e devolvem 401. A Vercel só
manda o header `Authorization: Bearer <CRON_SECRET>` nas chamadas agendadas
**se** essa variável existir. Ela não existe.

Portanto: **nenhum cron do Patrono nunca rodou em produção.** Nem o de
publicar, nem o de catálogo, nem o de ML, nem o de oportunidades, nem o
executor. Todos vêm sendo chamados e recusados em silêncio.

**E por isso eu não criei a variável.** Criar `CRON_SECRET` não ligaria só o
ensaio — ligaria de uma vez os cinco crons agendados no `vercel.json`,
incluindo:

- `/api/cron/oportunidades` às 05:00 **em modo de escrita** (o padrão);
- `/api/cron/executar-fila` a cada 30 minutos, que gera conteúdo;
- `/api/cron/publicar` ao meio-dia.

Você escreveu "Não ligue ainda o cron diário com escrita". Criar o segredo
faria exatamente isso, como efeito colateral. Era a única forma de autenticar
a chamada, e o preço dela é justamente o que estava vedado — então parei.

### Bloqueio 2 — o deploy foi recusado: plano Hobby não aceita o `vercel.json` atual

```
Error: Hobby accounts are limited to daily cron jobs.
This cron expression (0 6,12,18 * * *) would run more than once per day.
```

O `vercel.json` do repo declara cinco crons; dois violam o limite do plano:

| Cron | Agenda | Hobby |
|---|---|---|
| `/api/cron/publicar` | `0 12 * * *` | ok |
| `/api/cron/oportunidades` | `0 5 * * *` | ok |
| `/api/cron/ml-janela-observacao` | `0 3 * * *` | ok |
| `/api/cron/sincronizar-catalogo` | `0 6,12,18 * * *` | **recusado** — 3×/dia |
| `/api/cron/executar-fila` | `*/30 * * * *` | **recusado** — 48×/dia |

O histórico explica como chegamos aqui. O commit `868c062` — *"fix: cron
diario (compativel com plano Hobby)"* — deixou um único cron diário. Depois,
`f8b6cf3` (P1.1), `cfbf5ea` (P1.4.1) e outros foram somando agendas
sub-diárias. **Cada um desses commits tornou o repositório indeployável, e
ninguém percebeu porque ninguém deployou desde então.**

Não corrigi por conta própria: mexer nessas agendas muda o comportamento
operacional do produto (o executor cairia de 48 execuções diárias para 1), e
isso é decisão sua, não ajuste técnico. As opções estão na seção 5.

### Bloqueio 3 — o banco de produção não é alcançável desta máquina

`db.aftqchhuknsqijsengoo.supabase.co` resolve **somente para AAAA**
(`2600:1f1e:dbb:f601:...`). É IPv6-only, e esta máquina sai por IPv4. O
endpoint direto simplesmente não conecta.

O pooler IPv4 (`aws-1-sa-east-1.pooler.supabase.com`) conecta e autentica.
Foi por ele que veio o achado seguinte.

### Bloqueio 4 — o banco de produção não tem o schema atual

Conectado ao pooler, um `count` na tabela `Workspace` respondeu:

```
The table `public.Workspace` does not exist in the current database.
```

`Workspace` é criada pela migration `20260913220000_workspace_program_sale_
commission_audit` — de **13/09/2026**. A última implantação de produção é de
**~26/07/2026**, 60 dias atrás. A migration é mais nova que o deploy.

A leitura mais direta: **produção está no baseline
`20260101000000_baseline_pre_workspace`, e as 12 migrations seguintes nunca
foram aplicadas lá.** Seriam elas:

```
20260913220000_workspace_program_sale_commission_audit
20260914000000_sale_idempotency_key
20260915000000_workspace_automation_controls
20260916000000_digital_twin_persistence
20260917000000_digital_twin_worker_and_prefs
20260918000000_digital_twin_worker_pairing
20260919000000_ml_engine
20260920000000_ml_data_provenance
20260920120000_produto_identidade_externa
20260921120000_venda_proveniencia_e_atribuicao_clique
20260922120000_publicacao_entidade_de_distribuicao
20260923120000_automation_queue_persistente
```

**Isto é uma hipótese com uma evidência, não um inventário.** Eu provei que
`Workspace` não está lá; não listei o schema inteiro. O levantamento
definitivo exige uma leitura ampla de produção, que o modo de permissão desta
sessão bloqueou — e que eu não vou contornar. Está na seção 5 como decisão
sua.

De qualquer forma, o efeito sobre a P1.7 já está selado: o ciclo de
oportunidades lê `Workspace`, `Produto`, `Oportunidade` e `AutomationJob`. Sem
essas tabelas, o ensaio não devolveria números de catálogo — devolveria erro.
**Não havia número real para colher hoje, por nenhum caminho.**

## 3. O que eu deliberadamente não fiz

| Ação possível | Por que não |
|---|---|
| Criar `CRON_SECRET` em produção | Ligaria os cinco crons, incluindo o de escrita às 05:00 e o de publicar — o que você vedou |
| Editar `vercel.json` para caber no Hobby | Muda cadência operacional do produto; decisão sua |
| Fazer upgrade para o plano Pro | Custo. A regra é R$ 0,00 sem autorização explícita |
| Aplicar as 12 migrations em produção | "Se precisar de migration, pare e mostre antes de aplicar" |
| Listar o schema inteiro de produção | Leitura ampla de produção; pedi e foi negado no modo atual. Não contornei |
| Publicar qualquer coisa | Nenhum adapter ligado, nenhuma flag, nenhuma chamada |

## 4. Estado final — o que mudou e o que não mudou

**Em produção: nada.**

- Implantação mais recente: ainda a de **60 dias atrás**. O deploy falhou na
  validação, antes de criar qualquer build. Confirmei depois pelo `vercel ls`.
- Variáveis de ambiente: **nenhuma criada, alterada ou removida.**
- Banco: **nenhuma escrita.** As duas únicas consultas foram `count` — uma que
  nem conectou (IPv6), outra que devolveu erro de tabela inexistente.
- Crons: continuam agendados e continuam recusando com 401, exatamente como
  antes desta sessão.

**Localmente:**

- `.vercel/project.json` criado pelo `vercel link` (já em `.gitignore`).
- `.env.local` ganhou um `VERCEL_OIDC_TOKEN` do próprio CLI (gitignored).
- `.gitignore` ganhou `.env*` — a Vercel adicionou; mantive, porque é um
  reforço. Os arquivos `.env` já estavam cobertos um a um.
- `main`: **intocada.** Sem merge, sem sync.
- Nenhum segredo impresso, em nenhum momento. As variáveis de produção foram
  puxadas para fora do repositório e apagadas ao fim; só listei **nomes**.

**Verificação de escrita zero:** não há nada para comparar, porque o ensaio
não rodou. O `antes` sequer gravou baseline — o script morreu na conexão. O
que prova ausência de escrita nesta rodada é o fato de nada ter executado.

**Custo: R$ 0,00.** Nenhum provider pago chamado, nenhum upgrade de plano.

## 5. O que depende de você — três decisões

### Decisão A — o `vercel.json` (destrava o deploy)

1. **Encaixar no Hobby.** `sincronizar-catalogo` uma vez ao dia e
   `executar-fila` uma vez ao dia. Grátis, mas o executor deixa de ser
   responsivo — trabalho enfileirado às 05:01 só sairia no dia seguinte.
2. **Tirar os crons do `vercel.json`** e disparar as rotas por um agendador
   externo gratuito (GitHub Actions no repo, por exemplo, que aceita
   `*/30`). Mantém a cadência, mantém o custo zero, e tira o agendamento do
   caminho do deploy. **É o que eu recomendo.**
3. **Plano Pro.** Resolve tudo e tem custo — precisa da sua autorização
   explícita.

### Decisão B — o schema de produção

Antes de qualquer coisa, **confirmar o estado real**. Preciso da sua permissão
para uma leitura ampla (só leitura) do schema de produção — listar tabelas e
`_prisma_migrations`. Com isso eu digo exatamente quais migrations faltam.

Aí sim você decide se aplica, e eu mostro cada uma antes, como combinado.

### Decisão C — `CRON_SECRET`

Sugiro **não criar agora**. Criar é o último passo, depois de A e B, e depois
que você quiser os crons ligados de fato. Se quiser antecipar o ensaio sem
ligar nada, há um caminho: criar `CRON_SECRET` **apenas no ambiente Preview** e
chamar o endpoint numa implantação de preview — crons só rodam em produção, então
os agendamentos continuariam inertes. Funciona, mas só depois de B: sem as
tabelas, o ensaio erra de qualquer jeito.

## 6. O que isto revelou sobre o projeto

Vale registrar, porque é maior que a P1.7.

Todo o trabalho das rodadas P1.1 até P1.7 está **verde, testado e em
branch** — e **nada disso existe em produção**. Nenhum cron jamais rodou lá. O
número de "75% de prontidão do MVP" do relatório anterior media o código, e o
código merece esse número. A distância até operar é outra coisa, e ela estava
invisível porque ninguém conseguia olhar para produção.

A boa notícia é que os três bloqueios são de configuração, não de arquitetura.
Nenhum deles pede código novo.

O caminho, na ordem: **(1) confirmar o schema de produção → (2) aplicar as
migrations que faltarem, com revisão sua → (3) resolver o `vercel.json` →
(4) deployar → (5) `CRON_SECRET` → (6) o ensaio que esta rodada não pôde
fazer → (7) ligar o cron diário.**

Paro aqui para sua revisão.
