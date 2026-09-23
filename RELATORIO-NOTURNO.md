# Relatório noturno — 23/09/2026

Modo noturno seguro. Branch `claude/pronto-para-trabalhar-jiij19`.

---

## Resumo em uma linha

O ciclo do Patrono foi ligado de ponta a ponta e **rodou sozinho**: produto →
oportunidade → plano → fila → executor → conteúdo gerado → preflight → ensaio.
No caminho apareceram **três defeitos reais** que impediriam isso de funcionar,
e um que teria duplicado um post no perfil da proprietária.

---

## O que foi feito

### 1. Auditoria da cadeia do Instagram (Prioridade 1)

Percorri `Conteudo → preflight → Publicacao → LinkDinamico → adapter →
confirmação` procurando o que quebraria no P1.6.

**Defeito encontrado: retry após envio incerto duplicaria o post.**

A máquina de estados permite `FALHOU → DISTRIBUINDO`, e isso está certo — é o
que faz o retry reusar a mesma `Publicacao`. O que faltava era distinguir duas
falhas que não são a mesma coisa:

| Situação | Houve resposta? | O post existe? | Repetir é seguro? |
|---|---|---|---|
| Canal recusou (400, mídia rejeitada) | sim | não | **sim** |
| Exceção / timeout no envio | não | **talvez** | **não** |

Antes, as duas voltavam como falha comum e a fila repetiria ambas. Um timeout
depois de o container ser publicado produziria um **segundo post** — e post
duplicado não se desfaz sozinho.

Agora uma exceção que escapa do adapter, ou uma resposta marcada com
`envioIncerto`, viram `erroFatal`. *Fatal* aqui não significa "erro grave":
significa **"não repita sozinho"**. Uma pessoa confere o perfil e decide.

O adapter do Instagram classifica a falha: mensagem da Graph API = houve
resposta; falha de transporte, mensagem vazia, ou valor que nem é `Error` =
incerto. Fail-closed no que não dá para classificar — supor "não saiu" é
exatamente a suposição que duplica.

### 2. O elo que faltava: plano → fila (Prioridades 2, 3 e 4)

Ao executar o ciclo de verdade, descobri que **a cadeia tinha executor sem
produtor**:

- `/api/cron/executar-fila` roda a cada 30 min desde o P1.4.1;
- `/api/cron/oportunidades` calculava o plano todo dia às 05:00 e **o
  descartava** — ele voltava no JSON e ninguém o enfileirava;
- nenhuma rota chamava `jobsDeGeracaoDoPlano` nem `sincronizarFilaComPlano`.

A fábrica nunca receberia trabalho sozinha. Agora o plano vira job na mesma
tabela do P1.3, de três origens: dependências que faltam, geração que dá para
fazer, e a lacuna de formato.

**Mais três defeitos apareceram ao rodar:**

**(a) Duas autoridades discordavam sobre o FFmpeg.** O cron do plano afirmava
`{ FFMPEG: true }` fixo enquanto o executor perguntava a `FFMPEG_DISPONIVEL`.
O plano escolhia vídeo e o executor recusava por falta de capacidade. Agora os
dois leem a mesma fonte, fail-closed.

**(b) Formato que a fábrica não produz parava o ciclo em silêncio.** O plano
marcava `PRONTO_PARA_GERAR_CONTEUDO` em `CARROSSEL`, o filtro de
`jobsDeGeracaoDoPlano` pulava o item, e não sobrava job nem explicação — um
plano dizendo "pronto" e uma fila vazia. `jobsDeLacunaDeFormato` transforma
isso em `HABILITAR_CAPACIDADE` visível, com zero tentativas: é capacidade a
implementar, não falha a repetir.

**(c) A sincronização cancelava job de outro dono.** `sincronizar` apaga o que
saiu do plano, e sem escopo apagaria todo dia o `RENOVAR_TOKEN` criado pela
autorização da conta. Agora quem sincroniza declara os tipos que administra.

### 3. Auditoria de lacunas (Prioridade 6)

- **TODO/FIXME**: nenhum real. Os 6 resultados são a palavra "todo" em
  português.
