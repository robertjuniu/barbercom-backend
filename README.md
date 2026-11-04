# BarberCom backend

Backend acadêmico Node.js 24, Express e PostgreSQL 18. O frontend da equipe utiliza as rotas JSON `/api`; as páginas EJS demonstram as operações administrativas.

## Executar

### Com Docker (recomendado para a equipe)

Com Docker Desktop aberto, execute na raiz:

```sh
docker compose up --build -d
```

Abra http://127.0.0.1:3000/login. Banco, tabelas, contas e exemplos são preparados automaticamente. Gestor: `71999990000` / `GestorDemo@2026`. Cliente: `71999990001` / `ClienteDemo@2026`. Contas fictícias para uso local. Os dados persistem em volumes; não use `down -v` para parar.

Veja [INTEGRACAO.md](INTEGRACAO.md) para portas, rotas, sessão/CSRF, seed, configuração Google, testes e instruções de apresentação. O frontend definitivo deve seguir o Figma. Google é opcional e exige credenciais próprias.

Docker validado em 04/11/2026: dois serviços saudáveis, seis testes aprovados dentro do container e sessão/dados preservados após reinício. Veja [registro da validação](docs/validacao-docker.md).

### Sem Docker (Windows)

```powershell
npm.cmd ci
npm.cmd run configurar
npm.cmd start
```

Abra http://127.0.0.1:3000. O configurador prepara uma instância PostgreSQL exclusiva em 127.0.0.1:55438, com senha aleatória e usuário sem privilégios de superusuário. Não modifica a instância existente na porta 5432. O acesso inicial fica em `work/acesso-local.txt`; não compartilhe esse arquivo.

Preserve `.env` e `work/postgres-local/data` para manter as configurações e os cadastros. O configurador não substitui senhas existentes. Não mova nem sincronize o banco aberto; use pg_dump/pg_restore para transportar dados. A pasta atual está no OneDrive: feche o banco antes de mover ou sincronizar seus arquivos.

`scripts/iniciar-local.ps1` inicia banco e aplicação. Ctrl+C encerra o servidor no terminal. `scripts/parar-banco-local.ps1` encerra somente o PostgreSQL do BarberCom, preservando seus arquivos.

Para outro PostgreSQL, crie banco vazio dedicado, configure `.env` a partir de `.env.example`, aplique SQLs de 001 a 005 em ordem e execute `npm.cmd run preparar`. Não aplique 001 em banco preenchido. O configurador automático gerencia apenas sua própria instância local.

## Implementação

- Login gestor/cliente, hash scrypt, sessões no PostgreSQL, CSRF e limite de tentativas.
- Google OAuth com state, nonce, PKCE, token oficial e vinculação com senha original. Vinculação e login real comprovados no Edge. Na configuração atual, a conta institucional entra como CLIENTE. Cada instalação precisa configurar suas próprias credenciais.
- Unidades, Profissionais e Serviços: operações, vínculos, preço/duração por unidade.
- Horários: consulta/cadastro/edição/remoção via API, pausas, bloqueios e conflitos entre unidades. Demonstração só expõe consulta/cadastro.
- Cadastro direto de cliente com nome, telefone e senha, sem SMS. Telefone não é verificado.
- A mesma página de login aceita cliente e gestor; o perfil define o destino. Área mínima de cliente em /cliente/agendamentos.
- DEMO_GESTOR=true habilita botão separado de gestor com qualquer telefone e senha preenchidos; só para a apresentação local.
- Cliente: catálogo, unidades elegíveis, disponibilidade, resumo, reserva, cancelamento e histórico.
- Gestor: histórico com filtros, conclusão, atendimento avulso já realizado e adicionais com responsável por item. Cancelados permanecem registrados.
- Coordenadas opcionais nas unidades e ordenação por distância aproximada, sem API paga de mapas.
- Upload de foto JPEG/PNG (até 2 MB), validada e convertida para JPEG, armazenada no PostgreSQL.
- Demonstração Figma com interruptores sem recarga e transições nativas.

## Guias e código

- `outputs/GUIA_PARA_CLAUDE_FRONTEND.md`: instruções para implementar o frontend fiel ao Figma e integrar o backend.
- `outputs/verificacao-mobile.md`: conferência de larguras no PC e passos para testar Android real por USB.
- `outputs/integracao-frontend.md`: contrato, exemplos JSON, cookies, CSRF e CORS.
- `outputs/configurar-google-e-sms.md`: configuração externa e teste real.
- `outputs/relatorio-entrega.md`: cobertura e limites.
- `docs/modelagem.md`: modelagem consolidada da SP07, com 15 tabelas, 78 campos, diagrama, chaves e regras. Versões PDF, Markdown e Mermaid em `outputs/SP07-*`.
- `src/app.js`: autenticação e montagem; `src/api.js`: respostas JSON administrativas, sem duplicar regras.
- `src/catalogo.js`, `src/horarios.js`, `src/cliente.js`, `src/historico.js`: negócio.
- `src/google.js`, `src/session-store.js`: Google e sessões.
- `views/`, `public/`: demonstração opcional para o frontend da equipe.

## Configuração

Veja `.env.example`. SESSION_SECRET precisa ser aleatório, ter ao menos 32 caracteres e ser estável entre reinícios. Mantenha ALLOW_ANY_PASSWORD=false. O atalho separado DEMO_GESTOR deve ficar false fora da apresentação; na instalação local está true. Modo true é só para teste local e não permite vincular Google sem senha original.

Não compartilhe Client Secret, token Twilio, `.env`, acessos, banco ou logs. FRONTEND_ORIGIN permite uma origem exata para outra porta; prefira proxy de desenvolvimento para mesma origem.

## Testar e empacotar

```powershell
npm.cmd test
npm.cmd audit --omit=dev
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\empacotar.ps1
```

Testes usam schemas aleatórios em PostgreSQL real e removem somente esses schemas. Log 23514 é esperado na simulação de rollback.

O ZIP usa lista explícita de fontes, sem `.env`, `work`, `node_modules`, capturas ou acesso local. Envie `outputs/BarberCom-backend.zip`; dependências travadas no package-lock.

## Limites

Frontend da equipe e celular ainda precisam de validação. Google real foi testado como gestor e, depois da transferência autorizada, como cliente. Outra identidade sem vínculo ainda precisa de teste real. SMS foi retirado por decisão do responsável para evitar custo. Distância calculada em linha reta, sem rota de carro ou geocodificação automática. As unidades de demonstração já têm coordenadas fictícias em Salvador. O frontend pode enviar um ponto fictício de origem para apresentar a ordenação ou obter a localização do cliente com consentimento; unidades sem coordenadas ficam no fim. Atendimento avulso é um registro já realizado, não uma fila de espera. Fotos ficam no backup do banco. Histórico limitado a 500 registros; use filtros. Disponibilidade em passos de 15 minutos, intervalos no mesmo dia e fuso America/Bahia. Alterações de jornada bloqueadas quando há reservas em aberto.

Aplicação local, em 127.0.0.1, recusa NODE_ENV=production. Hospedagem exige HTTPS, cookies seguros, proxy e validação operacional. O frontend deve construir o fluxo visual do cliente sobre a API.
