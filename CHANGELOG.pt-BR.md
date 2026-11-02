# Changelog

Todas as mudanças do StatForge. A versão atual também aparece em Configurações.

## 1.7.0 — 02/11/2026

- Quando uma versão nova do StatForge é publicada, aparece um aviso no topo: **Atualizar** baixa os arquivos novos e recarrega a página (as fichas continuam onde estão); **Depois** esconde o aviso até o app ser aberto de novo. O app confere alguns segundos depois de abrir, quando você volta para a aba e a cada 30 minutos.

## 1.6.1 — 02/11/2026

- Modo Mestre: quando um jogador atualiza um pacote, a ficha compartilhada é reenviada na hora (e na próxima vez que o app abrir, para atualizações feitas antes), então o mestre vê a versão nova.
- Modo Mestre: quando as fichas dos jogadores usam uma versão mais nova de um pacote do que a do mestre, a mesa avisa e **Atualizar meus pacotes** baixa de novo as cópias do mestre (do link de onde foram instaladas, ou do Hub). As fichas são sempre calculadas com os pacotes do mestre.
- Hub: o filtro de idioma agora começa em **Todos os idiomas**.
- Novo `"language": "*"` para pacotes sem texto (temas, por exemplo): servem para qualquer idioma, aparecem com qualquer filtro de idioma no Hub e ganham a etiqueta "qualquer idioma".

## 1.6.0 — 02/11/2026

- Modo Mestre: **Cartões** na mesa escolhe os valores que aparecem nos cartões das fichas (recursos, atributos, perícias, valores derivados, contadores). **Padrão** volta para os recursos do sistema.
- Modo Mestre: **Abrir ficha** abre a ficha só leitura em outra guia, e a mesa continua aberta.
- Revisão de segurança do compartilhamento e do Modo Mestre:
  - As fórmulas só enxergam as próprias funções e valores: nomes como `constructor` ou `toString` não alcançam mais funções internas do JavaScript.
  - Os itens próprios de uma ficha (inclusive de uma ficha compartilhada com o mestre) não conseguem mais mexer em protótipos de objetos quando entram nas regras.
  - Na visão só leitura do mestre, os botões de salvar e remover das janelas também ficam desativados, e a janela de pacotes nunca abre.
  - Nomes e e-mails de dono vindos do Google são limpos de caracteres ocultos e de inversão de direção, e a cópia das mesas guardada no Drive do mestre é conferida antes do uso.
  - A página agora tem uma Content Security Policy: scripts só do próprio site e do login e seletor de arquivos do Google; sem plugins nem scripts embutidos.
- Novo SECURITY.md (en e pt-BR) explica como as pessoas são protegidas, e o README ganhou um tutorial do Modo Mestre para mestres e jogadores.

## 1.5.0 — 02/11/2026

**Parties e recursos da equipe** no Modo Mestre.

- **Nova party** divide as fichas da mesa em grupos. Mova uma ficha pelo menu de party no cartão dela, ou arraste o cartão para dentro de uma party (no computador). Cada ficha fica em no máximo uma party; as outras aparecem em "Sem party".
- Uma party é a **party ativa**: os recursos da equipe dela aparecem no topo da mesa. **Tornar ativa** troca.
- **Recursos da equipe** são fórmulas sobre os personagens de uma party, calculadas sozinhas e atualizadas quando as fichas mudam. `members('AGI')` lê qualquer valor de cada personagem (atributos, perícias, qualquer fórmula, com todos os efeitos), e `sum`, `avg`, `min`, `max` e `count` combinam esses valores; `size` é o tamanho da party. Exemplos: furtividade da equipe `min(members('AGI'))`, moral `floor(avg(members('CAR'))) + size`. A fórmula é conferida ao salvar, e um personagem em que ela falha conta como 0, com o motivo na dica do valor.
- Pacotes de sistema podem trazer recursos da equipe prontos em `party.resources` (aparecem como "do sistema"); os do mestre podem ser criados, editados e apagados em cada mesa.
- Tudo isso fica só com o mestre (aparelho e arquivo privado no Drive). Os jogadores não veem parties nem recursos da equipe, e nada é escrito nos arquivos deles.

