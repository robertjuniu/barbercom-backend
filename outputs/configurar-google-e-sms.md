# Configurar Google e acesso do cliente BarberCom

No ambiente Docker novo, Google começa desabilitado. Configure as variáveis `DOCKER_GOOGLE_*` em `.env.docker`, conforme `INTEGRACAO.md`. Os vínculos e credenciais da instalação Windows descrita abaixo não são copiados para containers nem enviados no pacote. O Compose usa as contas fictícias documentadas e mantém o atalho de gestor desligado.

Configurei o Google no meu ambiente Windows. Tirei o SMS para evitar custo e deixei as credenciais no arquivo local.

## Situação desta instalação

O projeto **BarberCom** (`barbercom`) e o cliente **BarberCom backend local** foram criados no Google Cloud. A credencial está somente na configuração local, fora do ZIP. Sua conta foi adicionada como usuário de teste. Foram cadastrados os callbacks em `127.0.0.1` nas portas 3000 e 3001; a instalação atual usa 3001.

Testei no Edge primeiro como gestor e depois como cliente. Passei o vínculo da conta institucional para uma conta CLIENTE; o Google agora abre a área de cliente. O gestor usa o botão de demonstração local, com qualquer telefone e senha preenchidos. O consentimento solicitou somente nome/foto do perfil e email. A rejeição de uma segunda identidade sem vínculo ainda precisa de teste real. Foi corrigida a proteção do formulário para permitir o redirecionamento a `https://accounts.google.com` quando Google estiver configurado, mantendo os demais destinos bloqueados.

## Google

1. Acesse [Google Cloud Console](https://console.cloud.google.com/) e entre na sua própria conta.
2. Crie ou selecione um projeto da equipe, por exemplo **BarberCom Faculdade**.
3. Abra **Google Auth Platform** e configure a marca/tela de consentimento: nome BarberCom, email de suporte e contato da equipe. Os nomes dos menus podem variar conforme a conta.
4. Para uma conta pessoal, selecione público externo e mantenha em teste. Adicione os emails da equipe como usuários de teste quando solicitado. Peça somente identificação básica: OpenID, email e perfil.
5. Em **Clientes**, crie um cliente OAuth do tipo **Aplicativo da Web**. A ação cria uma credencial persistente: confirme a criação na sua conta.
6. Cadastre exatamente este URI de redirecionamento:

```text
http://127.0.0.1:3000/auth/google/callback
```

7. Se for usar `localhost`, adicione também `http://localhost:3000/auth/google/callback`, mas use o mesmo hostname do início ao fim do teste. O servidor deste projeto escuta em 127.0.0.1.
8. Copie Client ID e Client Secret para o `.env` local:

```dotenv
GOOGLE_CLIENT_ID=SEU_CLIENT_ID
GOOGLE_CLIENT_SECRET=SEU_CLIENT_SECRET
GOOGLE_REDIRECT_URI=http://127.0.0.1:3000/auth/google/callback
```

9. Reinicie o backend. O botão Google deixa de aparecer desabilitado.
10. Primeiro entre com telefone e senha. Abra `http://127.0.0.1:3000/conta`, confirme a senha original e escolha a identidade Google a vincular.
11. Saia e teste **Entrar com Google**. O perfil deve ser o mesmo da conta BarberCom existente. Uma conta Google diferente, não vinculada, deve ser recusada.

O modo de qualquer senha não vale para vinculação: ela sempre exige a senha original guardada no banco. O acesso do gestor de demonstração está no arquivo local `acesso-local.txt`, que não deve ser compartilhado.

O callback valida state, prazo de dez minutos, nonce e token com a biblioteca oficial Google; usa PKCE e renova a sessão após login. A API não vincula identidades por email e não transforma novos usuários em gestores. Não são solicitados Drive, Gmail ou outros acessos de conteúdo.

Se aparecer `redirect_uri_mismatch`, confira protocolo, hostname, porta e caminho. Se houver bloqueio por público de teste, confira se o email está autorizado na configuração do projeto. Não compartilhe captura que mostre o Client Secret.

Referências: [OAuth para aplicação Web](https://developers.google.com/identity/protocols/oauth2/web-server), [validação do token](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).

## Cadastro sem SMS

O cliente se cadastra em `/cadastro` ou `POST /api/cadastro` com nome, telefone e senha. A conta é criada diretamente como CLIENTE. Não há envio de mensagens nem cobrança; a posse do telefone não é confirmada. Não existe mais a rota de confirmação de código.

Para a apresentação, `DEMO_GESTOR=true` habilita um botão de login de gestor com qualquer telefone e senha preenchidos. Esse botão acessa a conta de gestor já existente e não transforma o cliente em gestor. No pacote, o exemplo permanece `false`.

## Antes de entregar

- Execute `npm.cmd test`.
- Configure `ALLOW_ANY_PASSWORD=false` e reinicie.
- Não envie `.env`, arquivos de credenciais OAuth, dados do PostgreSQL, logs, acessos locais ou `node_modules` no pacote da equipe.
- Confira Google e os dois perfis. Nesta instalação, o Google institucional já foi testado como CLIENTE; o modo de apresentação do gestor também foi conferido no navegador.
- Ao finalizar a apresentação, desative DEMO_GESTOR caso a aplicação seja usada com dados ou pessoas reais.
- Nesta instalação, o navegador foi conectado e a credencial Google foi criada. Ela não acompanha o pacote: configure uma credencial própria ao instalar em outro computador.
