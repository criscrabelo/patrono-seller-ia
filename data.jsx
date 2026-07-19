/* ============ Mock data — Patrono Seller IA ============ */

const DATA = {
  user: { name: 'Cris Crabelo', email: 'cris@grupopatrono.com.br', role: 'Administradora' },

  // Dashboard de metas
  metas: {
    seguidores: 1240,
    meta1: 2000, meta1Data: '13 jun 2026',
    meta2: 100000, meta2Data: '25 ago 2026',
    crescimentoDiario: 38, crescimentoNecessario: 41,
    videosPlanejados: 8, videosPostados: 6, videosAprovados: 7,
    produtos: 47, produtosCampeoes: 6,
    cliques: 3820, vendas: 112, receita: 2840,
    aguardando: 4,
  },

  serie7d: [620, 740, 810, 905, 980, 1100, 1240],

  trends: [
    { id:'t1', tema:'Gaveta da cozinha que se organiza sozinha', cat:'Cozinha', dor:'Bagunça nos talheres', gancho:'"Você ainda guarda talher assim?"', formato:'POV antes/depois', dur:'18s', cta:'Compra', risco:'baixo', score:94, plataforma:'TikTok', views:'2.1M' },
    { id:'t2', tema:'Organizador de geladeira transparente', cat:'Geladeira', dor:'Comida que estraga no fundo', gancho:'"Minha geladeira virou isso"', formato:'Transformação', dur:'25s', cta:'Seguir+Compra', risco:'baixo', score:91, plataforma:'TikTok', views:'1.4M' },
    { id:'t3', tema:'Banheiro pequeno com nicho de canto', cat:'Banheiro', dor:'Falta de espaço no box', gancho:'"Banheiro de 2m² resolvido"', formato:'Tour rápido', dur:'22s', cta:'Compra', risco:'médio', score:88, plataforma:'Reels', views:'880k' },
    { id:'t4', tema:'Cabide que multiplica espaço do armário', cat:'Guarda-roupa', dor:'Roupa amassada e sem espaço', gancho:'"Coube o dobro de roupa"', formato:'Demonstração', dur:'15s', cta:'Compra', risco:'baixo', score:86, plataforma:'TikTok', views:'1.1M' },
    { id:'t5', tema:'Suporte de varal retrátil de parede', cat:'Lavanderia', dor:'Roupa secando pela casa', gancho:'"Lavanderia minúscula? Resolvi"', formato:'Antes/depois', dur:'20s', cta:'Seguir', risco:'baixo', score:82, plataforma:'Reels', views:'640k' },
    { id:'t6', tema:'Divisória de gaveta ajustável', cat:'Gavetas', dor:'Gaveta da gambiarra', gancho:'"O fim da gaveta bagunçada"', formato:'Sat. ASMR', dur:'17s', cta:'Compra', risco:'baixo', score:79, plataforma:'TikTok', views:'520k' },
  ],

  produtos: [
    { id:'p1', nome:'Organizador de Talheres Expansível', plat:'Shopee', cat:'Cozinha', preco:'R$ 29,90', comissao:'18%', nota:4.8, vendas:'3.2k', status:'campeao', dor:'Talheres bagunçados' },
    { id:'p2', nome:'Potes Herméticos Geladeira (kit 8)', plat:'Mercado Livre', cat:'Geladeira', preco:'R$ 79,90', comissao:'12%', nota:4.7, vendas:'1.8k', status:'campeao', dor:'Comida que estraga' },
    { id:'p3', nome:'Nicho de Canto Adesivo Inox', plat:'Amazon', cat:'Banheiro', preco:'R$ 45,00', comissao:'9%', nota:4.6, vendas:'940', status:'teste', dor:'Box sem espaço' },
    { id:'p4', nome:'Cabide Mágico Antideslizante (10un)', plat:'Shopee', cat:'Guarda-roupa', preco:'R$ 34,90', comissao:'20%', nota:4.9, vendas:'5.1k', status:'campeao', dor:'Armário lotado' },
    { id:'p5', nome:'Varal Retrátil de Parede 4m', plat:'TikTok Shop', cat:'Lavanderia', preco:'R$ 59,90', comissao:'15%', nota:4.5, vendas:'620', status:'aprovado', dor:'Roupa secando na sala' },
    { id:'p6', nome:'Divisória de Gaveta Ajustável (6un)', plat:'Shopee', cat:'Gavetas', preco:'R$ 24,90', comissao:'22%', nota:4.7, vendas:'2.4k', status:'novo', dor:'Gaveta bagunçada' },
    { id:'p7', nome:'Organizador Suspenso de Armário', plat:'Renner', cat:'Guarda-roupa', preco:'R$ 89,90', comissao:'8%', nota:4.4, vendas:'310', status:'pausado', dor:'Bolsas amontoadas' },
  ],

  // Biblioteca de vídeos autorizados
  criativos: [
    { id:'c1', nome:'ugc_talheres_v3.mp4', origem:'UGC contratado', fornecedor:'Marina (creator)', cat:'Cozinha', autorizado:true, postar:true, editar:true, status:'campeao', validade:'12/2026' },
    { id:'c2', nome:'proprio_geladeira_tour.mp4', origem:'Vídeo próprio', fornecedor:'—', cat:'Geladeira', autorizado:true, postar:true, editar:true, status:'aprovado', validade:'Vitalício' },
    { id:'c3', nome:'ia_banheiro_antesdepois.mp4', origem:'Gerado por IA', fornecedor:'Patrono Video Seller', cat:'Banheiro', autorizado:true, postar:true, editar:true, status:'aprovado', validade:'Vitalício' },
    { id:'c4', nome:'fornecedor_cabide_demo.mp4', origem:'Fornecedor autorizado', fornecedor:'OrganizaJá Ltda', cat:'Guarda-roupa', autorizado:true, postar:true, editar:false, status:'em_analise', validade:'06/2026' },
    { id:'c5', nome:'banco_lavanderia_b.mp4', origem:'Banco licenciado', fornecedor:'StockHome', cat:'Lavanderia', autorizado:false, postar:false, editar:true, status:'bloqueado', validade:'—' },
    { id:'c6', nome:'ugc_gaveta_asmr.mp4', origem:'UGC contratado', fornecedor:'Paula (creator)', cat:'Gavetas', autorizado:true, postar:true, editar:true, status:'recebido', validade:'10/2026' },
  ],

  // Fila de aprovação
  aprovacoes: [
    { id:'a1', produto:'Organizador de Talheres Expansível', rede:'TikTok', estilo:'POV antes/depois', motivo:'Publicação automática', risco:'verde', nota:9, dur:'18s',
      gancho:'Você ainda guarda talher amontoado na gaveta?', cta:'Toca no link e organiza a sua hoje 🔗',
      legenda:'Essa gaveta vivia um caos até eu achar esse organizador 😮‍💨 Agora cada talher tem seu lugar. Link na bio! #organizacao #cozinha #achadinhos #casaorganizada #patrono',
      hashtags:['#organizacao','#cozinha','#achadinhos','#casaorganizada'] },
    { id:'a2', produto:'Cabide Mágico Antideslizante', rede:'Instagram Reels', estilo:'Demonstração', motivo:'Campanha grande (12 vídeos)', risco:'amarelo', nota:8, dur:'15s',
      gancho:'Meu armário cabia metade. Olha agora.', cta:'Salva esse vídeo pra não esquecer 💾',
      legenda:'Comprei sem fé e me surpreendi: dobrei o espaço do armário 👗 Antideslizante de verdade. #guardaroupa #organizacao #dicasdecasa #patrono',
      hashtags:['#guardaroupa','#organizacao','#dicasdecasa'] },
    { id:'a3', produto:'Nicho de Canto Adesivo Inox', rede:'TikTok', estilo:'Tour rápido', motivo:'Produto novo · 1ª campanha', risco:'amarelo', nota:7, dur:'22s',
      gancho:'Banheiro de 2m²? Esse cantinho mudou tudo.', cta:'Link na bio pra economizar espaço',
      legenda:'Box minúsculo nunca mais 🚿 Esse nicho adesivo aguenta shampoo, condicionador e ainda sobra. #banheiropequeno #organizacao #achadinhos',
      hashtags:['#banheiropequeno','#organizacao','#achadinhos'] },
    { id:'a4', produto:'Varal Retrátil de Parede 4m', rede:'Facebook', estilo:'Antes/depois', motivo:'Conteúdo com risco jurídico', risco:'vermelho', nota:6, dur:'20s',
      gancho:'Lavanderia minúscula resolvida em 1 minuto', cta:'Compra pelo link e nunca mais',
      legenda:'PROMETO que sua lavanderia vai mudar 🤯 GARANTIDO que seca em metade do tempo! #lavanderia #organizacao',
      hashtags:['#lavanderia','#organizacao'] },
  ],

  // Calendário — slots do dia
  horarios: ['07:30','09:30','11:30','13:30','15:30','18:30','20:30','22:00'],
  calendario: [
    { h:'07:30', produto:'Talheres Expansível', rede:'TikTok', serie:'Achadinhos de cozinha', status:'postado', aprov:false },
    { h:'09:30', produto:'Potes Geladeira', rede:'Reels', serie:'Antes e depois', status:'postado', aprov:false },
    { h:'11:30', produto:'Cabide Mágico', rede:'TikTok', serie:'Guarda-roupa inteligente', status:'agendado', aprov:false },
    { h:'13:30', produto:'Nicho de Canto', rede:'TikTok', serie:'Banheiro pequeno organizado', status:'aguardando', aprov:true },
    { h:'15:30', produto:'Divisória de Gaveta', rede:'Reels', serie:'Produtos que parecem bobos', status:'aprovado', aprov:false },
    { h:'18:30', produto:'Varal Retrátil', rede:'Facebook', serie:'Lavanderia funcional', status:'aguardando', aprov:true },
    { h:'20:30', produto:'Organizador Suspenso', rede:'TikTok', serie:'Casa organizada sem gastar', status:'roteiro', aprov:false },
    { h:'22:00', produto:'Potes Geladeira', rede:'TikTok', serie:'3 organizadores que valem', status:'ideia', aprov:false },
  ],

  series: [
    { id:'s1', nome:'Casa organizada sem gastar muito', cor:'gold', videos:42, seguidores:'+680', icon:'bag', ativa:true },
    { id:'s2', nome:'Achadinhos de cozinha', cor:'violet', videos:58, seguidores:'+1.2k', icon:'sparkles', ativa:true },
    { id:'s3', nome:'Banheiro pequeno organizado', cor:'blue', videos:31, seguidores:'+410', icon:'grid', ativa:true },
    { id:'s4', nome:'Antes e depois', cor:'green', videos:64, seguidores:'+1.5k', icon:'refresh', ativa:true },
    { id:'s5', nome:'Produtos que parecem bobos, mas resolvem', cor:'pink', videos:39, seguidores:'+890', icon:'fire', ativa:true },
    { id:'s6', nome:'Despensa dos sonhos', cor:'amber', videos:18, seguidores:'+240', icon:'layers', ativa:false },
    { id:'s7', nome:'Lavanderia funcional', cor:'blue', videos:22, seguidores:'+300', icon:'refresh', ativa:false },
    { id:'s8', nome:'Não compre antes de ver isso', cor:'red', videos:27, seguidores:'+720', icon:'alert', ativa:true },
  ],

  // Relatórios — desempenho recente
  relatorios: [
    { produto:'Cabide Mágico', serie:'Guarda-roupa inteligente', rede:'TikTok', views:'412k', likes:'38k', cliques:412, vendas:28, receita:'R$ 195', veredito:'campeao' },
    { produto:'Talheres Expansível', serie:'Achadinhos de cozinha', rede:'TikTok', views:'287k', likes:'24k', cliques:301, vendas:19, receita:'R$ 102', veredito:'campeao' },
    { produto:'Potes Geladeira', serie:'Antes e depois', rede:'Reels', views:'156k', likes:'12k', cliques:188, vendas:11, receita:'R$ 105', veredito:'medio' },
    { produto:'Nicho de Canto', serie:'Banheiro pequeno', rede:'TikTok', views:'62k', likes:'4.1k', cliques:74, vendas:3, receita:'R$ 12', veredito:'medio' },
    { produto:'Varal Retrátil', serie:'Lavanderia funcional', rede:'Facebook', views:'18k', likes:'820', cliques:21, vendas:1, receita:'R$ 9', veredito:'fraco' },
  ],

  // Roteiros gerados (transformador)
  roteiros: [
    { titulo:'POV: a gaveta que se organiza sozinha', gancho:'Você ainda guarda talher amontoado?', dur:'18s',
      problema:'Gaveta de talheres bagunçada e sem espaço', solucao:'Organizador expansível que cabe em qualquer gaveta',
      tela:'CABE EM QUALQUER GAVETA ✨', cta:'Link na bio e organiza hoje' },
    { titulo:'3 segundos pra mudar sua geladeira', gancho:'Minha geladeira virou isso em 1 dia', dur:'25s',
      problema:'Comida estragando no fundo da geladeira', solucao:'Potes herméticos transparentes empilháveis',
      tela:'NUNCA MAIS DESPERDÍCIO', cta:'Toca no link e arruma a sua' },
  ],
};

