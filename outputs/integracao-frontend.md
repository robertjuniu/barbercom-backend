# Integração do frontend BarberCom

Para iniciar com Docker, portas, contas de teste e configuração do ambiente, leia [INTEGRACAO.md](../INTEGRACAO.md). Este arquivo detalha o contrato das operações.

Backend Node.js 24 + Express + PostgreSQL. As páginas EJS são apenas uma demonstração; o frontend da equipe usa as rotas `/api`. A API e a demonstração compartilham as mesmas regras de cadastro. Endereço local: `http://127.0.0.1:3000`.

## Sessão e segurança

1. Faça `GET /api/login` com `credentials: 'include'` para obter o token `csrf` e o cookie de sessão.
2. Envie o token no cabeçalho `X-CSRF-Token` em todas as requisições POST.
3. Faça login e substitua o token pelo novo `csrf` da resposta; o login renova a sessão.
4. Consulte `GET /api/sessao` para obter `{ usuario: { id, nome, perfil }, csrf }`. Sem login, `usuario` é `null`.
5. Mantenha `credentials: 'include'` nas próximas chamadas. Não guarde senha ou cookie no localStorage.

Exemplo mínimo no frontend:

```js
const base = 'http://127.0.0.1:3000/api';
let csrf;
async function api(rota, dados) {
  const resposta = await fetch(base + rota, {
    method: dados === undefined ? 'GET' : 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(csrf ? { 'X-CSRF-Token': csrf } : {}) },
    body: dados === undefined ? undefined : JSON.stringify(dados)
  });
  const resultado = await resposta.json();
  if (resultado.csrf) csrf = resultado.csrf;
  if (!resposta.ok) throw new Error(resultado.erro);
  return resultado;
}
await api('/login');
await api('/login', { telefone: '71999990000', senha: 'SENHA_LOCAL' });
const { unidades } = await api('/unidades');
```

Prefira servir frontend e backend pela mesma origem usando um proxy de desenvolvimento. Se o frontend usar outra porta, configure `FRONTEND_ORIGIN=http://127.0.0.1:5173` no backend, sem barra final, e reinicie. Use o mesmo hostname nos dois lados (não misture `localhost` e `127.0.0.1`). O CORS permite somente a origem configurada e cookies; não utiliza `*`. Hospedagem entre sites diferentes exige configuração adicional de HTTPS/cookies e não faz parte do ambiente local entregue.

## Formato comum

- `Content-Type: application/json` para POST. Também são aceitos formulários URL-encoded nas rotas administrativas.
- IDs, preços, horários, dias e indicadores enviados nos cadastros são **strings**. Indicadores administrativos usam `"true"` ou `"false"`.
- IDs retornados pelo PostgreSQL são strings. Preços são decimais; não some valores monetários no frontend para decidir cobranças.
- Erros usam `{ erro: 'mensagem' }` e status 400, 401, 403, 404, 409, 413, 429, 500 ou 503.
- Cadastros administrativos bem-sucedidos retornam 200 com `{ mensagem, proximaRota, csrf }`. `proximaRota` é uma referência de navegação da demonstração; o frontend pode atualizar sua própria lista.
- Respostas de consulta administrativa incluem os registros e opções dos formulários. A API não devolve HTML ou hashes de senha.
- A sessão expira após duas horas de inatividade e é armazenada no PostgreSQL. `POST /api/sair` encerra a sessão.

## Login e Google

| Método e rota | Entrada / retorno |
| --- | --- |
| GET `/api/login` | `csrf`, `googleDisponivel`, `modoTeste`, `demoGestor` |
| POST `/api/login` | `{ telefone, senha }`; login de gestor ou cliente |
| GET `/api/sessao` | Usuário ativo e token CSRF |
| POST `/api/sair` | `{}` |
| GET `/api/auth/google` | `{ autorizacaoUrl }`; navegue a página inteira para esse endereço |
| POST `/api/auth/google/vincular` | `{ senha }` original, com usuário já autenticado; devolve `autorizacaoUrl` |

O callback fixo é `/auth/google/callback`, sem `/api`. Use o guia Google desta pasta para configurar. Google identifica a pessoa; o perfil vem da conta já cadastrada no BarberCom. Não há promoção automática a gestor e não há vinculação apenas por igualdade de email. A primeira vinculação exige login existente e senha original. Para novos clientes, faça primeiro o cadastro direto, sem SMS. Após o callback, a demonstração abre /unidades para gestor e /cliente/agendamentos para cliente. O frontend real consulta /api/sessao e encaminha ao seu próprio fluxo visual.

## Unidades, Profissionais e Serviços — somente gestor