## 1.4.1 — 02/11/2026

- Corrigido: o mestre recebia "O Google recusou o pedido" ao adicionar uma ficha compartilhada. As cópias compartilhadas pela 1.3.x eram marcadas para leitores não poderem baixar, o que também bloqueava o app do mestre. As cópias novas não têm mais essa marca, e o app do jogador tira a marca das cópias antigas sozinho na próxima vez que abrir com acesso ao Google (ou pare de compartilhar e compartilhe de novo).
- Os erros do Google agora mostram o motivo curto entre colchetes (por exemplo `[cannotDownloadFile]`), e um limite temporário do Google não é mais tomado como "acesso removido".
- Corrigido: um "null" sobrando no fim da tela do Modo Mestre.

## 1.4.0 — 02/11/2026

**Modo Mestre** (botão **Mestre** no topo).

- Crie mesas (nome e sistema). Cada mesa tem um **link de convite** com o e-mail do mestre, pronto para copiar e mandar no grupo.
- **Adicionar fichas compartilhadas** abre a janela de arquivos do próprio Google: o mestre escolhe os arquivos "StatForge - …" que os jogadores compartilharam. Cada arquivo é lido e conferido antes de entrar na mesa (formato, tamanho até 2 MB, sem truques de protótipo, caracteres ocultos removidos).
- A mesa mostra um cartão ao vivo por ficha: nome, jogador, nível, recursos e quando foi atualizada. Ela confere o Google a cada 15 s (Configurações › Modo Mestre, de 10 a 120 s, com aviso sobre o limite de uso do Google) e só baixa a ficha quando ela mudou.
- **Abrir ficha** mostra a ficha inteira **só leitura**, calculada com os pacotes do próprio mestre: todos os controles ficam desativados, nada é salvo nem enviado, e ela se atualiza sozinha enquanto estiver aberta. Aparece um aviso quando o jogador usa pacotes que o mestre não tem ou tem em outra versão.
- Quando um jogador para de compartilhar, o cartão mostra "Acesso removido" e a cópia guardada no aparelho do mestre é apagada.
- As mesas ficam salvas no aparelho e num arquivo privado na pasta oculta do Drive do mestre, para outro aparelho do mestre receber também. Os jogadores nunca veem esse arquivo.
- O lado do mestre nunca escreve nos arquivos dos jogadores: só lê (e o Google recusaria de qualquer jeito).

## 1.3.1 — 02/11/2026

- Corrigido: compartilhar com um Gmail escrito diferente da conta (pontos, maiúsculas ou "+algo", como "Player.Example@gmail.com" para "playerexample@gmail.com") era tomado como acesso inesperado e cancelado. O Gmail trata os dois como a mesma conta, e agora o StatForge também.
- Compartilhar com o seu próprio e-mail é recusado com uma mensagem clara (não dá acesso nenhum), antes de criar qualquer coisa no Drive.
- Quando o Google não dá acesso ao mestre, a mensagem diz isso, e os dois erros mostram as permissões que o Google informou (só os papéis, sem e-mails) para ajudar a achar a causa.

## 1.3.0 — 02/11/2026

Primeiro passo do Modo Mestre: **compartilhar a ficha com o mestre, só leitura**.

