# Minha Revenda (app)

PWA em HTML, CSS e JS puros, sem build e sem dependências. Os dados ficam no celular (IndexedDB).

## Arquivos
- `index.html`, `styles.css`, `app.js`: o app inteiro (telas, regras, banco, leitura da foto)
- `sw.js`: guarda o app pra abrir sem internet. **A cada atualização publicada, trocar `VERSAO`** (senão o celular continua com a versão antiga)
- `manifest.webmanifest` e `icons/`: instalação na tela inicial

## Publicar (GitHub Pages)
1. Criar um repositório público (ex.: `minha-revenda`) e subir o conteúdo desta pasta `app/` na raiz.
2. Settings › Pages › Deploy from a branch › `main` / `/ (root)`.
3. O endereço fica `https://<usuario>.github.io/minha-revenda/`.

## Instalar no celular dela (Android, Chrome)
1. Abrir o endereço no Chrome › menu ⋮ › "Instalar app" (ou "Adicionar à tela inicial").
2. Criar o PIN de 4 números.
3. Ajustes: colocar o nome dela e a chave do Gemini (aistudio.google.com/apikey, gratuita, com a conta Google dela).
4. Fazer a primeira cópia de segurança e mandar pro Drive.

## Como as regras ficaram
- A empresa passa a cada 2 meses: recolhe o que não vendeu, entrega produto novo e recebe o TOTAL vendido. A comissão (25% ou 35% sobre o preço de venda) a empresa calcula e paga depois; no app o ganho é só pra acompanhar.
- O início mostra tudo "desde o último acerto": vendido, ganho previsto e "Passar pra empresa" (= total vendido). O botão "A empresa veio: fazer o acerto" anota quanto ela passou e zera o período; depois oferece devolver e tirar foto da lista nova. Acertos aparecem no histórico e podem ser apagados.
- Foto da lista: lida pelo Gemini (modelo em Ajustes › Avançado, padrão `gemini-2.5-flash`); tudo passa pela tela de conferência. Item sem comissão, preço, código ou quantidade fica em laranja e trava o botão até resolver. Produto que já existe herda a comissão cadastrada.
- Lista grande: "Juntar outra foto" soma os itens na mesma conferência; código repetido vira um item só.
- Ao entrar mercadoria, preço e comissão do produto são atualizados pelos da lista nova.
- Pagamento abate primeiro a compra mais antiga. Valor pago na hora da venda fica registrado como "na hora da venda".
- Apagar venda devolve os produtos ao estoque e tira o que foi pago nela.
- Cópia de segurança: arquivo `.txt` (JSON) com tudo, inclusive fotos; não leva a chave do Gemini nem o PIN. Restaurar troca todos os dados.
- O app pede o PIN ao abrir e depois de 3 minutos em segundo plano. Esqueceu o PIN: só reinstalando e restaurando uma cópia.

## Testar no computador
`python -m http.server 8765` nesta pasta e abrir `http://127.0.0.1:8765` com a tela em modo celular.
