# Validação do Docker

Fiz estes testes em 04/11/2026 no meu computador, com Docker Desktop e containers Linux.

O comando `docker compose up --build -d` criou o PostgreSQL 18, aplicou as migrações 001 a 005, preparou os exemplos e iniciou o backend Node.js 24. Os dois serviços ficaram saudáveis. A aplicação respondeu em http://127.0.0.1:3000 e o banco não publicou uma porta no Windows.

Os seis testes passaram tanto no PostgreSQL local quanto dentro do container. O teste novo verificou que repetir o seed não duplica unidades, profissionais ou turnos, não muda senhas existentes e preserva reservas. Também testou agendamento com os serviços e horários dos exemplos, pausa de almoço, permissões dos perfis e rollback quando um telefone já pertence a outro perfil.

Conferi os dois logins, o catálogo do cliente e as páginas administrativas pela porta do Docker. Também confirmei que o cliente não consegue acessar a gestão. Google e acesso de gestor sem senha válida ficaram desligados, conforme o Compose.

Após reiniciar banco e backend, a sessão de gestor continuou válida. O banco manteve 3 unidades, 4 profissionais, 2 serviços, 28 turnos e 2 contas. A conta PostgreSQL da aplicação não é superusuária e não pode criar bancos ou roles. A imagem não contém o `.env` local nem o histórico Git.

O volume de banco e o volume do segredo de sessão são independentes da instalação anterior do Windows. A publicação foi conferida para excluir credenciais locais, dados do banco, capturas de contas e anexos recebidos no chat.

Clonei uma cópia do GitHub e subi em outro projeto Compose, com volumes vazios e porta 3002. O build e a inicialização também funcionaram nessa cópia, sem usar o `.env` ou o banco locais anteriores.

Ainda precisam ser testados o frontend definitivo da equipe, o fluxo Google com credenciais próprias deste ambiente, celular físico e execução no notebook que será usado na apresentação. Este teste foi neste PC; não comprova funcionamento em qualquer máquina ou implantação pública.