- O mestre manda um link de convite (`#/join?gm=…`). O jogador abre, vê o e-mail do mestre, escolhe a ficha e confirma. Dá para chegar no mesmo lugar por **Compartilhar com o mestre** na ficha, colando o link.
- O StatForge mantém uma cópia da ficha no Google Drive do próprio jogador, atualizada alguns segundos depois de cada mudança, com uma única permissão de **leitor** para o e-mail do mestre. O próprio Google recusa qualquer alteração do mestre, e o app do jogador nunca lê a cópia de volta.
- Travas de segurança: as permissões são conferidas depois de compartilhar e a cópia é apagada se houver qualquer outro acesso; as atualizações param se alguém adicionar acesso pelo Drive; os links de convite são validados e mostrados só como texto; a cópia tem no máximo 2 MB.
- **Parar de compartilhar** apaga a cópia, e o mestre perde o acesso na hora. Apagar uma ficha compartilhada para o compartilhamento antes.
- Compartilhar pede ao Google mais uma permissão, `drive.file` (só arquivos que o StatForge cria ou que a pessoa escolhe), e só quando alguém compartilha. A Política de Privacidade explica.
- O lado do mestre (adicionar as fichas a uma mesa, parties) vem nas próximas versões.

## 1.2.2 — 31/10/2026

- Criação de personagem: as condições dos efeitos agora aparecem em palavras. "(se not has('x') and not has('y'))" vira "(exceto com X ou Y)", com o nome das entidades. O pacote pode dar a própria frase com `if_text` (ver FORMAT).
- Os cartões de escolha mostram os lembretes (efeitos `note`), que muitas vezes trazem o lado ruim, em destaque e primeiro. Bônus iguais em muitas perícias viram uma linha só ("+2 em todas as perícias"), e quando há mais efeitos do que cabe, o cartão diz quantos faltam (veja Detalhes).
- Listas longas num passo da criação agora têm o botão **Carregar mais**, em vez de esconder tudo depois dos 60 primeiros.

## 1.2.1 — 31/10/2026

- Corrigido: alcances escritos como texto (por exemplo "20 ft. cone" ou "Cone de 6 m") apareciam com a unidade grudada no fim ("20 ft. cone m"). Agora cada distância dentro do texto é convertida para a unidade escolhida em Configurações e as palavras ficam.

## 1.2.0 — 31/10/2026

- **A sincronização com o Google lembra a sua conta**: o Google não pergunta mais qual conta usar toda vez. O app guarda o e-mail da conta e o token de acesso só neste aparelho (nunca na nuvem nem em backups), então reabrir o app dentro de uma hora sincroniza sozinho e, depois disso, um toque reconecta a mesma conta. Configurações mostra a conta conectada. Desconectar apaga os dois. A Política de Privacidade foi atualizada.
- **Procurar atualizações automaticamente** (Configurações › Hub, desligado de início): ao abrir o app, ele procura no Hub versões novas dos pacotes que você tem e oferece atualizar num pop-up, sem passar por Pacotes › Hub. **Procurar agora** faz o mesmo na hora.

## 1.1.1 — 31/10/2026

- **Política de Privacidade e Termos de Serviço** (em português e inglês), exigidos pelo Google para publicar o login: `site/privacy.html` e `site/terms.html`, com links em Configurações, na seção de sincronização e em Sobre.

## 1.1.0 — 31/10/2026

- **Efeitos nos itens**: itens equipados (e traços, talentos e antecedentes) mostram abaixo do nome o que fazem, com o valor já calculado, por exemplo "+50 em Capacidade de Carga" na Mochila. Lembretes continuam em Efeitos ativos.
- **Modo debug** (Configurações › Aparência): cada valor calculado ganha, por último no tooltip, a fórmula, a mesma fórmula com os números que ela leu e cada efeito somado com a sua origem. Em telas de toque, o botão **ƒ** ao lado do valor abre o mesmo texto.

## 1.0.0 — 31/10/2026

Primeira versão oficial.

- **Sincronização com o Google Drive**: em Configurações, Conectar Google Drive guarda fichas e pacotes numa pasta escondida do app no seu próprio Drive. As mudanças sobem alguns segundos depois de feitas; ao abrir o app em outro aparelho, um toque sincroniza. Se os dois aparelhos mudaram a mesma ficha, vale a edição mais recente; fichas excluídas continuam excluídas. Cada aparelho mantém as próprias configurações.

