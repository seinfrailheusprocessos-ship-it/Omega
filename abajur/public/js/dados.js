/* Dados iniciais. Tudo marcado como EXEMPLO até chegarem a lista real das 65 pastas, a tabela de preços e os textos do ateliê. */
(function () {
  'use strict';
  function it(nome, grupo, syn, precos) { return { id: A.norm(nome).replace(/[^a-z0-9]+/g, '-'), nome: nome, grupo: grupo, syn: syn, precos: precos, exemplo: true }; }
  var P1 = { 20: 250, 30: 450, 40: 700 }, P2 = { 20: 260, 30: 470, 40: 720 }, P3 = { 30: 480, 40: 760 };
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
        gestos: { dir: ['fixar', 'estrela'], esq: ['arquivar', 'alarme', 'excluir'] }, pessoas: ['Lucas', 'Ela'], pastaNome: '', mostrarDevocionais: true },
      grupos: [
        { nome: 'Santos', termos: ['santo', 'santos'] },
        { nome: 'Santas', termos: ['santa', 'santas'] },
        { nome: 'Nossa Senhora', termos: ['nossa senhora', 'virgem maria', 'nossa sra'] },
        { nome: 'Oratórios', termos: ['oratorios'] },
        { nome: 'Menino Jesus', termos: [] },
        { nome: 'Orixás', termos: ['orixa', 'orixas'] }
      ],
      itens: [
        it('Santo Antônio', 'Santos', ['santo antonio', 'antonio', 'santo antonio de padua'], P1),
        it('São Jorge', 'Santos', ['sao jorge', 'jorge'], P2),
        it('São Francisco', 'Santos', ['sao francisco', 'francisco', 'francisco de assis'], { 20: 250, 30: 440, 40: 690 }),
        it('São José', 'Santos', ['sao jose', 'jose'], P1),
        it('São Miguel Arcanjo', 'Santos', ['sao miguel arcanjo', 'sao miguel', 'miguel arcanjo', 'arcanjo miguel'], P2),
        it('São Benedito', 'Santos', ['sao benedito', 'benedito'], P1),
        it('São Judas Tadeu', 'Santos', ['sao judas tadeu', 'sao judas', 'judas tadeu'], P1),
        it('São Cosme e Damião', 'Santos', ['sao cosme e damiao', 'cosme e damiao', 'cosme damiao', 'cosme'], { 20: 320, 30: 560 }),
        it('São Sebastião', 'Santos', ['sao sebastiao', 'sebastiao'], P1),
        it('Santa Clara', 'Santas', ['santa clara', 'clara'], { 20: 240, 30: 430 }),
        it('Santa Luzia', 'Santas', ['santa luzia', 'luzia'], { 20: 240, 30: 430 }),
        it('Santa Bárbara', 'Santas', ['santa barbara', 'barbara'], P1),
        it('Santa Rita', 'Santas', ['santa rita', 'rita de cassia', 'rita'], P1),
        it('Sant\'Ana', 'Santas', ['santa ana', 'santana', 'sant ana', 'sant anna'], P1),
        it('Nossa Senhora Aparecida', 'Nossa Senhora', ['nossa senhora aparecida', 'senhora aparecida', 'aparecida'], { 20: 260, 30: 460, 40: 720 }),
        it('Nossa Senhora da Conceição', 'Nossa Senhora', ['nossa senhora da conceicao', 'imaculada conceicao', 'conceicao', 'imaculada'], { 20: 260, 30: 460, 40: 720 }),
        it('Nossa Senhora de Fátima', 'Nossa Senhora', ['nossa senhora de fatima', 'fatima'], { 20: 260, 30: 460, 40: 720 }),
        it('Nossa Senhora das Graças', 'Nossa Senhora', ['nossa senhora das gracas', 'das gracas'], { 20: 260, 30: 460 }),
        it('Oratório', 'Oratórios', ['oratorio', 'capelinha'], { 25: 380, 40: 620 }),
        it('Menino Jesus', 'Menino Jesus', ['menino jesus', 'menino deus', 'menino'], { 15: 150, 20: 210, 30: 330 }),
        it('Presépio', 'Menino Jesus', ['presepio', 'presepe'], { 20: 520, 30: 890 }),
        it('Iemanjá', 'Orixás', ['iemanja', 'yemanja', 'janaina'], P3),
        it('Oxum', 'Orixás', ['oxum'], P3),
        it('Ogum', 'Orixás', ['ogum', 'ogun'], P3),
        it('Oxóssi', 'Orixás', ['oxossi', 'oxosse'], P3),
        it('Iansã', 'Orixás', ['iansa', 'oya'], P3),
        it('Xangô', 'Orixás', ['xango'], P3),
        it('Oxalá', 'Orixás', ['oxala'], P3)
      ],
      etiquetas: ['com Menino Jesus', 'sem Menino Jesus', 'com anjo', 'sem anjo', 'cabeça de anjo', 'com lírio', 'com lança', 'com dragão', 'com base', 'liso', 'detalhado', 'pintado', 'cru (sem pintura)'],
      pagamentos: [
        { id: 'pg1', txt: '50% de sinal via Pix e 50% antes do envio', on: true },
        { id: 'pg2', txt: 'À vista no Pix', on: false },
        { id: 'pg3', txt: 'Cartão de crédito em até 6x', on: false }
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
        { id: 'x2', cat: 'k1', tipo: 'lembrete', titulo: 'Conferir sinal do João (EXEMPLO)', quando: hoje + 'T16:00', para: 'Ela', area: 'Clientes', cliente: 'c-exemplo-2' },
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
