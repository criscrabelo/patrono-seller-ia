/* ============ Imagens e Criativos + Fornecedores ============ */

/* ---------- Imagens e Criativos ---------- */
const imgFiltros = ['Todas','Capa','Carrossel','Banner','Thumbnail'];

const ImgCard = ({ im, onClick }) => {
  const t = DATA.tipoImg[im.tipo];
  const blocked = !im.autorizado;
  return (
    <div className="card" onClick={onClick} style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 0, position: 'relative', cursor: 'pointer', borderColor: blocked ? 'oklch(0.70 0.19 22 / 0.35)' : 'var(--border-soft)' }}>
      <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden' }}>
        <Media label={`${im.tipo.toLowerCase()}\n${im.produto}`} ratio={t.ratio} style={{ borderRadius: 12 }} />
        {/* tipo badge */}
        <span className={`badge ${t.cor}`} style={{ position: 'absolute', top: 8, left: 8, padding: '2px 8px', background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(4px)' }}>{im.tipo}</span>
        {/* carrossel slides */}
        {im.slides && (
          <span style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,.6)', borderRadius: 99, padding: '2px 7px', fontSize: 10, fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="layers" size={10} />{im.slides}</span>
        )}
        {/* lock overlay */}
        {blocked && (
          <div style={{ position: 'absolute', inset: 0, background: 'oklch(0.16 0.02 22 / 0.55)', display: 'grid', placeItems: 'center', backdropFilter: 'blur(1px)' }}>
            <div className="col" style={{ alignItems: 'center', gap: 6, color: 'var(--red)' }}><Icon name="lock" size={22} /><span style={{ fontSize: 11, fontWeight: 700 }}>Bloqueado</span></div>
          </div>
        )}
      </div>
      <div className="col" style={{ gap: 8, padding: '12px 4px 4px' }}>
        <div className="row spread" style={{ alignItems: 'flex-start' }}>
          <span className="mono" style={{ fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>{im.nome}</span>
          <Badge status={im.status} />
        </div>
        <div className="row" style={{ gap: 6 }}>
          <Icon name="bag" size={12} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
          <span className="muted" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{im.produto}</span>
        </div>
        <div className="row spread" style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 9, marginTop: 2 }}>
          {im.autorizado
            ? <span className="row" style={{ gap: 4, fontSize: 11.5, color: 'var(--green)', fontWeight: 600 }}><Icon name="shield" size={12} />Autorizada</span>
            : <span className="row" style={{ gap: 4, fontSize: 11.5, color: 'var(--red)', fontWeight: 600 }}><Icon name="x" size={12} />Sem licença</span>}
          <span className="dim" style={{ fontSize: 11 }}>{im.usos} usos</span>
        </div>
      </div>
    </div>
  );
};