| Método e rota | Entrada / retorno |
| --- | --- |
| GET `/api/unidades` | `{ unidades }` |
| POST `/api/unidades` | `{ nome, endereco, ativa: 'true' }` |
| GET `/api/unidades/:id/editar` | Formulário com os dados atuais |
| POST `/api/unidades/:id` | Mesmo corpo do cadastro |
| POST `/api/unidades/:id/situacao` | `{ ativa: 'false' }`; retorna `ativo` e `mensagem` |
| GET `/api/servicos` | `{ servicos, unidades, ofertas }` |
| POST `/api/servicos` | Exemplo abaixo |
| GET `/api/servicos/:id/editar` | Dados atuais e ofertas |
| POST `/api/servicos/:id` | Mesmo corpo do cadastro |
| POST `/api/servicos/:id/situacao` | `{ ativo: 'false' }` |
| GET `/api/profissionais` | `{ profissionais, unidades, servicos }` |
| POST `/api/profissionais` | `{ nome, foto_url: '', ativo: 'true', unidades: ['2'], servicos: ['1'] }` |
| GET `/api/profissionais/:id/editar` | Dados atuais e opções |
| POST `/api/profissionais/:id` | Mesmo corpo do cadastro |
| POST `/api/profissionais/:id/situacao` | `{ ativo: 'false' }` |

Exemplo de serviço em duas unidades:

```json
{
  "nome": "Corte",
  "ativo": "true",
  "unidades": ["2", "3"],
  "preco_2": "35.50",
  "duracao_2": "30",
  "preco_3": "40.00",
  "duracao_3": "35"
}
```

Ao editar, envie a lista completa de unidades/serviços a manter. Os vínculos omitidos são removidos ou inativados. Remover vínculo de unidade preserva seus turnos; reativá-lo é recusado se os turnos voltarem a conflitar. Foto aceita URL HTTPS opcional ou o caminho retornado pelo upload do próprio profissional; veja o fluxo de foto abaixo. Preços admitem ponto ou vírgula; a API sempre retorna preço do banco como decimal com ponto.

## Horários — somente gestor

`GET /api/horarios?vinculo=ID` devolve `vinculos`, `selected`, `turnos`, `pausas` e `bloqueios`. Sem o filtro, seleciona o primeiro vínculo ativo. Use os IDs de `vinculos`, não o ID do profissional.

Todas as gravações usam `POST /api/horarios`:

```json
{ "vinculo": "1", "tipo": "turno", "dias": ["1", "2"], "inicio": "09:00", "fim": "18:00" }
```

```json
{ "vinculo": "1", "tipo": "pausa", "turno": "1", "descricao": "Almoço", "inicio": "12:00", "fim": "13:00" }
```

```json
{ "vinculo": "1", "tipo": "bloqueio", "descricao": "Feriado", "data": "2026-11-02", "motivo": "FERIADO", "dia_inteiro": "true" }
```

Use `motivo: 'INDISPONIBILIDADE'` para outro bloqueio. Para bloqueio parcial, use `dia_inteiro: 'false'`, `inicio` e `fim`. Dias: segunda = 1, domingo = 7. Intervalos ficam no mesmo dia.

Para editar um registro, envie o mesmo corpo com `id`. A edição de turno aceita um único dia. Para remover, envie `{ vinculo, tipo, id, remover: 'true' }`; remova pausas antes do turno. As opções de edição/remoção já estão no backend, mas ainda não estão expostas nas páginas EJS de demonstração.

Há bloqueio conservador de alterações de jornada quando o vínculo tem reservas em aberto. Resolva os agendamentos antes de alterar a jornada. Turnos entre unidades são verificados em transação, inclusive ao reativar vínculos antigos.

## Localização e distância

POST `/api/unidades` e POST `/api/unidades/:id` aceitam `latitude` e `longitude` como strings decimais com ponto (até 8 casas). São opcionais, mas devem vir juntas. Limites: latitude de -90 a 90, longitude de -180 a 180. Campos vazios removem o par. Em edição via API, omitir os dois preserva o par se o endereço não mudou; mudar endereço sem novas coordenadas limpa o ponto antigo.

GET `/api/cliente/unidades?servicos=1,2&latitude=-12.97&longitude=-38.50` continua filtrando as unidades que oferecem todos os serviços e devolve `distanciaKm` numérica, ordenada da menor para a maior. Unidades sem coordenadas têm `distanciaKm: null` e vêm no fim. Sem localização do cliente, todas têm distância null e são ordenadas por nome. Coordenadas incompletas ou inválidas retornam 400. A resposta inclui `criterio: 'distancia_em_linha_reta'` ou `'nome'`.