## 0.2.9 — 31/10/2026

- **Requisitos**: as entidades podem ter `requires` (uma fórmula). As buscas e os passos de escolha (criação e subir de nível) mostram "requisito não atendido" e não deixam escolher.
- Coleções podem ser `unique`: cada entidade entra uma vez, ou até o `repeat` dela. Subir de nível oferece de novo o que ainda pode ser repetido.

## 0.2.8 — 31/10/2026

- **Dinheiro**: uma coleção pode ser o dinheiro do personagem (`currency`), com quantas moedas o sistema tiver e o valor de cada uma. O novo bloco `money` lista as moedas com uma caixa ± (digite +50 ou -20 e Enter) e, com mais de uma moeda, o total convertido para a moeda base (10 de ouro, 3 de prata e 2 de cobre = 103,2 de prata). As moedas são itens do inventário, então o peso delas pode contar.
- A alternativa do equipamento inicial pode dar itens (`alternative.items`), como moedas.
- Corrigido: os blocos de anotações apareciam vazios ao reabrir a ficha, mesmo com o texto salvo.

## 0.2.7 — 31/10/2026

- Recursos podem mostrar só o total, em cartão (`"display": "card"`), para pontos gastos e recuperados todo turno.

## 0.2.6 — 31/10/2026

- **Subir de nível**: um botão Subir de nível no topo da ficha (destacado quando há XP suficiente) abre um assistente definido pelo pacote (`progression.level_up`), com os mesmos passos da criação: escolher talento ou atributo, distribuir pontos de perícia e assim por diante. O topo mostra o que muda (PV 15 → 20), e uma revisão lista tudo antes de confirmar. Recursos gastos mantêm a mesma diferença para o novo máximo. Pacotes sem isso só somam um nível.
- Novo passo `choice`: uma opção entre algumas, lida pelos passos seguintes no `if`.

## 0.2.5 — 31/10/2026

- **Itens personalizados**: a janela de Adicionar item tem "Criar item personalizado". Escolha a categoria e preencha os campos que o pacote permite para ela (`custom` na coleção); armas também podem ganhar pente com as munições que aceitam, e campos de propriedades têm um seletor. Os itens personalizados ficam salvos na ficha, funcionam como qualquer outro (carga, desgaste, equipar, mods) e podem ser editados ou excluídos nos detalhes.
- A busca de itens mostra primeiro os que têm a palavra no nome, depois os que só a têm na descrição.

## 0.2.4 — 31/10/2026

- **Aviso automático de condições**: os pacotes podem listar condições que o app percebe sozinho (`auto_conditions`). Um aviso discreto no topo da ficha oferece aplicar a condição, ou removê-la quando deixa de valer, e some depois de 10 segundos. Avisos dispensados ficam quietos até a situação mudar, e imunidades (como um talento) impedem o aviso.
- Novas funções de fórmula: `current('id')` para o valor atual de um recurso e `maxof('colecao', 'campo')` para o maior valor entre os itens da ficha.

## 0.2.3 — 31/10/2026

- **Desgaste com efeito**: as coleções podem dizer como o desgaste muda os números do item (`wear.fields`, por exemplo DF e TD da armadura caem), acrescentar penalidades que só existem com desgaste (`wear.stats`, por exemplo ataque −2) e quebrar o item no máximo (`wear.breaks`: os efeitos param e ele aparece como Quebrado). Os valores com desgaste aparecem nos cartões de equipados e nas listas, com o valor base na dica. `wear_ignore` faz itens robustos ignorarem os primeiros níveis.
- **Termos com dica**: um campo de texto com `links` transforma nomes de propriedades em links; passar o mouse mostra a descrição, e tocar abre.

## 0.2.2 — 31/10/2026

- **Adicionar item pesquisando**: no inventário, Adicionar item pesquisa em todas as categorias de uma vez (cada resultado mostra a categoria, e um filtro estreita a busca).
- **Detalhes dos itens no inventário**: o pacote escolhe quais campos aparecem nos cartões (`card_fields`) e na lista (`list_fields`), como a carga; o desgaste aparece como selo quando é maior que 0.

