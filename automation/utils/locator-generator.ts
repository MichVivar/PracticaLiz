import * as readline from 'readline';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';

dotenv.config();

// ─── Config ───────────────────────────────────────────────────────────────────

const USE_LOCAL = process.argv.includes('--local');
const GEMINI_MODEL = 'gemini-2.5-flash';

// ─── Colors ───────────────────────────────────────────────────────────────────

const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  gray:   '\x1b[90m',
  cyan:   '\x1b[36m',
};

function confidenceColor(confidence: 'ALTA' | 'MEDIA' | 'BAJA'): string {
  switch (confidence) {
    case 'ALTA':  return C.green;
    case 'MEDIA': return C.yellow;
    case 'BAJA':  return C.red;
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface ParsedElement {
  tag: string;
  attrs: Record<string, string>;
  innerText: string | null;
}

interface LocatorResult {
  locator: string;
  confidence: 'ALTA' | 'MEDIA' | 'BAJA';
  reason: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr'
]);

const ARIA_ROLE_MAP: Record<string, string> = {
  'button': 'button',
  'input:text': 'textbox',
  'input:search': 'searchbox',
  'input:url': 'textbox',
  'input:email': 'textbox',
  'input:tel': 'textbox',
  'input:checkbox': 'checkbox',
  'input:radio': 'radio',
  'input:number': 'spinbutton',
  'input:range': 'slider',
  'input:submit': 'button',
  'input:button': 'button',
  'input:reset': 'button',
  'input:image': 'button',
  'select': 'combobox',
  'textarea': 'textbox',
  'a': 'link',
  'h1': 'heading', 'h2': 'heading', 'h3': 'heading',
  'h4': 'heading', 'h5': 'heading', 'h6': 'heading',
  'img': 'img',
  'nav': 'navigation',
  'main': 'main',
  'header': 'banner',
  'footer': 'contentinfo',
  'aside': 'complementary',
  'form': 'form',
  'table': 'table',
  'li': 'listitem',
  'ul': 'list',
  'ol': 'list',
};

const CSS_STABLE_ATTRS = ['type', 'name', 'inputmode', 'role', 'aria-role'];

// ─── HTML Parser ─────────────────────────────────────────────────────────────

function findOpenTagEnd(html: string): number {
  let inDouble = false, inSingle = false;
  for (let i = 0; i < html.length; i++) {
    const c = html[i];
    if (c === '"' && !inSingle) { inDouble = !inDouble; continue; }
    if (c === "'" && !inDouble) { inSingle = !inSingle; continue; }
    if (c === '>' && !inDouble && !inSingle) return i;
  }
  return html.length - 1;
}

function parseHTMLElement(html: string): ParsedElement {
  html = html.trim();
  const tagMatch = html.match(/^<\s*([a-zA-Z][a-zA-Z0-9-]*)/);
  if (!tagMatch) throw new Error('No se pudo detectar un elemento HTML válido.');

  const tag = tagMatch[1].toLowerCase();
  const openTagEnd = findOpenTagEnd(html);
  const openTag = html.substring(0, openTagEnd + 1);

  const attrs: Record<string, string> = {};
  const attrRegex = /\s+([\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?/g;
  let m: RegExpExecArray | null;
  const attrStr = openTag.slice(tagMatch[0].length);
  while ((m = attrRegex.exec(attrStr)) !== null) {
    attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  }

  let innerText: string | null = null;
  if (!VOID_ELEMENTS.has(tag)) {
    const innerMatch = html.match(new RegExp(`>[^<]*?([^<]+?)<\\/${tag}\\s*>`, 'i'));
    if (innerMatch) {
      innerText = innerMatch[1].trim() || null;
    } else {
      const simple = html.match(/>([^<]+)</);
      if (simple) innerText = simple[1].trim() || null;
    }
  }

  return { tag, attrs, innerText };
}

// ─── ARIA Role Inference ──────────────────────────────────────────────────────

function inferAriaRole(el: ParsedElement): string | null {
  const { tag, attrs } = el;
  if (attrs['role']) return attrs['role'];
  if (tag === 'select' && 'multiple' in attrs) return 'listbox';
  if (tag === 'a' && !('href' in attrs)) return null;
  if (tag === 'input') {
    const type = (attrs['type'] || 'text').toLowerCase();
    if (type === 'password') return null;
    return ARIA_ROLE_MAP[`input:${type}`] ?? ARIA_ROLE_MAP['input:text'] ?? null;
  }
  return ARIA_ROLE_MAP[tag] ?? null;
}

function resolveAccessibleName(el: ParsedElement, role: string | null): string | null {
  const { attrs, innerText } = el;
  if (attrs['aria-label']?.trim()) return attrs['aria-label'].trim();
  if ((role === 'textbox' || role === 'searchbox') && attrs['placeholder']?.trim()) return attrs['placeholder'].trim();
  if (!VOID_ELEMENTS.has(el.tag) && innerText?.trim()) return innerText.trim();
  if (el.tag === 'img' && attrs['alt']?.trim()) return attrs['alt'].trim();
  if (role === 'button' && attrs['value']?.trim()) return attrs['value'].trim();
  if (attrs['title']?.trim()) return attrs['title'].trim();
  return null;
}

function buildCSSLocator(el: ParsedElement): string {
  const { tag, attrs } = el;
  let selector = tag;
  for (const attr of CSS_STABLE_ATTRS) {
    if (attrs[attr] !== undefined && attrs[attr] !== '') selector += `[${attr}="${attrs[attr]}"]`;
  }
  if (selector === tag) {
    const classVal = attrs['class']?.split(/\s+/)[0];
    if (classVal) selector += `.${classVal}`;
  }
  return `page.locator('${selector}')`;
}

// ─── Local Locator Generator ──────────────────────────────────────────────────

function generateLocatorsLocal(html: string): LocatorResult[] {
  const el = parseHTMLElement(html);
  const { tag, attrs } = el;
  const results: LocatorResult[] = [];
  const role = inferAriaRole(el);
  const accessibleName = resolveAccessibleName(el, role);

  if (role && accessibleName) {
    results.push({
      locator: `page.getByRole('${role}', { name: '${accessibleName}', exact: true })`,
      confidence: 'ALTA',
      reason: `Rol '${role}' (${tag}${attrs['type'] ? `[type=${attrs['type']}]` : ''}) + nombre accesible`
    });
  } else if (role) {
    results.push({
      locator: `page.getByRole('${role}')`,
      confidence: 'MEDIA',
      reason: `Rol '${role}' sin nombre accesible — puede no ser único en la página`
    });
  }

  if (attrs['aria-label']?.trim()) {
    results.push({
      locator: `page.getByLabel('${attrs['aria-label'].trim()}', { exact: true })`,
      confidence: 'ALTA',
      reason: 'Atributo aria-label presente'
    });
  }

  if (attrs['aria-labelledby']?.trim()) {
    results.push({
      locator: `page.getByLabel('/* texto del label con id="${attrs['aria-labelledby']}" */')`,
      confidence: 'MEDIA',
      reason: `aria-labelledby apunta a id="${attrs['aria-labelledby']}" — verifica el texto de ese label`
    });
  }

  if (attrs['placeholder']?.trim()) {
    results.push({
      locator: `page.getByPlaceholder('${attrs['placeholder'].trim()}')`,
      confidence: 'ALTA',
      reason: 'Atributo placeholder presente'
    });
  }

  if (!VOID_ELEMENTS.has(tag) && el.innerText?.trim()) {
    results.push({
      locator: `page.getByText('${el.innerText.trim()}', { exact: true })`,
      confidence: 'MEDIA',
      reason: 'Texto visible del elemento'
    });
  }

  if (attrs['data-testid']?.trim()) {
    results.push({
      locator: `page.getByTestId('${attrs['data-testid'].trim()}')`,
      confidence: 'ALTA',
      reason: 'Atributo data-testid presente'
    });
  }

  if (attrs['id']?.trim()) {
    results.push({
      locator: `page.locator('#${attrs['id'].trim()}')`,
      confidence: 'MEDIA',
      reason: 'Atributo id presente (único en página si el HTML es válido)'
    });
  }

  results.push({
    locator: buildCSSLocator(el),
    confidence: 'BAJA',
    reason: 'Selector CSS por atributos estables (fallback)'
  });

  const seen = new Set<string>();
  return results.filter(r => {
    if (seen.has(r.locator)) return false;
    seen.add(r.locator);
    return true;
  });
}

// ─── Gemini Locator Generator ─────────────────────────────────────────────────

async function generateLocatorsGemini(html: string): Promise<LocatorResult[]> {
  const apiKey = process.env['GEMINI_API_KEY'];
  if (!apiKey) throw new Error('GEMINI_API_KEY no encontrada en .env');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  const prompt = `Eres un experto en testing con Playwright. Dado el siguiente elemento HTML, genera los mejores locators de Playwright ordenados de mayor a menor prioridad según las mejores prácticas oficiales de Playwright (accesibilidad primero).

Elemento HTML:
${html}

Reglas:
- Prioridad: getByRole > getByLabel > getByPlaceholder > getByText > getByTestId > locator(CSS)
- Solo incluye locators que realmente apliquen al elemento dado
- Para getByRole, usa el rol ARIA implícito correcto según la spec HTML
- Para getByRole con name, usa el nombre accesible real (aria-label > placeholder para textbox > texto interno)
- inputmode="numeric" NO es lo mismo que type="number" — no cambies el rol por eso
- Siempre incluye un locator CSS como fallback final
- Clasifica cada locator como ALTA, MEDIA o BAJA confianza

Responde ÚNICAMENTE con JSON válido, sin markdown, sin explicación, en este formato exacto:
[
  {
    "locator": "page.getByRole('textbox', { name: 'Usuario', exact: true })",
    "confidence": "ALTA",
    "reason": "Rol textbox con nombre accesible via placeholder"
  }
]`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const clean = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(clean);
  } catch {
    throw new Error(`Gemini devolvió una respuesta no válida:\n${text}`);
  }

  if (!Array.isArray(parsed)) throw new Error('Gemini devolvió un formato inesperado.');

  return (parsed as Array<Record<string, string>>).map(item => ({
    locator: String(item['locator'] ?? ''),
    confidence: (['ALTA', 'MEDIA', 'BAJA'].includes(item['confidence'] ?? '') ? item['confidence'] : 'MEDIA') as LocatorResult['confidence'],
    reason: String(item['reason'] ?? ''),
  })).filter(r => r.locator);
}

// ─── Output Formatter ─────────────────────────────────────────────────────────

const SEMAFORO: Record<LocatorResult['confidence'], string> = {
  ALTA:  '🟢',
  MEDIA: '🟡',
  BAJA:  '🔴',
};

function formatOutput(results: LocatorResult[], source: 'gemini' | 'local'): string {
  const border = '═'.repeat(56);
  const sourceLabel = source === 'gemini' ? '✦ Gemini AI' : '⚙ Local Parser';
  const lines: string[] = [
    `\n${border}`,
    `  Locators sugeridos — ${sourceLabel}`,
    border,
  ];

  if (results.length === 0) {
    lines.push('\n  No se encontraron locators. Considera agregar data-testid al elemento.');
  } else {
    results.forEach((r, i) => {
      const color = confidenceColor(r.confidence);
      const badge = `${SEMAFORO[r.confidence]} ${r.confidence.padEnd(5)}`;
      lines.push(`\n  ${color}${C.bold}${i + 1}. [${badge}]${C.reset}  ${r.locator}`);
      lines.push(`  ${C.gray}             Razón: ${r.reason}${C.reset}`);
    });
  }

  lines.push(`\n${border}\n`);
  return lines.join('\n');
}

// ─── Multi-line Input ─────────────────────────────────────────────────────────

function isCompleteTag(buffer: string): boolean {
  let inDouble = false, inSingle = false;
  for (const c of buffer) {
    if (c === '"' && !inSingle) { inDouble = !inDouble; continue; }
    if (c === "'" && !inDouble) { inSingle = !inSingle; continue; }
    if (c === '>' && !inDouble && !inSingle) return true;
  }
  return false;
}

// ─── Main REPL ────────────────────────────────────────────────────────────────

async function processHTML(html: string): Promise<void> {
  if (USE_LOCAL) {
    const results = generateLocatorsLocal(html);
    console.log(formatOutput(results, 'local'));
    return;
  }

  process.stdout.write(`  ${C.cyan}Consultando Gemini${C.reset}`);
  const interval = setInterval(() => process.stdout.write('.'), 400);

  try {
    const results = await generateLocatorsGemini(html);
    clearInterval(interval);
    process.stdout.write('\n');
    console.log(formatOutput(results, 'gemini'));
  } catch (e: unknown) {
    clearInterval(interval);
    process.stdout.write('\n');
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`\n  ${C.red}Error de Gemini:${C.reset} ${msg}`);
    console.log(`  ${C.yellow}Usando parser local como fallback...${C.reset}\n`);
    const results = generateLocatorsLocal(html);
    console.log(formatOutput(results, 'local'));
  }
}

function main(): void {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const modeLabel = USE_LOCAL
    ? `${C.yellow}⚙  Modo: Local Parser${C.reset}`
    : `${C.cyan}✦  Modo: Gemini AI${C.reset}  ${C.gray}(usa --local para modo offline)${C.reset}`;

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║        Playwright Locator Generator v2.0             ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log(`\n  ${modeLabel}`);
  console.log(`  ${C.gray}Escribe "salir" para terminar.${C.reset}\n`);

  let buffer = '';
  let isCollecting = false;

  const prompt = () => {
    if (!isCollecting) rl.question('> Elemento HTML: ', handleLine);
  };

  const handleLine = async (line: string) => {
    const trimmed = line.trim();

    if (!isCollecting && (trimmed.toLowerCase() === 'salir' || trimmed.toLowerCase() === 'exit')) {
      console.log('\n  Hasta luego!\n');
      rl.close();
      return;
    }

    if (!isCollecting && trimmed === '') { prompt(); return; }

    buffer += (buffer ? '\n' : '') + line;
    if (!isCollecting && trimmed.startsWith('<')) isCollecting = true;

    if (isCollecting && isCompleteTag(buffer)) {
      isCollecting = false;
      const html = buffer.trim();
      buffer = '';

      try {
        await processHTML(html);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log(`\n  ${C.red}Error:${C.reset} ${msg}\n`);
      }

      if (!(rl as unknown as { closed: boolean }).closed) prompt();
    } else if (isCollecting) {
      rl.question('', handleLine);
    } else {
      prompt();
    }
  };

  prompt();
}

main();