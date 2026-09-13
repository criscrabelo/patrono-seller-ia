# TikTok — Checklist para Auditoria do App

**Criado:** Rodada 6 — TikTok First: Primeira Integração Real.

Enquanto o app do Patrono Seller no TikTok for "não auditado", a documentação oficial do TikTok limita conteúdo de clientes não auditados à visualização privada (`PRIVATE_TESTING_ONLY`, ver `lib/tiktok-privacy.ts`). Este checklist existe para deixar o Patrono pronto para SOLICITAR a auditoria corretamente, quando a usuária decidir avançar — nenhum item aqui é contornado ou simulado como concluído.

## Status atual (Rodada 6)

Nenhum item abaixo foi executado nesta rodada (sem credenciais reais, sem acesso à internet externa neste ambiente de desenvolvimento). O checklist é o roteiro real a seguir.

## Itens

- [ ] **App registrado** no TikTok for Developers (developers.tiktok.com), com nome e descrição reais do Patrono Seller.
- [ ] **Content Posting API** habilitada para o app.
- [ ] **Direct Post** habilitado (produto/capability específica dentro da Content Posting API).
- [ ] **Escopos** solicitados = só `video.publish` (ver `TIKTOK-INTEGRATION.md`, seção 3) — nunca pedir escopo que o Patrono não usa.
- [ ] **Redirect URIs** cadastrados = exatamente as URLs de callback reais em produção (`https://<domínio>/api/integracoes/tiktok/oauth/callback`) — nunca um wildcard desnecessário.
- [ ] **Domínio verificado** conforme exigência do TikTok para `PULL_FROM_URL` (necessário para os vídeos hospedados no Supabase Storage serem aceitos).
- [ ] **Privacy Policy** pública e acessível, refletindo o uso real de dados do TikTok pelo Patrono Seller.
- [ ] **Terms of Service** públicos.
- [ ] **UX exigida pelo TikTok** — a documentação pede telas específicas antes de publicar (ex.: mostrar ao usuário o que será postado, quem vai postar, com opção de cancelar) — conferir o guia de UX mais atual do Content Posting API antes de submeter.
- [ ] **Consentimento explícito** — fluxo real implementado (`tiktokHumanConsentGate`, `lib/tiktok-preflight.ts`) mostrado nas capturas de tela da submissão.
- [ ] **Creator Info** consultado e usado de verdade na UX (nunca limites hardcoded) — capturar isso na demonstração.
- [ ] **Screenshots/vídeos de funcionamento** — gravar o fluxo real: autorizar conta → gerar conteúdo → consentir → publicar → ver status.
- [ ] **Outros requisitos oficiais atuais** — reconferir a documentação do TikTok for Developers no momento da submissão (esta lista pode ficar desatualizada; os requisitos mudam).

## Depois da auditoria aprovada

1. Marcar `appAuditado: true` na configuração usada por `lib/tiktok-config-status.ts`/`lib/tiktok-privacy.ts` (hoje isso é passado explicitamente por quem monta os deps — nenhuma flag de banco foi criada para isso nesta rodada, ver Pendências no relatório da Rodada 6).
2. `resolverPrivacidadeTikTok()` passa a permitir privacidade pública quando a conta permitir.
3. `runAutopilot`/`lib/tiktok-autopilot.ts` deixam de ficar restritos a `TIKTOK_PRIVATE_TEST`.

## Nunca fazer

- Nunca declarar "app auditado" sem a confirmação real do TikTok.
- Nunca contornar a limitação de visualização privada enquanto não auditado.
- Nunca submeter para auditoria com capturas de tela de um fluxo que não existe de verdade no código.
