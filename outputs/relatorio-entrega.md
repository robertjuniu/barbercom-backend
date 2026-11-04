# Entrega do backend BarberCom

Preparei a API, o banco e o Docker Compose. Ao subir o projeto pela primeira vez, o banco carrega três unidades fictícias de Salvador, quatro profissionais, dois serviços e horários para testar reservas. Deixei uma conta de gestor e outra de cliente no [guia de integração](../INTEGRACAO.md).

| Parte | O que implementei |
| --- | --- |
| Acesso | Login de gestor e cliente, cadastro sem SMS e opção de vincular conta Google |
| Cadastros | Unidades, profissionais, serviços, preços por unidade e foto do profissional |
| Agenda | Turnos, pausas, bloqueios e verificação de conflitos |
| Cliente | Escolha de serviço, unidade e horário, resumo, reserva, cancelamento e histórico |
| Gestor | Histórico com filtros, conclusão e registro de atendimentos avulsos com adicionais |
| Banco | Migrações SQL, modelo e diagrama das tabelas |

Rodei os seis testes dentro do Docker. Conferi os dois logins e reiniciei os containers para verificar se os cadastros e a sessão continuavam disponíveis. Fiz o mesmo build em uma cópia limpa do GitHub. [Registro dos testes](../docs/validacao-docker.md).

Também testei o Google no ambiente local anterior. Para ativar no Docker, configure a credencial e o endereço de retorno. [Passos para configurar o Google](configurar-google-e-sms.md).

Deixei o código, as migrações e os guias no [repositório do projeto](https://github.com/robertjuniu/barbercom-backend). O [modelo do banco](../docs/modelagem.md) e o contrato da API acompanham o pacote.
