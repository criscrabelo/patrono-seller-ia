/* ============ Produtos Afiliados ============ */
const platColor = { 'Shopee':'amber', 'Mercado Livre':'gold', 'Amazon':'blue', 'TikTok Shop':'pink', 'Renner':'violet' };

const Produtos = () => (
  <div className="content-inner fade-in">
    <div className="row spread wrap" style={{ gap: 12 }}>
      <div className="row" style={{ gap: 10, flex: 1, maxWidth: 360 }}>
        <div className="input" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Icon name="search" size={15} style={{ color: 'var(--text-dim)' }} /><span className="dim">Buscar produto...</span></div>
      </div>
      <div className="row" style={{ gap: 10 }}>
        <button className="btn btn-ghost btn-sm"><Icon name="filter" size={14} />Filtrar</button>
        <button className="btn btn-primary btn-sm"><Icon name="plus" size={14} />Novo produto</button>
      </div>
    </div>

    <div className="grid g4">
      {[['bag','gold',47,'Cadastrados'],['star','green',6,'Campeões'],['flask','violet',8,'Em teste'],['pause','amber',3,'Pausados']].map(([ic,co,v,l]) => (
        <StatCard key={l} icon={ic} color={co} value={v} label={l} />
      ))}
    </div>

    <div className="card flush">
      <table className="tbl">
        <thead><tr><th>Produto</th><th>Plataforma</th><th>Categoria</th><th className="right">Preço</th><th className="right">Comissão</th><th className="right">Nota</th><th className="right">Vendas</th><th className="right">Status</th></tr></thead>
        <tbody>
          {DATA.produtos.map(p => (
            <tr key={p.id}>
              <td style={{ maxWidth: 230 }}>
                <div style={{ fontWeight: 600 }}>{p.nome}</div>
                <div className="dim" style={{ fontSize: 11.5 }}>Resolve: {p.dor}</div>
              </td>
              <td><span className={`badge ${platColor[p.plat]||'gray'}`} style={{ padding: '2px 8px' }}>{p.plat}</span></td>
              <td className="muted">{p.cat}</td>
              <td className="right mono">{p.preco}</td>
              <td className="right mono" style={{ color: 'var(--green)' }}>{p.comissao}</td>
              <td className="right"><span className="row" style={{ gap: 3, justifyContent: 'flex-end' }}><Icon name="star" size={12} style={{ color: 'var(--gold)' }} />{p.nota}</span></td>
              <td className="right mono">{p.vendas}</td>
              <td className="right"><Badge status={p.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

/* ============ Biblioteca de Vídeos Autorizados (NOVO) ============ */
const permRow = (ok) => ok
  ? <span className="row" style={{ gap: 4, color: 'var(--green)', fontSize: 12, fontWeight: 600 }}><Icon name="check" size={13} />Sim</span>
  : <span className="row" style={{ gap: 4, color: 'var(--red)', fontSize: 12, fontWeight: 600 }}><Icon name="x" size={13} />Não</span>;

const Biblioteca = () => {
  const [sel, setSel] = useState(DATA.criativos[0]);
  return (
    <div className="content-inner fade-in">
      <div className="card" style={{ background: 'radial-gradient(600px 200px at 0% 0%, var(--green-soft), transparent 60%), var(--surface)' }}>
        <div className="row spread wrap" style={{ gap: 14 }}>
          <div className="row" style={{ gap: 12 }}>
            <div className="ico" style={{ width: 42, height: 42, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'var(--green-soft)', color: 'var(--green)' }}><Icon name="shield" size={22} /></div>
            <div>
              <h2 style={{ fontSize: 18 }}>Biblioteca de Vídeos Autorizados</h2>
              <p className="muted" style={{ fontSize: 13 }}>Só entra na fila vídeo com <strong style={{ color: 'var(--green)' }}>"pode postar: sim"</strong> · nada de terceiros</p>
            </div>
          </div>
          <button className="btn btn-primary"><Icon name="plus" size={15} />Adicionar criativo</button>
        </div>
      </div>

      <div className="grid g2" style={{ gridTemplateColumns: '1fr 320px', alignItems: 'start' }}>
        <div className="card flush">
          <table className="tbl">
            <thead><tr><th>Arquivo</th><th>Origem</th><th>Categoria</th><th>Postar</th><th className="right">Status</th></tr></thead>
            <tbody>
              {DATA.criativos.map(c => (
                <tr key={c.id} onClick={() => setSel(c)} style={{ cursor: 'pointer', background: sel.id === c.id ? 'oklch(1 0 0 / 0.03)' : undefined }}>
                  <td><span className="mono" style={{ fontSize: 12.5 }}>{c.nome}</span></td>
                  <td className="muted" style={{ fontSize: 12.5 }}>{c.origem}</td>
                  <td className="muted">{c.cat}</td>
                  <td>{permRow(c.postar)}</td>
                  <td className="right"><Badge status={c.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card" style={{ position: 'sticky', top: 0 }}>
          <PhonePreview w="100%" label={sel.nome} badge={<Badge status={sel.status} />} />
          <div className="col" style={{ gap: 9, marginTop: 16 }}>
            {[['Origem', sel.origem],['Fornecedor', sel.fornecedor],['Categoria', sel.cat],['Validade', sel.validade]].map(([k,v]) => (
              <div key={k} className="row spread"><span className="dim" style={{ fontSize: 12 }}>{k}</span><span style={{ fontSize: 12.5, fontWeight: 500 }}>{v}</span></div>
            ))}
          </div>
          <div className="divider" style={{ margin: '14px 0' }} />
          <div className="col" style={{ gap: 8 }}>
            {[['Autorização confirmada', sel.autorizado],['Pode postar', sel.postar],['Pode editar', sel.editar]].map(([k,v]) => (
              <div key={k} className="row spread"><span style={{ fontSize: 12.5 }}>{k}</span>{permRow(v)}</div>
            ))}
          </div>
          {sel.postar
            ? <button className="btn btn-violet" style={{ width: '100%', marginTop: 14 }}><Icon name="calendar" size={15} />Enviar para a fila</button>
            : <div style={{ marginTop: 14, padding: 10, borderRadius: 10, background: 'var(--red-soft)', color: 'var(--red)', fontSize: 12, textAlign: 'center' }}>🔒 Bloqueado — sem autorização para postar</div>}
        </div>
      </div>
    </div>
  );
};

/* ============ Séries Fixas ============ */
const Series = () => (
  <div className="content-inner fade-in">
    <div className="row spread wrap" style={{ gap: 12 }}>
      <div><h2 style={{ fontSize: 18 }}>Séries Fixas</h2><p className="muted" style={{ fontSize: 13 }}>Linhas editoriais que a IA alimenta automaticamente</p></div>
      <button className="btn btn-primary btn-sm"><Icon name="plus" size={14} />Nova série</button>
    </div>
    <div className="grid g3">
      {DATA.series.map(s => (
        <div key={s.id} className="card" style={{ position: 'relative', overflow: 'hidden', opacity: s.ativa ? 1 : 0.6 }}>
          <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(300px 120px at 100% 0%, var(--${s.cor}-soft), transparent 70%)`, pointerEvents: 'none' }} />
          <div className="row spread" style={{ position: 'relative' }}>
            <div className="ico" style={{ width: 40, height: 40, borderRadius: 11, display: 'grid', placeItems: 'center', background: `var(--${s.cor}-soft)`, color: `var(--${s.cor})` }}><Icon name={s.icon} size={20} /></div>
            {s.ativa ? <span className="badge green" style={{ padding: '2px 8px' }}><span className="dot" />Ativa</span> : <span className="badge gray" style={{ padding: '2px 8px' }}>Pausada</span>}
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, marginTop: 14, position: 'relative' }}>{s.nome}</div>
          <div className="row spread" style={{ marginTop: 14, position: 'relative' }}>
            <div className="col"><span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 19 }}>{s.videos}</span><span className="dim" style={{ fontSize: 11 }}>vídeos</span></div>
            <div className="col" style={{ alignItems: 'flex-end' }}><span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 19, color: `var(--${s.cor})` }}>{s.seguidores}</span><span className="dim" style={{ fontSize: 11 }}>seguidores</span></div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

window.Produtos = Produtos;
window.Biblioteca = Biblioteca;
window.Series = Series;
