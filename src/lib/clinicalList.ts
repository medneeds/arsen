/**
 * Leitura tolerante de listas clinicas guardadas como texto (diagnosticos,
 * antecedentes). O normal e uma linha por item, mas o dado chega as vezes
 * serializado: JSON (`["Dx 1","Dx 2"]`), literal de array do Postgres
 * (`{"Dx 1","Dx 2"}`), itens entre aspas ou um JSON truncado. Na tela isso
 * apareceria com colchetes, aspas e chaves; aqui vira uma lista limpa.
 *
 * Texto comum (sem aspecto de JSON) segue o caminho antigo: uma linha, um item.
 */
const NAME_KEYS = ["text", "label", "name", "nome", "descricao", "description", "diagnostico", "titulo", "title"];

const clean = (items: string[]): string[] => items.map((s) => s.trim()).filter(Boolean);

function itemToString(item: unknown): string | null {
  if (typeof item === "string") return item;
  if (item && typeof item === "object") {
    for (const k of NAME_KEYS) {
      const v = (item as Record<string, unknown>)[k];
      if (typeof v === "string" && v.trim()) return v;
    }
  }
  return null;
}

function fromJson(t: string): string[] | null {
  try {
    const parsed: unknown = JSON.parse(t);
    if (Array.isArray(parsed)) {
      return clean(parsed.map(itemToString).filter((s): s is string => s !== null));
    }
    if (typeof parsed === "string") return clean(parsed.split(/\r?\n/));
  } catch {
    /* nao e JSON valido */
  }
  return null;
}

/** JSON truncado/quebrado: so aproveita se o que sobra fora das aspas e pontuacao. */
function salvageQuoted(t: string): string[] | null {
  const tokens = [...t.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1].replace(/\\"/g, '"'));
  if (tokens.length === 0) return null;
  const rest = t.replace(/"((?:[^"\\]|\\.)*)"/g, "").replace(/[\s,[\]{}]/g, "");
  return rest === "" ? clean(tokens) : null;
}

/** Literal de array de texto do Postgres: {a,b} / {"a b","c, d"}. */
function fromPgArray(t: string): string[] | null {
  if (!(t.startsWith("{") && t.endsWith("}"))) return null;
  const inner = t.slice(1, -1);
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  let wasQuoted = false;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (quoted) {
      if (c === "\\" && i + 1 < inner.length) cur += inner[++i];
      else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') {
      quoted = true;
      wasQuoted = true;
    } else if (c === ",") {
      if (wasQuoted || cur.trim().toUpperCase() !== "NULL") out.push(cur);
      cur = "";
      wasQuoted = false;
    } else cur += c;
  }
  if (quoted) return null; // aspas abertas: nao e um literal confiavel
  if (wasQuoted || cur.trim().toUpperCase() !== "NULL") out.push(cur);
  return clean(out);
}

function fromLines(t: string): string[] {
  return clean(
    t
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => !/^[[\]{}],?$/.test(line))
      .map((line) => {
        const m = line.match(/^"(.*)",?$/);
        return m ? m[1].replace(/\\"/g, '"') : line;
      }),
  );
}

function parseString(value: string): string[] {
  const t = value.trim();
  if (!t) return [];
  if (t.startsWith("[") || t.startsWith('"')) {
    const j = fromJson(t);
    if (j) return j;
    if (t.startsWith("[")) {
      const s = salvageQuoted(t);
      if (s) return s;
    }
  }
  if (t.startsWith("{")) {
    const pg = fromPgArray(t);
    if (pg) return pg;
    const s = salvageQuoted(t);
    if (s) return s;
  }
  return fromLines(t);
}

export function parseClinicalList(value: string | string[] | null | undefined): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (typeof item !== "string") return [];
      const t = item.trim();
      return /^[[{"]/.test(t) ? parseString(t) : clean([item]);
    });
  }
  return parseString(value);
}
