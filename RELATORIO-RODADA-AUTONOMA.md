# Relatório da rodada autônoma — 24/09/2026

Branch `claude/pronto-para-trabalhar-jiij19`. Sem deploy, sem merge, sem sync
da main, sem migration, sem publicação, custo R$ 0,00.

---

## Em uma linha

O ciclo interno do Patrono passou a ser **verificável de ponta a ponta**: um
teste E2E percorre Produto → Oportunidade → Plano → Job → Executor → Conteudo
→ Preflight → Dry Run chamando as mesmas funções que rodam em produção. E as
garantias que antes eram promessas em comentário viraram invariantes checadas
no grafo de imports.

## Estado inicial

Último marco: `b445f28` (P1.5.4). 1740 testes. As três pendências do relatório
noturno: duas resolvidas na P1.5.3, a terceira preparada e sem deploy.

## O que foi corrigido

### 1. O cron diário alcançava o pipeline de treino do ML

`lib/ml-engine.ts` importava de `lib/ml-training-pipeline.ts` apenas a
constante `CONVERSION_MODEL_FAMILY`. **Nada era treinado** —
`treinarModeloConversao` nunca é chamada de lá. Mas um import de constante é um
import de módulo: bastava isso para o pipeline de treino entrar no grafo de
qualquer coisa que usasse o engine, inclusive do cron das 05:00.

Não era bug de comportamento; era fronteira indefensável. Não dava para
escrever "o cron não alcança o treino" como invariante verificável — e
invariante que não dá para verificar é promessa.

**Correção:** a constante mudou para `lib/ml-constantes.ts`, puro e sem
import. O pipeline a reexporta para não quebrar quem já a importava. Agora
quem lê o modelo não carrega quem o treina, e há teste exigindo isso.

### 2. O cron do executor não reportava falhas

`rodarFilaDoWorkspace` sempre contou `falhas`. A rota `/api/cron/executar-fila`
não as devolvia na resposta. Uma execução com jobs falhando era
**indistinguível de uma limpa** para quem lê o JSON — que é exatamente o que
alguém abre quando desconfia que algo parou. Agora `totalFalhas` sai na
resposta, com teste.

### 3. Três defeitos meus nos próprios testes

Corrigidos antes de qualquer commit:

- varredura casando **prosa de comentário** em vez de chamada (o comentário do
  readiness gate cita `promoverModelo()` para explicar uma garantia). Agora os
  comentários são removidos antes de casar;
- filtro de caminho usando só `/`, que no **Windows** deixaria o teste
  percorrendo zero arquivos e passando por vazio. Trocado por `sep`;
- ausência de guarda contra teste vazio. Agora o teste exige mais de 20
  arquivos examinados e um grafo com mais de 10 nós, senão falha.

## Auditorias que não encontraram problema

Registro o que foi olhado e estava certo, porque "não mexi" e "conferi e está
bom" são coisas diferentes:

- **Automation Queue** — os 11 pontos pedidos já tinham teste: não duplica,
  retry com backoff e teto, heartbeat renovado só pelo dono, worker morto
  recuperado por heartbeat expirado, WAITING humano com zero tentativas,
  WAITING condição sem loop, job obsoleto cancelado de forma auditável, RUNNING
  não cancelado pelo sync, workspace alheio nunca reivindica, e tipo sem
  executor não é automatizável.
- **Cross-workspace** — varredura de todas as consultas Prisma nos 11 módulos
  do ciclo. Cinco não têm `workspaceId` no `where`; todas as cinco são
  legítimas: listar workspaces (o ponto do cron), heartbeat escopado por
  `jobId + workerId`, e três updates por id **precedidos de leitura escopada
  por workspace**. Nenhum vazamento.
- **Segredo em log** — nenhum `console.*` imprime token, senha ou secret. As
  ocorrências citam o *nome* da variável ("CRON_SECRET não configurado"),
  nunca o valor.
- **Provider pago** — `lib/falai.ts` só é alcançável por três rotas disparadas
  pela usuária. **Nenhum dos quatro crons o alcança**, agora provado por grafo
  de imports.
