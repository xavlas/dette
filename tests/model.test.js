const test = require('node:test');
const assert = require('node:assert/strict');
const { BASE, DEFAUTS, simuler } = require('../model.js');

const proche = (a, b, tol, msg) =>
  assert.ok(Math.abs(a - b) <= tol, `${msg || ''} attendu ${b} ± ${tol}, obtenu ${a}`);

test('le point de départ 2026 est cohérent avec les sources', () => {
  proche((BASE.dette / BASE.pib) * 100, 118.6, 0.05, 'ratio Cour des comptes');
  const solde = BASE.recettes - BASE.depensesPrimaires - BASE.interets;
  proche((solde / BASE.pib) * 100, -5.0, 0.05, 'déficit 2026');
  proche((BASE.recettes / BASE.pib) * 100, 52.1, 0.05, 'recettes Insee');
});

test('la projection couvre 10 ans, de 2027 à 2036', () => {
  const t = simuler(DEFAUTS);
  assert.equal(t.length, 10);
  assert.equal(t[0].annee, 2027);
  assert.equal(t[9].annee, 2036);
});

test('identité comptable : dette(t) = dette(t-1) - solde(t)', () => {
  const t = simuler({ ...DEFAUTS, crise: 300, anneeCrise: 2029, climat: 50 });
  let prec = BASE.dette;
  for (const a of t) {
    proche(a.dette, prec - a.solde, 1e-6, `année ${a.annee}`);
    proche(a.solde, a.recettes - a.depensesPrimaires - a.interets, 1e-6);
    prec = a.dette;
  }
});

test('solde stabilisant proche de -2,8 % du PIB (Cour des comptes)', () => {
  const t = simuler(DEFAUTS);
  proche(t[0].soldeStabilisant, -2.8, 0.15);
});

test('choc de +100 pb : surcoût conforme au rapport du Sénat n° 719', () => {
  // Périmètre du rapport : dette négociable de l'État, choc à partir de 2025,
  // déficit de l'ordre de 120 à 180 Md€ par an. Tolérance de 15 %.
  const etat = {
    annee: 2024, pib: 2920, dette: 2500, dettePrecedente: 2350,
    recettes: 1350, depensesPrimaires: 1410, interets: 50,
  };
  const p = { ...DEFAUTS, retraites: 0, autonomie: 1.9, tauxMarche: 3.0 };
  const ref = simuler(p, etat, 9);
  const choc = simuler({ ...p, tauxMarche: 4.0 }, etat, 9);
  const surcout = (n) => choc[n - 1].interets - ref[n - 1].interets;
  proche(surcout(3), 13.9, 13.9 * 0.15, 'fin 2027');
  proche(surcout(6), 24.0, 24.0 * 0.15, 'fin 2030');
  proche(surcout(9), 32.6, 32.6 * 0.15, 'fin 2033');
});

test('la charge d’intérêts dépasse 100 Md€ vers 2029 dans le tendanciel', () => {
  const t = simuler(DEFAUTS);
  const a2029 = t.find((a) => a.annee === 2029);
  assert.ok(a2029.interets > 95 && a2029.interets < 120, `intérêts 2029 = ${a2029.interets}`);
});

test('sens des leviers', () => {
  const fin = (p) => simuler({ ...DEFAUTS, ...p }).at(-1).ratio;
  const ref = fin({});
  assert.ok(fin({ croissance: DEFAUTS.croissance + 1 }) < ref, 'croissance');
  assert.ok(fin({ inflation: DEFAUTS.inflation + 1 }) < ref, 'inflation');
  assert.ok(fin({ tauxMarche: DEFAUTS.tauxMarche + 1 }) > ref, 'taux');
  assert.ok(fin({ productivite: 50 }) < ref, 'productivité');
  assert.ok(fin({ depenses: DEFAUTS.depenses - 0.5 }) < ref, 'dépenses');
  assert.ok(fin({ economies: 40 }) < ref, 'économies');
  assert.ok(fin({ prelevements: 1 }) < ref, 'prélèvements');
  assert.ok(fin({ niches: 20 }) < ref, 'niches');
  assert.ok(fin({ fraude: 5 }) < ref, 'fraude');
  assert.ok(fin({ allegements: 20 }) < ref, 'allègements');
  assert.ok(fin({ subventions: 50 }) < ref, 'subventions');
  assert.ok(fin({ retraites: 200 }) > ref, 'retraites');
  assert.ok(fin({ autonomie: 4.8 }) > ref, 'autonomie');
  assert.ok(fin({ seniors: 5 }) < ref, 'seniors');
  assert.ok(fin({ climat: 100 }) > ref, 'climat');
  assert.ok(fin({ crise: 300, anneeCrise: 2030 }) > ref, 'crise');
});

