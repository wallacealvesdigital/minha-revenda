# Minha Revenda (app)

PWA em HTML, CSS e JS puros, sem build e sem dependências. Os dados ficam no celular (IndexedDB).

## Arquivos
- `index.html`, `styles.css`, `app.js`: o app inteiro (telas, regras, banco, leitura da foto)
- `sw.js`: guarda o app pra abrir sem internet. **A cada atualização publicada, trocar `VERSAO`** (senão o celular continua com a versão antiga)
- `manifest.webmanifest` e `icons/`: instalação na tela inicial

## Publicar (GitHub Pages)
1. Criar um repositório público (ex.: `minha-revenda`) e subir o conteúdo desta pasta `app/` na raiz.
2. Settings › Pages › Deploy from a branch › `main` / `/ (root)`.
3. Endereço: https://wallacealvesdigital.github.io/minha-revenda/ (repositório `wallacealvesdigital/minha-revenda`). Atualizar: trocar `VERSAO` no `sw.js`, commit e `git push` nesta pasta.

## Instalar no celular dela (Android, Chrome)
1. Abrir o endereço no Chrome › menu ⋮ › "Instalar app" (ou "Adicionar à tela inicial").
2. Criar o PIN de 4 números.
3. Ajustes: colocar o nome dela e a chave do Gemini (aistudio.google.com/apikey, gratuita, com a conta Google dela).
4. Fazer a primeira cópia de segurança e mandar pro Drive.

## Como as regras ficaram
- A empresa passa a cada 2 meses: recolhe o que não vendeu, entrega produto novo e recebe o TOTAL vendido. A comissão (25% ou 35% sobre o preço de venda) a empresa calcula e paga depois; no app o ganho é só pra acompanhar.
- O início mostra tudo "desde o último acerto": Vendido (= o que passa pra empresa), Ganhos previstos, Recebido (pagamentos lançados no período, inclusive de compras antigas) e Falta receber. O botão "A empresa veio: fazer o acerto" anota quanto ela passou e zera o período; depois oferece devolver e tirar foto da lista nova. Acertos aparecem no histórico e podem ser apagados.
- Formato da lista (calibrado com a foto real de 20/10/2026, em `../fotos-listas/`): "Relação de Produtos Entregues", colunas Código, Descrição, $ Unit., Qtd., Dev., Ven., Total. O app lê só o impresso (Dev., Ven., Total e rabiscos à mão são ignorados). O percentual escrito à mão na folha (ex.: "25%") vale pros itens comuns; item com "**" no nome (os lençóis) entra com 35%. Os botões ficam à mostra pra trocar. O total impresso (peças e valor) é comparado com a soma lida: verde se bate, laranja se não. A "Próxima Visita" da lista aparece no card da visita no início.
- Foto da lista: lida pelo Gemini; tudo passa pela tela de conferência. Modelo padrão `gemini-flash-latest`. Se o modelo gravado sair do ar (o `gemini-2.5-flash` tinha desligamento marcado pra 16/10/2026), o app tenta os reservas e depois pergunta ao Google quais modelos a chave pode usar, e grava o que funcionou. Servidor ocupado (503, 429): espera 3 s e tenta de novo no mesmo modelo, depois passa pros reservas e pros modelos leves (lite), até 7 tentativas; o modelo gravado só muda quando o anterior saiu do ar. Erro mostra o motivo técnico embaixo (pra mandar print). Ajustes tem "Testar a chave do Gemini". Item sem comissão, preço, código ou quantidade fica em laranja e trava o botão até resolver. Produto que já existe herda a comissão cadastrada.
- Lista grande: "Juntar outra foto" soma os itens na mesma conferência; código repetido vira um item só.
- Ao entrar mercadoria, preço e comissão do produto são atualizados pelos da lista nova.
- Tamanhos: um produto por código, com a quantidade de cada tamanho guardada dentro dele (`tams`: PP a XG ou 38 a 48; o que sobra de `qtd` é "sem tamanho"). Na conferência, "Separar por tamanho" divide as peças de cada item (sutiã abre nos números). No produto, a grade de tamanhos tem + e −: o + de um tamanho tira primeiro das peças sem tamanho. Na venda e na devolução cada tamanho aparece separado. Produtos da v1.3 (um por tamanho) são juntados sozinhos ao abrir. Aviso "Última peça" quando sobra 1 peça do produto (somando os tamanhos).
- Comissão das listas: Ajustes › "Comissão nas listas da empresa" escolhe peças comuns (o que está na folha, 25% ou 35%) e itens com ** (25% ou 35%; padrão 35%, ainda não confirmado).
- Campos: nome do produto em Title Case (siglas de tamanho em maiúsculas; nomes antigos em MAIÚSCULAS são convertidos ao abrir), dinheiro com máscara (os números entram pela direita: 4990 vira R$ 49,90), celular no formato (11) 98765-4321.
- Menu de baixo em todas as telas (menos o PIN).
- Produto não encontrado na busca (estoque ou venda): "Produto não encontrado. Cadastre o produto." com o que foi digitado já preenchido; na venda, o rascunho é guardado e o produto novo volta direto pra venda.
- Pagamento abate primeiro a compra mais antiga. "Cobrar no WhatsApp" pede pagamento até 5 dias antes da próxima visita da empresa (data da lista ou última visita + 60 dias); sem data ou com prazo vencido, "ainda essa semana". Valor pago na hora da venda fica registrado como "na hora da venda".
- Apagar venda devolve os produtos ao estoque e tira o que foi pago nela.
- Cópia de segurança: arquivo `.txt` (JSON) com tudo, inclusive fotos; não leva a chave do Gemini nem o PIN. Restaurar troca todos os dados. Ao terminar abre uma janela "Cópia enviada" (ou "salva no celular") e, se ela permitir, um aviso na barra do celular. O app só sabe que o arquivo foi entregue ao Drive, não se o upload terminou. Histórico das últimas 20 cópias em Ajustes › Cópias feitas; a última aparece no início com data e hora.
- O app pede o PIN ao abrir e depois de 3 minutos em segundo plano. Esqueceu o PIN: só reinstalando e restaurando uma cópia.

## Testar no computador
`python -m http.server 8765` nesta pasta e abrir `http://127.0.0.1:8765` com a tela em modo celular.