O frontend deve pedir autorização antes de obter localização pelo navegador e enviar apenas para este backend. O backend não armazena a localização do cliente nem chama mapas. A distância é aproximada em linha reta, não trajeto de carro. Na apresentação, os pontos das três unidades são fictícios e já vêm no arquivo database/unidades-demonstracao.json. Não há geocodificação automática de endereço.

## Upload de foto do profissional

1. Cadastre o profissional e obtenha seu ID em GET `/api/profissionais`.
2. Envie POST `/api/profissionais/:id/foto` autenticado como gestor, com `X-CSRF-Token`. O corpo é o próprio arquivo, não JSON nem multipart; `Content-Type` é `image/jpeg` ou `image/png`.
3. A resposta 200 inclui `{ mensagem, foto_url: '/fotos/profissionais/ID' }`. Use a URL do backend no elemento img.

```js
const resposta = await fetch(base + '/profissionais/' + profissionalId + '/foto', {
  method: 'POST', credentials: 'include',
  headers: { 'Content-Type': arquivo.type, 'X-CSRF-Token': csrf },
  body: arquivo
});
const resultado = await resposta.json();
if (!resposta.ok) throw new Error(resultado.erro);
```

Máximo de 2 MB e 16 milhões de pixels. O servidor decodifica JPEG/PNG, rejeita outros formatos/animações e reconverte para JPEG de até 512 px por lado, sem metadados do original. Arquivo inválido retorna 400, excesso de tamanho 413, profissional inexistente 404 e cliente sem permissão 403. A foto anterior permanece se o envio falha. GET `/fotos/profissionais/:id` é leitura pública da foto de catálogo do profissional, servida como image/jpeg. A imagem fica no PostgreSQL; faça backup do banco para transportá-la. Ao editar os demais dados, preserve `foto_url` recebida; envie vazio se quiser deixar sem foto no catálogo. Na demonstração, o envio aparece ao editar um profissional já salvo.

## Cadastro do cliente sem SMS

- POST `/api/cadastro`: `{ nome, telefone, senha }`. Telefone nacional com DDD, somente 10 ou 11 dígitos. Senha de 12 a 256 caracteres.
- Retorna 201 e cria somente perfil CLIENTE ativo. Não inicia sessão; faça login depois. `perfil`, `ativo` e `google_sub` enviados pelo navegador são ignorados.
- Retorna 400 para dados inválidos e 409 para telefone já cadastrado. Duplicatas são impedidas pelo banco.
- SMS e `/api/cadastro/confirmar` foram retirados por decisão do responsável. O telefone não tem posse verificada; não descreva esse cadastro como verificação de identidade.
- A demonstração oferece GET/POST `/cadastro` e uma área mínima `/cliente/agendamentos`. Ela não substitui as telas do frontend da equipe.

### Gestor de apresentação

O `.env.example` traz `DEMO_GESTOR=false`. Na instalação local, o responsável pediu `true`. Quando habilitado, POST `/api/login` com `{ telefone: '123', senha: '123', acesso: 'gestor-demo' }` abre a primeira conta GESTOR ativa, sem criar usuários e sem trocar o perfil de clientes. Telefone e senha devem estar preenchidos. Sem esse parâmetro, vale o login normal com senha; clientes também podem usar Google. `GET /api/login` informa `demoGestor`.

No navegador, use o botão **Entrar como gestor de demonstração**. Esse acesso dá controle administrativo a qualquer pessoa com acesso à aplicação; mantenha somente na apresentação local.

## Agendamento do cliente

Requer login de cliente ativo. O gestor usa as rotas de gestão, não as rotas particulares do cliente.

| Método e rota | Entrada / retorno |
| --- | --- |
| GET `/api/cliente/servicos` | Ofertas ativas de serviços, com unidade, preço e duração |
| GET `/api/cliente/unidades?servicos=1,2` | Unidades que oferecem todos os serviços |
| GET `/api/cliente/disponibilidade?unidade=2&servicos=1,2&data=2026-12-01` | Resumo de valores e horários disponíveis em passos de 15 minutos; profissionais elegíveis |
| GET mesma rota com `&profissional=1` | Filtra por profissional; omita para sem preferência |
| POST `/api/cliente/resumo` | Corpo abaixo; revalida e devolve itens, preço, duração e profissional sem reservar |
| POST `/api/cliente/agendamentos` | Mesmo corpo; revalida novamente, reserva e retorna 201 |
| GET `/api/cliente/agendamentos` | Histórico particular, inclusive cancelados |
| POST `/api/cliente/agendamentos/:id/cancelar` | `{}`; cancela reserva futura confirmada do próprio cliente |

