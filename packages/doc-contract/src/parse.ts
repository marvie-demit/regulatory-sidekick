// A STRICT tokenizer for the controlled-document fragments — not an HTML parser.
//
// Why not jsdom/parse5: the corpus is machine-generated and uses 13 tags, 2
// attributes and no self-closing forms except <br>. A real parser would
// helpfully REPAIR a malformed draft — close a stray <td>, drop a bad attribute
// — and hide exactly the defect we are trying to catch. Here, anything
// unexpected is an error. Unparseable must mean invalid.
//
// Zero dependencies, no fs, no network.

export type Tag =
  | "h1" | "h2" | "h3" | "h4"
  | "p" | "div" | "b" | "br"
  | "table" | "thead" | "tbody" | "tr" | "td" | "th";

/** Every tag the 275 stock fragments use. Anything else is rejected. */
export const ALLOWED_TAGS: readonly Tag[] = [
  "h1", "h2", "h3", "h4", "p", "div", "b", "br",
  "table", "thead", "tbody", "tr", "td", "th",
];

/** Only these two attributes appear in the corpus. */
export const ALLOWED_ATTRS = ["class", "colspan"] as const;

/** Every class the .paper stylesheet actually styles. */
export const ALLOWED_CLASSES = [
  "doc-title", "guidance", "headerband", "manual-banner", "manual",
  "grid", "grid reg", "tscroll", "emptyreg",
] as const;

const VOID_TAGS = new Set<Tag>(["br"]);

export type Token =
  | { k: "open"; tag: Tag; attrs: Record<string, string>; i: number }
  | { k: "close"; tag: Tag; i: number }
  | { k: "void"; tag: Tag; i: number }
  | { k: "text"; text: string; i: number }
  | { k: "comment"; text: string; i: number };

export type ParseIssue = { rule: string; message: string; at: number };

export type ParseResult = { tokens: Token[]; issues: ParseIssue[] };

const NAMED_ENTITIES = new Set([
  "amp", "lt", "gt", "quot", "apos", "nbsp", "mdash", "ndash",
  "hellip", "rsquo", "lsquo", "ldquo", "rdquo", "deg", "times", "middot",
  "eacute", "uuml", "auml", "ouml", "szlig", "copy", "reg", "trade", "euro",
]);

/**
 * Decode the entity subset the corpus uses. Deliberately narrow: an unknown
 * entity is left alone AND reported, rather than silently passed through.
 */
export function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body.startsWith("#")) {
      const code = body[1] === "x" || body[1] === "X"
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    switch (body) {
      case "amp": return "&";
      case "lt": return "<";
      case "gt": return ">";
      case "quot": return '"';
      case "apos": return "'";
      case "nbsp": return " ";
      case "mdash": return "—";
      case "ndash": return "–";
      default: return whole;
    }
  });
}

/** Decoded, whitespace-collapsed, trimmed — the form every text rule compares. */
export function normalizeText(s: string): string {
  return decodeEntities(s).replace(/\s+/g, " ").trim();
}

