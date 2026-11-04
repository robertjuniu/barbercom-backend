// As rotas existentes continuam sendo a única implementação das regras de cadastro.
export function apiAdapter(req, res, next) {
  if (!/^\/api(?:\/|$)/.test(req.url)) return next();
  req.isApi = true;
  req.url = req.url.slice(4) || '/';
  req.headers.accept = 'application/json';
  const json = res.json.bind(res);
  res.render = (view, data = {}) => {
    const status = res.statusCode;
    if (status >= 400) return json({ erro: data.erro || data.mensagem || 'Não foi possível concluir a operação.', csrf: req.session?.csrf });
    const response = { ...data };
    delete response.valores;
    delete response.dias;
    response.csrf = req.session?.csrf;
    if (view === 'login') return json({ csrf: req.session.csrf, googleDisponivel: res.app.locals.googleEnabled, modoTeste: res.app.locals.allowAnyPassword, demoGestor: res.app.locals.demoGestor });
    return json(response);
  };
  res.redirect = (status, location) => {
    const target = location ?? status;
    if (target === '/login' && req.path !== '/sair') return res.status(401).json({ erro: 'Autenticação necessária.' });
    return res.status(200).json({ mensagem: req.session?.aviso || 'Operação concluída.', proximaRota: target, csrf: req.session?.csrf });
  };
  next();
}