test('le taux moyen ne bouge pas si le taux de marché lui est égal', () => {
  const t = simuler({ ...DEFAUTS, tauxMarche: BASE.interets / BASE.dettePrecedente * 100 });
  proche(t.at(-1).tauxMoyen, t[0].tauxMoyen, 1e-9);
});

test('les leviers montent en charge sur 3 ans', () => {
  const ref = simuler(DEFAUTS);
  const t = simuler({ ...DEFAUTS, fraude: 9 });
  const gain = (i) => t[i].recettes - ref[i].recettes;
  proche(gain(0), 3 * ref[0].pib / BASE.pib, 0.01);
  proche(gain(2), 9 * ref[2].pib / BASE.pib, 0.01);
});

test('une crise de 300 Md€ alourdit la dette d’au moins son coût direct', () => {
  const ref = simuler(DEFAUTS).at(-1).dette;
  const crise = simuler({ ...DEFAUTS, crise: 300, anneeCrise: 2029 }).at(-1).dette;
  assert.ok(crise - ref > 300);
});

// Leviers retraites et emploi : Cour des comptes, « Situation financière et
// perspectives du système de retraites », février 2025 (effets 2035, toutes
// finances publiques) ; scénario plein emploi de dettedelafrance.fr.
const gainSolde = (p, annee) => {
  const ref = simuler(DEFAUTS).find((a) => a.annee === annee);
  const t = simuler({ ...DEFAUTS, ...p }).find((a) => a.annee === annee);
  return (t.soldePrimaire - ref.soldePrimaire) / (ref.pib / BASE.pib);
};

test('âge légal : +17,7 Md€ pour un an de plus, −13,0 Md€ pour un an de moins en 2035', () => {
  proche(gainSolde({ ageLegal: 1 }, 2035), 17.7, 0.01);
  proche(gainSolde({ ageLegal: -1 }, 2035), -13.0, 0.01);
  assert.ok(gainSolde({ ageLegal: 1 }, 2030) < 17.7 / 2, 'montée en charge progressive');
});

test('durée de cotisation : +9,7 Md€ pour un an de plus, −7,1 Md€ pour un an de moins en 2035', () => {
  proche(gainSolde({ dureeAssurance: 1 }, 2035), 9.7, 0.01);
  proche(gainSolde({ dureeAssurance: -1 }, 2035), -7.1, 0.01);
});

test('un point de cotisation retraite rapporte 6,2 Md€ par an', () => {
  proche(gainSolde({ cotisation: 1 }, 2029), 6.2, 0.01);
});

test('sous-indexation : 2,9 Md€ par point et par année, acquis ensuite', () => {
  const p = { sousIndexation: 1, anneesSousIndexation: 4 };
  proche(gainSolde(p, 2027), 2.9, 0.01);
  proche(gainSolde(p, 2030), 11.6, 0.01);
  proche(gainSolde(p, 2036), 11.6, 0.01);
});

test('chômage de 7,4 % à 5 % : environ 35 Md€ par an au bout de 5 ans', () => {
  proche(gainSolde({ chomage: 5 }, 2031), 35, 0.5);
  assert.ok(gainSolde({ chomage: 9 }, 2031) < 0);
});

// Dépenses par poste : Eurostat, dépenses par fonction 2024 (gov_10a_exp).
const { H } = require('../model.js');

