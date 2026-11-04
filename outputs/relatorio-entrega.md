# Relatório de entrega BarberCom

## Ambiente Docker, 04/11/2026

Incluídos `docker-compose.yml`, Dockerfile, seed automático e `INTEGRACAO.md` na raiz. A execução foi validada em Docker Desktop com banco vazio, seis testes dentro do container, dois logins pela porta 3000 e reinício preservando a sessão e os cadastros. O banco usa conta própria sem superusuário e não publica porta externa. Google inicia desabilitado e o atalho de qualquer senha fica desligado. A configuração antiga do Windows não foi copiada. Evidências e limites em `docs/validacao-docker.md`. Código público: https://github.com/robertjuniu/barbercom-backend.

O texto abaixo registra as verificações anteriores. Onde indicar cinco testes, a rodada Docker atual passou em seis. A integração visual com o frontend final e o teste em celular físico continuam pendentes.

Atualizado em 28/10/2026. API Node.js/Express/PostgreSQL e demonstração EJS. Este relatório substitui avaliações anteriores restritas às quatro telas administrativas.

| Requisito | Implementação e evidência | Situação |
| --- | --- | --- |
| Login/perfis | Telefone/senha, gestor/cliente, sessão no PostgreSQL, CSRF, conta ativa | API e navegador testados; gestor tem atalho de apresentação local |
| Google | OAuth, PKCE, state, nonce, token oficial e vinculação com senha original | Gestor e cliente comprovados no Edge; atualmente conta institucional vinculada ao CLIENTE |
| Cadastro de cliente | Nome, telefone, hash da senha e perfil CLIENTE obrigatório | Cadastro sem SMS testado; alteração de requisito autorizada pelo responsável |
| Unidades | Cadastro, edição, consulta, inativação/reativação | API e demonstração testadas |
| Profissionais | Operações, vínculos, reativação conflitante recusada | API e demonstração testadas |
| Serviços | Operações, preço/duração por unidade | API e demonstração testadas |
| Horários | Turnos, pausas, bloqueios, edição/remoção e conflitos | API testada; demonstração só consulta/cadastro |
| Serviços/unidade | Ofertas ativas e unidade que oferece todos os serviços | API testada; ordenação por distância em linha reta implementada |
| Profissional/sem preferência | Vínculo, habilitação e jornada elegíveis | API testada |
| Resumo | Itens, preço e duração calculados no servidor | API testada |
| Reserva | Revalidação e bloqueios contra reserva simultânea | API testada |
| Cancelamento | Reserva futura do próprio cliente, histórico preservado | API testada |
| Histórico | Cliente e gestor, filtros e cancelados | API testada; até 500 registros |
| Atendimento/adicionais | Conclusão, avulso e responsáveis pelos serviços/adicionais | API testada; avulso e responsável por item implementados |
| Foto do profissional | Upload JPEG/PNG, validação, conversão e armazenamento no banco | Testes HTTP e formulário disponível |
| Banco e documentação | SQLs, relacionamentos, instruções e contrato | Incluídos |

SP07 consolidada em 28/10/2026: `docs/modelagem.md` substitui a versão inicial. PDF para anexar ao Trello: `SP07-modelagem-banco.pdf`; versão editável: `SP07-modelagem-banco.md`; diagrama completo editável: `SP07-diagrama-banco.mmd`. Os três estão em outputs e no pacote. Foram conferidos 15 tabelas, 78 campos e 15 FKs nos metadados reais, sem consultar ou alterar cadastros. A documentação distingue regras SQL, regras do backend e a tabela legada de SMS; a aprovação formal continua com equipe/professor.

Comparado às User Stories, Critérios de Aceitação e documentação nova de telas da equipe. O recorte de quatro telas não elimina os demais itens da especificação.

## Validação

Cinco testes principais com diversas verificações: hash, páginas administrativas e integração API. PostgreSQL real; schemas aleatórios isolam e removem dados fictícios.

Verificados preço por unidade, rollback, validações, permissões, CSRF, escape HTML, reativação conflitante, sessão em segunda instância, reserva simultânea com uma aceitação, edição/remoção de agenda e CORS restrito. npm audit desta rodada não encontrou vulnerabilidades conhecidas.

