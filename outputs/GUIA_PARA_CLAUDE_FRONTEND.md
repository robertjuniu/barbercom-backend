# BarberCom — instruções para o Claude implementar o frontend e integrar o backend

## Pedido que você deve executar

Para iniciar o ambiente, use primeiro `docker compose up --build -d` na raiz e leia `INTEGRACAO.md`. Ele informa portas, contas fictícias, persistência e configuração opcional do Google. As instruções de scripts Windows mais abaixo continuam como alternativa. No Compose o acesso de gestor com qualquer senha está desligado; use as contas documentadas.

Você vai implementar o frontend do projeto acadêmico BarberCom e integrá-lo ao backend fornecido no ZIP. O responsável por este pacote desenvolveu o backend e o banco; sua responsabilidade é entregar as telas funcionais de cliente e gestor, seguindo **exatamente o Figma da equipe**. Trabalhe até concluir a integração e os testes; não entregue apenas um plano ou telas com dados simulados.

Figma: https://www.figma.com/design/ncaTkGX5U0imx7fTDEmgop/Barber-Com

O Figma é a referência visual. `views/` e `public/style.css` do backend são uma demonstração funcional e **não são uma reprodução fiel certificada do Figma**. Não copie essa demonstração como desenho definitivo.

## Materiais necessários

- `BarberCom-backend.zip`, incluindo o contrato `outputs/integracao-frontend.md`, o relatório e este guia.
- Acesso de leitura ao Figma, com páginas de cliente e administrador, componentes, variantes e assets.
- Se o link não estiver acessível, peça ao integrante da equipe que forneça acesso ou os arquivos de referência. As exportações originais disponíveis com o responsável são `Barber Com (1).zip`, `Barber Com (2).zip` e `Barber Com (3).zip`. Elas contêm imagens de referência, não necessariamente código editável.
- Fontes e ícones originais, exportados ou identificados no Figma. O ZIP do backend contém o logo utilizado na demonstração, mas não garante todos os assets ou fontes do design.

Se não conseguir ler o Figma, avance na integração que independe dele, mas não invente telas nem declare fidelidade visual comprovada. Diga exatamente qual referência faltou.

## Fidelidade visual obrigatória

1. Antes de programar telas, inventarie todos os frames, estados, modais e variantes das páginas de cliente e admin. Registre nome do frame, rota planejada, medidas, fonte/pesos, cores, espaçamentos e assets.
2. Preserve tipografia, paleta, logo, ícones, tamanhos, alinhamentos, textos fixos, ordem dos elementos, cantos, sombras, menus e estados aprovados. Não redesenhe, não “modernize” e não troque por um template de dashboard.
3. Use componentes simples compartilhados para reproduzir os padrões do próprio Figma. Não adicione uma biblioteca visual que mude a aparência.
4. Não transforme as imagens das telas em uma página única clicável. Formulários, navegação, listas, seleção e botões devem funcionar com HTML/componentes reais e dados da API.
5. Compare a implementação com o frame original na mesma largura/altura. Faça capturas e comparação lado a lado ou sobreposição; corrija diferenças antes de declarar a tela pronta.
6. Se o Figma trouxer apenas frames móveis, mantenha essa composição nas telas correspondentes; em telas maiores, centralize ou siga as variantes existentes. Não invente uma versão desktop completamente diferente. Em larguras menores, adapte apenas o necessário para não cortar conteúdo, preservando hierarquia e proporções. Registre qualquer adaptação necessária.
7. Recursos que não tenham frame aprovado, como o registro de atendimento avulso, devem reutilizar os componentes existentes. Mantenha essas telas adicionais separadas e peça validação visual da equipe; não as apresente como se estivessem no Figma.
8. Mensagens dinâmicas de erro, carregamento, lista vazia e sucesso precisam funcionar. Use os padrões do design; não esconda falhas para manter uma captura bonita.

### Exceções funcionais já decididas pelo responsável

- **SMS foi retirado** para evitar custos. Cadastro cria CLIENTE diretamente, com nome, telefone e senha. Não implementar envio, código fictício, provedor pago nem afirmar que o telefone foi verificado. O frame de SMS do protótipo não deve bloquear o fluxo atual. Registre essa diferença funcional e preserve o restante do design.
- Unidades e coordenadas de Salvador são **fictícias para apresentação**. São dados dinâmicos, não texto fixo do layout. Use os dados da API.
- Na apresentação local, `DEMO_GESTOR=true` permite acesso administrativo com qualquer telefone numérico e senha preenchidos. No login por telefone do frontend de apresentação, é possível enviar `acesso: 'gestor-demo'` pelo mesmo botão do frame, sem acrescentar um botão ou seletor que não exista no Figma. Google é usado para testar CLIENTE. Ative esse comportamento somente quando `GET /api/login` informar `demoGestor: true`; com false, omita o parâmetro e use login normal. A API continua oferecendo login normal de cliente por telefone/senha, sem esse parâmetro.
- O Google institucional do responsável está vinculado ao CLIENTE **somente no banco local dele**. Esse vínculo e os dados pessoais não acompanham o ZIP. Não crie contas com emails de terceiros automaticamente na máquina do frontend.