- **Segredo em log**: um único `console.error` nos módulos novos, já
  higienizado.
- **Cross-workspace**: toda consulta dos módulos novos é escopada. A única
  exceção estrutural é `prisma.integracao.update({ where: { id } })` na
  renovação — `id` é a chave única, e quem protege é a leitura anterior,
  escopada. Era um guard **posicional sem teste**; agora tem um.
- **Jobs sem executor**: `CONECTAR_CANAL` e `HABILITAR_CAPACIDADE` não têm
  executor de propósito (0 tentativas). `COMPLETAR_DADO_DO_PRODUTO` é
  `AGUARDA_CONDICAO` e para antes do lookup. `SINCRONIZAR_MIDIA_AUTORIZADA` é
  o único automatizável sem ação — ver decisões abaixo.
- **Capacidade declarada sem implementação**: já mapeado em
  `LACUNAS_DE_DISTRIBUICAO` e `FORMATOS_NAO_PRODUZIDOS`.

---

## Commits

| Hash | Assunto |
|---|---|
| `1c0a334` | `fix: envio incerto nunca vira retry automatico` |
| `d8b6e23` | `feat: o plano passa a alimentar a fila (elo que faltava)` |
| `333e40a` | `test: guard de workspace na renovacao + relatorio noturno` |

Todos com push apenas em `claude/pronto-para-trabalhar-jiij19`.

---

## Testes

- Suíte completa rodada **3 vezes**, em série, sempre verde.
- `npx tsc --noEmit` limpo em cada etapa.
- **Total final: 1688 testes, 0 falhas.** (Eram 1659 na entrega da P1.5.2 —
  **29 novos** esta noite.)
- A suíte `.mjs` continua exigindo servidor em `localhost:3100`; não foi
  executada, mesma condição das rodadas anteriores.

---

## Execução observacional do ciclo

Rodada no banco de teste autorizado (`xntkypjmmdovrfbblbqb`), com dados
controlados criados e **apagados no fim**.

```
OPORTUNIDADES=4
PLANO=4   (3 × CARROSSEL, 1 × TEXTO_COM_LINK)
JOBS_DE_GERACAO=1   LACUNAS_DE_FORMATO=3
EXECUTOR executados=1 sucessos=1 aguardando=0 falhas=0
CONTEUDOS_GERADOS=1
PREFLIGHT  disclosure=true formato=true midia=true  bloqueio=DESCONECTADA
ENSAIO     acao=NENHUMA  link_rastreado=true
PUBLICACOES=0
```

Com `FFMPEG_DISPONIVEL=true` o plano escolhe `VIDEO_9X16_FFMPEG_NARRADO`, os 3
jobs são criados, o executor os reivindica e devolve **`WAITING` por falta de
Chatterbox** — sem consumir tentativa, exatamente como projetado.

- **Jobs processados**: 4 criados, 1 executado com sucesso, 3 em `WAITING`.
- **Conteúdos gerados**: 1 (`TEXTO_COM_LINK`), já com o disclosure que o canal
  exige.
- **Itens em WAITING**: 3 `HABILITAR_CAPACIDADE` (formato `CARROSSEL` não
  produzido). Nenhum deles consome tentativa.

---

## Decisões que dependem de você

### AGUARDANDO_REVISAO_HUMANA — 1. O plano escolhe formato que a fábrica não faz

**Assunto**: `FORMATOS` (P1.2) lista `CARROSSEL` e `IMAGEM_UNICA` como
capacidades reais; `FORMATOS_GRATUITOS` (P1.4) diz que a fábrica só produz
`VIDEO_9X16_FFMPEG_NARRADO` e `TEXTO_COM_LINK`. Como `CARROSSEL` vem antes na
ordem do catálogo, ele é escolhido sempre que há mídia autorizada e o FFmpeg
não está declarado — e nada é produzido.

**Opções**
1. Reordenar a seleção para preferir formato que a fábrica produz.
2. Construir o renderer de carrossel (a mídia já está autorizada).
3. Deixar como está; a lacuna já fica visível na fila desde esta noite.