test('les postes de dépense couvrent la dépense hors intérêts de 2024', () => {
  const total = H.postes.reduce((s, q) => s + q.montant, 0);
  proche(total, 1671.8 - 58.9, 0.15);
});

test('sans écart par poste, le tendanciel est inchangé', () => {
  proche(simuler(DEFAUTS).at(-1).ratio, 154.5, 0.1);
});

test('la ventilation par poste retrouve la dépense hors intérêts', () => {
  const t = simuler({ ...DEFAUTS, poste_defense: 4, ageLegal: 1, economies: 30, crise: 200, chomage: 6 });
  for (const a of t) {
    const somme = Object.values(a.postes).reduce((s, v) => s + v, 0);
    proche(somme + a.nonVentile, a.depensesPrimaires, 1e-6, `année ${a.annee}`);
  }
});

test('défense : +7,6 %/an en volume mène à environ 3,5 % du PIB en 2036', () => {
  const ecart = 7.6 - DEFAUTS.depenses;
  const fin = simuler({ ...DEFAUTS, poste_defense: ecart }).at(-1);
  proche((fin.postes.defense / fin.pib) * 100, 3.5, 0.15);
  assert.ok(fin.ratio > simuler(DEFAUTS).at(-1).ratio);
});

test('un écart sur un poste ne touche pas les autres', () => {
  const ref = simuler(DEFAUTS).at(-1).postes;
  const t = simuler({ ...DEFAUTS, poste_enseignement: -1 }).at(-1).postes;
  assert.ok(t.enseignement < ref.enseignement);
  proche(t.sante, ref.sante, 1e-9);
});

// Impôt sur le revenu et hauts patrimoines. Rendements par point : ordres de
// grandeur de l'application, calés sur les chiffrages cités par le Sénat.
const { effetImpot } = require('../model.js');
const impot = (p) => effetImpot({ ...DEFAUTS, erosion: 0, ...p });

test('barème inchangé : aucun effet', () => {
  proche(effetImpot(DEFAUTS), 0, 1e-9);
});

test('un point de taux par tranche', () => {
  proche(impot({ ir11: 12 }), 3.5, 1e-9);
  proche(impot({ ir30: 31 }), 1.15, 1e-9);
  proche(impot({ ir41: 42 }), 0.3, 1e-9);
  proche(impot({ ir45: 46 }), 0.13, 1e-9);
});

test('la tranche à 45 % retrouve l’ordre de grandeur de sa création (344 M€ pour 4 points en 2013)', () => {
  const gain2013 = 0.344 / 4;
  assert.ok(H.ir.parPoint[3] > gain2013 && H.ir.parPoint[3] < gain2013 * 2);
});

test('nouvelle tranche : le rendement fond quand le seuil monte', () => {
  proche(impot({ irSurtaxe: 10, irSeuil: H.ir.seuils[3] }), 1.3, 1e-9);
  proche(impot({ irSurtaxe: 10, irSeuil: 500000 }), 1.3 * Math.pow(500000 / H.ir.seuils[3], -H.ir.pareto), 1e-9);
  assert.ok(impot({ irSurtaxe: 10, irSeuil: 1000000 }) < impot({ irSurtaxe: 10, irSeuil: 500000 }));
});

// SMIC et revenu universel : hypothèses de l'application.
const { effetSmic, effetRevenuUniversel } = require('../model.js');

test('une hausse du SMIC dégrade le solde et accroît le chômage', () => {
  const s = effetSmic({ smic: 10 });
  proche(s.chomage, 10 * 15 / 1000 / 31 * 100, 1e-9);
  assert.ok(gainSolde({ smic: 10 }, 2032) < 0);
  assert.ok(gainSolde({ smic: 10, smicEmplois: 0 }, 2032) > gainSolde({ smic: 10 }, 2032));
});

test('revenu universel : coût brut, aides absorbées plafonnées', () => {
  const r = effetRevenuUniversel({ ruAdulte: 100 });
  proche(r.brut, 54.3 * 1.2, 1e-9);
  const total = effetRevenuUniversel({ ruAdulte: 5000, ruMineur: 5000 });
  const max = H.ru.aides.reduce((s, a) => s + a.montant * a.plafond, 0);
  proche(total.aides, max, 1e-9);
  proche(effetRevenuUniversel({ ruAdulte: 600, ruAides: 0 }).aides, 0, 1e-9);
});