const Imagens = ({ go, locked }) => {
  const [f, setF] = useState('Todas');
  const [sel, setSel] = useState(null);
  const list = f === 'Todas' ? DATA.imagens : DATA.imagens.filter(i => i.tipo === f);
  const stats = [
    ['image','pink', DATA.imagens.length, 'No banco'],
    ['shield','green', DATA.imagens.filter(i => i.autorizado).length, 'Autorizadas'],
    ['sparkles','violet', DATA.imagens.filter(i => i.origem === 'Gerado por IA').length, 'Geradas por IA'],
    ['lock','red', DATA.imagens.filter(i => !i.autorizado).length, 'Bloqueadas'],
  ];
  return (
    <div className="content-inner fade-in">
      {locked && <PaywallBanner mod={locked} go={go} onActivate={() => { locked.ativo = true; window.__rerender(); }} />}
      <div className="card" style={{ background: 'radial-gradient(600px 200px at 0% 0%, var(--pink-soft), transparent 60%), var(--surface)' }}>
        <div className="row spread wrap" style={{ gap: 14 }}>
          <div className="row" style={{ gap: 12 }}>
            <div className="ico" style={{ width: 42, height: 42, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'var(--pink-soft)', color: 'var(--pink)' }}><Icon name="image" size={22} /></div>
            <div>
              <h2 style={{ fontSize: 18 }}>Imagens e Criativos</h2>
              <p className="muted" style={{ fontSize: 13 }}>Capas, carrosséis, banners e thumbnails · cada arte com <strong style={{ color: 'var(--pink)' }}>controle de autorização</strong></p>
            </div>
          </div>
          <div className="row" style={{ gap: 10 }}>
            <button className="btn btn-ghost btn-sm"><Icon name="upload" size={14} />Enviar arte</button>
            <button className="btn btn-primary btn-sm" onClick={() => go && go('gerar')}><Icon name="sparkles" size={14} />Gerar com IA</button>
          </div>
        </div>
      </div>

      <div className="grid g4">
        {stats.map(([ic,co,v,l]) => <StatCard key={l} icon={ic} color={co} value={v} label={l} />)}
      </div>

      <div className="row spread wrap" style={{ gap: 12 }}>
        <div className="chips">
          {imgFiltros.map(c => <div key={c} className={`chip ${f === c ? 'active' : ''}`} onClick={() => setF(c)}>{c}</div>)}
        </div>
        <span className="dim" style={{ fontSize: 12.5 }}>{list.length} criativos · vinculados a produto e campanha</span>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', alignItems: 'start' }}>
        {list.map(im => <ImgCard key={im.id} im={im} onClick={() => setSel(im)} />)}
      </div>

      {/* Detalhe da arte */}
      <Modal open={!!sel} onClose={() => setSel(null)} w={440}
        icon={sel ? DATA.tipoImg[sel.tipo].kind === 'wide' ? 'image' : 'image' : 'image'}
        iconColor={sel ? DATA.tipoImg[sel.tipo].cor : 'pink'}
        title={sel?.nome} sub={sel ? `${sel.tipo} · ${sel.produto}` : ''}
        footer={sel && (sel.autorizado
          ? <><button className="btn btn-ghost btn-sm" onClick={() => setSel(null)}>Fechar</button><button className="btn btn-primary btn-sm"><Icon name="calendar" size={13} />Usar em campanha</button></>
          : <><button className="btn btn-ghost btn-sm" onClick={() => setSel(null)}>Fechar</button><button className="btn btn-primary btn-sm" onClick={() => { setSel(null); go && go('fornecedores'); }}><Icon name="folder" size={13} />Resolver licença</button></>)}>
        {sel && (<>
          <div style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 16, maxWidth: 220, margin: '0 auto 16px' }}>
            <Media label={`${sel.tipo.toLowerCase()}\n${sel.produto}`} ratio={DATA.tipoImg[sel.tipo].ratio} style={{ borderRadius: 12 }} />
          </div>
          {!sel.autorizado && (
            <div className="row" style={{ gap: 9, padding: '10px 12px', borderRadius: 11, background: 'var(--red-soft)', border: '1px solid oklch(0.70 0.19 22 / 0.25)', marginBottom: 12 }}>
              <Icon name="lock" size={15} style={{ color: 'var(--red)', flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, color: 'var(--red)' }}>Arte sem licença de uso — bloqueada para publicação até regularizar o fornecedor.</span>
            </div>
          )}
          <KV k="Tipo" v={sel.tipo} />
          <KV k="Origem" v={sel.origem} />
          {sel.slides && <KV k="Slides" v={`${sel.slides} imagens`} />}
          <KV k="Produto" v={sel.produto} />
          <KV k="Campanha" v={sel.campanha} />
          <KV k="Validade da licença" v={sel.validade} />
          <KV k="Usos na operação" v={`${sel.usos} posts`} />
          <div className="row spread" style={{ paddingTop: 10 }}>
            <span className="dim" style={{ fontSize: 12.5 }}>Autorização</span>
            {sel.autorizado
              ? <span className="row" style={{ gap: 4, fontSize: 12.5, color: 'var(--green)', fontWeight: 600 }}><Icon name="shield" size={13} />Autorizada</span>
              : <span className="row" style={{ gap: 4, fontSize: 12.5, color: 'var(--red)', fontWeight: 600 }}><Icon name="x" size={13} />Sem licença</span>}
          </div>
        </>)}
      </Modal>
    </div>
  );
};

