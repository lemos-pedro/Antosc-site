
/*
 * ANTOSC — Dados de cobertura (FONTE ÚNICA)
 * ----------------------------------------------------------------------
 * Alimenta o mapa, o verificador de cobertura (sobre.html)
 * e os indicadores da página inicial (index.html).
 *
 * Angola possui atualmente 21 províncias.
 * As coordenadas representam centros provinciais aproximados,
 * não a localização exata de infraestruturas.
 *
 * IMPORTANTE:
 * - Os valores count devem refletir o inventário real de sites.
 *   Quando js/sites-data.js está carregado (deve vir ANTES deste ficheiro),
 *   os count são recalculados a partir dessa lista (ver o fim do ficheiro);
 *   os valores escritos abaixo servem apenas de reserva.
 * - As novas províncias começam com count: 0 até validação interna.
 * - Não distribuir sites arbitrariamente entre províncias.
 * - Atualizar updated apenas após validação dos dados.
 */

window.ANTOSC_COVERAGE_META = {
  updated: null
};

window.ANTOSC_ZONE_LABELS = {
  luanda: "Luanda",
  norte: "Norte",
  centro: "Centro",
  sul: "Sul",
  leste: "Leste"
};

window.ANTOSC_COVERAGE = [
  {
    id: "luanda",
    short: "LUANDA",
    lab: "l",
    name: "Luanda",
    coords: [-8.8389, 13.2894],
    count: 84,
    zone: "luanda"
  },
  {
    id: "icolo-e-bengo",
    short: "ICOLO E BENGO",
    lab: "tr",
    name: "Icolo e Bengo (Catete)",
    coords: [-9.0000, 13.7000],
    count: 0,
    zone: "norte"
  },
  {
    id: "benguela",
    short: "BENGUELA",
    lab: "l",
    name: "Benguela",
    coords: [-12.5763, 13.4055],
    count: 15,
    zone: "centro"
  },
  {
    id: "lunda-norte",
    short: "LUNDA NORTE",
    lab: "r",
    name: "Lunda Norte (Dundo)",
    coords: [-7.3667, 20.8167],
    count: 11,
    zone: "leste"
  },
  {
    id: "uige",
    short: "UÍGE",
    lab: "tr",
    name: "Uíge",
    coords: [-7.6089, 15.0611],
    count: 10,
    zone: "norte"
  },
  {
    id: "cuanza-sul",
    short: "CUANZA SUL",
    lab: "l",
    name: "Cuanza Sul (Sumbe)",
    coords: [-11.2061, 13.8433],
    count: 10,
    zone: "centro"
  },
  {
    id: "cuanza-norte",
    short: "CUANZA NORTE",
    lab: "bl",
    name: "Cuanza Norte (Cazengo)",
    coords: [-9.2975, 14.9147],
    count: 10,
    zone: "norte"
  },
  {
    id: "huambo",
    short: "HUAMBO",
    lab: "b",
    name: "Huambo",
    coords: [-12.7756, 15.7392],
    count: 9,
    zone: "centro"
  },
  {
    id: "cabinda",
    short: "CABINDA",
    lab: "l",
    name: "Cabinda",
    coords: [-5.5500, 12.2000],
    count: 8,
    zone: "norte"
  },
  {
    id: "bie",
    short: "BIÉ",
    lab: "t",
    name: "Bié (Cuito)",
    coords: [-12.3833, 16.9333],
    count: 7,
    zone: "centro"
  },
  {
    id: "bengo",
    short: "BENGO",
    lab: "t",
    name: "Bengo (Dande)",
    coords: [-8.5786, 13.6644],
    count: 7,
    zone: "norte"
  },
  {
    id: "huila",
    short: "HUÍLA",
    lab: "tr",
    name: "Huíla (Lubango)",
    coords: [-14.9167, 13.4922],
    count: 7,
    zone: "sul"
  },
  {
    id: "moxico",
    short: "MOXICO",
    lab: "t",
    name: "Moxico (Luena)",
    coords: [-11.7833, 19.9167],
    count: 6,
    zone: "leste"
  },
  {
    id: "moxico-leste",
    short: "MOXICO LESTE",
    lab: "t",
    name: "Moxico Leste (Cazombo)",
    coords: [-11.9000, 22.9000],
    count: 0,
    zone: "leste"
  },
  {
    id: "cuando",
    short: "CUANDO",
    lab: "r",
    name: "Cuando (Mavinga)",
    coords: [-13.1000, 21.4500],
    count: 0,
    zone: "sul"
  },
  {
    id: "cubango",
    short: "CUBANGO",
    lab: "r",
    name: "Cubango (Menongue)",
    coords: [-14.6585, 17.6910],
    count: 6,
    zone: "sul"
  },
  {
    id: "namibe",
    short: "NAMIBE",
    lab: "l",
    name: "Namibe (Moçâmedes)",
    coords: [-15.1961, 12.1522],
    count: 5,
    zone: "sul"
  },
  {
    id: "zaire",
    short: "ZAIRE",
    lab: "r",
    name: "Zaire (Mbanza Kongo)",
    coords: [-6.2679, 14.2494],
    count: 5,
    zone: "norte"
  },
  {
    id: "malanje",
    short: "MALANJE",
    lab: "r",
    name: "Malanje",
    coords: [-9.5402, 16.3410],
    count: 4,
    zone: "norte"
  },
  {
    id: "lunda-sul",
    short: "LUNDA SUL",
    lab: "r",
    name: "Lunda Sul (Saurimo)",
    coords: [-9.6603, 20.3906],
    count: 4,
    zone: "leste"
  },
  {
    id: "cunene",
    short: "CUNENE",
    lab: "tr",
    name: "Cunene (Ondjiva)",
    coords: [-17.0667, 15.7333],
    count: 4,
    zone: "sul"
  }
];

/* Recalcula os totais por província a partir da lista de sites (js/sites-data.js). */
(function () {
  var sites = window.ANTOSC_SITES;
  if (!sites || !sites.length) return;

  var byProv = {};
  sites.forEach(function (s) {
    byProv[s.prov] = (byProv[s.prov] || 0) + 1;
  });

  window.ANTOSC_COVERAGE.forEach(function (p) {
    p.count = byProv[p.id] || 0;
  });
})();

window.ANTOSC_TOTALS = (function () {
  var d = window.ANTOSC_COVERAGE;

  return {
    sites: d.reduce(function (sum, province) {
      return sum + province.count;
    }, 0),
    provinces: d.length
  };
})();
