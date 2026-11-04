# BarberCom: execução e integração

## Iniciar pelo Docker

Instale o Docker Desktop e deixe o motor de containers Linux em execução. No Windows, ele usa WSL 2 e pode exigir reinício na instalação. Em Linux, use Docker Engine com Compose v2.

Na pasta que contém `docker-compose.yml`:

```sh
docker compose up --build -d
docker compose ps
docker compose logs -f backend
```

Abra http://127.0.0.1:3000/login. Não precisa instalar Node.js ou PostgreSQL na máquina. O primeiro build precisa de internet para baixar as imagens e dependências. O frontend definitivo é desenvolvido pela equipe; o container inclui a demonstração EJS.

| Uso | Endereço |
| --- | --- |
| Demonstração | http://127.0.0.1:3000/login |
| API | http://127.0.0.1:3000/api |
| Sessão atual | GET http://127.0.0.1:3000/api/sessao |
| Frontend de desenvolvimento permitido | http://127.0.0.1:5173 |
| Banco, dentro do Compose | db:5432, banco barbercom, usuário barbercom_app |

O PostgreSQL fica acessível apenas na rede interna do Compose. O backend é publicado somente no próprio computador, em 127.0.0.1. O nome `db` funciona dentro do Docker, não no navegador. Os containers não usam a instância PostgreSQL já instalada no Windows.

## Contas e dados iniciais

Estas contas são fictícias e suas senhas são públicas para testes locais:

| Perfil | Telefone | Senha |
| --- | --- | --- |
| Gestor | 71999990000 | GestorDemo@2026 |
| Cliente | 71999990001 | ClienteDemo@2026 |

As senhas são verificadas normalmente; o atalho de gestor com qualquer senha fica desligado no Compose. Não use essas contas em um serviço publicado.

O banco novo recebe três unidades fictícias de Salvador (duas ativas), dois serviços, quatro profissionais e jornadas das 09h às 18h em todos os dias, com almoço das 12h às 13h. Corte custa R$ 35 e barba R$ 25, cada um com 30 minutos. Use uma data futura para testar o agendamento. Não há reservas pré-criadas.

As migrações 001 a 005 rodam na criação do volume vazio. O seed roda no início do backend e não troca senhas, apaga reservas nem duplica exemplos em um banco já preenchido. Contas existentes com perfil incompatível fazem o início falhar, em vez de receberem outra permissão. O segredo da sessão é aleatório e fica no volume `sessao`.

```sh
docker compose stop
docker compose start
docker compose down
```

Esses comandos preservam os volumes. Não use `docker compose down -v` para parar: a opção `-v` apaga o banco e as sessões do Docker. Mudanças futuras no SQL precisam de migração explícita para volumes existentes; editar o SQL de inicialização não atualiza sozinho um volume antigo.

## Porta, frontend e Google

Não precisa criar `.env` para executar com os padrões acima. Para alterar as opções, copie `.env.docker.example` para `.env.docker` e use:

```sh
docker compose --env-file .env.docker up --build -d
```

`DOCKER_BACKEND_PORT` troca a porta do navegador (por exemplo 3002). A porta interna segue 3000. `DOCKER_FRONTEND_ORIGIN` permite uma única origem, sem barra no final. Use o mesmo hostname nos dois lados: 127.0.0.1 no frontend e no backend. O `.env` do ambiente Windows anterior não é copiado nem carregado dentro da imagem. Use as mesmas opções `--env-file` ao recriar os containers. Alterar uma senha de banco no arquivo não altera a senha de um volume existente.

Google fica desabilitado até configurar `DOCKER_GOOGLE_CLIENT_ID`, `DOCKER_GOOGLE_CLIENT_SECRET` e `DOCKER_GOOGLE_REDIRECT_URI` no arquivo privado `.env.docker`. Para porta 3000, o callback é `http://127.0.0.1:3000/auth/google/callback` e deve estar cadastrado exatamente assim no Google Cloud. As contas e os vínculos Google do computador anterior não vão no pacote. A vinculação inicial exige login com telefone/senha e a senha original da conta. Veja [configuração Google](outputs/configurar-google-e-sms.md).

Prefira um proxy no frontend para `/api`, `/auth` e `/fotos`. Exemplo com Vite:

```js
server: {
  host: '127.0.0.1',
  port: 5173,
  strictPort: true,
  proxy: {
    '/api': 'http://127.0.0.1:3000',
    '/auth': 'http://127.0.0.1:3000',
    '/fotos': 'http://127.0.0.1:3000'
  }
}
```

No frontend, use `/api` como base. Para o Google retornar pelo proxy, configure o callback com porta 5173 nos dois lugares (Google Cloud e `.env.docker`). O callback termina em `/unidades` para gestor ou `/cliente/agendamentos` para cliente; essas rotas devem existir no frontend e consultar `/api/sessao`. CORS sozinho não muda o destino do callback. Se acessar o Google diretamente pela porta 3000, ele retorna às telas de demonstração.

