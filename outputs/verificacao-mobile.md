# Verificação móvel — BarberCom, 28/10/2026

## O que foi conferido

Verificação da demonstração EJS no Microsoft Edge do PC, com alteração do tamanho do viewport. Não foi um teste em Android/iPhone físico e não certifica o frontend que a equipe ainda vai implementar.

| Tela | Larguras conferidas |
| --- | --- |
| Unidades | 320, 375, 390 e 430 px |
| Edição de profissional com upload | 320, 375, 390 e 430 px |
| Horários, estado inicial | 320, 375, 390 e 430 px |
| Histórico, estado inicial | 320, 375, 390 e 430 px |
| Formulário avulso aberto | 320 e 390 px |
| Login | 320 e 390 px |
| Cadastro de cliente | 320 e 390 px |
| Área de cliente sem agendamentos | 320 e 390 px |

Nos estados observados, a largura do documento não ultrapassou a largura disponível; o modal de profissional também não teve transbordamento horizontal interno. Captura em 390 px salva separadamente como unidades-mobile-390.png. A altura usada foi 844 px. Não foi feita comparação pixel a pixel com o Figma, nem conferência de todas as combinações de dados longos/erros, teclado móvel ou formulários de agenda expandidos.

## Teste rápido no PC

No Edge ou Chrome, abra a aplicação, pressione F12 e ative o ícone de celular/tablet (atalho Ctrl+Shift+M). Teste as larguras acima e a medida exata do frame Figma. Percorra o fluxo, role até o fim, abra modais e provoque erros. A simulação não substitui um celular real. [Documentação do Edge](https://learn.microsoft.com/en-us/microsoft-edge/devtools-guide-chromium/device-mode/).

## Android real por USB, sem publicar o projeto

O backend atual escuta somente em `127.0.0.1`; portanto abrir o IP do PC pelo Wi-Fi não funciona nessa configuração. `127.0.0.1` no celular normalmente é o próprio celular, não o PC.

O Android SDK/ADB foi localizado neste PC, mas nenhum aparelho apareceu conectado na conferência desta rodada. Para testar:

1. Inicie o banco e o backend no PC e confirme a porta mostrada. Nesta instalação é 3001.
2. No Android, ative as opções de desenvolvedor e a depuração USB; conecte o cabo de dados. O dono do aparelho deve aceitar a autorização de depuração no celular.
3. Abra PowerShell e execute:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" devices
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" reverse tcp:3001 tcp:3001
```

4. No Chrome do Android, abra `http://127.0.0.1:3001/login`. O PC deve continuar ligado com o servidor rodando. Não altere o callback Google se continuar usando exatamente esse endereço; a sessão Google do navegador do celular é independente da sessão do PC.
5. Confira cliente, gestor, teclado, rolagem, menus, modais e foto da galeria. Para Google, o usuário faz login/consentimento no próprio aparelho. Não envie suas senhas ao Claude.
6. Ao terminar, remova o encaminhamento:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" reverse --remove tcp:3001
```

Se houver vários aparelhos, use `adb -s SERIAL ...` com o serial exibido por devices. Se aparecer unauthorized, desbloqueie e aceite o aviso no aparelho. Se o servidor usar 3000, substitua a porta em todos os passos.

Quando o frontend definitivo estiver em outra porta (por exemplo 5173), encaminhe também essa porta e abra o frontend no celular. Configure seu proxy e o callback Google para a origem escolhida; não presuma que acessar 5173 fará o Google retornar automaticamente ao frontend. Veja a seção Google do guia para Claude. [Encaminhamento reverso documentado pelo Android](https://developer.android.com/develop/ui/views/layout/webapps/access-local-server).

## iPhone e teste por Wi-Fi

O método ADB acima é para Android. Para iPhone ou acesso por Wi-Fi, será necessário preparar uma origem de teste acessível ao aparelho, com configuração de rede/proxy e, para recursos como localização, HTTPS apropriado. A configuração local atual não fornece isso. Google também precisa de callback compatível; não basta trocar localhost por um IP privado.

Não publique a configuração atual com DEMO_GESTOR=true. O primeiro teste recomendado para esta apresentação é Android por USB. Nenhuma alteração de firewall, exposição da rede ou publicação foi realizada nesta rodada.