## 0.2.1 — 31/10/2026

- **Caderno de notas**: o novo bloco `notebook` guarda quantas notas você quiser, cada uma com título e texto, minimizada ou aberta. A busca acha palavras dentro de títulos e textos, sem ligar para acentos (por exemplo, "bunk" acha Bunker e Bunkitidini), e destaca o trecho; Abrir leva até a nota.
- Pacotes podem passar o texto de um bloco de notas antigo para o caderno (`import_notes`), então nada escrito antes se perde.

## 0.2.0 — 31/10/2026

- **Inventário num lugar só**: o novo bloco `inventory` reúne todos os itens, em cartões por categoria ou numa lista única com busca (a escolha fica salva). Itens e quantidades são editados ali.
- **Visão de equipados**: blocos de lista com `"view": "equipped"` mostram só o que está equipado, em cartões com os números e o desgaste do item.
- **Pente e recarga**: armas com `magazine` mostram balas no pente / capacidade, gastam disparos e recarregam com a munição compatível do inventário (perguntando qual quando há mais de uma; trocar devolve as balas do pente). Armas de carga gastam uma unidade para encher. É genérico, então arco e besta funcionam também.
- **Mods dentro das armas**: coleções com `mods` deixam instalar num item as modificações que estão no inventário; `magazine_bonus` aumenta o pente.
- **Unidade de distância** em Configurações (metros, pés ou quadrados); campos `range` são convertidos, inclusive alcances que multiplicam um atributo.
- Valores calculados com `editable_bonus` ganham um campo para modificador extra.

## 0.1.9 — 31/10/2026

- **Editor de perícias**: as perícias ficam só para leitura até você tocar em **Editar**. Aí cada perícia tem − / +, o total muda na hora, e **Aplicar** salva (ou **Cancelar** desfaz).
- O bloco de perícias pode ter um `budget`: o editor mostra os pontos gastos contra ele e avisa quando você gasta a mais ou a menos; o Aplicar pergunta antes de salvar um total diferente.

## 0.1.8 — 31/10/2026

- **Recursos em caixinhas**: um recurso com `"display": "toggles"` mostra uma caixinha por ponto (tampas de karma, espaços de magia, usos por dia) em vez de número e barra.
- **Imunidades escondem o que não pode acontecer**: uma `immunity` pode dizer quais condições ou contadores cobre (`ref` ou `tag`), e eles deixam de aparecer nas listas de adicionar da ficha.
- Efeitos como imunidades e vantagens agora também respeitam `"if"`.
- **Entidades concedidas aparecem na lista** (por exemplo, o traço que vem com o antecedente), com o nome da origem, e saem junto com ela.
- Assistente de criação: um passo `pick` pode listar só entidades com uma `tag`.

## 0.1.7 — 31/10/2026

- **Botão voltar** na barra do topo: volta para onde você estava (por exemplo, de Configurações para a ficha aberta).
- Remover algo da ficha (raça, antecedente, item…) pede confirmação antes. Coleções marcadas com `quick_remove` (como condições) não perguntam.
- Correção: o contador de desgaste agora fica alinhado com a coluna.

## 0.1.6 — 30/10/2026