window.DATA = DATA;

// ----- Gestão de usuários (admin) -----
DATA.usuarios = [
  { id:'u1', nome:'Cris Crabelo', email:'cris@grupopatrono.com.br', papel:'admin', status:'ativo', acesso:'agora', voce:true },
  { id:'u2', nome:'Letícia Moraes', email:'leticia@grupopatrono.com.br', papel:'admin', status:'ativo', acesso:'há 2h' },
  { id:'u3', nome:'Bruno Tavares', email:'bruno.ops@grupopatrono.com.br', papel:'operador', status:'ativo', acesso:'há 15min' },
  { id:'u4', nome:'Paula Reis', email:'paula.reis@gmail.com', papel:'operador', status:'ativo', acesso:'ontem' },
  { id:'u5', nome:'Marina Duarte', email:'marina.ugc@gmail.com', papel:'operador', status:'bloqueado', acesso:'há 8 dias' },
];
DATA.solicitacoes = [
  { id:'s1', nome:'Rafael Lopes', email:'rafael.lopes@gmail.com', quando:'há 1h' },
  { id:'s2', nome:'Camila Souza', email:'camila.s@grupopatrono.com.br', quando:'há 3h' },
];
window.papelMap = {
  admin:    { label:'Administrador', cls:'gold', icon:'shield' },
  operador: { label:'Operador', cls:'violet', icon:'users' },
};