## Subir e verificar o backend antes de integrar

Leia `README.md` e `outputs/integracao-frontend.md`. Reaproveite a arquitetura existente; não reescreva as regras em outro servidor.

```powershell
npm.cmd ci
npm.cmd run configurar
npm.cmd start
```

Requer Node.js 24 e PostgreSQL compatível com o projeto. O configurador local cria uma instância separada na porta 55438, aplica migrações de 001 a 005 e cria dados de demonstração. Não apaga cadastros existentes e não usa a instância padrão 5432. Em outro PostgreSQL, siga a instalação manual do README.

Uma instalação nova usa normalmente `http://127.0.0.1:3000`. O PC do responsável está configurado para `http://127.0.0.1:3001`. Leia o `.env` e confirme a URL exibida no terminal; não suponha uma porta fixa em todo ambiente.

Não envie `.env`, Client Secret Google, senhas, banco, logs ou cookies para o Claude, repositório ou pacote compartilhado. O dono preenche a configuração privada localmente. O ZIP contém apenas `.env.example`. Google exige credenciais válidas no novo ambiente; `outputs/configurar-google-e-sms.md` explica os passos, apesar do nome histórico do arquivo.

## Integração obrigatória da API

- Use `/api` para dados. A API e as páginas EJS compartilham as regras; não edite dados pelo HTML da demonstração.
- Faça GET `/api/login` para iniciar a sessão e obter `csrf`, `googleDisponivel`, `modoTeste` e `demoGestor`.
- Envie cookies com `credentials: 'include'`. Em POST, envie `X-CSRF-Token`. Depois de login, atualize o token com o novo `csrf`; consulte também GET `/api/sessao`.
- Não armazene senha, cookie ou token Google no localStorage. Não use perfil escolhido no navegador como autorização: o perfil vem da sessão do servidor.
- IDs são strings, valores monetários são strings decimais e indicadores administrativos são strings `"true"`/`"false"`. Não converta preços em float para decidir o total da compra; use o resumo do backend.
- `proximaRota` pode apontar para uma página da demonstração. Use o perfil e suas próprias rotas para mostrar o frontend; não redirecione cegamente para EJS.
- Trate 400/401/403/404/409/413/429/500/503 com mensagens legíveis. Não faça sucesso visual antes de receber a confirmação do servidor. Impedir duplo clique durante envio e manter os dados do formulário ao falhar.
- Prefira mesma origem com proxy. Se usar origens diferentes, configure `FRONTEND_ORIGIN` com a origem exata do frontend, sem barra final, e use o mesmo hostname nos dois lados. Não misture `localhost`, `127.0.0.1` e IP de rede. CORS não usa `*` com cookies.
- O contrato completo, incluindo payloads, está em `outputs/integracao-frontend.md`. Não invente endpoints a partir do nome da tela.

### Fluxo de cliente

1. Cadastro sem SMS: POST `/api/cadastro`, depois login.
2. Login: POST `/api/login`; consultar sessão e encaminhar CLIENTE ao fluxo do Figma.
3. Serviços: GET `/api/cliente/servicos`; permitir um ou mais serviços e impedir avanço sem seleção.
4. Unidades: GET `/api/cliente/unidades?servicos=IDs`. Para distância, acrescentar latitude/longitude consentidas ou um ponto fictício claramente identificado para apresentação. Mostrar as unidades retornadas, com todas as ofertas selecionadas; manter unidades sem coordenadas ao final quando houver origem.
5. Profissional/horário: GET `/api/cliente/disponibilidade`, com unidade, serviços e data; `profissional` é opcional para “sem preferência”. Não fabricar horários. As opções de profissionais vêm dos horários elegíveis retornados; se o frame exigir uma lista independente, verifique a informação disponível e alinhe uma alteração pequena na API, em vez de usar dados privados das rotas de gestor.
6. Resumo: POST `/api/cliente/resumo`; usar preço, duração e profissional devolvidos pelo servidor.
7. Reserva: POST `/api/cliente/agendamentos`; conflito 409 pede nova consulta de disponibilidade. Mostrar confirmação somente após 201.
8. Histórico: GET `/api/cliente/agendamentos`; cancelamento por POST `/api/cliente/agendamentos/:id/cancelar`. Manter cancelados identificados e não mostrar atendimentos de outros clientes.

### Fluxo de gestor

