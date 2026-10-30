/*
 * ANTOSC — Rede de fibra ótica e rotas (FONTE ÚNICA)
 * ----------------------------------------------------------------------
 * Alimenta o mapa de rede (sobre.html#map) e o indicador "Links de fibra
 * disponíveis". Os nós das torres vêm de js/coverage-data.js (por id).
 *
 * !!! ATENÇÃO !!!  Os links abaixo são um TRAÇADO DE EXEMPLO (corredores
 * entre capitais de província) para demonstrar o mapa. Têm de ser
 * substituídos/confirmados pela equipa técnica. Enquanto
 * `validated` for false, o mapa mostra o aviso "Traçado ilustrativo —
 * em validação" e o indicador aparece como "(provisório)".
 *
 * Como editar um link:
 *   { id, a, b, status, kind, bend, note }
 *   a / b   -> id de uma província (coverage-data.js) ou de um ponto de
 *              fronteira (border, abaixo)
 *   status  -> "ativo" | "implementacao" | "pendente"
 *   kind    -> "interprovincial" | "transfronteirica"
 *   bend    -> curvatura da rota (0 = reta; positivo/negativo = lado)
 *   note    -> texto opcional mostrado no balão
 */
window.ANTOSC_NETWORK_META = { validated: false, updated: null };

window.ANTOSC_NETWORK = {
  // Pontos de ligação fora de Angola (rotas transfronteiriças)
  border: [
    { id: "pointe-noire", short: "POINTE-NOIRE", name: "Pointe-Noire (Rep. Congo)", coords: [11.86, -4.79], lab: "l" },
    { id: "matadi", short: "MATADI", name: "Matadi (RD Congo)", coords: [13.45, -5.82], lab: "t" },
    { id: "tshikapa", short: "TSHIKAPA", name: "Tshikapa (RD Congo)", coords: [20.80, -6.42], lab: "r" },
    { id: "solwezi", short: "SOLWEZI", name: "Solwezi (Zâmbia)", coords: [26.39, -12.18], lab: "b" },
    { id: "oshikango", short: "OSHIKANGO", name: "Oshikango (Namíbia)", coords: [15.90, -17.40], lab: "br" }
  ],
  links: [
    // --- Interprovinciais ativos
    { id: "l01", a: "luanda", b: "benguela", status: "ativo", kind: "interprovincial", bend: 0.10 },
    { id: "l02", a: "luanda", b: "huambo", status: "ativo", kind: "interprovincial", bend: 0.10 },

 
    // --- Interprovinciais em implementação
    { id: "l06", a: "cuanza-norte", b: "malanje", status: "implementacao", kind: "interprovincial", bend: -0.10 },
    { id: "l07", a: "huambo", b: "bie", status: "implementacao", kind: "interprovincial", bend: 0.10 },
    { id: "l08", a: "benguela", b: "huila", status: "implementacao", kind: "interprovincial", bend: -0.08 },
    { id: "l09", a: "zaire", b: "uige", status: "implementacao", kind: "interprovincial", bend: 0.12 },
    { id: "l10", a: "cabinda", b: "zaire", status: "implementacao", kind: "interprovincial", bend: -0.12 },
    // --- Interprovinciais pendentes
    { id: "l11", a: "uige", b: "cuanza-norte", status: "pendente", kind: "interprovincial", bend: 0.10 },
    { id: "l12", a: "huila", b: "namibe", status: "pendente", kind: "interprovincial", bend: 0.10 },
    { id: "l13", a: "huila", b: "cunene", status: "pendente", kind: "interprovincial", bend: -0.10 },
    { id: "l14", a: "huila", b: "cuando-cubango", status: "pendente", kind: "interprovincial", bend: 0.10 },
    { id: "l15", a: "bie", b: "moxico", status: "pendente", kind: "interprovincial", bend: -0.10 },
    { id: "l16", a: "malanje", b: "lunda-sul", status: "pendente", kind: "interprovincial", bend: 0.08 },
    { id: "l17", a: "lunda-sul", b: "lunda-norte", status: "pendente", kind: "interprovincial", bend: -0.10 },
    // --- Transfronteiriças (em desenvolvimento)
    { id: "t01", a: "cabinda", b: "pointe-noire", status: "implementacao", kind: "transfronteirica", bend: -0.15 },
    { id: "t02", a: "zaire", b: "matadi", status: "pendente", kind: "transfronteirica", bend: 0.15 },
    { id: "t03", a: "cunene", b: "oshikango", status: "implementacao", kind: "transfronteirica", bend: 0.10 },
    { id: "t04", a: "moxico", b: "solwezi", status: "pendente", kind: "transfronteirica", bend: 0.12 },
    { id: "t05", a: "lunda-norte", b: "tshikapa", status: "pendente", kind: "transfronteirica", bend: -0.12 }
  ]
};

window.ANTOSC_NETWORK_TOTALS = (function () {
  var L = window.ANTOSC_NETWORK.links;
  return {
    active: L.filter(function (l) { return l.status === "ativo"; }).length,
    building: L.filter(function (l) { return l.status !== "ativo"; }).length,
    crossBorder: L.filter(function (l) { return l.kind === "transfronteirica"; }).length
  };
})();