// ----- Conta gerenciada + contribuição por usuário p/ a meta -----
DATA.conta = {
  handle: '@patrono.organiza',
  plataforma: 'TikTok',
  outras: ['Instagram', 'Kwai', 'YouTube'],
};

// ----- Multi-contas / marcas + nichos por conta -----
DATA.nichos = [
  'Organização de cozinha', 'Organização de quarto', 'Organização de banheiro',
  'Lavanderia', 'Geladeira', 'Gavetas', 'Guarda-roupa', 'Casa pequena',
  'Achadinhos úteis', 'Produtos para mães', 'Decoração funcional', 'Casa organizada',
  'Produtos baratos e úteis', 'Despensa e cozinha', 'Pet', 'Beleza e autocuidado',
];
DATA.contas = [
  { id:'c1', nome:'BoraComprar Organiza', handle:'@patrono.organiza', cor:'gold', atual:true,
    redes:[{p:'TikTok',st:'conectada'},{p:'Instagram',st:'conectada'},{p:'Kwai',st:'pendente'}],
    nichos:['Organização de cozinha','Geladeira','Gavetas','Guarda-roupa','Casa organizada'],
    seguidores:1240, videos:186, plano:'Afiliado Pro' },
  { id:'c2', nome:'BoraComprar Cozinha', handle:'@bora.cozinha', cor:'violet', atual:false,
    redes:[{p:'TikTok',st:'conectada'},{p:'Instagram',st:'conectada'}],
    nichos:['Organização de cozinha','Despensa e cozinha','Achadinhos úteis'],
    seguidores:680, videos:92, plano:'Afiliado Iniciante' },
  { id:'c3', nome:'BoraComprar Casa Pequena', handle:'@bora.casapequena', cor:'blue', atual:false,
    redes:[{p:'TikTok',st:'conectada'},{p:'YouTube',st:'pendente'}],
    nichos:['Casa pequena','Banheiro','Lavanderia','Decoração funcional'],
    seguidores:430, videos:54, plano:'Base Seller' },
  { id:'c4', nome:'Cliente · Lar & Cia', handle:'@larecia.oficial', cor:'pink', atual:false, cliente:true,
    redes:[{p:'Instagram',st:'conectada'}],
    nichos:['Casa organizada','Produtos para mães'],
    seguidores:2100, videos:38, plano:'Combo Social Media' },
];
window.redeStatusMap = {
  conectada: { cls:'green', label:'Conectada' },
  pendente:  { cls:'amber', label:'Conectar' },
};
DATA.contribuintes = [
  { nome:'Cris Crabelo',   papel:'admin',    seguidores:410, videos:38, vendas:22, voce:true },
  { nome:'Bruno Tavares',  papel:'operador', seguidores:320, videos:41, vendas:18 },
  { nome:'Paula Reis',     papel:'operador', seguidores:280, videos:33, vendas:14 },
  { nome:'Letícia Moraes', papel:'admin',    seguidores:230, videos:22, vendas:11 },
];

