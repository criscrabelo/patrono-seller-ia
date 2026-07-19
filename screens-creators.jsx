/* ============ Creators / UGC ============ */

const CreatorCard = ({ c, onBriefing }) => (
  <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
    <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(300px 130px at 100% 0%, var(--${c.cor}-soft), transparent 70%)`, pointerEvents: 'none' }} />
    <div className="row spread" style={{ position: 'relative' }}>
      <div className="row" style={{ gap: 11 }}>
        <div className="avatar" style={{ width: 44, height: 44, fontSize: 17, background: `linear-gradient(140deg, var(--${c.cor}), var(--violet-2))`, color: c.cor === 'gold' ? 'oklch(0.2 0.02 70)' : 'white' }}>{c.nome[0]}</div>
        <div>
          <div className="row" style={{ gap: 6 }}>
            <span style={{ fontWeight: 600, fontSize: 14.5 }}>{c.nome}</span>
            {c.exclusivo && <span className="badge gold" style={{ padding: '1px 7px', fontSize: 9.5 }}><Icon name="crown" size={10} />Exclusivo</span>}
          </div>
          <div className="dim" style={{ fontSize: 12 }}>{c.handle}</div>
        </div>
      </div>
      <span className="row" style={{ gap: 3, fontSize: 12.5, fontWeight: 700, color: 'var(--gold)' }}><Icon name="star" size={13} />{c.nota}</span>
    </div>

    <div className="chips" style={{ position: 'relative', marginTop: 13 }}>
      {c.nicho.map(n => <span key={n} className="badge gray" style={{ padding: '2px 9px' }}>{n}</span>)}
    </div>

    <div className="row" style={{ position: 'relative', marginTop: 15, gap: 0, borderTop: '1px solid var(--border-soft)', paddingTop: 14 }}>
      {[['Entregas', c.entregas],['Em produção', c.producao],['Cachê', 'R$ ' + c.cache]].map(([k,v], i) => (
        <div key={k} className="col" style={{ flex: 1, alignItems: i === 0 ? 'flex-start' : 'center', borderLeft: i ? '1px solid var(--border-soft)' : 'none', paddingLeft: i ? 12 : 0 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18 }}>{v}</span>
          <span className="dim" style={{ fontSize: 11 }}>{k}</span>
        </div>
      ))}
    </div>

    <div className="row spread" style={{ position: 'relative', marginTop: 14 }}>
      {c.termo
        ? <span className="row" style={{ gap: 5, fontSize: 12, color: 'var(--green)', fontWeight: 600 }}><Icon name="shield" size={13} />Cessão até {c.validade}</span>
        : <span className="row" style={{ gap: 5, fontSize: 12, color: 'var(--amber)', fontWeight: 600 }}><Icon name="clock" size={13} />Cessão pendente</span>}
      <button className="btn btn-ghost btn-sm" onClick={onBriefing}>Briefing<Icon name="arrow" size={13} /></button>
    </div>
  </div>
);

const Creators = ({ go }) => {
  const [modal, setModal] = useState(null); // 'contratar' | creator obj para briefing
  const stats = [
    ['users','violet', DATA.creators.length, 'Creators ativos'],
    ['video','blue', DATA.creators.reduce((s,c) => s + c.entregas, 0), 'Entregas no total'],
    ['shield','green', DATA.creators.filter(c => c.termo).length, 'Cessões vigentes'],
    ['clock','amber', DATA.creators.reduce((s,c) => s + c.producao, 0), 'Em produção'],
  ];
  return (
    <div className="content-inner fade-in">
      <div className="card" style={{ background: 'radial-gradient(600px 200px at 0% 0%, var(--violet-soft), transparent 60%), var(--surface)' }}>
        <div className="row spread wrap" style={{ gap: 14 }}>
          <div className="row" style={{ gap: 12 }}>
            <div className="ico" style={{ width: 42, height: 42, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'var(--violet-soft)', color: 'var(--violet)' }}><Icon name="users" size={22} /></div>
            <div>
              <h2 style={{ fontSize: 18 }}>Creators e UGC</h2>
              <p className="muted" style={{ fontSize: 13 }}>Conteúdo de pessoas reais · todo vídeo entra com <strong style={{ color: 'var(--violet)' }}>cessão de uso assinada</strong></p>
            </div>
          </div>
          <button className="btn btn-violet" onClick={() => setModal('contratar')}><Icon name="plus" size={15} />Contratar creator</button>
        </div>
      </div>

      <div className="grid g4">
        {stats.map(([ic,co,v,l]) => <StatCard key={l} icon={ic} color={co} value={v} label={l} />)}
      </div>

      <SectionTitle action={<span className="dim" style={{ fontSize: 12.5 }}>{DATA.creators.length} creators · cachê por entrega</span>}>Roster de creators</SectionTitle>
      <div className="grid g2">
        {DATA.creators.map(c => <CreatorCard key={c.id} c={c} onBriefing={() => setModal(c)} />)}
      </div>

      {/* Pipeline de produção UGC */}
      <SectionTitle action={<button className="btn btn-ghost btn-sm" onClick={() => go && go('biblioteca')}><Icon name="video" size={13} />Ver acervo</button>}>Pipeline de produção</SectionTitle>
      <div className="grid g4" style={{ alignItems: 'start' }}>
        {DATA.ugcPipeline.map(col => (
          <div key={col.fase} className="col" style={{ gap: 10 }}>
            <div className="row spread" style={{ padding: '0 2px' }}>
              <span className="row" style={{ gap: 7, fontSize: 12.5, fontWeight: 700 }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: `var(--${col.cor === 'gray' ? 'text-dim' : col.cor})` }} />{col.fase}
              </span>
              <span className="dim mono" style={{ fontSize: 11.5 }}>{col.itens.length}</span>
            </div>
            {col.itens.map((it, i) => (
              <div key={i} className="card" style={{ padding: 13, borderColor: `oklch(0.5 0.1 285 / 0.2)`, borderLeft: `3px solid var(--${col.cor === 'gray' ? 'border-strong' : col.cor})` }}>
                <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>{it.produto}</div>
                <div className="row spread" style={{ marginTop: 10 }}>
                  <span className="row" style={{ gap: 5, fontSize: 11.5 }}>
                    <span className="avatar" style={{ width: 18, height: 18, fontSize: 9 }}>{it.creator[0]}</span>
                    <span className="muted">{it.creator.split(' ')[0]}</span>
                  </span>
                  <span className="dim" style={{ fontSize: 11 }}>{it.prazo}</span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Briefing de creator */}
      <Modal open={!!modal && typeof modal === 'object'} onClose={() => setModal(null)} icon="video" iconColor="violet" w={480}
        title={`Briefing · ${modal && modal.nome ? modal.nome : ''}`} sub={modal && modal.handle ? modal.handle : ''}
        footer={<><button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>Cancelar</button><button className="btn btn-violet btn-sm" onClick={() => setModal(null)}><Icon name="arrow" size={13} />Enviar briefing</button></>}>
        {modal && typeof modal === 'object' && (<>
          {!modal.termo && (
            <div className="row" style={{ gap: 9, padding: '10px 12px', borderRadius: 11, background: 'var(--amber-soft)', border: '1px solid oklch(0.80 0.15 70 / 0.25)', marginBottom: 14 }}>
              <Icon name="clock" size={15} style={{ color: 'var(--amber)', flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, color: 'var(--amber)' }}>Cessão de uso pendente — será coletada junto com o briefing.</span>
            </div>
          )}
          <label className="label">Produto</label>
          <select className="input">{DATA.imagens.map(i => i.produto).filter((v,i,a) => a.indexOf(v) === i).map(p => <option key={p}>{p}</option>)}</select>
          <label className="label" style={{ marginTop: 14 }}>Formato</label>
          <select className="input"><option>Vídeo vertical (UGC)</option><option>Carrossel</option><option>Review unboxing</option></select>
          <label className="label" style={{ marginTop: 14 }}>Orientação</label>
          <textarea className="input" rows={3} placeholder="Tom, ganchos, pontos obrigatórios..." style={{ resize: 'vertical', fontFamily: 'var(--font-body)' }} />
          <div className="row spread" style={{ marginTop: 14 }}>
            <span className="dim" style={{ fontSize: 12 }}>Cachê estimado</span>
            <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>R$ {modal.cache}</span>
          </div>
        </>)}
      </Modal>

      {/* Contratar creator */}
      <Modal open={modal === 'contratar'} onClose={() => setModal(null)} icon="users" iconColor="violet"
        title="Contratar creator" sub="Cadastro com cessão de uso"
        footer={<><button className="btn btn-ghost btn-sm" onClick={() => setModal(null)}>Cancelar</button><button className="btn btn-violet btn-sm" onClick={() => setModal(null)}><Icon name="check" size={13} />Cadastrar</button></>}>
        <label className="label">Nome</label>
        <input className="input" placeholder="Nome do creator" />
        <label className="label" style={{ marginTop: 14 }}>@ do perfil</label>
        <input className="input" placeholder="@usuario" />
        <label className="label" style={{ marginTop: 14 }}>Cachê por entrega (R$)</label>
        <input className="input" type="number" placeholder="300" />
        <div className="row" style={{ gap: 8, marginTop: 14, padding: '9px 11px', borderRadius: 10, background: 'var(--violet-soft)', border: '1px solid oklch(0.62 0.18 295 / 0.25)' }}>
          <Icon name="shield" size={14} style={{ color: 'var(--violet)', flexShrink: 0 }} />
          <span style={{ fontSize: 11.5, color: 'var(--violet)' }}>O termo de cessão de imagem e voz é enviado automaticamente para assinatura digital.</span>
        </div>
      </Modal>
    </div>
  );
};

window.Creators = Creators;
