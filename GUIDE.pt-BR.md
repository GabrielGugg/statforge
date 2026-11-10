# Guia do StatForge

[Read in English](GUIDE.md)

O StatForge é uma ficha de personagem para qualquer RPG de mesa. O app não vem com nenhum jogo: cada sistema é um **pacote** que você instala. Este guia mostra tudo o que dá para fazer, do primeiro pacote ao Modo Mestre.

Este guia também fica no app, em **Configurações › Guia**.

## 1. Primeiros passos

1. Abra o app: https://gabrielgugg.github.io/statforge/site/
2. Instale um sistema. Na primeira tela você tem três caminhos:
   - **Colar link do Mestre**: o seu Mestre mandou um link? Cole aqui. Um link de mesa instala o sistema, as extensões e o tema de uma vez.
   - **Instalar arquivo**: você recebeu um arquivo `.json`.
   - **Explorar o Hub**: a coleção oficial de pacotes. Busque, filtre e toque em **Instalar**.
3. Toque em **+ Nova ficha**, escolha o sistema (e as extensões, se houver) e siga o assistente de criação.

Quer só conhecer? Use **Testar com o exemplo** na primeira tela.

> O app funciona no celular e no computador, e funciona offline depois de aberto uma vez. No celular, use "Adicionar à tela inicial" do navegador para instalar como app.

## 2. Pacotes

Tudo o que é de jogo vem em pacotes `.json`:

- **Sistema**: as regras (atributos, perícias, itens, criação de personagem).
- **Extensão** (homebrew): muda ou acrescenta regras a um sistema.
- **Tema**: cores e fonte do app.
- **Mesa**: um link que instala um sistema, as extensões e o tema juntos. É o jeito mais fácil de o Mestre preparar o grupo.
- **Compendium**: fichas prontas de criaturas e NPCs, para o Modo Mestre.

Em **Pacotes** você vê o que tem instalado, a ordem das extensões, atualiza e remove. Quando um pacote do Hub ganha versão nova, o app avisa. Para ele procurar sozinho ao abrir, ligue **Procurar atualizações automaticamente** em Configurações.

## 3. A ficha

A ficha é dividida em abas e blocos, definidos pelo sistema. O que você encontra nela:

- **Valores calculados**: tudo o que depende de fórmula (defesa, carga, perícias) é calculado sozinho, com os efeitos de raça, traços, itens e condições.
- **Perícias**: ficam só para leitura até você tocar em **Editar**. Use − / + e depois **Aplicar** (ou **Cancelar**).
- **Recursos** (pontos de vida e afins): o atual você muda, o máximo vem da fórmula.
- **Inventário**: todos os itens num lugar, em cartões por categoria ou numa lista com busca. **+ Adicionar item** busca em todas as categorias. Se o item não existe no pacote, crie um **item personalizado**.
- **Itens equipados**: armas e armaduras equipadas aparecem em cartões, com os números, o desgaste, o pente e as modificações instaladas.
- **Munição e pente**: armas com pente mostram as balas carregadas; **Recarregar** usa a munição do inventário.
- **Usos limitados**: itens como kits mostram uma caixinha por uso. Quando acabam, **Abrir outro** pega um novo da quantidade.
- **Desgaste**: o desgaste muda os números do item e pode quebrá-lo.
- **Propriedades com dica**: passe o mouse (ou toque) numa propriedade para ler a regra. Quando a regra muda conforme o tipo de item, aparece a certa para aquele item.
- **Condições automáticas**: quando o sistema percebe uma condição (por exemplo, sobrecarregado), um aviso discreto no topo oferece aplicar ou remover.
- **Caderno de notas**: quantas notas quiser, com busca.
- **Subir de nível**: o botão fica em destaque quando há XP suficiente e abre um assistente com as escolhas do sistema.

No menu **Mais ⋯** da ficha:

- **Organizar**: arraste, redimensione e esconda os blocos. O arranjo fica salvo por sistema.
- **Pacotes**: as extensões que essa ficha usa.
- **Exportar PDF**: abre a impressão com todas as abas; escolha "Salvar como PDF".
- **Exportar .json**: a ficha num arquivo, para guardar ou passar para outro aparelho (na tela inicial, **Importar ficha**).
- **Excluir**.

> **Modo debug** (Configurações › Aparência) mostra em cada valor a fórmula e de onde veio cada bônus. Útil para conferir regras ou criar pacotes.

## 4. Seus dados

As fichas e os pacotes ficam no seu navegador. Não existe servidor do StatForge nem conta.

- **Sincronização com o Google Drive** (Configurações): guarda tudo numa pasta escondida do app no seu próprio Drive. As mudanças sobem alguns segundos depois de feitas. Em outro aparelho, um toque sincroniza.
- **Backup** (Configurações › Backup): baixa um arquivo com fichas, pacotes e configurações. **Restaurar backup** traz de volta.
- **Lembrete de backup**: com a sincronização desligada, a tela inicial avisa quando o último backup tem mais de 14 dias.
- **Armazenamento do navegador**: alguns navegadores apagam os dados de sites pouco usados (o Safari depois de uns 7 dias). Configurações › Backup mostra se o seu guarda os dados, com um botão para pedir.