- Unidades, profissionais e serviços: listagem, cadastro, edição e mudança de situação conforme os frames. Preservar vínculos completos ao salvar; o contrato explica arrays e campos por unidade.
- Horários: GET/POST `/api/horarios`; turnos, pausas e bloqueios, incluindo edição e remoção. ID do vínculo não é ID do profissional. Respeitar conflitos e restrições de reservas abertas.
- Interruptores de situação devem atualizar somente o item confirmado, sem recarregar a tela inteira, perder posição da lista ou apagar seleções. Animações discretas, preservando aparência do Figma e preferência por movimento reduzido.
- Upload: POST `/api/profissionais/:id/foto`, corpo binário JPEG/PNG, até 2 MB, com cookie e cabeçalho CSRF; não usar multipart nesse endpoint. Exibir a `foto_url` devolvida e preservar a imagem anterior em falha.
- Histórico/avulso/adicionais: rotas `/api/gestao`, conforme contrato. Acesso exclusivo do gestor. Preços dos serviços vêm do banco; adicionais aceitam responsável por item. Não misturar avulso já realizado com reserva futura.

### Google: ponto importante para não abrir a demonstração por engano

GET `/api/auth/google` e POST `/api/auth/google/vincular` retornam `autorizacaoUrl`. Faça navegação da página inteira para ela. Vincular exige usuário já autenticado e senha original. Não tente abrir o Google por fetch de conteúdo ou validar tokens no frontend.

O callback é `/auth/google/callback`, sem `/api`. Hoje o backend termina o login com redirecionamento para `/unidades` ou `/cliente/agendamentos`, que são páginas EJS. Apenas configurar CORS **não troca esse destino pelo frontend**.

Escolha e teste uma solução de integração:

- Mesma origem via proxy: encaminhar `/api`, `/auth` e `/fotos` ao backend; as rotas de tela do frontend devem responder pelas páginas de destino. Inicie a sessão e o OAuth nessa mesma origem. Cadastre no Google o callback correspondente à origem pública do proxy.
- Origens separadas: se necessário, alinhar uma pequena configuração explícita de retorno no backend. O destino deve ser fixo/confiável e compatível com o perfil; não aceitar URL livre da query. Não mudar esse contrato sem documentar e testar.

No retorno ao frontend, consulte `/api/sessao` e carregue o usuário real. Teste sair e entrar novamente, cliente sem acesso a gestor e sessão preservada ao atualizar a página. Nunca marque o fluxo pronto se o Google terminar nas páginas EJS antigas.

## Responsividade e validação visual

O projeto deve ser um site utilizável no celular e no computador, mantendo os frames aprovados. Teste pelo menos 320, 375, 390, 430 e 1280 pixels de largura, além da dimensão exata de cada frame Figma.

Conferir: sem rolagem horizontal; textos completos; botões alcançáveis; modal com rolagem interna; teclado sem esconder a ação; campos de telefone/data/hora; imagens sem distorção; menus e rodapé sem cobrir conteúdo; orientação deitada; zoom de texto; foco e navegação por teclado. Não use `overflow-x:hidden` para disfarçar elementos cortados.

Antes de dar a tela por pronta, execute o fluxo completo. Uma captura com dados estáticos não comprova integração. Faça também um teste real em Android/Chrome e, se disponível, iPhone/Safari. A emulação de tela no PC não comprova teclado, permissões, upload da galeria, Google, GPS ou funcionamento do Safari real.

## Entrega esperada de você

1. Frontend funcionando e integrado, com instruções para instalar/iniciar e configurar o proxy.
2. Inventário de frames e tabela frame Figma → rota → API → situação.
3. Capturas da implementação nas dimensões do Figma, comparação visual e correções feitas. Não declarar “idêntico” sem essa conferência.
4. Registro dos testes de cliente e gestor, inclusive cadastro, Google, reserva, cancelamento, CRUD, conflitos, foto e histórico/avulso quando aplicável.
5. Resultado em celular real, identificando aparelho/navegador, ou indicação explícita de que ainda não foi testado fisicamente.
6. Lista curta de diferenças autorizadas (SMS removido, dados fictícios, demo de gestor) e pendências reais. Não criar mais diferenças por conveniência.
7. Código sem credenciais, banco de usuários, logs privados ou node_modules. Só chamar a entrega completa após conferir frontend, API, Figma e fluxo de apresentação juntos.

## Estado do backend no momento deste envio

Cinco testes principais passaram com PostgreSQL real, no projeto e na cópia do ZIP. Google real foi conferido localmente como gestor e depois como cliente; atualmente o Google institucional está no CLIENTE. Gestor de apresentação tem acesso separado no backend, condicionado à configuração. Cadastro funciona sem SMS. Coordenadas, upload e avulso foram implementados. A API está pronta para integrar, mas isso não certifica o frontend definitivo nem o funcionamento em celular físico.

As telas EJS de demonstração foram verificadas em larguras móveis no Edge do PC, sem transbordamento horizontal nos casos registrados em `outputs/verificacao-mobile.md`. Não são o aceite visual do Figma.
