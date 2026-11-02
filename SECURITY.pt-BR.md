# Segurança

[Read in English](SECURITY.md)

O StatForge é um site estático: não existe servidor do StatForge nem conta. Tudo fica no navegador, e as funções opcionais do Google usam a conta Google da própria pessoa, direto.

## O que protege as pessoas

**Pacotes e fichas compartilhadas são dados, nunca código.** Pacotes, links de mesa e fichas compartilhadas com o mestre são JSON. As fórmulas rodam num interpretador pequeno do próprio StatForge (números, comparações e uma lista fixa de funções), nunca com `eval`. Texto de fora é sempre mostrado como texto, nunca como HTML. Fichas compartilhadas são conferidas antes do uso: tamanho até 2 MB, limite de profundidade, chaves de protótipo (`__proto__`, `constructor`, `prototype`) descartadas, caracteres de controle e de inversão de direção removidos de nomes e e-mails.

**O acesso ao Google é o menor que funciona.**

- A sincronização usa `drive.appdata`: uma pasta oculta que só o StatForge vê.
- Compartilhar com o mestre usa `drive.file`: o StatForge só vê os arquivos que ele criou, ou os que a pessoa escolheu no seletor do próprio Google. Ele não consegue ver mais nada do Drive.
- Os tokens de acesso ficam no aparelho e só vão para o Google.

**Compartilhar com o mestre é só leitura por construção.**

- O app do jogador cria uma cópia separada no Drive do jogador e dá a um único e-mail o papel de **leitor**. Nunca usa "qualquer pessoa com o link" nem "editor". As permissões são lidas de volta logo depois; qualquer coisa inesperada apaga a cópia.
- O app do jogador só escreve nessa cópia e nunca lê de volta, então nada feito nela muda a ficha de verdade.
- Antes de cada atualização, as permissões são conferidas de novo. Se outra pessoa ganhou acesso, as atualizações param e o jogador é avisado. **Parar de compartilhar** apaga a cópia, o que tira todos os acessos.
- O app do mestre só lê (o Google recusa escrita de um leitor de qualquer forma). Ele mostra a ficha só leitura, nunca salva como ficha do mestre e apaga a cópia local quando o jogador para de compartilhar.
- Mesas, parties e recursos da equipe ficam no aparelho do mestre e na pasta oculta do app no Drive dele. Os jogadores nunca veem isso, nem as fichas uns dos outros.

**A página limita o que pode carregar.** Uma Content Security Policy só permite scripts do próprio site e do login e seletor de arquivos do Google, e bloqueia plugins e scripts embutidos. Dados, imagens e fontes podem vir por https porque pacotes e temas podem vir de qualquer link.

## Relatar um problema

Se encontrar um problema de segurança, abra uma [issue](https://github.com/GabrielGugg/statforge/issues) sem os detalhes de como explorar e peça um contato privado, ou use "Report a vulnerability" na aba Security do GitHub, se estiver ativada.