- **Hub**: Pacotes › Explorar o Hub lista os pacotes compartilhados no [StatForge Hub](https://github.com/GabrielGugg/statforge-hub) oficial. Busque, filtre por tipo e idioma, instale com um toque e veja quando um pacote que você tem ganhou versão nova ("Atualizar todos"). O endereço do Hub pode ser trocado em Configurações, então grupos podem ter o próprio.
- Pacotes podem declarar `license`.
- Autor e licença: GabrielGugg.

## 0.1.5 — 30/10/2026

- **Ficha em painel.** Cada aba é uma grade, e o pacote define a largura de cada bloco. Em **Organizar** você arrasta os blocos (mouse ou toque), muda a largura e oculta o que não usa. O arranjo vale para todas as fichas daquele sistema e pode voltar ao padrão.
- **Cartões compactos de recursos** (vida, estamina, espaços de magia…), que o pacote pode pôr no topo.
- **Contadores que só aparecem quando ativos**, com um menu para adicionar (por exemplo, níveis de sobrevivência). O texto da regra fica recolhido.
- **Equipamento inicial no assistente de criação**: o novo passo `items` põe na ficha o kit do antecedente escolhido (com desgaste e armadura vestida), ou uma alternativa, como dinheiro inicial.
- Os atributos preenchem o bloco por igual (todos numa linha quando cabe, senão duas linhas equilibradas), sem espaço vazio do lado.

## 0.1.4 — 30/10/2026

- **Assistente de criação de personagem.** Um pacote de sistema pode descrever seus passos de criação (`creation` no formato): escolher raça, classe ou antecedente, comprar atributos com pontos, escolher perícias, talentos e traços e escrever a história, com um resumo ao vivo dos valores principais e uma revisão no final. Voltar e mudar um passo é seguro. Ainda dá para pular e criar a ficha em branco.
- **Campos mais bonitos**: caixas de texto, seletores e números com visual novo; os atributos mostram o modificador num selo; os contadores de sobrevivência cabem numa linha no celular; os recursos não cortam mais o nome.
- Correção: um texto "null" perdido acima do botão "Criar ficha" (e na janela de pacotes da ficha).
- Os sistemas de exemplo agora têm passos de criação.

## 0.1.3 — 30/10/2026

- Os pacotes de jogo saem do repositório do app: o StatForge fica só com o motor, e todo sistema (inclusive o Fallout) é instalado como qualquer outro pacote.

## 0.1.2 — 30/10/2026

- Correção: blocos largos com tabela (como Armas) não empurram mais a página para o lado no celular.

## 0.1.1 — 30/10/2026

- **Novo ícone do app** (bigorna, chamas e d20) no cabeçalho, na aba do navegador e ao instalar o app no celular ou no computador.

## 0.1.0 — 30/10/2026

Primeira versão do StatForge, uma ficha universal escrita do zero.

- **Pacotes .json**: o app não vem com nenhum jogo. Cada sistema, homebrew, tema ou mesa é um pacote instalado por arquivo ou por link.
- **Idiomas**: o app está em inglês e português do Brasil (seletor em Configurações, automático na primeira vez). Cada pacote declara o próprio `language`, mostrado como etiqueta na tela de Pacotes.
- **Pacote de mesa**: o Mestre manda um link só, e o app instala sistema, extensões e tema. Também funciona com `?table=<link>` no endereço do app.
- **Ordem das extensões**: lista ordenável (arrastar ou setas). A de baixo vence quando duas mexem na mesma coisa, e o app mostra o conflito. Avisos de `requires`, `conflicts` e `load_after`, e botão "Sugerir ordem".
- **Patches**: add, replace, modify, remove e rename.
- **Motor de regras**: fórmulas seguras (sem código executável) e efeitos `add`, `set`, `grant`, `block`, vantagem/desvantagem, imunidade, resistência, vulnerabilidade e nota.
- **Ficha desenhada pelo pacote**: abas e blocos de atributos, perícias, valores calculados, recursos, contadores, efeitos ativos, listas de itens (equipar, quantidade, desgaste, renomear), notas e rolador de dados.
- **Fichas**: várias por aparelho, cada uma com seu sistema e suas extensões. Exportar e importar ficha.
- **Temas**: claro e escuro de fábrica (ou automático); outros temas como pacotes.
- **Backup** completo (pacotes, fichas e configurações) e funcionamento offline.
- **Guia do formato** (`FORMAT.md` e `FORMAT.pt-BR.md`), pacotes de exemplo em inglês e português, e validador pela linha de comando (`npm run validate`).