- **Machine Learning** — nenhuma rota ou cron chama treino ou promoção. O cron
  de ML só rotula amostras, e é idempotente.

## Commits

| Hash | Assunto |
|---|---|
| `f9a23f8` | `test: E2E do ciclo interno completo, de ponta a ponta` |
| `67a11d5` | `test: invariantes de arquitetura no grafo de imports + desacopla constante do ML` |
| _(este)_ | `fix: cron do executor reporta falhas + relatorio da rodada` |

## Testes

**1764 passando, 0 falhando, exit code 0.** `npx tsc --noEmit` exit code 0.
309 suítes. Eram 1740 no início da rodada — **24 novos**.

A suíte `.mjs` continua exigindo servidor em `localhost:3100` e não foi
executada; mesma condição de todas as rodadas anteriores.

## Ciclo E2E

Passa. Prova, numa execução contínua contra Postgres real:

1 produto → 1 oportunidade → 1 item de plano → 1 job `PENDING` → 1 sucesso do
executor → **1 Conteudo**, já com o disclosure que o canal exige → preflight
com `pronto: true` e `executavelAgora: false` (`ADAPTER_DESLIGADO`) → ensaio
sem envio e sem gravação.

Saldo: **0 Publicacao, 0 LinkDinamico, 0 EventoLink, custo 0.**

Cobre ainda: segunda volta não duplica job ativo por chave; retomada reusa a
peça pelo `contentId` do contexto; workspace B intocado e preflight de B não
enxerga peça de A; e um **adapter-espião** injetado no ensaio com
`PUBLICACAO_REAL_INSTAGRAM=true` registra **zero chamadas** — prova mais forte
que contar `Publicacao`, porque mostra que o caminho nem chega ao adapter.

## Situação por frente

**Cron de oportunidades** — pronto para operação contínua, **sem deploy**.
Autenticação por `CRON_SECRET` + Bearer, fail-closed. Idempotente (dois crons
seguidos criam zero). Isolado por workspace. Só seleciona formato produzível.
Sincroniza e cancela apenas os tipos que administra. Zero provider pago
(`PROVEDOR_PAGO_AUTORIZADO` é `false` cravado, não lido do ambiente). Zero
publicação — não alcança nenhum módulo de distribuição. Tem modo `?modo=ensaio`
que percorre o mesmo caminho sem gravar.

**Automation Queue** — auditada e íntegra. Nenhuma correção necessária.

**Creative Factory** — autoridade única em `lib/capacidades-da-fabrica.ts`,
sem lista duplicada (há teste que falha se alguém redeclarar). Produz
`VIDEO_9X16_FFMPEG_NARRADO` e `TEXTO_COM_LINK`. Formato não implementado nunca
é escolhido como executável; sem nenhum produzível, o item vai para
`AGUARDANDO_CAPACIDADE`.

**Instagram** — adapter escrito e **desligado**. `ADAPTADORES_DISPONIVEIS` só
o contém, e `adaptadoresHabilitados()` só o liga com
`PUBLICACAO_REAL_INSTAGRAM=true`, que não existe em lugar nenhum. Preflight
explica conta, escopos, capability efetiva, mídia, disclosure, formato, custo
e bloqueio. **Nenhuma postagem real.**

**TikTok** — sem adapter disponível de propósito. Direct Post existe em
`TikTokPublisher` mas o registro declara `autoPublish: false` e o app não
passou por auditoria. Draft continua impossível: não há implementação, o app
não pede `video.upload`, e a concessão sozinha não bastaria. **Nenhum Direct
Post, nenhum draft, nenhum upload.**

**Machine Learning** — shadow mode preservado. Sem treino, sem promoção, sem
ativação. `REAL_OPERATION` segue como única origem elegível.

## Itens em WAITING