```json
{ "unidade": "2", "servicos": ["1"], "data": "2026-12-01", "hora": "10:00", "profissional": "1" }
```

Para sem preferência, omita `profissional`. O servidor escolhe um profissional elegível. Datas/horários de negócio usam `America/Bahia`; valores retornados sem fuso representam horário local da barbearia. Serviços e valores são recalculados no servidor; nenhuma cobrança enviada pelo frontend é aceita. Nome, preço e duração ficam registrados como estavam na reserva. Cancelar preserva o histórico e libera o intervalo. Reservas simultâneas do mesmo profissional ou cliente são revalidadas sob bloqueios no banco.

## Histórico e conclusão — gestor

- GET `/api/gestao/historico`: filtros opcionais `cliente`, `unidade`, `inicio=YYYY-MM-DD`, `fim=YYYY-MM-DD`; até 500 registros por consulta. Inclui cancelados.
- POST `/api/gestao/atendimentos/:id/concluir`: `{ adicionais: [{ nome: 'Hidratação adicional', preco: '5.00' }] }`. Apenas atendimento confirmado cujo fim já passou; soma adicionais em decimal e marca como concluído. Não permite concluir duas vezes. Cada adicional pode informar profissional responsável, conforme a seção abaixo.

## Limites da integração

Contrato e fluxos foram exercitados por testes HTTP com PostgreSQL real. A integração com o frontend da equipe e o teste em celular físico continuam pendentes. Google exige credenciais próprias; o cadastro atual não usa SMS. Distância em linha reta, upload de foto, atendimento avulso e responsáveis por item estão implementados nas rotas descritas neste guia. Não há paginação completa do histórico; use filtros. Existem os perfis CLIENTE e GESTOR; não há acesso separado de operador. Este projeto é para desenvolvimento e apresentação local.

## Atendimento sem agendamento e responsáveis — gestor

GET `/api/gestao/clientes?busca=Robert` busca por nome ou telefone (de 2 a 120 caracteres), somente clientes ativos, até 50 resultados `{ clientes: [{ id, nome, telefone }] }`. A busca exige sessão de gestor.

POST `/api/gestao/atendimentos/avulso` registra um atendimento **já realizado** e retorna 201 com `{ atendimento: { id, status: 'CONCLUIDO', origem: 'AVULSO', valor_total } }`.

```json
{
  "cliente": "2",
  "unidade": "1",
  "profissional": "1",
  "inicio": "2026-10-20T10:00:00",
  "servicos": ["1"],
  "adicionais": [{ "nome": "Acabamento", "preco": "5.00", "profissional": "2" }]
}
```

`inicio` usa data e hora local de Salvador/Bahia, sem Z/fuso, segundos 00. Selecione de 1 a 20 serviços ativos distintos; preços e duração vêm das ofertas atuais da unidade. O cliente, a unidade, o profissional e seu vínculo devem estar ativos; o profissional deve estar habilitado para os serviços. O fim calculado deve ter passado e ficar no mesmo dia. Não exige um turno previamente cadastrado: é registro de serviço efetivamente realizado. Não cria senha, cliente ou reserva futura automaticamente.

Adicionais são opcionais, até 20, com nome e preço decimal string. O responsável é opcional; sem ele vale o profissional principal. Quando informado, precisa estar ativo e vinculado à mesma unidade. Os responsáveis por itens vêm no histórico como `profissionalId` (string) e `responsavel` (nome). O campo `origem` distingue AVULSO de AGENDAMENTO tanto no histórico do gestor quanto no do cliente.

Horários conflitantes do cliente ou de qualquer responsável são recusados com 409. Duas requisições simultâneas do mesmo atendimento produzem uma inclusão e uma rejeição. Qualquer falha desfaz atendimento e itens; limite monetário total de R$ 99.999.999,99. Não é uma fila de chegada; a duração base vem dos serviços e os adicionais não estendem o intervalo.

POST `/api/gestao/atendimentos/:id/concluir` também aceita `adicionais` com profissional por item, nas mesmas regras; só conclui reserva confirmada cujo fim já passou. O frontend deve consultar a lista atualizada após concluir. Históricos preservam preços e nomes dos serviços, mesmo que o catálogo seja alterado.

Na demonstração, abra **Histórico → Registrar atendimento sem agendamento**. O formulário expõe um adicional; a API aceita até 20. A lista simplificada oferece os primeiros 100 clientes ativos; o frontend definitivo deve usar a busca. O histórico retorna no máximo 500 registros; use os filtros existentes.
