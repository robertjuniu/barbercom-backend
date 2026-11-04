# BarberCom

Fiquei com o backend e o banco de dados do BarberCom. Usei Node.js 24, Express e PostgreSQL 18. Deixei algumas telas em EJS para a gente testar o fluxo antes de ligar o frontend do Figma à API.

## Rodar com Docker

Abra o Docker Desktop e rode este comando na pasta do projeto:

```sh
docker compose up --build -d
```

O Compose sobe o banco e o backend. Na primeira vez, ele cria as tabelas e carrega unidades, profissionais, serviços e horários fictícios. Abra [a tela de login](http://127.0.0.1:3000/login) e use uma das contas abaixo.

| Perfil | Telefone | Senha de teste |
| --- | --- | --- |
| Gestor | 71999990000 | GestorDemo@2026 |
| Cliente | 71999990001 | ClienteDemo@2026 |

Para parar e manter os dados, use `docker compose stop`. A opção `-v` em `docker compose down -v` apaga os volumes.

## Ligar o frontend

A API fica em `http://127.0.0.1:3000/api`. Deixei os exemplos de login, rotas, cookies e configuração do Google no [guia de integração](INTEGRACAO.md). O frontend local pode usar a porta 5173. As telas que vamos entregar seguem o Figma.

Na parte do gestor, já dá para cadastrar unidades, profissionais e serviços, montar horários e registrar atendimentos. O cliente consegue escolher serviço, unidade e horário, agendar, cancelar e consultar o próprio histórico.

## Rodar no Windows sem Docker

Com Node.js 24 e PostgreSQL 18 instalados, rode:

```powershell
npm.cmd ci
npm.cmd run configurar
npm.cmd start
```

O script cria um banco separado na porta 55438 e grava o acesso em `work/acesso-local.txt`. A porta do backend aparece no terminal. Guarde o `.env` e os dados em `work/postgres-local/data` se quiser manter essa instalação.

## Testes e banco

Rodei os seis testes dentro do Docker e conferi os dois logins. Depois reiniciei os containers e verifiquei que a sessão e os cadastros continuavam lá. Também subi uma cópia limpa baixada do GitHub. [Como conferi o Docker](docs/validacao-docker.md).

O [modelo do banco](docs/modelagem.md) explica as tabelas. Os scripts SQL estão em `database/`. Para montar o ZIP de entrega no Windows, execute `scripts/empacotar.ps1`.