> **Só restaure backups feitos por você.** O app confere o arquivo, ignora o que for inválido e nunca pega de um backup o login do Google nem os compartilhamentos. Mesmo assim, um arquivo de outra pessoa pode trazer fichas e pacotes que você não queria.

## 5. Compartilhar a ficha com o Mestre

1. O Mestre manda um **link de convite**. Abra o link, escolha a sua ficha e confira o e-mail do Mestre.
2. Toque em **Compartilhar ficha**. O Google pode pedir para deixar o StatForge criar arquivos no seu Drive (só os arquivos que ele cria).
3. Pronto: o Mestre vê a sua ficha ao vivo, só leitura. A cópia se atualiza sozinha alguns segundos depois de cada mudança.

Na ficha, **Compartilhada com o mestre ✓** mostra quem pode ver. **Parar de compartilhar** apaga a cópia e tira o acesso na hora. O Mestre nunca consegue mudar a sua ficha.

## 6. Modo Mestre

Toque em **Mestre** no topo. Cada **mesa** tem um sistema e abre em abas.

### Personagens

- **Link de convite**: mande para o grupo. Ele leva o seu e-mail, que os jogadores veem antes de compartilhar.
- **Adicionar fichas compartilhadas**: escolha no seletor do Google os arquivos "StatForge - …" que os jogadores compartilharam. Cada ficha vira um cartão que se atualiza sozinho.
- **Cartões** escolhe quais valores aparecem nos cartões. **Abrir ficha** mostra a ficha inteira, só leitura.
- **Nova ficha local**: uma ficha sua (NPC, criatura, personagem reserva), editada no editor completo. **Cópia local** tira um retrato editável de uma ficha compartilhada.
- **Do compendium**: transforma uma entrada de um compendium instalado numa ficha local de NPC.
- **Nova party** divide as fichas em grupos. A **party ativa** mostra no topo os **recursos da equipe**: fórmulas sobre os personagens, como `floor(avg(members('furtividade')))`.

### Combate

- **Novo encontro** e **Adicionar**: fichas da mesa e criaturas de um compendium (×3 vira "Saqueador 1, 2 e 3").
- **Rolar iniciativa** rola para quem a mesa manda e ordena a lista. Os empates seguem a regra da mesa: manual (arraste), jogadores antes dos NPCs ou uma fórmula sua.
- **Próximo turno** e **Anterior** controlam rodada e turno.
- Clique num valor para mudar: um número troca, `-N` tira, `+N` soma. O dano segue a ordem do sistema, e a janela mostra o que vai mudar antes de aplicar.
- Clicar num nome mostra a ficha ao lado, sem sair do combate.

### Escudo

A sua tela para a sessão, em páginas. Cartões de texto livre, notas, tabelas de rolagem, valores dos jogadores, rolador de dados e a ordem dos turnos. **Organizar** muda tamanho e posição.

### Tabelas

Tabelas de rolagem (espólio, clima, encontros). Uma linha por resultado, como `1-4: Chuva ácida`. **Rolar** mostra a linha sorteada, já com os dados rolados. Dá para exportar e importar.

### Notas

O caderno do Mestre, com busca. Só você vê.

### Configurações da mesa

O nome, de quanto em quanto tempo as fichas são conferidas, para quem a iniciativa é rolada, a regra de desempate, se os **nomes e e-mails dos jogadores** aparecem (escondidos até passar o mouse, nunca ou sempre; útil para mostrar a tela ou tirar um print) e **Apagar mesa**.

> Tudo do Mestre fica no aparelho dele e na pasta escondida do app no Drive dele. Os jogadores nunca veem a mesa nem as fichas uns dos outros.

## 7. Criar pacotes

- **Construtor de pacotes**, sem escrever código: https://gabrielgugg.github.io/statforge-hub/builder/
- **Guia do formato**, para quem prefere o `.json`: [FORMAT.pt-BR.md](https://github.com/GabrielGugg/statforge/blob/main/FORMAT.pt-BR.md)
- **Compartilhar no Hub**: [como enviar um pacote](https://github.com/GabrielGugg/statforge-hub/blob/main/CONTRIBUTING.pt-BR.md)

## 8. Problemas comuns

- **"Sistema não instalado"**: a ficha usa um pacote que não está instalado. Instale-o em Pacotes.
- **A ficha não aparece no outro aparelho**: ligue a sincronização nos dois, ou leve um backup.
- **O Mestre não vê a minha ficha**: confira se o e-mail do convite está certo e se a ficha mostra **Compartilhada com o mestre ✓**.
- **Apareceu "Uma versão nova do StatForge está disponível"**: toque em **Atualizar**. As fichas continuam onde estão.
- **Encontrou um erro?** Abra uma [issue](https://github.com/GabrielGugg/statforge/issues).

Privacidade: [Política de Privacidade](https://gabrielgugg.github.io/statforge/site/privacy.html) · Segurança: [SECURITY.pt-BR.md](https://github.com/GabrielGugg/statforge/blob/main/SECURITY.pt-BR.md)