Nenhum item do ciclo fica preso: no ensaio com o catálogo de teste,
`nasceriamWaiting = 0`, porque sem FFmpeg o plano escolhe `TEXTO_COM_LINK`,
que roda sem capacidade. Numa máquina com FFmpeg declarado e sem Chatterbox,
os jobs de vídeo nascem `PENDING` e o executor os devolve a `WAITING` sem
consumir tentativa — e `reavaliarAguardando()` os destrava quando a capacidade
voltar.

## Decisões tomadas autonomamente

1. **Mover a constante do ML para módulo próprio** em vez de apenas documentar
   o acoplamento. Menos acoplado, reversível, e torna a invariante
   verificável.
2. **Testar alcance por grafo de imports**, não por varredura de texto. Foi o
   que revelou o achado do ML, que três rodadas de varredura textual não
   viram.
3. **Manter o executor alcançando a distribuição** e documentar isso num
   teste, em vez de cortar o import. O que impede a publicação é o registro
   vazio, não a ausência do import — fingir o contrário esconderia onde o
   portão realmente está.
4. **Prefixar o relatório noturno com o status atual** em vez de reescrevê-lo.
   O texto original explica como cada problema foi descoberto; um documento
   que diz "pendência aberta" sobre algo resolvido é risco.

## Depende de você

1. **Deploy do cron de oportunidades.** Está pronto e testado; ativar exige
   deploy, que está vedado. Recomendo rodar `?modo=ensaio` em produção antes.
2. **Ligar o Instagram**, quando quiser publicar: reconectar informando App ID
   e App Secret (para o `debug_token` comprovar o escopo) e definir
   `PUBLICACAO_REAL_INSTAGRAM=true`.
3. **Auditoria do app TikTok** — fora do nosso alcance; depende da plataforma.

## Migrations

**Nenhuma proposta e nenhuma aplicada.** Nada desta rodada precisou de mudança
de schema. `PENDENCIA-MIGRATION.md` não foi criado por não haver pendência.

## Confirmações

- **Custo R$ 0,00.** Nenhum provider pago chamado; nenhum alcançável a partir
  de cron, provado por grafo de imports.
- **Zero publicação real.** Nenhum post, Direct Post, draft ou upload.
  Registros de adapter e renovador vazios, com teste.
- **Produção intocada.** Toda escrita foi no banco de teste autorizado
  (`xntkypjmmdovrfbblbqb`), com verificação de ref antes de cada execução.
- **`main` intocada.** Sem merge, sem sync, sem deploy.

## Prontidão do MVP comercial

**Aproximadamente 75%.** O que sustenta esse número:

| Frente | Estado |
|---|---|
| Descobrir e priorizar oportunidade | pronto |
| Planejar canal e formato | pronto |
| Fila persistente e executor | pronto |
| Gerar conteúdo gratuito | pronto para `TEXTO_COM_LINK`; vídeo depende de FFmpeg e Chatterbox no worker |
| Link rastreado e `Publicacao` | pronto |
| Preflight e autorização | pronto |
| **Publicar de verdade** | **bloqueado**: sem deploy, sem escopo comprovado, sem flag |
| Medir clique e conversão | pronto, sem dado real ainda |
| Aprender (ML) | shadow mode, sem amostra suficiente |

Os 25% restantes são quase inteiramente **a primeira publicação real** e o que
só existe depois dela: dado de clique, conversão e as primeiras amostras
rotuladas. Nada disso se resolve escrevendo mais código.

## Próximo passo mínimo para começar operação real

**Três coisas, nesta ordem:**

1. Deploy da branch e um `GET /api/cron/oportunidades?modo=ensaio` em produção
   com o Bearer — devolve os números reais sem gravar nada.
2. Reconectar o Instagram com App ID e App Secret. Isso faz o `debug_token`
   comprovar `instagram_content_publish`, e o preflight sai de
   `SCOPE_NAO_VERIFICAVEL` para `pronto: true` sem uma linha de código nova.
3. `PUBLICACAO_REAL_INSTAGRAM=true` e uma peça publicada sob observação.

Depois da primeira publicação real, o ciclo se fecha sozinho: link rastreado →
clique → venda → amostra rotulada → readiness do ML.
