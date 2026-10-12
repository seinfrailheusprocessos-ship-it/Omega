# Omega — simulação e manual (nada disto foi aplicado no app ainda)

Abra `simulacao/index.html` (ou o link da simulação publicada) para ver a maquete interativa. Abaixo, o que entendi do pedido.

1. **Visual** do Claude desktop: lateral 375/1920 (19,5%), barra de título 56 px, itens 43 px, coluna de leitura 73% centralizada, caixa arredondada na base. Divisórias de 1 px, curtas, com a largura do texto. Cores medidas do print (escuro): lateral #111111, fundo #151515, caixa #20201F, código #313130, divisor #292929, borda da caixa #4D4D4C, texto #F0EFEC, texto da lateral #C3C2B7, ícones #B8B8B6; destaque #4A5D78; três temas (Claro, Escuro, Mais escuro). Fonte mono inclinada ao Courier New (D1: Courier Prime sugerido).
2. **Ditado**: microfone em toda caixa; atalho Ctrl+Shift+Espaço (proposta; só Ctrl+Shift não chega ao app; Win+H é o ditado do Windows); religa sozinho nas pausas (limite do Chrome); texto aparece ao falar e a tela desce; celular: Gboard.
3. **Edição**: teclado só com duplo toque (celular) ou clique (PC); rolagem automática.
4. **Barra superior congelada**: Relatório (PDF), Documento, Resposta, CI, Copiar relatório, Copiar item, Foco, microfone.
5. **Lateral enxuta e recolhível**: busca por número/nome; Numérica / Últimos trabalhados (data de modificação da pasta, só com servidor); pastas numeradas (1 Licitações, 2 Aditivos, 3 Jurídico, 4 Comunicações…); clicar abre o relatório.
6. **Códigos e README**: todo documento tem código numérico; pastas só com números; README (memorial + ficha) em cada pasta.
7. **Mesa PDF por gesto**: arrastar página para a direita extrai; segurar seleciona (rolagem automática com velocidade ajustável, pulo para a próxima, toque pausa); arrastar a barra extrai tudo; depois Renomear → salvar na mesma pasta/existente/nova ou "criar resposta" (pasta com o nome do arquivo). Miniaturas exigem pdf.js (~1 MB).
8. **Pipeline** (script): OCR → tipo (título→fecho) → separa → guarda bloco original → pastas por tipo → renomeia (MAIÚSCULAS_COM_UNDERLINE, sem "N." nem barra, data sem parênteses). No Omega: revisar um por um (Arquivado / Corrigir) → Responder → entra no relatório.
9. **Sessões**: recomendo duas (1: interface; 2: scripts do pipeline).

**Decisões pendentes:** D1 fonte; D2 sessões; D3 atalho do ditado; D4 formato da data nos nomes (12-10-2026 ou 20261012); D5 hierarquia (1 Licitações, 2 Aditivos, 3 Jurídico, 4 Comunicações, 5+ a definir).

**Não prometo:** ditado sem nenhum limite (depende do Chrome); pastas/data de modificação pelo celular; OCR dentro do Omega.
