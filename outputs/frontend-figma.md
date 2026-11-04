# Frontend do BarberCom

Fiquei com o backend e o banco. Deixei o Docker pronto para a gente integrar as telas de cliente e gestor. Para subir o projeto, use `docker compose up --build -d` na raiz. As portas, as contas de teste e os exemplos de requisição estão no [guia de integração](../INTEGRACAO.md).

## Telas

Vamos seguir as cores, fontes, ícones, espaçamentos e estados do [Figma do BarberCom](https://www.figma.com/design/ncaTkGX5U0imx7fTDEmgop/Barber-Com). As páginas EJS servem para testar as operações do backend. Para o atendimento avulso, se ainda faltar um frame, vamos combinar o visual antes de fechar a tela.

## Cliente

O cadastro pede nome, telefone e senha. Tirei a etapa de SMS para evitar custo. Depois do login, o fluxo é escolher os serviços, a unidade e o horário, revisar o resumo e confirmar a reserva. Use os horários e valores que a API devolve. Se outro cliente pegar o horário primeiro, consulte a disponibilidade de novo. No histórico, mantenha os cancelados identificados.

## Gestor

As telas usam a API de unidades, profissionais, serviços, horários e histórico. Ao editar um cadastro, envie a lista completa dos vínculos que devem ficar. Para editar horários, use o ID do vínculo entre profissional e unidade. A foto é enviada como JPEG ou PNG no corpo da requisição, com até 2 MB. Os exemplos de cada formulário estão no [contrato da API](integracao-frontend.md).

## Login

O Compose usa as contas fictícias do guia. Mantive o atalho de gestor desligado nessa configuração. Para entrar com Google pelo frontend, encaminhe `/api`, `/auth` e `/fotos` para o backend pelo proxy. Cadastre o callback na origem do frontend e confira a sessão no retorno. [Configuração do Google](configurar-google-e-sms.md).

## Conferência

Antes da apresentação, vamos testar o cadastro, os dois logins, uma reserva e um cancelamento, além dos cadastros do gestor e do histórico. Compare as telas com o Figma nas mesmas larguras. Já conferi a demonstração no Edge do PC. Para testar no aparelho, deixei os passos do [Android por USB](verificacao-mobile.md).
