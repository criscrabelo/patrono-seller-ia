# Digital Twin da Proprietária — Fundações

**Criado:** complemento à Rodada 6 (TikTok First). Só as fundações — nenhuma geração de avatar, clonagem de voz ou treinamento pesado nesta rodada.

## Finalidade

Permitir que o Patrono gere, no futuro, vídeos usando a aparência e a voz consistentes da própria proprietária (identidade facial, sincronização labial, roteiros/cenários variados) sem gravação manual de cada vídeo. É uma **representação digital autorizada da própria titular** — nunca uma ferramenta genérica de impersonação de terceiros.

Primeiro uso otimizado para **TikTok**, dentro do pipeline futuro:

```
Produto → Opportunity Radar → Script → Voice Clone → Digital Twin → Lip Sync
  → Renderer → TikTok Preflight → Commercial Disclosure → AI Content Disclosure
  → Consent Gate → Direct Post → Metrics → Sale/Commission → Learning Engine
```

Nada desse pipeline foi implementado de ponta a ponta nesta rodada — só os tipos/gates abaixo, para a etapa seguinte não precisar redesenhar nada.

## Consentimento

`lib/digital-twin.ts`: `IdentityConsent` e `VoiceConsent` — cada um com `status` (`NOT_REQUESTED | GRANTED | REVOKED | EXPIRED`), `grantedAt`, `revokedAt`, `expiresAt`. **Nenhuma geração ocorre sem consentimento `GRANTED` e não expirado/revogado** — checado a cada job (`podeGerarComDigitalTwin()`), nunca só uma vez no cadastro.

## Identidade (`DigitalTwinProfile`)

Perfil persistente da proprietária: `displayName`, `identityReferenceId` (referência ao material biométrico — nunca a mídia em si exposta), `voiceProfileId`, `consentStatus`, `enabled` (kill switch). Consistência exigida: rosto, cabelo, características principais, aparência geral, idade aparente coerente — **a pessoa precisa continuar reconhecivelmente a mesma** entre conteúdos. Pode variar: roupa, fundo, cenário, posição, enquadramento, iluminação.

## Voz (`VoiceProfile`)

`referenceAudio` (privado, nunca exposto publicamente), `consentId`, `provider`, `language`, `enabled`. A voz precisa ser **consistente entre os vídeos** — nunca uma voz diferente por conteúdo.

**Candidato à primeira avaliação (não integrado ainda):** Chatterbox TTS ou outra opção open source compatível com clonagem de voz autorizada, execução local, licença comercial adequada e custo R$ 0,00. Nenhum provider pago (ElevenLabs ou similar) foi ou será contratado sem autorização expressa.

## Avatar (não integrado)

Nenhum SaaS pago de avatar (HeyGen, Synthesia, D-ID) foi contratado. Antes de escolher um motor definitivo, será preciso documentar candidatos open source e verificar: licença, uso comercial permitido, GPU/VRAM necessária, qualidade, manutenção, riscos. **Open source não significa automaticamente permitido para uso comercial** — cada candidato precisa ser verificado individualmente.

## Providers desacoplados

`VoiceCloneProvider`, `AvatarVideoProvider`, `LipSyncProvider` (`lib/digital-twin.ts`) — interfaces puras, sem implementação, sem acoplamento a fornecedor específico. Trocar de provider no futuro não deve exigir mudar o resto do pipeline.

## Presenter Mode (único modo desta rodada)

`validarPresenterMode()` — o avatar apresenta informações **verificadas** do produto, nunca inventa experiência pessoal. Bloqueia frases como "eu usei", "eu testei", "eu recomendo porque uso", "na minha experiência". O avatar pode ser sintético; **o produto e as afirmações sobre ele nunca podem ser falsificados** (característica, funcionamento, cor, tamanho, benefício, resultado).

## TikTok AI Content Disclosure

`lib/ai-content-disclosure.ts`, `decidirAIContentDisclosure()` — distinto do `TikTokCommercialDisclosure` (relação comercial/afiliado). Um vídeo com Digital Twin pode precisar dos **dois disclosures ao mesmo tempo**. Fail-safe: qualquer elemento sintético (avatar, voz clonada, lip sync) já exige disclosure de IA — nunca escondido para tentar burlar a plataforma.

## Media Rights e Áudio

O Digital Twin respeita o `MediaRightsGate` (`lib/media-rights.ts`) já existente — nunca usa imagem de produto sem direito suficiente para transformação/publicação. Compatível com `AudioUsagePolicy` (`lib/audio-policy.ts`) — nunca música protegida sem direito de uso.

## Segurança

Arquivos de voz, rosto, vídeo e referência são sempre privados. Áudio de referência, material biométrico, tokens e segredos **nunca** em log ou URL pública permanente.

## Kill Switch — "DESATIVAR MEU AVATAR"

`DigitalTwinProfile.enabled` / `VoiceProfile.enabled`. Quando desativado, nenhuma nova geração usa rosto ou voz da proprietária. **Jobs pendentes verificam o status imediatamente antes de gerar**, nunca confiando num status checado no início do job (`podeGerarComDigitalTwin()` deve ser chamado de novo antes da etapa de geração, o mais tarde possível no fluxo).

## Fallback sem GPU

Se o Digital Twin completo não puder rodar gratuitamente no ambiente, o Autopilot continua funcionando com: voz autorizada (sem clone), produto, motion graphics, texto, legendas, B-roll permitido, animação — a automação nunca fica bloqueada por falta de GPU.

## Custo

Nenhum serviço pago contratado (HeyGen, Synthesia, ElevenLabs, D-ID, cloud GPU ou outro SaaS). **Custo novo: R$ 0,00.**

## O que ainda não existe

Nenhuma geração de avatar real; nenhuma clonagem de voz real; nenhum treinamento; nenhuma persistência em banco (os tipos acima são conceituais, sem migração Prisma nesta rodada — decisão deliberada para não criar tabelas que ainda não têm nenhum código real usando-as); nenhum provider concreto escolhido.