**Recomendação**: (1) agora, (2) depois. Escolher o que não se sabe fazer não
ajuda ninguém.

**Risco de mexer**: muda **o que o robô decide produzir** — é decisão de
produto, não de código, por isso não fiz.

**Próximo passo**: uma linha em `escolherCanalEFormato` filtrando por
`ehFormatoGratuito` quando houver alternativa.

### AGUARDANDO_REVISAO_HUMANA — 2. `SINCRONIZAR_MIDIA_AUTORIZADA` sem executor

**Assunto**: o tipo é `AUTOMATIZAVEL` com 3 tentativas e **não tem ação
registrada**. Desde a P1.5.2 o preflight passou a produzi-lo (mídia sem
direito). Ele será reivindicado, devolvido a `WAITING` com "sem ação
registrada", e reivindicado de novo a cada execução.

**Opções**
1. Ligar à sincronização de catálogo que já existe
   (`/api/cron/sincronizar-catalogo`).
2. Rebaixar para `AGUARDA_CONDICAO`/0 tentativas até existir ação.
3. Deixar como está (churn pequeno, sem dano).

**Recomendação**: (2) agora, (1) quando houver rodada para isso.

**Risco**: (1) envolve chamada a provider externo de catálogo — não fiz à
noite por ser integração nova, não por ser cara.

**Próximo passo**: trocar a classe em `PERFIS_DE_DEPENDENCIA`.

### AGUARDANDO_REVISAO_HUMANA — 3. O cron de oportunidades passou a escrever

**Assunto**: `/api/cron/oportunidades` era só leitura; agora cria jobs. Está
agendado em `vercel.json` para 05:00 diário. Quando isto for para produção, a
fábrica começa a gerar conteúdo sozinha — que é o objetivo declarado desde a
P1.4, mas é uma ativação real.

**Recomendação**: revisar e só então fazer deploy. Nenhum deploy foi feito.

**Risco**: geração é interna, gratuita e não publica. `Publicacao` continua
exigindo decisão separada.

---

## Migrations

**Nenhuma proposta e nenhuma aplicada.** Nada desta noite precisou de mudança
de schema: `jobsDeLacunaDeFormato` usa tipos e colunas existentes, e o escopo
da sincronização é um parâmetro de função.

---

## Confirmações

- **Custo R$ 0,00.** Nenhum provider pago foi chamado. `fal.ai`, Anthropic paga
  e qualquer fallback pago continuam bloqueados e não foram tocados.
- **Nenhuma publicação real.** Nenhum post no Instagram, nenhum Direct Post no
  TikTok, nenhum draft externo. `ADAPTADORES_LIGADOS` continua `{}` e
  `adaptadoresHabilitados(process.env)` devolve vazio sem
  `PUBLICACAO_REAL_<CANAL>=true`. Zero `Publicacao` criada pela execução
  observacional.
- **Produção intocada.** Toda escrita foi no banco de teste autorizado
  (`xntkypjmmdovrfbblbqb`, via `.env.digital-twin-test`), com verificação do
  project ref antes de cada execução. O ref de produção não foi tocado.
- **`main` intocada.** Sem merge, sem sync, sem deploy. Commits e push apenas
  em `claude/pronto-para-trabalhar-jiij19`.
- **Nenhum segredo** em commit, log, resposta de API, evidência de `Publicacao`
  ou contexto de job.
- **Nenhum dado real apagado.** A limpeza atingiu apenas os workspaces criados
  pela própria execução.

---

## Próximo menor passo recomendado pela manhã

**Decidir o item 1** (ordem dos formatos). É uma linha de código, e é o que
separa "o robô gera conteúdo sozinho" de "o robô enfileira três lacunas e
espera". Todo o resto da cadeia já está provado.

Depois dele, o menor passo seguinte é reconectar o Instagram informando App ID
e App Secret: isso faz o `debug_token` comprovar `instagram_content_publish`, e
o preflight sai de `SCOPE_NAO_VERIFICAVEL` para `pronto: true` sem nenhuma
linha de código nova.
