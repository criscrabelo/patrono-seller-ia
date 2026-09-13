/* ============ Administração — Usuários ============ */
const Usuarios = () => {
  const [papel, setPapel] = useState('operador'); // papel do novo usuário
  const us = DATA.usuarios;
  const admins = us.filter(u => u.papel === 'admin').length;
  const ops = us.filter(u => u.papel === 'operador').length;

  return (
    <div className="content-inner fade-in">
      <div className="card" style={{ background: 'radial-gradient(600px 220px at 0% 0%, var(--gold-soft), transparent 60%), var(--surface)' }}>
        <div className="row spread wrap" style={{ gap: 14 }}>
          <div className="row" style={{ gap: 12 }}>
            <div className="ico" style={{ width: 42, height: 42, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'var(--gold-soft)', color: 'var(--gold)' }}><Icon name="shield" size={22} /></div>
            <div><h2 style={{ fontSize: 18 }}>Usuários &amp; permissões</h2><p className="muted" style={{ fontSize: 13 }}>Cadastre administradores e operadores · só admins veem esta área</p></div>
          </div>
          <span className="badge gold"><Icon name="shield" size={12} />Você é Administradora</span>
        </div>
      </div>

      <div className="grid g4">
        <StatCard icon="users" color="blue" value={us.length} label="Usuários no total" />
        <StatCard icon="shield" color="gold" value={admins} label="Administradores" />
        <StatCard icon="users" color="violet" value={ops} label="Operadores" />
        <StatCard icon="bell" color="amber" value={DATA.solicitacoes.length} label="Solicitações pendentes" />
      </div>

      <div className="grid g2" style={{ gridTemplateColumns: '1fr 340px', alignItems: 'start' }}>
        {/* Lista de usuários */}
        <div className="card flush">
          <div className="row spread" style={{ padding: '14px 20px' }}>
            <div className="card-title">Usuários ativos</div>
            <div className="chips"><div className="chip active">Todos</div><div className="chip">Admins</div><div className="chip">Operadores</div></div>
          </div>
          <table className="tbl">
            <thead><tr><th>Usuário</th><th>Função</th><th>Status</th><th>Último acesso</th><th className="right">Ações</th></tr></thead>
            <tbody>
              {us.map(u => {
                const pm = window.papelMap[u.papel];
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="row" style={{ gap: 10 }}>
                        <div className="avatar" style={{ width: 32, height: 32, fontSize: 12, background: u.papel === 'admin' ? 'linear-gradient(140deg, var(--gold), var(--gold-2))' : 'linear-gradient(140deg, var(--violet), var(--violet-2))', color: u.papel === 'admin' ? 'oklch(0.2 0.02 70)' : 'white' }}>{u.nome[0]}</div>
                        <div style={{ minWidth: 0 }}>
                          <div className="row" style={{ gap: 6 }}><span style={{ fontWeight: 600 }}>{u.nome}</span>{u.voce && <span className="badge gray" style={{ padding: '1px 6px', fontSize: 10 }}>você</span>}</div>
                          <div className="dim" style={{ fontSize: 11.5 }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className={`badge ${pm.cls}`}><Icon name={pm.icon} size={11} />{pm.label}</span></td>
                    <td><Badge status={u.status} /></td>
                    <td className="muted" style={{ fontSize: 12.5 }}>{u.acesso}</td>
                    <td className="right">
                      <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost btn-sm" style={{ padding: '5px 8px' }} title="Mudar função"><Icon name="refresh" size={13} /></button>
                        {!u.voce && <button className="btn btn-ghost btn-sm" style={{ padding: '5px 8px' }} title={u.status === 'bloqueado' ? 'Desbloquear' : 'Bloquear'}><Icon name={u.status === 'bloqueado' ? 'check' : 'pause'} size={13} /></button>}
                        {!u.voce && <button className="btn btn-danger btn-sm" style={{ padding: '5px 8px' }} title="Remover"><Icon name="x" size={13} /></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Cadastrar novo */}
        <div className="card" style={{ position: 'sticky', top: 0 }}>
          <div className="row" style={{ gap: 9, marginBottom: 14 }}>
            <div className="ico" style={{ width: 34, height: 34, borderRadius: 9, display: 'grid', placeItems: 'center', background: 'var(--gold-soft)', color: 'var(--gold)' }}><Icon name="plus" size={17} /></div>
            <div className="card-title">Cadastrar usuário</div>
          </div>
          <label className="label">Nome completo</label>
          <input className="input" placeholder="Nome da pessoa" />
          <label className="label" style={{ marginTop: 13 }}>Email</label>
          <input className="input" placeholder="email@grupopatrono.com.br" />
          <label className="label" style={{ marginTop: 13 }}>Função</label>
          <div className="col" style={{ gap: 8 }}>
            <div onClick={() => setPapel('operador')} style={{ cursor: 'pointer', padding: '11px 13px', borderRadius: 11, border: `1px solid ${papel==='operador'?'oklch(0.68 0.195 295 / 0.45)':'var(--border-soft)'}`, background: papel==='operador'?'var(--violet-soft)':'oklch(0 0 0 / 0.15)' }}>
              <div className="row spread"><div className="row" style={{ gap: 8 }}><Icon name="users" size={15} style={{ color: 'var(--violet)' }} /><span style={{ fontWeight: 600, fontSize: 13.5 }}>Operador</span></div>{papel==='operador' && <Icon name="checkCircle" size={15} style={{ color: 'var(--violet)' }} />}</div>
              <p className="dim" style={{ fontSize: 11.5, marginTop: 5 }}>Cria, agenda e gerencia conteúdo. Não gerencia usuários nem integrações.</p>
            </div>
            <div onClick={() => setPapel('admin')} style={{ cursor: 'pointer', padding: '11px 13px', borderRadius: 11, border: `1px solid ${papel==='admin'?'oklch(0.84 0.155 86 / 0.45)':'var(--border-soft)'}`, background: papel==='admin'?'var(--gold-soft)':'oklch(0 0 0 / 0.15)' }}>
              <div className="row spread"><div className="row" style={{ gap: 8 }}><Icon name="shield" size={15} style={{ color: 'var(--gold)' }} /><span style={{ fontWeight: 600, fontSize: 13.5 }}>Administrador</span></div>{papel==='admin' && <Icon name="checkCircle" size={15} style={{ color: 'var(--gold)' }} />}</div>
              <p className="dim" style={{ fontSize: 11.5, marginTop: 5 }}>Acesso total: usuários, integrações, aprovações e configurações.</p>
            </div>
          </div>
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 16 }}><Icon name="plus" size={15} />Criar e enviar convite</button>
          <p className="dim" style={{ fontSize: 11, textAlign: 'center', marginTop: 10 }}>A pessoa recebe um email para definir a senha.</p>
        </div>
      </div>

      {/* Solicitações de cadastro */}
      {DATA.solicitacoes.length > 0 && (
        <div className="card" style={{ borderColor: 'oklch(0.80 0.15 70 / 0.3)' }}>
          <div className="row" style={{ gap: 9, marginBottom: 14 }}>
            <Icon name="bell" size={16} style={{ color: 'var(--amber)' }} />
            <div className="card-title" style={{ fontSize: 15 }}>Solicitações de cadastro</div>
            <span className="badge amber" style={{ marginLeft: 'auto' }}>{DATA.solicitacoes.length} aguardando</span>
          </div>
          <div className="col" style={{ gap: 10 }}>
            {DATA.solicitacoes.map(s => (
              <div key={s.id} className="row spread wrap" style={{ gap: 12, padding: '11px 13px', borderRadius: 11, background: 'oklch(0 0 0 / 0.2)', border: '1px solid var(--border-soft)' }}>
                <div className="row" style={{ gap: 10 }}>
                  <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>{s.nome[0]}</div>
                  <div><div style={{ fontWeight: 600, fontSize: 13.5 }}>{s.nome}</div><div className="dim" style={{ fontSize: 11.5 }}>{s.email} · {s.quando}</div></div>
                </div>
                <div className="row wrap" style={{ gap: 8 }}>
                  <button className="btn btn-ghost btn-sm"><Icon name="users" size={13} />Aprovar como Operador</button>
                  <button className="btn btn-primary btn-sm"><Icon name="shield" size={13} />Como Admin</button>
                  <button className="btn btn-danger btn-sm"><Icon name="x" size={13} />Recusar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

window.Usuarios = Usuarios;
