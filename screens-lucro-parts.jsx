/* ============ Painel de Lucro e Escala — helpers ============ */
const brl = (v) => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });

const ScoreRing = ({ score, size = 64 }) => {
  const f = window.scoreFaixa(score);
  const r = (size - 8) / 2, c = 2 * Math.PI * r;
  const col = `var(--${f.cls})`;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="oklch(0 0 0 / 0.3)" strokeWidth="6" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score/100)} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', flexDirection: 'column' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: size > 50 ? 20 : 15, color: col, lineHeight: 1 }}>{score}</span>
      </div>
    </div>
  );
};

/* ============ Drill-down de produto ============ */
const ProdutoDetalhe = ({ p, onClose }) => {
  const f = window.scoreFaixa(p.score);
  const rec = window.recTipoMap[p.recTipo];
  const metric = (label, val, color) => (
    <div className="col" style={{ gap: 2, padding: '11px 13px', borderRadius: 11, background: 'oklch(0 0 0 / 0.2)', border: '1px solid var(--border-soft)' }}>
      <span className="dim" style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, color: color || 'var(--text)' }}>{val}</span>
    </div>
  );
  return ReactDOM.createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'oklch(0 0 0 / 0.6)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: 'min(680px, 100%)', maxHeight: '88vh', overflowY: 'auto', padding: 0 }}>
        <div className="row spread" style={{ padding: '18px 22px', borderBottom: '1px solid var(--border-soft)', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 1 }}>
          <div className="row" style={{ gap: 12 }}>
            <ScoreRing score={p.score} size={48} />
            <div>
              <h2 style={{ fontSize: 17 }}>{p.nome}</h2>
              <div className="row" style={{ gap: 7, marginTop: 3 }}>
                <span className={`badge ${platColor[p.plat]||'gray'}`} style={{ padding: '2px 8px' }}>{p.plat}</span>
                <span className="badge gray" style={{ padding: '2px 8px' }}>{p.cat}</span>
                <span className={`badge ${f.cls}`} style={{ padding: '2px 8px' }}>{f.label}</span>
              </div>
            </div>
          </div>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><Icon name="x" size={16} /></button>
        </div>
        <div style={{ padding: 22 }}>
          <div className="grid g4" style={{ gap: 10 }}>
            {metric('Preço', brl(p.preco))}
            {metric('Comissão', p.pct + '%')}
            {metric('Cliques', p.cliques.toLocaleString('pt-BR'))}
            {metric('Vendas', p.vendas)}
            {metric('Comissão ganha', brl(p.comissao), 'var(--blue)')}
            {metric('Custos', brl(p.custos), 'var(--amber)')}
            {metric('Lucro líquido', brl(p.lucro), p.lucro >= 0 ? 'var(--green)' : 'var(--red)')}
            {metric('Margem', p.margem + '%', p.margem >= 0 ? 'var(--green)' : 'var(--red)')}
          </div>
          <div className="grid g3" style={{ gap: 10, marginTop: 10 }}>
            {metric('Conversão', p.conversao + '%')}
            {metric('Vídeos', p.videos)}
            {metric('Cresc. 7d', (p.cresc7d >= 0 ? '+' : '') + p.cresc7d + '%', p.cresc7d >= 0 ? 'var(--green)' : 'var(--red)')}
          </div>

          <div style={{ marginTop: 18, padding: 16, borderRadius: 13, background: `var(--${rec.cls}-soft)`, border: `1px solid oklch(0.7 0.1 285 / 0.2)` }}>
            <div className="row spread" style={{ marginBottom: 7 }}>
              <div className="row" style={{ gap: 7 }}><Icon name="brain" size={15} style={{ color: `var(--${rec.cls})` }} /><span style={{ fontSize: 12.5, fontWeight: 700, color: `var(--${rec.cls})` }}>Recomendação da IA</span></div>
              <span className={`badge ${rec.cls}`}><Icon name={rec.icon} size={11} />{rec.label}</span>
            </div>
            <p style={{ fontSize: 13.5, color: 'var(--text)' }}>{p.rec}</p>
            <div className="row" style={{ gap: 9, marginTop: 12 }}>
              <button className="btn btn-primary btn-sm"><Icon name="check" size={13} />Aprovar ação</button>
              <button className="btn btn-ghost btn-sm"><Icon name="sparkles" size={13} />Gerar 5 variações</button>
              <button className="btn btn-ghost btn-sm"><Icon name="x" size={13} />Ignorar</button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

window.brl = brl;
window.ScoreRing = ScoreRing;
window.ProdutoDetalhe = ProdutoDetalhe;