export function tokenize(html: string): ParseResult {
  const tokens: Token[] = [];
  const issues: ParseIssue[] = [];
  const bad = (rule: string, message: string, at: number) =>
    issues.push({ rule, message, at });

  let i = 0;
  const stack: { tag: Tag; i: number }[] = [];

  while (i < html.length) {
    const lt = html.indexOf("<", i);

    // ---- text run --------------------------------------------------------
    if (lt === -1 || lt > i) {
      const end = lt === -1 ? html.length : lt;
      const raw = html.slice(i, end);
      checkEntities(raw, i, bad);
      if (raw.trim()) tokens.push({ k: "text", text: raw, i });
      i = end;
      if (lt === -1) break;
      continue;
    }

    // ---- comment ---------------------------------------------------------
    if (html.startsWith("<!--", i)) {
      const end = html.indexOf("-->", i + 4);
      if (end === -1) {
        bad("html.comment", "Unterminated comment.", i);
        break;
      }
      tokens.push({ k: "comment", text: html.slice(i + 4, end), i });
      i = end + 3;
      continue;
    }

    // ---- doctype / processing instruction: never valid in a fragment ------
    if (html.startsWith("<!", i) || html.startsWith("<?", i)) {
      bad("html.fragment", "A fragment must not contain a doctype or processing instruction.", i);
      const end = html.indexOf(">", i);
      if (end === -1) break;
      i = end + 1;
      continue;
    }

    // ---- closing tag -----------------------------------------------------
    if (html.startsWith("</", i)) {
      const end = html.indexOf(">", i);
      if (end === -1) {
        bad("html.malformed", "Unterminated closing tag.", i);
        break;
      }
      const name = html.slice(i + 2, end).trim().toLowerCase();
      if (!isTag(name)) {
        bad("tag.allowed", `<\/${name}> is not an allowed tag.`, i);
      } else if (VOID_TAGS.has(name)) {
        bad("html.malformed", `<${name}> must not have a closing tag.`, i);
      } else {
        const top = stack.pop();
        if (!top) bad("html.balanced", `Stray closing <\/${name}>.`, i);
        else if (top.tag !== name)
          bad("html.balanced", `<${top.tag}> closed by <\/${name}>.`, i);
        else tokens.push({ k: "close", tag: name, i });
      }
      i = end + 1;
      continue;
    }

    // ---- opening tag -----------------------------------------------------
    const end = findTagEnd(html, i);
    if (end === -1) {
      bad("html.malformed", "Unterminated tag.", i);
      break;
    }
    const inner = html.slice(i + 1, end);
    if (inner.endsWith("/")) {
      bad("html.malformed", "Self-closing syntax is not used in this corpus.", i);
    }
    const m = /^([a-zA-Z][a-zA-Z0-9]*)/.exec(inner);
    if (!m) {
      bad("html.malformed", "Unreadable tag name.", i);
      i = end + 1;
      continue;
    }
    const name = m[1].toLowerCase();
    if (!isTag(name)) {
      bad(
        "tag.allowed",
        `<${name}> is not allowed. Use only: ${ALLOWED_TAGS.join(", ")}.`,
        i,
      );
      i = end + 1;
      continue;
    }

    const attrs = parseAttrs(inner.slice(m[1].length), i, name, bad);
    if (VOID_TAGS.has(name)) tokens.push({ k: "void", tag: name, i });
    else {
      tokens.push({ k: "open", tag: name, attrs, i });
      stack.push({ tag: name, i });
    }
    i = end + 1;
  }

  stack.forEach((s) =>
    bad("html.balanced", `<${s.tag}> is never closed.`, s.i),
  );

  return { tokens, issues };
}

function isTag(n: string): n is Tag {
  return (ALLOWED_TAGS as readonly string[]).includes(n);
}

/** Index of the '>' that ends this tag, respecting quoted attribute values. */
function findTagEnd(html: string, start: number): number {
  let q: '"' | "'" | null = null;
  for (let j = start + 1; j < html.length; j++) {
    const c = html[j];
    if (q) {
      if (c === q) q = null;
    } else if (c === '"' || c === "'") q = c;
    else if (c === ">") return j;
  }
  return -1;
}

function parseAttrs(
  s: string,
  at: number,
  tag: Tag,
  bad: (rule: string, message: string, at: number) => void,
): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([a-zA-Z-][a-zA-Z0-9:-]*)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const name = m[1].toLowerCase();
    const value = m[3] ?? m[4] ?? m[5] ?? "";
    if (!(ALLOWED_ATTRS as readonly string[]).includes(name)) {
      // THE XSS wall. These fragments are injected with dangerouslySetInnerHTML,
      // so style/on*/href/src/id are not style preferences — they are the
      // attack surface. Never relax this without changing how docs are rendered.
      bad(
        "attr.allowed",
        `<${tag} ${name}=…> — only ${ALLOWED_ATTRS.join(" and ")} are allowed.`,
        at,
      );
      continue;
    }
    if (name === "class" && !(ALLOWED_CLASSES as readonly string[]).includes(value)) {
      bad(
        "class.allowed",
        `class="${value}" is not styled. Allowed: ${ALLOWED_CLASSES.join(", ")}.`,
        at,
      );
    }
    if (name === "colspan" && !/^\d+$/.test(value)) {
      bad("attr.allowed", `colspan="${value}" must be a whole number.`, at);
    }
    attrs[name] = value;
  }
  return attrs;
}

/** A bare '&' that does not open a valid entity. Titles are full of "&". */
function checkEntities(
  raw: string,
  offset: number,
  bad: (rule: string, message: string, at: number) => void,
) {
  const re = /&(#x?[0-9a-fA-F]+|[a-zA-Z]+)?;?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const body = m[1];
    const terminated = m[0].endsWith(";");
    if (!body || !terminated) {
      bad(
        "entities",
        `Bare "&" at "${raw.slice(m.index, m.index + 12).trim()}…" — write &amp;`,
        offset + m.index,
      );
      continue;
    }
    if (!body.startsWith("#") && !NAMED_ENTITIES.has(body)) {
      bad("entities", `Unknown entity &${body};`, offset + m.index);
    }
  }
}

/** Concatenated, normalized text of a token range. */
export function textOf(tokens: Token[], from = 0, to = Number.MAX_SAFE_INTEGER): string {
  const parts: string[] = [];
  for (let j = from; j < Math.min(to, tokens.length); j++) {
    const t = tokens[j];
    if (t.k === "text") parts.push(t.text);
  }
  return normalizeText(parts.join(" "));
}
