// Abreviações institucionais para o PDF da prescrição.
// Aplicadas apenas na camada de impressão — não alteram dados persistidos.

const PRESENTATION_MAP: Array<[RegExp, string]> = [
  [/\bcomprimidos?\b/gi, 'COMP.'],
  [/\bcompr\.?\b/gi, 'COMP.'],
  [/\bcp\b/gi, 'COMP.'],
  [/\bcápsulas?\b/gi, 'CÁPS.'],
  [/\bcapsulas?\b/gi, 'CÁPS.'],
  [/\bdrágeas?\b/gi, 'DRG'],
  [/\bdrageas?\b/gi, 'DRG'],
  [/\bfrasco[-\s]?ampolas?\b/gi, 'FA'],
  [/\bampolas?\b/gi, 'AMP'],
  [/\bfrascos?\b/gi, 'FR'],
  [/\bsachês?\b/gi, 'SCH'],
  [/\bsaches?\b/gi, 'SCH'],
  [/\bbisnagas?\b/gi, 'BIS'],
  [/\bseringas?\b/gi, 'SER'],
  [/\bsoluções?\b/gi, 'SOL'],
  [/\bsolucoes?\b/gi, 'SOL'],
  [/\bsolução\b/gi, 'SOL'],
  [/\bsolucao\b/gi, 'SOL'],
  [/\bsuspensões?\b/gi, 'SUSP'],
  [/\bsuspensao\b/gi, 'SUSP'],
  [/\bxaropes?\b/gi, 'XAR'],
  [/\bsupositórios?\b/gi, 'SUP'],
  [/\bsupositorios?\b/gi, 'SUP'],
  [/\badesivos?\b/gi, 'ADES.'],
  [/\bpomadas?\b/gi, 'POM'],
  [/\bcremes?\b/gi, 'CR'],
  [/\bgotas?\b/gi, 'GTS'],
];

export function abbrevPresentation(input?: string | null): string {
  if (!input) return '';
  let out = input;
  for (const [re, rep] of PRESENTATION_MAP) out = out.replace(re, rep);
  return out;
}

const ROUTE_MAP: Array<[RegExp, string]> = [
  [/\b(intra[-\s]?venosa|endovenosa|endo[-\s]?venosa|intravenoso|endovenoso)\b/gi, 'EV'],
  [/\bIV\b/g, 'EV'],
  [/\b(intra[-\s]?muscular|intramuscular)\b/gi, 'IM'],
  [/\b(sub[-\s]?cutânea|subcutanea|sub[-\s]?cutaneo|hipodérmica|hipodermica)\b/gi, 'SC'],
  [/\bSubcut\b/gi, 'SC'],
  [/\bvia oral\b/gi, 'VO'],
  [/\boral\b/gi, 'VO'],
  [/\bsublingual\b/gi, 'SL'],
  [/\bretal\b/gi, 'VR'],
  [/\binala(t[óo]ria|ção|cao)\b/gi, 'INAL'],
  [/\btópica\b/gi, 'TÓP'],
  [/\btopica\b/gi, 'TÓP'],
  [/\boftálmica\b/gi, 'OFT'],
  [/\boftalmica\b/gi, 'OFT'],
  [/\bot[óo]l[óo]gica\b/gi, 'OTO'],
  [/\bnasal\b/gi, 'NAS'],
  [/\btrans[-\s]?dérmica\b/gi, 'TD'],
  [/\btransdermica\b/gi, 'TD'],
  [/\bsonda nasoenteral\b/gi, 'SNE'],
  [/\bsonda nasog[áa]strica\b/gi, 'SNG'],
  [/\bgastrostomia\b/gi, 'GTT'],
  [/\bjejunostomia\b/gi, 'JJT'],
  [/\benteral\b/gi, 'SNE'],
];

export function abbrevRoute(input?: string | null): string {
  if (!input) return '';
  let out = input.trim();
  for (const [re, rep] of ROUTE_MAP) out = out.replace(re, rep);
  return out;
}
