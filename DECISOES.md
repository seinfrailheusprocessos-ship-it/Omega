# Decisões — Omega 4 (artefato dentro do Claude)

Versões anteriores (v2 a v3.3, com servidor local) estão no histórico do git. Esta é a única versão em uso.

## Plataforma
- **Só dentro do Claude**, como artefato publicado com `db` (estado compartilhado entre celular e computador, lido pelo Claude) e `downloads` (PDF, Word, páginas extraídas). Sem servidor, sem GitHub Pages, sem instalação, sem service worker.
- **Arquivos**: `index.html`, `estilo.css`, `nucleo.js` (modelo, banco, saída), `tela.js` (interface), `docs.js` (documentos), `mesa.js` (Mesa PDF e revisão), `exemplo.json`. Carregados só quando usados: `dicionario-ptbr.js` (5,4 MB, revisor), `pdf-lib.min.js` (PDF), `pdf-mesa.js` (pdf.js 3.11.174, miniaturas).
- **Congelamento** (12/10): a causa era montar o dicionário na abertura. O dicionário só é baixado ao tocar em "Sublinhar erros", "Revisar tudo" ou no Revisor, e é montado em fatias de 15 mil linhas.

## Gravação das decisões (problema 3.3)
- **Causa encontrada no código antigo** (`adaptador.js`): a cada toque, o Omega regravava o documento `decisoes/<id>` inteiro de **todos** os relatórios com o estado local do aparelho, e depois da primeira leitura nunca mais lia o banco. Um aparelho com estado antigo ou vazio apagava o que o outro tinha decidido (por isso `st` vazio com 8 a 20 gravações).
- **Agora**: o banco manda. Cada escolha grava só a própria chave (`update` com mescla), com data (`t`) e leva (`rev`); na leitura vence a mudança mais recente de cada chave. Só o relatório alterado é gravado, 1,2 s depois da última mudança, uma gravação por vez. O Omega escuta `decisoes` ao vivo (o que se decide no computador aparece no celular aberto).
- O navegador guarda só conveniências (tema, pastas abertas, rascunho do documento avulso) e uma cópia para abrir rápido; nunca sobrescreve o banco.
- Sem banco (página fora do Claude): aviso no Início e as decisões ficam só no aparelho.

## Cliques (problema 3.2)
Causas encontradas e corrigidas: (1) ao tocar no chip, o campo de busca da caixinha recebia foco e o teclado subia; o teclado redimensionava a tela e o código fechava a caixinha; (2) no toque duplo, o segundo toque caía numa opção da folha que acabara de abrir; (3) depois de escolher, a página inteira era redesenhada e a tela pulava até o chip; (4) deslizar da borda abria e fechava a lateral sem querer, e o aviso "Desfazer" ficava embaixo, onde o dedo passa.
Agora: a folha inferior não abre teclado (só "Outra… (digitar)" abre); toques nos primeiros 0,35–0,45 s depois de abrir são ignorados; só a seção mexida é redesenhada e o item tocado fica no mesmo lugar; a lateral do celular abre só pelo ☰; o aviso aparece em cima.

## Visual (mockups aprovados em 12/10)
- IBM Plex Mono (Google Fonts) em `--fonte`; temas Claro, Escuro e Mais escuro (padrão) em variáveis; destaque `#4A5D78`.
- Computador: lateral de ~19,5% (busca, Últimos trabalhados, pastas numeradas, tema e ⚙), barra superior congelada (Relatório, PDF, Documento, Resposta | Copiar relatório, Copiar item, Foco), coluna central de 73%.
- Celular: barra de ícones (👁 relatório, documento, copiar/enviar, foco, → Enviar ao Claude), gaveta lateral pelo ☰, barra inferior (Início, Relatório, Mesa PDF, Documentos), chip em folha inferior, tabela em cartões.
- **Conflitos resolvidos**: itens em lista como no mockup (não a tabela de 5 colunas da v3.1); "Depende de / Bloqueia" viram linha curta clicável. Texto na tela alinhado à esquerda como no mockup (justificado só no documento oficial). Números à direita nas tabelas (especificação). Nomes das opções da especificação (A fazer, Feito, Ignorar, Não consegui); cores do mockup (vermelho pendente, verde feito, azul decidir/ajustar, contorno = escolha). Item INFO tem chip opcional Ciente/Dúvida que não conta como pendência.
- **Onde ficou o que o mockup não mostra**: no botão Foco (ir ao item, próximo/anterior pendente, só pendentes, recolher/abrir tudo, rolagem automática, ditar, sublinhar erros, link da conversa, copiar caminho da pasta); na ⚙ (Documentos, Documento avulso, Mesa PDF, Revisão, Revisor, Claude, Gemini, Gmail, ajustes); Prazos no Início.

