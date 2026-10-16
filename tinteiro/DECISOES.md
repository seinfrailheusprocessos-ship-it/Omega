# Decisões técnicas do Tinteiro

## Nome e aparência
- **Nome**: Tinteiro (ícone próprio: frasco de tinta com pena; nada da marca do Obsidian).
- **Visual**: tema próprio que reproduz o padrão visual do Obsidian 1.x (medidas, cores dos temas Claro/Escuro, ícones Lucide — a mesma família de ícones livre que o Obsidian usa). Comparado com capturas oficiais do repositório público de ajuda do Obsidian.
- **Fonte**: a do sistema (Segoe UI no Windows, Roboto no Android, SF no iPhone), como o Obsidian.

## Computador
- **Electron** + servidor local Node (`src/server`). A janela carrega `http://127.0.0.1:27182` com um código de acesso aleatório.
- **Pasta raiz**: `C:\CL` (trocável em Configurações → Geral).
- **Histórico**: antes de gravar por cima, a versão anterior vai para `C:\CL\.tinteiro\historico\<caminho do arquivo>\` (até 60 versões por arquivo; notas que salvam sozinhas guardam no máximo uma cópia a cada 5 minutos). Restaurar pelo painel “Histórico de versões”.
- **Excluir** manda para a Lixeira do Windows.
- **Instalador**: NSIS de um clique (instala só para o usuário, sem pedir administrador), atalho na Área de Trabalho e no Menu Iniciar.
- **Atualização automática**: electron-updater lendo o GitHub Releases do repositório. Baixa sozinho; avisa “Atualização pronta” na barra de baixo; instala ao reiniciar (ou ao fechar o app).
- **Sem assinatura digital** (custa caro): o Windows mostra “O Windows protegeu o computador” na primeira instalação → “Mais informações” → “Executar assim mesmo”.

## Word (.docx)
- Renderização com **docx-preview** (cópia modificada em `src/web/js/docx/vendor/`) que guarda, em cada parágrafo/trecho na tela, a referência ao XML original.
- Ao salvar, **só os parágrafos tocados** são reescritos no `word/document.xml`; todas as outras partes do arquivo (cabeçalho com brasão, estilos, numeração, imagens, propriedades) ficam **byte a byte iguais**.
- Validado com o validador XSD oficial do Office (ISO/IEC 29500), python-docx e LibreOffice (mesmo número de páginas e aparência).
- Cabeçalho e rodapé são exibidos mas não editados no app (botão “Abrir no Word” para isso).
- Paginação: as páginas aparecem separadas nas quebras de página e de seção do documento (a quebra automática de página do Word não é simulada).

## Planilhas e PDF
- Planilhas: grade própria + HyperFormula (fórmulas, funções em português na digitação) e gravação cirúrgica do XML do .xlsx.
- PDF: pdf.js para ver; pdf-lib para gravar (anotações, texto, assinatura, páginas).

## Celular e sincronização
- **Android**: APK feito com Capacitor (mesma interface). **iPhone**: PWA (Adicionar à Tela de Início).
- **Sincronização própria e gratuita**, sem Google Drive nem serviço pago: o celular guarda uma cópia dos arquivos (funciona sem internet) e troca as alterações com o Tinteiro do computador quando está no mesmo Wi-Fi.
- **Pareamento** por QR mostrado no computador (Configurações → Celular e sincronização).
- **Conflito** (mesmo arquivo mudou nos dois lados): a versão do computador fica com o nome original e a do celular vira uma cópia “(conflito celular data)”. Nada se perde.
- **Fora de casa e iPhone**: Tailscale (gratuito) dá ao computador um endereço seguro (https) que o celular alcança de qualquer lugar; o Tinteiro ativa o “acesso seguro” com um clique.
- A chave de assinatura do APK fica no repositório (`mobile/android/app/tinteiro.jks`) para que toda atualização instale por cima da anterior.

## Publicação
- GitHub Actions (`.github/workflows/tinteiro.yml`) gera o `.exe`, o `.apk` e o pacote web a cada envio; publica no GitHub Releases quando a mensagem do commit tem `[publicar]`.
- Links fixos (sempre a versão mais nova):
  - Windows: https://github.com/seinfrailheusprocessos-ship-it/Omega/releases/latest/download/Tinteiro-Setup.exe
  - Android: https://github.com/seinfrailheusprocessos-ship-it/Omega/releases/latest/download/Tinteiro.apk
