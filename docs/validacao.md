# Validacao da primeira parte

Data: 27/10/2026.

Comando executado: `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\testar-banco.ps1`.

Resultado: passou em PostgreSQL 18.6. As 10 tabelas foram criadas em uma instancia temporaria. A instancia foi encerrada ao final. O PostgreSQL existente nao foi usado pelo teste.

## O que foi conferido

- Cadastro de duas unidades, um profissional, um servico e suas ofertas.
- Precos diferentes para o mesmo servico em duas unidades.
- Vinculo de profissional com unidade e servico.
- Registro de turno, pausa, bloqueio de dia inteiro e bloqueio parcial.
- Inativacao de unidade mantendo seus vinculos.
- Rejeicao de 12 operacoes invalidas: nome vazio, telefone invalido, perfil invalido, preco negativo, duracao zero, dia da semana invalido, turno invertido, pausa sem duracao, bloqueio incompleto, vinculo duplicado, referencia inexistente e exclusao de unidade referenciada.

Os dados ficticios do teste foram revertidos ao final. O teste nao cobre telas, login, permissao de acesso, sobreposicoes de horarios nem conexao da futura aplicacao; essas partes ainda nao existem.

## Segunda parte realizada em 27/10/2026

A aplicacao agora implementa login de gestor e Unidades. O resultado acima descreve somente a primeira parte.

- `npm.cmd test`: 2 testes passaram. O teste de integracao executa o ciclo HTTP completo em PostgreSQL real, em um schema isolado removido ao final. Inclui login correto/incorreto, renovacao de sessao, permissoes, conta inativa, CSRF, validacao, escape de HTML, cadastro, edicao, inativacao, reativacao, logout, limite de tentativas e entrega de recursos estaticos.
- `npm.cmd audit --omit=dev --audit-level=high`: nenhuma vulnerabilidade conhecida reportada nas dependencias instaladas nesta verificacao.
- `npm.cmd run configurar` executado novamente sem sobrescrever credenciais e cadastros.
- A aplicacao foi reiniciada; as 3 unidades de demonstracao permaneceram no banco.
- Depois de reiniciar, `/login` e `/referencia-login.png` retornaram HTTP 200.
- A instancia PostgreSQL original, na porta 5432, continuou aceitando conexoes. A aplicacao usa exclusivamente a instancia com senha na porta 55438 e uma conta sem privilegios de superusuario.
- `.env`, arquivos de acesso e `work/` foram conferidos como ignorados pelo Git.

O login foi aberto no Edge. O controle de interface foi interrompido pela ferramenta por falta de confianca na identificacao da URL da janela do Windows. Por isso, a navegacao visual completa, o resultado final do CSS e a conferência em celular nao foram validados nesta etapa. A marca usa a referencia visual enviada pela equipe; a exportacao do PNG isolado ainda esta pendente.

O servidor local permanece em http://127.0.0.1:3000. Instrucoes de teste estao em `outputs/guia-teste.md`; as credenciais locais de demonstracao ficam em `outputs/acesso-local.txt`, ignorado pelo Git.

## Terceira parte realizada em 27/10/2026

- ZIP `(2)` forneceu o logotipo PNG original com transparência; ZIP `(3)` forneceu as referências administrativas. São recursos e referências visuais, não código pronto de backend.
- Profissionais e Serviços foram implementados com as tabelas já existentes. Não houve mudança de schema ou remoção de cadastros existentes.
- Testes HTTP ampliados: múltiplas unidades, preços e duração por unidade, associação de profissionais, validação de referências inexistentes, URL de foto, inativação e reativação, acesso sem login, preservação de vínculos antigos e turnos, e reversão da operação inteira quando o banco rejeita uma gravação intermediária.
- O teste de reversão cria uma restrição apenas no schema descartável para simular uma falha; a aplicação retorna erro genérico sem expor a mensagem do banco, preservando nome e associações anteriores. A mensagem de log `23514` nessa simulação é esperada.
- Conferência no Edge: navegação entre telas; seleção de unidade exibindo preço/duração no formulário de Serviço; fechamento via Escape; abertura e gravação da edição de um profissional com mensagem de sucesso.
- Capturas salvas em `outputs/servicos.png` e `outputs/profissionais.png`. A aba da demonstração ficou aberta para conferência do usuário.
- Fotos usam URL HTTPS opcional e iniciais quando ausentes. Upload de foto e agenda não foram implementados nesta parte. A conferência em celular físico segue pendente.

## Animacoes e alternancia sem recarregar em 27/10/2026