Os testes automatizados não comprovam Google real, SMS no aparelho, frontend da equipe, celular ou produção. Separadamente, nesta revisão o projeto BarberCom e a credencial OAuth foram criados no Google Cloud e o teste real de gestor foi concluído no Edge: consentimento com identificação básica, vinculação da conta institucional, saída da sessão e novo acesso usando somente Google, retornando à área de unidades. Depois, por decisão do responsável, o vínculo Google foi transferido para uma nova conta CLIENTE. O novo login real Google abriu /cliente/agendamentos e o acesso à gestão foi recusado. A rejeição de outra identidade Google sem vínculo ainda precisa de teste real.

O teste do navegador revelou o bloqueio do redirecionamento do formulário pela Content Security Policy. A correção permite apenas o domínio de autenticação Google quando a integração está habilitada. Testes cobrem a política com e sem Google. O comando de teste agora seleciona somente `test/*.test.js`, evitando executar novamente cópias extraídas do pacote em `work`.

## Entregar à equipe

Envie `BarberCom-backend.zip`, com fontes, SQLs, testes, package-lock, `.env.example` e guias. O frontend usa `integracao-frontend.md`; não precisa usar EJS. Não compartilhe senhas ou dados locais.

O pacote inclui `GUIA_PARA_CLAUDE_FRONTEND.md`, com exigência de fidelidade visual ao Figma e integração completa dos perfis, e `verificacao-mobile.md`, com os limites da simulação e os passos do teste físico. O Figma e seus assets originais devem estar acessíveis ao responsável pelo frontend; não é correto usar as páginas EJS como reprodução aprovada. Atenção à integração Google: o callback ainda encaminha às rotas da demonstração; o frontend definitivo precisa tratar esse destino com proxy da mesma origem ou alteração documentada de retorno.

## Antes de declarar entrega final completa

1. Testar outra identidade Google sem vínculo; gestor e cliente já foram validados. Em outro computador, configurar credenciais próprias.
2. Confirmar com a equipe a retirada do requisito SMS. O responsável decidiu não usar envio pago; o cadastro não verifica a posse do telefone.
3. Integrar ao frontend real, incluindo erros, sessão e perfis.
4. Para a apresentação, usar as coordenadas fictícias de Salvador já cadastradas. Não representam estabelecimentos reais. Distância em linha reta, upload, avulso e responsáveis por item estão implementados.
5. Conferir telas no navegador/celular e controles de edição/remoção da agenda no frontend.

Configuração de entrega deve usar senha real (ALLOW_ANY_PASSWORD=false). Aplicação continua local; publicação exige validação adicional.

## Conferência do pacote e endereço atual

O ZIP foi extraído em pasta de validação separada, instalado com npm ci e testado novamente: cinco testes principais passaram. A inspeção dos arquivos confirmou ausência de credenciais locais, banco e node_modules. O pacote usa uma lista explícita de fontes, guias e testes, sem dados locais.

A demonstração atual desta sessão está em http://127.0.0.1:3001, com login normal de cliente, Google configurado e atalho de demonstração do gestor. Banco e aplicação foram iniciados novamente. O `.env` local usa a porta 3001. A porta padrão do pacote novo continua 3000.

Ao configurar Google para a instância temporária 3001, cadastre `http://127.0.0.1:3001/auth/google/callback` no Cloud e no GOOGLE_REDIRECT_URI. O guia usa a porta padrão 3000; escolha um único endereço e mantenha os dois lados iguais.

## Revisão: cliente e apresentação sem SMS

O cadastro público agora cria diretamente CLIENTE; não aceita elevação de perfil, não grava Google por dados enviados no formulário e impede duplicatas de telefone. Senha curta é recusada. A rota de código SMS e o adaptador Twilio foram removidos; a tabela legada verificacao_telefone foi preservada sem uso, para não apagar dados de instalações anteriores.

O login HTML deixou de ser exclusivo do gestor. Clientes chegam à sua área mínima, com agendamentos particulares e vínculo Google; o frontend definitivo continua sendo responsabilidade da equipe. A API preserva cadastro, serviços, disponibilidade, reserva, cancelamento e histórico do cliente.

