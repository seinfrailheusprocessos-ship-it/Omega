# Abajur (E1, protótipo instalável)

App da assistente do ateliê: atender pelo WhatsApp, reconhecer santos e medidas, escolher fotos, montar orçamento com desconto por peça e geral, gerar PDF e texto, clientes com código, lembretes, notas e calendário. Tudo fica no aparelho (IndexedDB); sem servidor, sem IA paga.

## Rodar no computador
```
cd abajur/public
npx http-server -p 8080 -c-1
```
Abrir http://localhost:8080 (no celular, mesma rede: http://IP-do-PC:8080; para instalar como app é preciso HTTPS, ou seja, o Firebase).

## Publicar no Firebase Hosting (gratuito)
1. Criar o projeto em https://console.firebase.google.com (plano Spark, sem custo).
2. Trocar `DEFINIR-ID-DO-PROJETO` em `.firebaserc` pelo ID do projeto.
3. Na pasta `abajur/`: `npx firebase-tools login` e depois `npx firebase-tools deploy --only hosting`.
4. No Galaxy, abrir o endereço `https://ID.web.app` no Chrome › menu › Instalar app.

## Estrutura
- `public/index.html`, `css/app.css`: casca, tema claro/escuro seguindo o celular, coluna central.
- `js/nucleo.js` (banco local, folhas, rotas), `dados.js` (dados de EXEMPLO), `deteccao.js` (dicionário de sinônimos),
  `fotos.js` (pasta do aparelho, miniaturas, etiquetas), `atender.js`, `pdf.js`, `inicio.js` (caixinhas, arrastar, deslizar),
  `cadastro.js` (+ Novo), `clientes.js`, `agenda.js`, `mais.js`, `zip.js` (conversa exportada do WhatsApp), `app.js`.
- `sw.js`: funciona sem internet e recebe o que for compartilhado pelo WhatsApp (texto, print, áudio, conversa .zip/.txt).
- `vendor/`: pdf-lib (MIT) e Tesseract.js com português (Apache-2.0) para ler prints no aparelho; só carrega quando usado.

## Logo
`public/icons/logo.svg` é provisório até chegar `abajur_logo.jpg`. Com o arquivo na mão:
`bash ferramentas/vetorizar-logo.sh caminho/abajur_logo.jpg` (potrace + ImageMagick) vetoriza sem redesenhar,
põe o traço em `currentColor` (claro no tema escuro) e regenera todos os ícones (`ferramentas/gerar-icones.mjs`).

## Pendências marcadas com X no app
Logo do Abajur, planilha das 65 pastas/735 fotos, logo do ateliê (timbre), tabela de preços, textos fixos, fotos reais, nome da assistente.
