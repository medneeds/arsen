/**
 * formatPresentation
 * --------------------------------------------------------------
 * Normaliza o campo "apresentação" das medicações para um padrão
 * único, compacto e legível na prescrição.
 *
 * Regras:
 *  - Unidades em caixa correta: mg, mcg, g, mL, UI, %
 *  - Formas farmacêuticas abreviadas:
 *      ampola → amp, frasco-ampola → fr-amp, frasco → fr,
 *      seringa → ser, comprimido → cp, cápsula → cps,
 *      drágea → drg, sachê → sch, bolsa → bls,
 *      solução → sol, suspensão → susp, supositório → sup,
 *      flaconete → flac, bisnaga → bsn, envelope → env,
 *      pomada → pom, creme → cr, gotas → gts
 *  - "por" / "x" entre dose e volume → "/"
 *  - " — " ou " - " preservado como separador "dose/volume — forma"
 *  - Remove espaços duplicados e CAIXA ALTA desnecessária
 *
 * Função pura, segura para usar em render e em criação de itens.
 */

// Usamos (?<![A-Za-zÀ-ÿ]) / (?![A-Za-zÀ-ÿ]) no lugar de \b para
// reconhecer unidades coladas a números (ex.: 200MG, 5ml, 500mcg)
// sem casar pedaços de palavras (ex.: "ML" dentro de "AMOXIMOL").
const UNIT_MAP: Array<[RegExp, string]> = [
  // microgramas (vem antes de "mg" para não confundir)
  [/\bmicrogramas?\b/gi, "mcg"],
  [/(?<![A-Za-zÀ-ÿ])mcgs?(?![A-Za-zÀ-ÿ])/gi, "mcg"],
  [/(?<![A-Za-zÀ-ÿ])MCG(?![A-Za-zÀ-ÿ])/g, "mcg"],
  [/µg/g, "mcg"],
  // miligramas
  [/\bmiligramas?\b/gi, "mg"],
  [/(?<![A-Za-zÀ-ÿ])milig(?![A-Za-zÀ-ÿ])/gi, "mg"],
  [/(?<![A-Za-zÀ-ÿ])mg(?![A-Za-zÀ-ÿ])/gi, "mg"],
  // mililitros (antes de "L" sozinho)
  [/\bmililitros?\b/gi, "mL"],
  [/(?<![A-Za-zÀ-ÿ])ml(?![A-Za-zÀ-ÿ])/gi, "mL"],
  // gramas (cuidado: só casa "g" colado a número, evita virar artigo)
  [/\bgramas?\b/gi, "g"],
  [/(?<=\d\s?)GR?(?![A-Za-zÀ-ÿ])/g, "g"],
  [/(?<=\d)\s?g(?![A-Za-zÀ-ÿ])/g, " g"],
  // litros
  [/\blitros?\b/gi, "L"],
  // unidades internacionais
  [/\bunidades?\s+internacionais?\b/gi, "UI"],
  [/(?<![A-Za-zÀ-ÿ])ui(?![A-Za-zÀ-ÿ])/gi, "UI"],
  // porcentagem permanece "%"
];

const FORM_MAP: Array<[RegExp, string]> = [
  // mais específicos primeiro
  [/\bfrascos?[\s-]+ampolas?\b/gi, "fr-amp"],
  [/\bfr[\s-]+amp\b/gi, "fr-amp"],
  [/\bampolas?\b/gi, "amp"],
  [/\bfrascos?\b/gi, "fr"],
  [/\bseringas?\b/gi, "ser"],
  [/\bcomprimidos?\b/gi, "cp"],
  [/\bc[áa]psulas?\b/gi, "cps"],
  [/\bdr[áa]geas?\b/gi, "drg"],
  [/\bsach[êe]s?\b/gi, "sch"],
  [/\bbolsas?\b/gi, "bls"],
  [/\bsolu[çc][ãa]o\b/gi, "sol"],
  [/\bsuspens[ãa]o\b/gi, "susp"],
  [/\bsupposit[óo]rios?\b/gi, "sup"],
  [/\bsupposit[óo]rio\b/gi, "sup"],
  [/\bsupp?osit[óo]rios?\b/gi, "sup"],
  [/\bsupositórios?\b/gi, "sup"],
  [/\bflaconetes?\b/gi, "flac"],
  [/\bbisnagas?\b/gi, "bsn"],
  [/\benvelopes?\b/gi, "env"],
  [/\bpomadas?\b/gi, "pom"],
  [/\bcremes?\b/gi, "cr"],
  [/\bgotas?\b/gi, "gts"],
];

export function formatPresentation(raw?: string | null): string {
  if (!raw) return "";
  let s = String(raw).trim();
  if (!s || s === "-") return s;

  // "por" entre números → "/"
  s = s.replace(/(\d)\s*por\s*(\d)/gi, "$1/$2");
  // "x" entre números → "/"  (ex.: 40mg x 0,4mL)
  s = s.replace(/(\d)\s*[xX]\s*(\d)/g, "$1/$2");

  // unidades
  for (const [re, rep] of UNIT_MAP) s = s.replace(re, rep);
  // formas farmacêuticas
  for (const [re, rep] of FORM_MAP) s = s.replace(re, rep);

  // separadores: " - " e " – " → " — "
  s = s.replace(/\s+[-–]\s+/g, " — ");

  // remove caixa-alta de palavras restantes (mantém siglas curtas e unidades já normalizadas)
  s = s.replace(/\b[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{4,}\b/g, (m) =>
    m.charAt(0) + m.slice(1).toLowerCase()
  );

  // espaços
  s = s.replace(/\s{2,}/g, " ").trim();
  // espaço antes de unidade colada: "40 mg" tudo bem; "40mg" também ok — não força
  return s;
}
