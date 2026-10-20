/* Dados iniciais. Clientes, textos e preços marcados como EXEMPLO até chegarem os reais; o catálogo vem da carga da pasta Santos. */
(function () {
  'use strict';
  A.semente = function () {
    var hoje = A.hoje();
    var cli1 = { id: 'c-exemplo-1', codigo: 'M7KQ', tel: '73999990000', telCodigo: '73999990000', nome: 'Maria S. (EXEMPLO)', email: 'maria@exemplo.com', cidade: 'Salvador/BA', obs: '', criado: hoje, exemplo: true,
      pessoas: [{ id: 'p1', nome: 'Maria S.', papel: 'Cliente', tel: '73999990000', conversas: [{ id: 'v1', data: hoje + 'T09:12', txt: 'Oi, boa tarde! Vocês fazem Santo Antônio de 30 cm? Queria ver também um oratório e o Menino Jesus.' }] },
        { id: 'p2', nome: 'Rafael (arquiteto)', papel: 'Arquiteto', tel: '71988880000', conversas: [{ id: 'v2', data: hoje + 'T10:03', txt: 'O oratório precisa caber num nicho de 45 cm de altura.' }] }],
      eventos: [{ data: hoje + 'T09:12', txt: 'Primeiro contato pelo WhatsApp' }] };
    var cli2 = { id: 'c-exemplo-2', codigo: 'J4TX', tel: '71988776655', telCodigo: '71988776655', nome: 'João P. (EXEMPLO)', email: '', cidade: 'Ilhéus/BA', obs: '', criado: hoje, exemplo: true,
      pessoas: [{ id: 'p1', nome: 'João P.', papel: 'Cliente', tel: '71988776655', conversas: [] }], eventos: [{ data: hoje + 'T08:00', txt: 'Pediu Oratório 40 cm' }] };
    return {
      v: 1,
      atelie: { nome: 'Ateliê Osmundo', slogan: 'Esculturas sacras em argila', tel: '', cidade: '', instagram: '', assinatura: 'Osmundo', logo: null, exemplo: true },
      cfg: { tema: 'auto', prazo: 25, sinal: 50, validade: 7, fotosLinha: 3, modeloPdf: 'refinado', seqOrc: 1, followDias: 3,
        gestos: { dir: ['fixar', 'estrela'], esq: ['arquivar', 'alarme', 'excluir'] }, pessoas: ['Lucas', 'Ju'], pastaNome: '', mostrarDevocionais: true },
      // catálogo real: montado pela carga da pasta Santos (dados/carga-santos.json) em carga.js
      grupos: JSON.parse(JSON.stringify(A.GRUPOS_SUGERIDOS || [])),
      itens: [],
      etiquetas: ['com Menino Jesus', 'sem Menino Jesus', 'com anjo', 'sem anjo', 'cabeça de anjo', 'com lírio', 'com lança', 'com dragão', 'com base', 'liso', 'detalhado', 'pintado', 'cru (sem pintura)'],
      pagamentos: [
        { id: 'pg1', txt: '50% de sinal via Pix e 50% antes do envio', on: true, exemplo: true },
        { id: 'pg2', txt: 'À vista no Pix', on: false, exemplo: true },
        { id: 'pg3', txt: 'Cartão de crédito em até 6x', on: false, exemplo: true }
      ],
      textos: [
        { id: 'tx1', titulo: 'Nota fiscal', txt: 'Emitimos nota fiscal mediante solicitação.', on: true, exemplo: true },
        { id: 'tx2', titulo: 'Entrega', txt: 'Envio por transportadora; frete por conta do cliente.', on: true, exemplo: true },
        { id: 'tx3', titulo: 'Peça oca', txt: 'Peças em argila, ocas e leves, pintadas à mão.', on: false, exemplo: true },
        { id: 'tx4', titulo: 'Cuidados', txt: 'Manusear com cuidado; limpar apenas com pano seco.', on: false, exemplo: true },
        { id: 'tx5', titulo: 'Validade', txt: 'Orçamento válido por {validade} dias.', on: true, exemplo: true }
      ],
      respostas: [
        { id: 'r1', titulo: 'Prazo', txt: 'Olá, {cliente}! O prazo médio é de {prazo} dias após a confirmação do sinal.', exemplo: true },
        { id: 'r2', titulo: 'Frete', txt: 'Enviamos para todo o Brasil por transportadora. O frete é calculado pelo CEP; pode me passar o seu?', exemplo: true },
        { id: 'r3', titulo: 'Pagamento', txt: 'Trabalhamos com 50% de sinal via Pix e 50% antes do envio. No cartão, em até 6x.', exemplo: true },
        { id: 'r4', titulo: 'Oca e leve', txt: 'As peças são de argila, ocas e leves, o que facilita o transporte e a instalação.', exemplo: true },
        { id: 'r5', titulo: 'Cuidados', txt: 'Para conservar, evite sol direto e umidade; limpe só com pano seco e macio.', exemplo: true }
      ],
      devocionais: [
        ['01-20', 'São Sebastião'], ['02-02', 'Iemanjá'], ['03-19', 'São José'], ['04-23', 'São Jorge'], ['05-13', 'Nossa Senhora de Fátima'],
        ['06-13', 'Santo Antônio'], ['06-24', 'São João'], ['06-29', 'São Pedro'], ['07-26', 'Sant\'Ana'], ['08-11', 'Santa Clara'],
        ['08-15', 'Assunção de Nossa Senhora'], ['09-27', 'São Cosme e Damião'], ['09-29', 'São Miguel Arcanjo'], ['10-04', 'São Francisco de Assis'],
        ['10-12', 'Nossa Senhora Aparecida'], ['11-01', 'Todos os Santos'], ['12-04', 'Santa Bárbara'], ['12-08', 'Nossa Senhora da Conceição'],
        ['12-13', 'Santa Luzia'], ['12-25', 'Natal (Menino Jesus)']
      ],
      categorias: [
        { id: 'k1', nome: 'Hoje', cor: '#7c5cf0' }, { id: 'k2', nome: 'Clientes', cor: '#3f7de0' }, { id: 'k3', nome: 'Orçamentos', cor: '#2f9a63' },
        { id: 'k4', nome: 'Financeiro', cor: '#b97a14' }, { id: 'k5', nome: 'Pessoal', cor: '#d44a4a' }
      ],
      notaCats: ['Geral', 'Ideias', 'Compras'],
      cx: [
        { id: 'x1', cat: 'k1', tipo: 'demanda', titulo: 'Responder Maria sobre o oratório (EXEMPLO)', quando: hoje, cliente: 'c-exemplo-1' },
        { id: 'x2', cat: 'k1', tipo: 'lembrete', titulo: 'Conferir sinal do João (EXEMPLO)', quando: hoje + 'T16:00', para: 'Ju', area: 'Clientes', cliente: 'c-exemplo-2' },
        { id: 'x3', cat: 'k2', tipo: 'cliente', titulo: 'Maria S. (EXEMPLO)', ref: 'c-exemplo-1' },
        { id: 'x4', cat: 'k4', tipo: 'lembrete', titulo: 'Pagar argila e tintas (EXEMPLO)', quando: hoje, para: 'Lucas', area: 'Financeiro' },
        { id: 'x5', cat: 'k5', tipo: 'nota', titulo: 'Ideia: foto dos bastidores da pintura (EXEMPLO)', notaCat: 'Ideias' },
        { id: 'x6', cat: null, tipo: 'nota', titulo: 'Nota solta, sem data (EXEMPLO)', notaCat: 'Geral' }
      ],
      clientes: [cli1, cli2],
      orcamentos: [],
      eventos: [{ id: 'e1', titulo: 'Produção do pedido da Maria (EXEMPLO)', ini: hoje, fim: A.iso(new Date(Date.now() + 9 * 864e5)), cor: '#7c5cf0' }]
    };
  };
})();