test('revenu universel : alourdit la dette, sauf s’il est entièrement financé', () => {
  const ref = simuler(DEFAUTS).at(-1);
  const ru = simuler({ ...DEFAUTS, ruAdulte: 600, ruMineur: 150 }).at(-1);
  assert.ok(ru.ratio > ref.ratio);
  assert.ok(ru.postes.social > ref.postes.social);
  const finance = simuler({ ...DEFAUTS, ruAdulte: 600, ruMineur: 150, ruFinancement: 100 }).at(-1);
  proche(finance.soldePrimaire, ref.soldePrimaire, 1e-6);
});

test('impôt plancher sur les patrimoines : 20 Md€ bruts à 2 %, moins l’érosion', () => {
  proche(impot({ patrimoine: 2 }), 20, 1e-9);
  proche(impot({ patrimoine: 2, erosion: 50 }), 10, 1e-9);
});

test('l’érosion ne s’applique qu’aux hausses sur les hauts revenus', () => {
  proche(impot({ ir45: 55, erosion: 40 }), 1.3 * 0.6, 1e-9);
  proche(impot({ ir45: 40, erosion: 40 }), -0.65, 1e-9);
  proche(impot({ ir11: 12, erosion: 40 }), 3.5, 1e-9);
});

test('l’effet de l’impôt arrive dans les recettes en 3 ans', () => {
  const p = { ir30: 32, ir45: 50, erosion: 30 };
  proche(gainSolde(p, 2029), effetImpot({ ...DEFAUTS, ...p }), 0.01);
  proche(gainSolde(p, 2027), effetImpot({ ...DEFAUTS, ...p }) / 3, 0.01);
});

// TVA : DG Trésor, « Analyse de la composition des recettes de TVA » (sept. 2025).
const { effetTVA } = require('../model.js');

test('TVA : rendement d’un point de chaque taux (7,5 / 1,6 / 2,0 / 0,4 Md€)', () => {
  proche(effetTVA(DEFAUTS), 0, 1e-9);
  proche(effetTVA({ ...DEFAUTS, tva20: 21 }), 7.5, 1e-9);
  proche(effetTVA({ ...DEFAUTS, tva10: 11 }), 1.6, 1e-9);
  proche(effetTVA({ ...DEFAUTS, tva55: 6.5 }), 2.0, 1e-9);
  proche(effetTVA({ ...DEFAUTS, tva21: 3.1 }), 0.4, 1e-9);
  proche(effetTVA({ ...DEFAUTS, tva20: 19 }), -7.5, 1e-9);
});

test('TVA : un point sur tous les taux rapporte environ 11,4 Md€, dès la première année', () => {
  const p = { tva20: 21, tva10: 11, tva55: 6.5, tva21: 3.1 };
  proche(effetTVA({ ...DEFAUTS, ...p }), 11.4, 0.15);
  proche(gainSolde(p, 2027), 11.5, 0.01);
  assert.ok(simuler({ ...DEFAUTS, ...p }).at(-1).ratio < simuler(DEFAUTS).at(-1).ratio);
});

// Aides aux entreprises : commission d'enquête du Sénat (2023), hors dépenses
// fiscales et hors Bpifrance.
test('aides aux entreprises : 37,5 Md€ nets pour tous les allègements, 7 Md€ de subventions', () => {
  proche(gainSolde({ allegements: 100 }, 2029), 75 * 0.5, 0.01);
  proche(gainSolde({ subventions: 100 }, 2029), 7, 0.01);
  proche(gainSolde({ subventions: 100 }, 2027), 7 / 3, 0.01);
  const ref = simuler(DEFAUTS).at(-1).postes;
  const t = simuler({ ...DEFAUTS, subventions: 100 }).at(-1).postes;
  assert.ok(t.economie < ref.economie, 'imputées aux affaires économiques');
  proche(t.sante, ref.sante, 1e-9);
});
