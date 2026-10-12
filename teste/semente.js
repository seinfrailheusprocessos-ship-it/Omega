/* Dados de exemplo (fictícios) para os testes locais e para o banco do artefato de teste. */
const fs = require("fs"), path = require("path");
const RAIZ = path.resolve(__dirname, "..");
function rel(d) { return { json: JSON.stringify(d), rev: d.rev }; }
function semente() {
  const ex = JSON.parse(fs.readFileSync(path.join(RAIZ, "exemplo.json"), "utf8"));
  const pregao = { id: "pregao-018-2026", rev: 3, numero: "1.7", titulo: "Pregão 018/2026 – impugnação", nome: "Pregão 018/2026 – impugnação", exemplo: true,
    pasta: { rotulo: "Pregão 018/2026" }, atualizado: "2026-10-10T09:10:00-03:00",
    secoes: [{ num: "1", titulo: "Impugnação", itens: [
      { num: "1.1", tipo: "acao", titulo: "Ler a impugnação da empresa", texto: "Recebida em 08/10 pelo e-mail da comissão.", valor: "Feito" },
      { num: "1.2", tipo: "decisao", titulo: "Acolher a impugnação?", texto: "O pedido é de prazo maior para a proposta.", opcoes: ["Acolher", "Não acolher", "Acolher em parte"], valor: "Não acolher" }] }] };
  const aditivo = { id: "aditivo-3-contrato-042", rev: 2, numero: "2.4", titulo: "Aditivo 3º – Contrato 042", nome: "Aditivo 3º – Contrato 042", exemplo: true,
    pasta: { rotulo: "Aditivo 3º – Contrato 042" }, atualizado: "2026-10-11T16:40:00-03:00",
    prazos: [{ titulo: "Vencimento do contrato 042", data: "2026-11-30", tipo: "contrato" }],
    secoes: [{ num: "1", titulo: "Prazo e valor", itens: [
      { num: "1.1", tipo: "decisao", titulo: "Prorrogar por 12 ou 6 meses?", texto: "A fiscalização pediu 12 meses; o saldo cobre 6.", opcoes: ["12 meses", "6 meses"], valor: "Aguardando" },
      { num: "1.2", tipo: "acao", titulo: "Minutar o termo aditivo", texto: "Depois da decisão sobre o prazo.", valor: "A fazer", dependeDe: ["1.1"] }] }] };
  const oficio = { id: "oficio-114-2026", rev: 1, numero: "3.1.2", titulo: "Ofício 114/2026 – recebido", nome: "Ofício 114/2026", exemplo: true,
    pasta: { rotulo: "Ofício 114/2026" }, atualizado: "2026-10-11T10:00:00-03:00",
    secoes: [{ num: "1", titulo: "Registro", itens: [{ num: "1.1", tipo: "acao", titulo: "Cadastrar o ofício na pasta 3.1.1", valor: "Feito" }] }] };
  const lote = { id: "malhado-bloco-1", origem: "processo_malhado_completo.pdf", criado: "2026-10-12T14:00:00-03:00", exemplo: true, arquivos: [
    { arquivo: "3.1.1-oficio-114-2026.pdf", tipo: "Ofício do MP", destino: "3.1.1/Entrada", status: "ok", paginas: "1-2" },
    { arquivo: "3.1.1-laudo-vistoria.pdf", tipo: "Laudo de vistoria", destino: "3.1.1/Anexos", status: "ok", paginas: "3-6" },
    { arquivo: "3.1.1-relatorio-fotografico.pdf", tipo: "Relatório fotográfico", destino: "3.1.1/Anexos", status: "revisar_nome", paginas: "7-12" },
    { arquivo: "3.1.2-parecer-procuradoria.pdf", tipo: "Parecer da Procuradoria?", destino: "3.1.2/Pareceres", status: "pasta_duvidosa", paginas: "13-15" }] };
  return {
    ["relatorios/" + ex.id]: rel(ex), ["relatorios/" + pregao.id]: rel(pregao), ["relatorios/" + aditivo.id]: rel(aditivo), ["relatorios/" + oficio.id]: rel(oficio),
    ["pipeline/" + lote.id]: lote
  };
}
module.exports = { semente };
if (require.main === module) process.stdout.write(JSON.stringify(semente(), null, 1));