// ----- Painel de Lucro e Escala -----
DATA.lucro = {
  receitaBruta: 9840, comissaoTotal: 2840, custos: 920, lucroLiquido: 1920,
  margem: 67.6, ticket: 25.40, vendas: 112, cliques: 3820, conversao: 2.9,
  receitaPorVideo: 23.7, lucroPorVideo: 16.0, receita30d: 4120,
};
DATA.lucroPlataformas = [
  { nome:'Shopee',        cor:'amber',  produtos:18, videos:62, cliques:1820, vendas:58, comissao:1240, custos:380, lucro:860,  conversao:3.2, campeao:'Cabide Mágico' },
  { nome:'Mercado Livre', cor:'gold',   produtos:11, videos:41, cliques:940,  vendas:31, comissao:820,  custos:210, lucro:610,  conversao:3.3, campeao:'Potes Geladeira' },
  { nome:'Amazon',        cor:'blue',   produtos:9,  videos:28, cliques:620,  vendas:15, comissao:410,  custos:160, lucro:250,  conversao:2.4, campeao:'Nicho de Canto' },
  { nome:'TikTok Shop',   cor:'pink',   produtos:6,  videos:19, cliques:440,  vendas:8,  comissao:370,  custos:170, lucro:200,  conversao:1.8, campeao:'Talheres Exp.' },
];
DATA.produtosEscala = [
  { nome:'Cabide Mágico Antideslizante', plat:'Shopee', vendas:41, conversao:3.6, comissao:'R$ 520', lucro:'R$ 410', score:92, classe:'campeao' },
  { nome:'Organizador de Talheres', plat:'Shopee', vendas:28, conversao:3.1, comissao:'R$ 310', lucro:'R$ 240', score:84, classe:'campeao' },
  { nome:'Potes Herméticos Geladeira', plat:'Mercado Livre', vendas:19, conversao:3.0, comissao:'R$ 280', lucro:'R$ 175', score:71, classe:'promissor' },
  { nome:'Divisória de Gaveta Ajustável', plat:'Shopee', vendas:14, conversao:2.6, comissao:'R$ 120', lucro:'R$ 78', score:58, classe:'testar' },
  { nome:'Nicho de Canto Adesivo', plat:'Amazon', vendas:6, conversao:1.9, comissao:'R$ 90', lucro:'R$ 28', score:44, classe:'testar' },
  { nome:'Varal Retrátil de Parede', plat:'TikTok Shop', vendas:1, conversao:0.8, comissao:'R$ 9', lucro:'-R$ 40', score:22, classe:'naoescalar' },
];
DATA.escalaMap = {
  campeao:    { label:'Escalar já', cls:'green',  faixa:'81–100' },
  promissor:  { label:'Promissor', cls:'gold',    faixa:'61–80' },
  testar:     { label:'Testar mais', cls:'amber',  faixa:'31–60' },
  naoescalar: { label:'Não escalar', cls:'red',    faixa:'0–30' },
};
DATA.recomendacoes = [
  { icon:'rocket', cls:'green', tipo:'Escalar', texto:'Cabide Mágico tem margem de 79% e score 92. Criar mais 5 vídeos e priorizar Shopee.', aprovar:true },
  { icon:'alert', cls:'amber', tipo:'Revisar', texto:'Nicho de Canto teve muitos cliques e poucas vendas. Trocar o gancho ou revisar o preço.', aprovar:false },
  { icon:'dollar', cls:'blue', tipo:'Plataforma', texto:'Mercado Livre gera a melhor conversão nesta categoria (3,3%). Concentrar próximos conteúdos.', aprovar:false },
  { icon:'pause', cls:'red', tipo:'Pausar', texto:'Varal Retrátil está com lucro negativo (-R$ 40). Pausar por 7 dias e arquivar aprendizado.', aprovar:true },
];