- Inativar e reativar agora usa POST com resposta JSON e atualiza somente o cartão. A resposta HTML tradicional continua disponível para uso sem JavaScript.
- Os testes HTTP conferem as respostas JSON, a gravação no banco e os fluxos antigos. `npm.cmd test`: 2 testes passaram, incluindo o fluxo integrado de três telas.
- Na página aberta no navegador interno, Unidade Barra e Unidade Federação foram inativadas e reativadas. Os estados originais foram restaurados.
- A posição superior do elemento principal antes e depois de alternar a Unidade Federação permaneceu exatamente em -230.40000915527344 px; o documento não voltou ao topo.
- Conferida a navegação para Profissionais. O navegador carregou os nomes de View Transition `screen` e `menu` e transições de cor dos botões de 0,24 segundo.
- A troca de telas usa View Transitions nativas, com deslizamento e fade. Botões mostram interruptor animado; formulários têm entrada suave. Movimento reduzido desativa as animações.
- Captura: `outputs/transicoes.png`. Conferência em outros navegadores e em celular físico não realizada nesta alteração.

## Horarios em 27/10/2026

- Criada a quarta tela com seleção de vínculo unidade/profissional, consulta e cadastro de turnos, pausas e bloqueios; schema existente reaproveitado.
- Teste integrado ampliado: cadastro em vários dias, rejeição de fim anterior ao início, turno duplicado, conflito entre unidades, pausa fora do turno, pausa duplicada, data inexistente, bloqueio duplicado, bloqueio parcial e token CSRF inválido.
- Duas requisições simultâneas de turno idêntico resultaram em 303 e 400: uma gravação aceita, outra rejeitada. A serialização é feita por bloqueio da linha do profissional em transação.
- Dados fictícios dos testes usam schema separado e são removidos ao fim. Dados da demonstração preservados.
- Aplicação e PostgreSQL local reiniciados. Conferência visual impedida porque o controle de navegador está desativado nas configurações do Work. Abertura solicitada no painel do aplicativo; não equivale a validação visual.
- Limites: sem edição/exclusão de agenda, sem reserva de cliente e sem revisão de conflitos ao reativar vínculos antigos de profissionais.

## Preparação da API e integrações em 27/10/2026

As limitações da entrada anterior foram tratadas no backend: edição/remoção de agenda, reserva/cancelamento de clientes e validação da reativação conflitante. Há sessão persistente em PostgreSQL, API compartilhando as rotas administrativas, cadastro/confirmacao SMS, histórico e conclusão com adicionais.

Três testes principais passaram no workspace e novamente após extrair o ZIP em pasta separada e instalar com npm ci. Foram exercitados fluxo cliente, concorrência de reservas, persistência de sessão em segunda instância, cadastro SMS com remetente simulado, código incorreto, CORS, OAuth indisponível/retorno inválido, reativação conflitante e edição/remoção de agenda.

Google real e SMS em aparelho seguem sem validação externa. Nenhuma credencial foi criada por falta de controle do navegador nas configurações do Work. npm audit não encontrou vulnerabilidades conhecidas nesta rodada. O ZIP foi inspecionado para excluir credenciais reais, dados do banco e node_modules.

A senha real foi reativada na configuração de entrega. Versão nova em 127.0.0.1:3001; processo antigo da porta 3000 preservado porque a revisão automática bloqueou seu encerramento. Os guias e relatório atuais em outputs documentam requisitos e pendências.

## Revisão atual: perfis e retirada do SMS

Esta revisão substitui os estados pendentes anteriores: Google foi configurado e testado no Edge, primeiro como gestor e depois como cliente. A conta institucional agora pertence ao CLIENTE. Cadastro direto sem SMS, login HTML de cliente, permissões e demo de gestor foram implementados e testados. O demo de gestor aceita qualquer telefone e senha preenchidos apenas quando DEMO_GESTOR=true; esse é o pedido para a apresentação local. A configuração de exemplo usa false. A tabela histórica de verificação não foi apagada. Veja outputs/relatorio-entrega.md para os limites atuais e o contrato atualizado do frontend.

## Complementos em 28/10/2026

Cinco testes principais passaram. Incluídos: localização/distância, foto JPEG/PNG com validação de conteúdo e tamanho, avulso transacional concorrente, responsáveis por adicionais, formulário HTML e histórico privado. Migração 005 reaplicada nos testes e aplicada ao banco local preservando cadastros. Consulte o relatório atual em outputs para limites e evidências desta rodada; as entradas acima são histórico de etapas anteriores.
