/* ============ Imagens · Fornecedores · Creators · Compliance — dados ============ */

// ----- Banco de Imagens e Criativos -----
DATA.tipoImg = {
  'Capa':       { cor:'pink',   ratio:'9 / 16',  kind:'phone' },
  'Carrossel':  { cor:'violet', ratio:'4 / 5',   kind:'carousel' },
  'Banner':     { cor:'blue',   ratio:'16 / 9',  kind:'wide' },
  'Thumbnail':  { cor:'gold',   ratio:'16 / 9',  kind:'wide' },
};
DATA.imagens = [
  { id:'im1', nome:'capa_talheres_pov.jpg', tipo:'Capa', origem:'Gerado por IA', produto:'Talheres Expansível', campanha:'Achadinhos de cozinha', autorizado:true, status:'campeao', validade:'Vitalício', usos:42 },
  { id:'im2', nome:'carrossel_geladeira_antesdepois', tipo:'Carrossel', slides:5, origem:'Vídeo próprio', produto:'Potes Geladeira', campanha:'Antes e depois', autorizado:true, status:'aprovado', validade:'Vitalício', usos:28 },
  { id:'im3', nome:'banner_cabide_promo.jpg', tipo:'Banner', origem:'Fornecedor autorizado', produto:'Cabide Mágico', campanha:'Guarda-roupa inteligente', autorizado:true, status:'aprovado', validade:'06/2026', usos:17 },
  { id:'im4', nome:'thumb_nicho_canto.jpg', tipo:'Thumbnail', origem:'Gerado por IA', produto:'Nicho de Canto', campanha:'Banheiro pequeno', autorizado:true, status:'em_analise', validade:'Vitalício', usos:9 },
  { id:'im5', nome:'carrossel_gaveta_divisoria', tipo:'Carrossel', slides:4, origem:'UGC contratado', produto:'Divisória de Gaveta', campanha:'Produtos que resolvem', autorizado:true, status:'recebido', validade:'10/2026', usos:6 },
  { id:'im6', nome:'capa_stockhome_banner.jpg', tipo:'Banner', origem:'Banco licenciado', produto:'Varal Retrátil', campanha:'Lavanderia funcional', autorizado:false, status:'bloqueado', validade:'—', usos:0 },
  { id:'im7', nome:'capa_varal_lavanderia.jpg', tipo:'Capa', origem:'Gerado por IA', produto:'Varal Retrátil', campanha:'Lavanderia funcional', autorizado:true, status:'aprovado', validade:'Vitalício', usos:14 },
  { id:'im8', nome:'thumb_organizador_suspenso.jpg', tipo:'Thumbnail', origem:'Vídeo próprio', produto:'Organizador Suspenso', campanha:'Casa organizada', autorizado:true, status:'novo', validade:'Vitalício', usos:3 },
];

// ----- Fornecedores -----
DATA.tipoForn = {
  'Fornecedor de produto': { cor:'gold',   icon:'bag' },
  'Banco de imagens':      { cor:'blue',   icon:'image' },
  'Agência de UGC':        { cor:'pink',   icon:'users' },
  'Editor freelancer':     { cor:'violet', icon:'pencil' },
  'IA interna':            { cor:'green',  icon:'sparkles' },
};
DATA.fornecedores = [
  { id:'f1', nome:'OrganizaJá Ltda', tipo:'Fornecedor de produto', contato:'comercial@organizaja.com.br', criativos:14, contrato:'Ativo', termo:true, validade:'06/2026', status:'vigente', nichos:['Guarda-roupa','Gavetas'] },
  { id:'f2', nome:'StockHome', tipo:'Banco de imagens', contato:'licencas@stockhome.io', criativos:60, contrato:'Vencido', termo:false, validade:'02/2026', status:'vencido', nichos:['Lavanderia','Casa'] },
  { id:'f3', nome:'Estúdio Caseiro UGC', tipo:'Agência de UGC', contato:'ola@estudiocaseiro.com', criativos:28, contrato:'Ativo', termo:true, validade:'12/2026', status:'vigente', nichos:['Cozinha','Banheiro'] },
  { id:'f4', nome:'Renata Edições', tipo:'Editor freelancer', contato:'renata.edita@gmail.com', criativos:9, contrato:'Pendente', termo:false, validade:'—', status:'pendente', nichos:['Edição de vídeo'] },
  { id:'f5', nome:'Patrono Video Seller', tipo:'IA interna', contato:'plataforma interna', criativos:36, contrato:'Interno', termo:true, validade:'Vitalício', status:'vigente', nichos:['Todos os nichos'] },
];
DATA.contratoMap = {
  'Ativo':    'green', 'Interno': 'green', 'Vencido': 'red', 'Pendente': 'amber',
};