## Sessão, login e chamadas

A autenticação usa cookie HTTP-only, não token no localStorage. Primeiro faça `GET /api/login`, guarde o `csrf` e envie-o no cabeçalho `X-CSRF-Token` em todas as alterações. Atualize o token quando a resposta trouxer outro, principalmente após login e logout. Use `credentials: 'include'` nas requisições. O cookie mantém a sessão por até duas horas de inatividade.

```js
const base = '/api'; // Com o proxy acima. Sem proxy: http://127.0.0.1:3000/api
let csrf;
async function api(path, body) {
  const response = await fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(csrf ? { 'X-CSRF-Token': csrf } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = await response.json();
  if (data.csrf) csrf = data.csrf;
  if (!response.ok) throw new Error(data.erro || 'Não foi possível concluir.');
  return data;
}
await api('/login');
await api('/login', { telefone: '71999990000', senha: 'GestorDemo@2026' });
const { unidades } = await api('/unidades');
```

## Rotas disponíveis

| Método | Rota | Uso |
| --- | --- | --- |
| GET / POST | /api/login | Obter CSRF / entrar |
| GET | /api/sessao | Perfil autenticado e CSRF |
| POST | /api/sair | Encerrar sessão |
| POST | /api/cadastro | Criar cliente: nome, telefone, senha |
| GET | /api/auth/google | Obter autorizacaoUrl para navegação completa |
| POST | /api/auth/google/vincular | Vincular Google à conta autenticada |
| GET / POST | /api/unidades | Consultar / cadastrar unidade (gestor) |
| POST | /api/unidades/:id | Editar unidade (gestor) |
| POST | /api/unidades/:id/situacao | Inativar ou reativar (gestor) |
| GET / POST | /api/profissionais | Consultar / cadastrar profissional (gestor) |
| POST | /api/profissionais/:id | Editar profissional (gestor) |
| POST | /api/profissionais/:id/situacao | Inativar ou reativar (gestor) |
| POST | /api/profissionais/:id/foto | Enviar JPEG/PNG binário, até 2 MB (gestor) |
| GET | /fotos/profissionais/:id | Ler foto enviada |
| GET / POST | /api/servicos | Consultar / cadastrar serviço (gestor) |
| POST | /api/servicos/:id | Editar serviço (gestor) |
| POST | /api/servicos/:id/situacao | Inativar ou reativar (gestor) |
| GET / POST | /api/horarios | Consultar / alterar turnos, pausas, bloqueios (gestor) |
| GET | /api/cliente/servicos | Serviços disponíveis (cliente) |
| GET | /api/cliente/unidades | Unidades compatíveis e distância opcional (cliente) |
| GET | /api/cliente/disponibilidade | Profissionais e horários livres (cliente) |
| POST | /api/cliente/resumo | Calcular preço/duração antes de reservar |
| GET / POST | /api/cliente/agendamentos | Histórico próprio / criar reserva |
| POST | /api/cliente/agendamentos/:id/cancelar | Cancelar reserva futura própria |
| GET | /api/gestao/historico | Histórico com filtros (gestor) |
| GET | /api/gestao/clientes?busca= | Buscar clientes (gestor) |
| POST | /api/gestao/atendimentos/avulso | Registrar atendimento já realizado (gestor) |
| POST | /api/gestao/atendimentos/:id/concluir | Concluir e registrar adicionais (gestor) |

O [contrato detalhado](outputs/integracao-frontend.md) contém os campos, parâmetros, formatos e exemplos de cada operação. IDs e preços são strings. O backend calcula o total; o frontend não deve decidir o preço da reserva. Erros retornam `{ erro }` e status HTTP. Respeite 401 (precisa entrar), 403 (sem permissão/CSRF), 409 (conflito), 413 (foto grande) e 429 (limite de tentativas).

Hoje existem os perfis CLIENTE e GESTOR. Operador aparece nos requisitos, mas não tem login/permissões separados nesta implementação. SMS foi retirado do fluxo. Distância é em linha reta e as unidades são fictícias. A equipe precisa concluir a integração visual conforme o Figma e testar em celular físico.

## Testes e apresentação

```sh
docker compose exec backend node --test --test-concurrency=1 test/*.test.js
```

Os testes criam schemas temporários no banco do projeto e removem somente esses schemas. Há um teste do seed que verifica repetição, preservação de senha, rollback e agendamento usando os exemplos. Confira também os dois logins no navegador, uma reserva, cancelamento e edição de um cadastro.

Antes da apresentação, execute o build no notebook, confirme `docker compose ps` com os dois serviços saudáveis e teste após parar e iniciar. Com as imagens já baixadas, use `docker compose up -d --no-build --pull never` para iniciar sem baixar/buildar novamente. O login Google continua dependendo de internet. Este Compose é para desenvolvimento e apresentação local.