DEMO_GESTOR=true está ativo somente nesta configuração local por pedido do responsável. O botão de demonstração aceita telefone 123/senha 123 (ou outros valores preenchidos), usa o gestor existente e mantém os dados. Isso permite acesso administrativo sem senha válida e não deve ser publicado. ALLOW_ANY_PASSWORD continua false para o login normal. A configuração de exemplo no ZIP usa DEMO_GESTOR=false.

Testes desta revisão: cadastro sem provedor, validação de senha, tentativa de criar GESTOR ignorada, duplicata 409, confirmação SMS 404, cliente no HTML/API, retorno da conta, acesso negado entre perfis e modo gestor habilitado/desabilitado. Os cinco testes principais passaram. Conferência manual no Edge: cadastro, gestor com 123/123, saída, Google institucional como CLIENTE, gestão recusada.

## Complementos implementados em 28/10/2026

- Migração 005 aditiva: coordenadas das unidades, foto em bytea, origem do atendimento e profissional por item. Reaplicável sem apagar registros; itens anteriores recebem o profissional original.
- Distância em linha reta, sem API paga: coordenadas opcionais validadas; unidades compatíveis ordenadas por proximidade, sem ponto ao final. Sem localização do cliente, ordem por nome. Nenhuma coordenada de cliente é persistida. A pedido do responsável, as três unidades receberam coordenadas fictícias de Salvador, com endereços identificados como barbearia fictícia. O arquivo database/unidades-demonstracao.json reproduz esses pontos em instalações novas.
- Upload JPEG/PNG de até 2 MB: decode real, limite de pixels, JPEG reduzido, sem metadados; falha não substitui imagem anterior. Leitura pública somente da foto de catálogo do profissional.
- Atendimento avulso concluído: cliente existente, serviços e preços do banco, período já realizado, validação do profissional, responsáveis diferentes em adicionais, conflitos e concorrência. Total exato e rollback integral.
- Histórico HTML habilitado, com formulário básico de avulso; formulário de unidade tem coordenadas e edição de profissional tem envio de foto. Esses controles são demonstração, não alteram o contrato com o frontend da equipe.

Cinco testes principais passaram, incluindo os fluxos anteriores e os novos casos: coordenadas inválidas/ausentes, zero e distância conhecida; ordenação com unidades sem ponto; foto inválida/sem CSRF/sem permissão/acima do tamanho; preservação da foto; avulso futuro/data inexistente/responsável inválido; concorrência com 201 e 409; responsável de adicional ocupado; histórico do cliente; formulário HTML; limite monetário e rollback. Auditoria de dependências: nenhuma vulnerabilidade conhecida nesta rodada.

Limites restantes: integração com frontend real, celular, recuperação de senha, outra identidade Google não vinculada e implantação pública não validados. Atendimento avulso é histórico de serviço realizado, não recepção/fila em tempo real. Distância não é rota viária e não inclui mapa. Fotos fazem parte do backup do banco.

Verificação adicional de layout no Edge do PC: unidades, edição de profissional, horários e histórico em 320/375/390/430 px; login, cadastro, cliente sem agendamentos e formulário avulso aberto em 320/390 px. Sem transbordamento horizontal nos estados observados. Isso não comprova fidelidade ao Figma nem funcionamento de teclado, upload, Google e permissões em Android/iPhone físico. Nenhum aparelho apareceu em adb devices nesta conferência.

## Localizações fictícias para a apresentação

As unidades usam referências de vias de Salvador, com pontos aproximados inventados para demonstrar a ordenação. Não afirmam a existência de barbearias nesses locais. Campo da Pólvora: Av. Joana Angélica (-12.9805, -38.5085); Barra: Av. Oceânica (-13.0095, -38.5305); Federação: Rua Caetano Moura (-13.0005, -38.5055). Situações e vínculos foram preservados. A aplicação local foi atualizada; o preparador só cria esses exemplos quando o banco não tem unidades, sem substituir cadastros existentes.

Conferência: partindo do ponto fictício da Barra, a unidade Barra resulta em 0 km e Federação em aproximadamente 2,89 km em linha reta. A unidade inativa não aparece na escolha do cliente. Não foi consultada nem armazenada a localização real do usuário.