// ----- Creators / UGC -----
DATA.creators = [
  { id:'cr1', nome:'Marina Duarte', handle:'@marina.organiza', cor:'pink',   nicho:['Cozinha','Gavetas'],      entregas:18, producao:2, cache:380, termo:true,  exclusivo:false, validade:'12/2026', status:'ativo',    nota:4.9 },
  { id:'cr2', nome:'Paula Reis',    handle:'@paulaemcasa',     cor:'violet', nicho:['Gavetas','Lavanderia'],   entregas:11, producao:1, cache:300, termo:true,  exclusivo:false, validade:'10/2026', status:'ativo',    nota:4.7 },
  { id:'cr3', nome:'Bia Nogueira',  handle:'@bia.decor',       cor:'blue',   nicho:['Banheiro','Decoração'],   entregas:7,  producao:3, cache:420, termo:false, exclusivo:false, validade:'pendente',status:'pendente', nota:4.6 },
  { id:'cr4', nome:'Léo Martins',   handle:'@leoorganiza',     cor:'gold',   nicho:['Guarda-roupa'],           entregas:5,  producao:0, cache:260, termo:true,  exclusivo:true,  validade:'08/2026', status:'ativo',    nota:4.5 },
];
DATA.ugcPipeline = [
  { fase:'Briefing',     cor:'gray',   itens:[
    { creator:'Bia Nogueira', produto:'Nicho de Canto Adesivo', prazo:'em 3 dias' },
    { creator:'Léo Martins',  produto:'Organizador Suspenso',   prazo:'em 5 dias' },
  ]},
  { fase:'Em produção',  cor:'violet', itens:[
    { creator:'Marina Duarte', produto:'Talheres Expansível', prazo:'amanhã' },
    { creator:'Bia Nogueira',  produto:'Cabide Mágico',       prazo:'em 2 dias' },
  ]},
  { fase:'Recebido',     cor:'blue',   itens:[
    { creator:'Paula Reis',    produto:'Divisória de Gaveta', prazo:'aguarda análise' },
    { creator:'Marina Duarte', produto:'Potes Geladeira',     prazo:'aguarda análise' },
  ]},
  { fase:'Autorizado',   cor:'green',  itens:[
    { creator:'Marina Duarte', produto:'Talheres Expansível', prazo:'na fila' },
    { creator:'Paula Reis',    produto:'Gaveta ASMR',         prazo:'publicado' },
  ]},
];

// ----- Compliance Jurídico -----
DATA.compliance = {
  score: 86,
  conformes: 142, bloqueados: 5, autorizacoes: 38, vencendo: 4,
  checklist: [
    { item:'Autorização de imagem dos creators', ok:true,  det:'4 de 4 creators com termo assinado' },
    { item:'Cessão de direitos de uso (UGC)',     ok:true,  det:'18 cessões vigentes' },
    { item:'Licença de banco de imagens',         ok:false, det:'StockHome vencido em 02/2026' },
    { item:'Termo de parceria com fornecedores',  ok:true,  det:'3 de 4 fornecedores' },
    { item:'Política de claims e promessas',      ok:false, det:'1 legenda com promessa de resultado' },
    { item:'Marcação de publicidade (#publi)',    ok:true,  det:'Marcação automática ativa em todas as redes' },
  ],
  documentos: [
    { nome:'Termo de Cessão de Imagem e Voz', versao:'v3.2', status:'vigente', atualizado:'mar 2026' },
    { nome:'Contrato de UGC / Creator',       versao:'v2.0', status:'vigente', atualizado:'jan 2026' },
    { nome:'Política de Publicidade e Claims', versao:'v1.4', status:'revisar', atualizado:'set 2025' },
    { nome:'Licença de Banco de Imagens',     versao:'v1.0', status:'vencido', atualizado:'fev 2025' },
    { nome:'Termo de Parceria com Fornecedor', versao:'v2.1', status:'vigente', atualizado:'abr 2026' },
  ],
  logs: [
    { quem:'Cris Crabelo',   acao:'Aprovou cessão de uso',    alvo:'ugc_talheres_v3.mp4',        quando:'há 2h',     tipo:'aprovado' },
    { quem:'Sistema',        acao:'Bloqueou publicação',      alvo:'banco_lavanderia_b.mp4',     quando:'há 5h',     tipo:'bloqueado', motivo:'Licença sem autorização para postar' },
    { quem:'Letícia Moraes', acao:'Assinou termo digital',    alvo:'Creator Léo Martins',        quando:'ontem',     tipo:'aprovado' },
    { quem:'Sistema',        acao:'Sinalizou risco jurídico', alvo:'Legenda · Varal Retrátil',   quando:'ontem',     tipo:'risco',     motivo:'Promessa de resultado garantido' },
    { quem:'Cris Crabelo',   acao:'Renovou licença',          alvo:'Estúdio Caseiro UGC',        quando:'há 2 dias', tipo:'aprovado' },
  ],
  bloqueios: [
    { conteudo:'banco_lavanderia_b.mp4',       tipo:'Vídeo',   motivo:'Sem autorização para postar (banco licenciado)',          desde:'há 5h',   acao:'Solicitar licença' },
    { conteudo:'Legenda · Varal Retrátil 4m',  tipo:'Legenda', motivo:'Promessa de resultado garantido ("PROMETO", "GARANTIDO")', desde:'ontem',   acao:'Reescrever' },
    { conteudo:'capa_stockhome_banner.jpg',    tipo:'Imagem',  motivo:'Licença de banco vencida',                                desde:'há 1 dia', acao:'Substituir' },
  ],
};
DATA.docMap = {
  vigente: { cls:'green', label:'Vigente' },
  revisar: { cls:'amber', label:'Revisar' },
  vencido: { cls:'red',   label:'Vencido' },
};
DATA.logMap = {
  aprovado:  { cls:'green', icon:'check' },
  bloqueado: { cls:'red',   icon:'ban' },
  risco:     { cls:'amber', icon:'alert' },
};
