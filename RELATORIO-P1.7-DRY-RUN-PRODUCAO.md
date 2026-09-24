# P1.7 — Dry Run Controlado em Produção

**Status: verificação pré-deploy concluída e aprovada. Deploy e ensaio NÃO
executados — faltam credenciais que eu não tenho.**

Este relatório não contém números de produção, porque o ensaio não rodou.
Registrar números aqui sem tê-los medido seria inventar o resultado.

---

## 1. Verificação pré-deploy — todas as condições

| Condição | Resultado |
|---|---|
| Branch correta | ✅ `claude/pronto-para-trabalhar-jiij19` |
| Working tree limpa | ✅ nada pendente |
| Commit atual | ✅ `855e31f` |
| Sincronia com origin | ✅ em dia |
| Suíte completa verde | ✅ **1764 testes, 0 falhas, exit 0** |
| `npx tsc --noEmit` verde | ✅ **exit 0** |
| Nenhuma migration pendente | ✅ última é `20260923120000_automation_queue_persistente`; `prisma/` sem alteração |
| Nenhum adapter real habilitado | ✅ `ADAPTADORES_LIGADOS = {}` no código |
| Nenhum renovador habilitado | ✅ `RENOVADORES_LIGADOS = {}` no código |
| Nenhuma `PUBLICACAO_REAL_<CANAL>` | ✅ a string não existe em nenhum `.env` |
| Provider pago inalcançável | ✅ nenhum dos 4 crons alcança `lib/falai.ts`, provado por grafo de imports |
| ML sem treino/promoção | ✅ nenhum cron chama treino ou promoção; o cron diário nem alcança o pipeline |
| Cron em modo ensaio não grava | ✅ a gravação está atrás de `if (params.escrever)`, com teste comparando ensaio × operação |

**Nenhuma condição falhou.** O código está apto para o deploy.

## 2. Confirmação do destino, como solicitado

| Item | Valor |
|---|---|
| Ambiente de destino | Produção (Vercel) |
| Projeto | `patrono-seller-ia` — `prj_4cayueFe5iJ51swlj2LRUyMXVfTD` |
| Organização | `team_PLMmL1vXSAUjoIJ5bVQvNB7r` |
| Branch | `claude/pronto-para-trabalhar-jiij19` |
| Commit | `855e31f` |
| Migration | **Nenhuma.** Nada nesta entrega altera schema |
| Publicação habilitada | **Nenhuma.** Nenhum adapter ligado, nenhuma flag definida |

**Variáveis necessárias em produção para o ensaio:**

- `CRON_SECRET` — já existe em produção (é o que autentica os crons atuais).
- `DATABASE_URL` / `DIRECT_URL` — já existem.
- **Nenhuma variável nova.** `FFMPEG_DISPONIVEL` e `DIGITAL_TWIN_GPU_DISPONIVEL`
  são opcionais e fail-closed: ausentes, o plano simplesmente não escolhe
  formatos que dependem delas.
- **Nenhuma `PUBLICACAO_REAL_<CANAL>` deve ser criada.**

## 3. Por que o deploy e o ensaio não foram executados

Duas credenciais faltam, e nenhuma delas eu deveria inventar ou contornar:

**a) Autenticação do Vercel.** O CLI está *logged out* e não há `VERCEL_TOKEN`
no ambiente:

```
$ npx vercel whoami
> Logged out.
```

O `vercel login` é interativo (abre navegador ou pede código por e-mail) e não
pode ser completado a partir daqui.

**b) `CRON_SECRET` de produção.** Não está em nenhum arquivo local — `.env.local`
não o contém. Ele vive nas variáveis de ambiente do Vercel, que é onde deve
estar.

Sem (a) não há deploy; sem (b) não há como autenticar a chamada do ensaio.

### O que eu deliberadamente não fiz

`.env.local` aponta para o banco de **produção** (`aftqchhuknsqijsengoo`). Eu
poderia ter lido dali as contagens da tabela e até rodado o ciclo em modo
ensaio direto contra produção, sem passar pelo endpoint.