## Relatório e texto
- Seções sempre recolhidas ao abrir. Foco gravado em `decisoes/<id>.foco`.
- Bolinhas: toque troca (vermelho → verde → azul), segurar volta, toque duplo (celular) ou duplo clique (computador) edita; a caixinha Pendente/Aprovado/Ajustar ficou como atalho opcional (⚙ → "Caixinha nos parágrafos"); o chip "Capítulo" aprova o capítulo inteiro.
- Caixas de escrever no celular só abrem o teclado com toque duplo.
- Copiar em quatro níveis (parágrafo, capítulo, texto, relatório inteiro); Copiar relatório e Copiar item em foco no formato `[OMEGA]`.

## Ditado
- 🎙 em toda caixa de texto e Ctrl+Shift+M; contínuo, religa sozinho quando o navegador corta, texto aparece enquanto se fala e a tela acompanha; SEINFRA corrigido ("Sé infra", "Isso é infra", "Você é infra").
- **Limite**: o artefato não tem capacidade de microfone; se o Claude bloquear o microfone no painel, o Omega avisa e abre a caixa para o ditado do sistema (Win+H no Windows, microfone do Gboard no celular).

## Documentos
- Prévia oficial paginada como o PDF: Arial 12, entrelinha 1,15, A4, margens 3,5/2,5/3/3 cm, justificado sem recuo, título centralizado, fecho "Ilhéus, *data da assinatura*." à esquerda, sem rodapé; timbre (brasão de `config/brasao` + ESTADO DA BAHIA / PREFEITURA MUNICIPAL DE ILHÉUS); carimbo LICITAÇÃO P.M.I. Fls.___ em licitação e aditivo; despacho com quadro em fonte 10; opção de numerar.
- O mockup da prévia tinha recuo, "Ilhéus (BA)" e margens 3/2/3/2: valeu a seção 8 da especificação.
- **Sem botão Imprimir**: o Claude bloqueia a impressão dentro do artefato; imprime-se o PDF baixado.
- PDF (pdf-lib, Helvetica = medidas da Arial) e Word (.docx com timbre no cabeçalho da 1ª página).
- Documento avulso fora do histórico (rascunho só no aparelho), uma versão por signatário.
- Gmail: rascunho com assunto e texto; anexo vai à mão (o Gmail não aceita anexo por link).

## Enviar ao Claude
- Grava as decisões na hora, copia "Leia o relatório de retorno do Omega do objeto X (rev N)." e abre a conversa do objeto. O artefato não consegue escrever na conversa: o usuário cola. Sem link guardado, o Omega pede o endereço uma vez.

## Mesa PDF e pipeline
- Miniaturas com pdf.js; segurar marca várias e liga a rolagem sozinha (velocidade ajustável, um toque fora para); marcar uma de baixo pula para a fileira seguinte; arrastar para a direita (ou soltar na área "Solte aqui") extrai; renomear; destino (pasta de origem, existente, nova ou "criar resposta"). O arquivo é baixado e o destino fica em `extracoes/` para o Claude mover.
- Revisão da separação lê `pipeline/<lote>` e grava `revisao/<lote>`. Os scripts de OCR e separação são da sessão 2.

## Fora desta rodada
Busca global (abas Processos/Pesquisa), signatários unificados, favoritos, sincronização de foco em tempo real.
