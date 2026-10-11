# Decisões tomadas sozinho

- **Um só arquivo + dicionário**: `index.html` (CSS e JS dentro) e `dicionario-ptbr.js` (só o dicionário, carregado por `<script src>`). Há também `sw.js` (pequeno, só funciona no endereço https) para o app abrir offline no celular depois da primeira visita.
- **Branches**: o briefing pedia `main`; a sessão também estava presa à branch `claude/upbeat-curie-uvfj5q`. Enviei para as duas, com o mesmo conteúdo. Sem pull request.
- **Escolher uma opção** (item com `opcoes`) marca o item como *liberado* automaticamente (se estava pendente) e ele some da lista; aparece aviso com "Desfazer". No texto copiado sai como `[ESCOLHA]`.
- **Itens `ajustar` com opção escolhida** saem como `[AJUSTAR] … — Opção: x — Observação: y`.
- **Sem pendentes**: a última linha do texto copiado diz "Pendentes não decididos: nenhum".
- **Cabeçalho copiado** usa o título inteiro do relatório (inclusive "(dados fictícios)" no exemplo).
- **Aviso "Antes: n.n"**: o link leva ao item; se o item exigido estiver liberado e escondido, o app mostra os liberados para poder levar até lá. O aviso só aparece enquanto o requisito não estiver liberado/ignorado.
- **Revisor**: em vez de sublinhar dentro da caixa de digitação (impossível numa caixa comum), a caixa fica em cima e a "conferência" com palavras sublinhadas logo abaixo, atualizada ao digitar. Tocar na palavra sublinhada abre o balão (até 5 sugestões, Ignorar, Adicionar ao meu dicionário).
- **Não marca**: siglas em maiúsculas, palavras com número, "art", nomes próprios no meio da frase (letra maiúscula fora do começo de frase). Palavras com hífen passam se as partes existem ou se são pronome ligado ao verbo (dar-lhe-ia).
- **Dicionário**: Hunspell pt-BR do projeto VERO (pacote npm `dictionary-pt-br`), licença **LGPL-3.0 ou MPL-2.0** (uso livre, inclusive em repositório público; o texto da licença está em `LICENCA-DICIONARIO.txt`). A biblioteca nspell não foi usada porque trava com este dicionário grande; escrevi no app uma verificação própria (remove sufixos/prefixos e confere na lista de radicais), por isso o `dicionario-ptbr.js` tem ~5 MB. Na primeira vez que o Revisor é usado, o dicionário leva alguns segundos para carregar.
- **Texto do Revisor** fica guardado só na aba do navegador (sessionStorage) para não gravar texto de processo; o "meu dicionário" fica no navegador.
- **Atalho do Claude**: tenta `?q=` com o trecho (até 1.500 caracteres) e também copia; acima disso, só copia. Não consegui testar no site real a partir daqui (sem internet), então se o Claude ignorar o `?q=`, basta colar.
- **Copiar/Colar estado**: o texto começa com `OMEGA-ESTADO:` e contém todos os relatórios, marcações e o dicionário pessoal. Colar **substitui** o que está no aparelho (pede confirmação).
- **API do Gemini (opcional)**: não feita; está no `BACKLOG.md`.