Não fiz, por três razões:

1. Você pediu o ensaio **pelo endpoint publicado**, autenticado por
   `CRON_SECRET` — que é o caminho que valida a rota, o deploy e a
   autenticação juntos. Rodar a função por fora testaria outra coisa.
2. Um "antes" sem "depois" não prova nada. A verificação de escrita zero só
   faz sentido em torno do ensaio.
3. Esse ref foi tratado como intocável em todas as rodadas anteriores. Uma
   autorização para deployar não é, por si, autorização para eu conectar na
   produção pela minha máquina.

## 4. O que ficou pronto para quando você destravar

### Script de prova de escrita zero

`scripts/verificar-escrita-zero.ts` — conta as sete tabelas que o ensaio
jamais pode tocar, antes e depois, e **sai com código 1 se qualquer contagem
mudar**. Só lê; não cria, não altera, não apaga.

Tabelas cobertas: `AutomationJob`, `Conteudo`, `Publicacao`, `LinkDinamico`,
`EventoLink`, `MLModel`, `MLFeatureSnapshot`.

Já validado de ponta a ponta contra o banco de teste (exit 0, todos os deltas
zero).

### Sequência completa

```bash
# 1. Autenticar (interativo — precisa ser você)
vercel login

# 2. Deploy do commit aprovado
vercel deploy --prod

# 3. Baseline, contra o banco de produção
npx tsx scripts/verificar-escrita-zero.ts antes

# 4. O ensaio, autenticado — o segredo não aparece no histórico
curl -s -H "Authorization: Bearer $CRON_SECRET" \
  "https://<dominio-de-producao>/api/cron/oportunidades?modo=ensaio" | tee ensaio.json

# 5. Prova de escrita zero
npx tsx scripts/verificar-escrita-zero.ts depois
```

### O que a resposta do ensaio vai trazer

O JSON já carrega, por construção, tudo o que você pediu:

`escreveu: false` · `workspaces` · `oportunidadesAvaliadas` · `itensDePlano` ·
`jobsDesejados` · `jobsCriados` (quantos **seriam** criados) · `jobsMantidos` ·
`jobsCancelados` · `nasceriamWaiting` · `lacunasDeFormato` · `recusados` ·
`erros` · `custoTotal` · e `porWorkspace[]` com canais conectados, prontas,
comerciais e o erro de cada workspace.

Os formatos escolhidos aparecem em `porWorkspace[].` via o plano; os bloqueios
reais, nos `bloqueios` de cada item e em `lacunasDeFormato`.

## 5. Garantias que já valem, independentemente do ensaio

- **Custo previsto: R$ 0,00.** `PROVEDOR_PAGO_AUTORIZADO` é `false` cravado no
  código, não lido do ambiente — nenhuma variável de produção pode autorizar
  gasto por este caminho.
- **Zero publicação.** O cron de oportunidades não alcança nenhum módulo de
  distribuição; nenhum adapter está ligado.
- **Zero geração.** O ensaio não chama a fábrica; gerar é trabalho do executor,
  que é outro cron.
- **Zero treino de ML.** Nenhum cron chama treino ou promoção.

## 6. Estado final

- Produção: **intocada**. Nenhum deploy, nenhuma conexão, nenhuma escrita.
- `main`: **intocada**. Sem merge, sem sync.
- Instagram e TikTok: **desligados**.
- Cron diário com escrita: **não ligado**.
- Migrations: **nenhuma**.

## 7. O que depende de você

1. `vercel login` — sugiro rodar no terminal desta sessão com `! vercel login`,
   assim a saída chega aqui e eu sigo a partir dali.
2. Confirmar que posso usar o `CRON_SECRET` de produção para a chamada do
   ensaio, ou disparar a chamada você e me passar o JSON.
3. Confirmar se posso rodar `verificar-escrita-zero.ts` contra o banco de
   produção — é leitura pura, mas é produção, e prefiro pedir.

Com qualquer um desses três destravado, termino a P1.7 na sequência.