/* ---------- Fornecedores ---------- */
const Fornecedores = ({ go }) => {
  const [sel, setSel] = useState(DATA.fornecedores[0]);
  const [modal, setModal] = useState(null); // 'renovar' | 'contrato' | 'assinatura' | 'novo'
  const t = DATA.tipoForn[sel.tipo];
  const stats = [
    ['folder','blue', DATA.fornecedores.length, 'Fornecedores'],
    ['check','green', DATA.fornecedores.filter(f => f.contrato === 'Ativo' || f.contrato === 'Interno').length, 'Contratos vigentes'],
    ['doc','gold', DATA.fornecedores.filter(f => f.termo).length, 'Termos assinados'],
    ['alert','red', DATA.fornecedores.filter(f => f.status !== 'vigente').length, 'Exigem atenção'],
  ];
  return (
    <div className="content-inner fade-in">
      <div className="card" style={{ background: 'radial-gradient(600px 200px at 0% 0%, var(--blue-soft), transparent 60%), var(--surface)' }}>
        <div className="row spread wrap" style={{ gap: 14 }}>
          <div className="row" style={{ gap: 12 }}>
            <div className="ico" style={{ width: 42, height: 42, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'var(--blue-soft)', color: 'var(--blue)' }}><Icon name="folder" size={22} /></div>
            <div>
              <h2 style={{ fontSize: 18 }}>Fornecedores</h2>
              <p className="muted" style={{ fontSize: 13 }}>Quem fornece produtos e criativos · só entra na operação com <strong style={{ color: 'var(--blue)' }}>contrato e termo válidos</strong></p>
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => setModal('novo')}><Icon name="plus" size={15} />Novo fornecedor</button>
        </div>
      </div>

      <div className="grid g4">
        {stats.map(([ic,co,v,l]) => <StatCard key={l} icon={ic} color={co} value={v} label={l} />)}
      </div>

      <div className="grid g2" style={{ gridTemplateColumns: '1fr 320px', alignItems: 'start' }}>
        <div className="card flush">
          <table className="tbl">
            <thead><tr><th>Fornecedor</th><th>Tipo</th><th className="right">Criativos</th><th>Termo</th><th className="right">Status</th></tr></thead>
            <tbody>
              {DATA.fornecedores.map(f => {
                const ft = DATA.tipoForn[f.tipo];
                return (
                  <tr key={f.id} onClick={() => setSel(f)} style={{ cursor: 'pointer', background: sel.id === f.id ? 'oklch(1 0 0 / 0.03)' : undefined }}>
                    <td>
                      <div className="row" style={{ gap: 10 }}>
                        <div className="ico" style={{ width: 30, height: 30, borderRadius: 9, display: 'grid', placeItems: 'center', background: `var(--${ft.cor}-soft)`, color: `var(--${ft.cor})`, flexShrink: 0 }}><Icon name={ft.icon} size={15} /></div>
                        <div style={{ fontWeight: 600 }}>{f.nome}</div>
                      </div>
                    </td>
                    <td className="muted" style={{ fontSize: 12.5 }}>{f.tipo}</td>
                    <td className="right mono">{f.criativos}</td>
                    <td>{f.termo
                      ? <span className="row" style={{ gap: 4, color: 'var(--green)', fontSize: 12, fontWeight: 600 }}><Icon name="check" size={13} />Assinado</span>
                      : <span className="row" style={{ gap: 4, color: 'var(--amber)', fontSize: 12, fontWeight: 600 }}><Icon name="clock" size={13} />Pendente</span>}</td>
                    <td className="right"><span className={`badge ${DATA.contratoMap[f.contrato]}`} style={{ padding: '2px 8px' }}><span className="dot" />{f.contrato}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="card" style={{ position: 'sticky', top: 0 }}>
          <div className="row" style={{ gap: 11, marginBottom: 16 }}>
            <div className="ico" style={{ width: 44, height: 44, borderRadius: 12, display: 'grid', placeItems: 'center', background: `var(--${t.cor}-soft)`, color: `var(--${t.cor})`, flexShrink: 0 }}><Icon name={t.icon} size={22} /></div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 15.5 }}>{sel.nome}</div>
              <div className="muted" style={{ fontSize: 12.5 }}>{sel.tipo}</div>
            </div>
          </div>
          <div className="col" style={{ gap: 9 }}>
            {[['Contato', sel.contato],['Criativos fornecidos', sel.criativos],['Validade do contrato', sel.validade]].map(([k,v]) => (
              <div key={k} className="row spread"><span className="dim" style={{ fontSize: 12 }}>{k}</span><span style={{ fontSize: 12.5, fontWeight: 500, textAlign: 'right', maxWidth: 170, wordBreak: 'break-word' }}>{v}</span></div>
            ))}
          </div>
          <div className="divider" style={{ margin: '14px 0' }} />
          <div className="dim" style={{ fontSize: 10.5, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8 }}>Nichos atendidos</div>
          <div className="chips">{sel.nichos.map(n => <span key={n} className="badge gray" style={{ padding: '2px 9px' }}>{n}</span>)}</div>
          <div className="divider" style={{ margin: '14px 0' }} />
          <div className="col" style={{ gap: 8 }}>
            <div className="row spread"><span style={{ fontSize: 12.5 }}>Contrato</span><span className={`badge ${DATA.contratoMap[sel.contrato]}`} style={{ padding: '2px 8px' }}>{sel.contrato}</span></div>
            <div className="row spread"><span style={{ fontSize: 12.5 }}>Termo de cessão</span>{sel.termo
              ? <span className="row" style={{ gap: 4, color: 'var(--green)', fontSize: 12, fontWeight: 600 }}><Icon name="check" size={13} />Assinado</span>
              : <span className="row" style={{ gap: 4, color: 'var(--amber)', fontSize: 12, fontWeight: 600 }}><Icon name="clock" size={13} />Pendente</span>}</div>
          </div>
          {sel.status === 'vencido' && (
            <div className="row" style={{ gap: 8, marginTop: 14, padding: '9px 11px', borderRadius: 10, background: 'var(--red-soft)', border: '1px solid oklch(0.70 0.19 22 / 0.25)', cursor: 'pointer' }} onClick={() => go && go('compliance')}>
              <Icon name="scale" size={14} style={{ color: 'var(--red)', flexShrink: 0 }} />
              <span style={{ fontSize: 11.5, color: 'var(--red)', flex: 1 }}>Gera pendência no Compliance — 60 criativos bloqueados</span>
              <Icon name="arrow" size={13} style={{ color: 'var(--red)' }} />
            </div>
          )}
          {sel.status === 'vencido'
            ? <button className="btn btn-primary" style={{ width: '100%', marginTop: 14 }} onClick={() => setModal('renovar')}><Icon name="refresh" size={15} />Renovar contrato</button>
            : sel.termo
              ? <button className="btn btn-ghost" style={{ width: '100%', marginTop: 14 }} onClick={() => setModal('contrato')}><Icon name="doc" size={15} />Ver contrato</button>
              : <button className="btn btn-primary" style={{ width: '100%', marginTop: 14 }} onClick={() => setModal('assinatura')}><Icon name="pencil" size={15} />Coletar assinatura</button>}
        </div>
      </div>

      {/* Renovar contrato */}
      <Modal open={modal === 'renovar'} onClose={() => setModal(null)} icon="refresh" iconColor="gold"
        title="Renovar contrato" sub={sel.nome}
        footer={<><button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>Cancelar</button><button className="btn btn-primary btn-sm" onClick={() => { sel.contrato = 'Ativo'; sel.status = 'vigente'; sel.termo = true; sel.validade = '06/2027'; setModal(null); }}><Icon name="check" size={13} />Confirmar renovação</button></>}>
        <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>O contrato com <strong style={{ color: 'var(--text)' }}>{sel.nome}</strong> está vencido desde {sel.validade}. Renovar libera os criativos bloqueados no Compliance.</p>
        <KV k="Tipo de parceria" v={sel.tipo} />
        <KV k="Criativos fornecidos" v={sel.criativos} />
        <KV k="Nova validade" v="06/2027 (12 meses)" />
        <KV k="Termo de cessão" v="Será reemitido para assinatura" />
      </Modal>

      {/* Ver contrato */}
      <Modal open={modal === 'contrato'} onClose={() => setModal(null)} icon="doc" iconColor="blue"
        title="Contrato e termo de cessão" sub={sel.nome}
        footer={<><button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>Fechar</button><button className="btn btn-primary btn-sm"><Icon name="download" size={13} />Baixar PDF</button></>}>
        <div className="row" style={{ gap: 9, padding: '10px 12px', borderRadius: 11, background: 'var(--green-soft)', border: '1px solid oklch(0.72 0.16 158 / 0.25)', marginBottom: 14 }}>
          <Icon name="shield" size={15} style={{ color: 'var(--green)', flexShrink: 0 }} />
          <span style={{ fontSize: 12.5, color: 'var(--green)' }}>Termo de cessão vigente — criativos liberados para publicação.</span>
        </div>
        <KV k="Status do contrato" v={sel.contrato} />
        <KV k="Validade" v={sel.validade} />
        <KV k="Criativos cobertos" v={sel.criativos} />
        <KV k="Nichos" v={sel.nichos.join(', ')} />
        <KV k="Contato" v={sel.contato} mono />
      </Modal>

      {/* Coletar assinatura */}
      <Modal open={modal === 'assinatura'} onClose={() => setModal(null)} icon="pencil" iconColor="amber"
        title="Coletar assinatura digital" sub={sel.nome}
        footer={<><button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>Cancelar</button><button className="btn btn-primary btn-sm" onClick={() => { sel.termo = true; sel.contrato = 'Ativo'; sel.status = 'vigente'; sel.validade = '06/2027'; setModal(null); }}><Icon name="arrow" size={13} />Enviar termo</button></>}>
        <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>Enviar o termo de cessão de direitos para assinatura digital. Enquanto pendente, os criativos deste fornecedor não entram na fila.</p>
        <label className="label">Enviar para</label>
        <input className="input" defaultValue={sel.contato} />
        <label className="label" style={{ marginTop: 14 }}>Documento</label>
        <input className="input" defaultValue="Termo de Cessão de Imagem e Voz v3.2" readOnly />
      </Modal>

      {/* Novo fornecedor */}
      <Modal open={modal === 'novo'} onClose={() => setModal(null)} icon="plus" iconColor="blue"
        title="Novo fornecedor" sub="Cadastro com contrato e termo"
        footer={<><button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>Cancelar</button><button className="btn btn-primary btn-sm" onClick={() => setModal(null)}><Icon name="check" size={13} />Cadastrar</button></>}>
        <label className="label">Nome / Razão social</label>
        <input className="input" placeholder="Ex.: OrganizaJá Ltda" />
        <label className="label" style={{ marginTop: 14 }}>Tipo de fornecedor</label>
        <select className="input">{Object.keys(DATA.tipoForn).map(k => <option key={k}>{k}</option>)}</select>
        <label className="label" style={{ marginTop: 14 }}>E-mail de contato</label>
        <input className="input" placeholder="comercial@fornecedor.com" />
        <div className="row" style={{ gap: 8, marginTop: 14, padding: '9px 11px', borderRadius: 10, background: 'var(--amber-soft)', border: '1px solid oklch(0.80 0.15 70 / 0.25)' }}>
          <Icon name="clock" size={14} style={{ color: 'var(--amber)', flexShrink: 0 }} />
          <span style={{ fontSize: 11.5, color: 'var(--amber)' }}>O fornecedor só fornece criativos após contrato e termo assinados.</span>
        </div>
      </Modal>
    </div>
  );
};

window.Imagens = Imagens;
window.Fornecedores = Fornecedores;