const statusMap = {
  campeao:   { label:'Campeão', cls:'gold', icon:'star' },
  aprovado:  { label:'Aprovado', cls:'green', icon:'check' },
  teste:     { label:'Em teste', cls:'violet', icon:'flask' },
  novo:      { label:'Novo', cls:'blue', icon:'plus' },
  pausado:   { label:'Pausado', cls:'gray', icon:'pause' },
  postado:   { label:'Postado', cls:'green', icon:'check' },
  agendado:  { label:'Agendado', cls:'violet', icon:'clock' },
  aguardando:{ label:'Aguardando', cls:'amber', icon:'clock' },
  roteiro:   { label:'Roteiro', cls:'blue', icon:'pencil' },
  ideia:     { label:'Ideia', cls:'gray', icon:'sparkles' },
  em_analise:{ label:'Em análise', cls:'amber', icon:'clock' },
  bloqueado: { label:'Bloqueado', cls:'red', icon:'x' },
  recebido:  { label:'Recebido', cls:'blue', icon:'download' },
  ativo:     { label:'Ativo', cls:'green', icon:'check' },
  pendente:  { label:'Pendente', cls:'amber', icon:'clock' },
  medio:     { label:'Médio', cls:'amber', icon:'trend' },
  fraco:     { label:'Fraco', cls:'red', icon:'arrow' },
};
window.statusMap = statusMap;
window.riscoMap = {
  verde:   { cls:'green', label:'Risco baixo' },
  amarelo: { cls:'amber', label:'Atenção' },
  vermelho:{ cls:'red', label:'Risco alto' },
  baixo:   { cls:'green', label:'Baixo' },
  'médio': { cls:'amber', label:'Médio' },
};
