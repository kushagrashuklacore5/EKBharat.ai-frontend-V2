import type { Item, JsonValue } from './types'

/** Read a dotted/bracket path such as "lead.score" or "lines[0].hsn". */
export function getPath(obj: JsonValue | undefined, path: string): JsonValue | undefined {
  if (!path.trim()) return obj
  const parts = path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .map((p) => p.trim())
    .filter(Boolean)
  let cur: JsonValue | undefined = obj
  for (const p of parts) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined
    cur = Array.isArray(cur) ? cur[Number(p)] : (cur as Record<string, JsonValue>)[p]
  }
  return cur
}

const EXPR = /\{\{\s*([^}]+?)\s*\}\}/g

/**
 * Resolve n8n-style expressions inside a string:
 *   {{ $json.field }}   – field of the current item
 *   {{ $input.count }}  – number of input items
 *   {{ $now }}          – ISO timestamp
 * A string that is exactly one expression keeps the value's type.
 */
export function resolveExpr(template: string, item: Item, ctx: { count: number }): JsonValue {
  const one = template.trim().match(/^\{\{\s*([^}]+?)\s*\}\}$/)
  const evalOne = (expr: string): JsonValue | undefined => {
    if (expr === '$now') return new Date().toISOString()
    if (expr === '$input.count') return ctx.count
    if (expr === '$json') return item
    if (expr.startsWith('$json.')) return getPath(item, expr.slice(6))
    return undefined
  }
  if (one) {
    const v = evalOne(one[1])
    return v === undefined ? null : v
  }
  return template.replace(EXPR, (_, expr: string) => {
    const v = evalOne(expr)
    if (v === undefined || v === null) return ''
    return typeof v === 'object' ? JSON.stringify(v) : String(v)
  })
}

export const hasExpr = (s: string) => /\{\{.*\}\}/.test(s)

export type Operator = 'equals' | 'notEquals' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'notContains' | 'isTrue' | 'isFalse' | 'exists' | 'isEmpty'

export const OPERATORS: { id: Operator; label: string; needsValue: boolean }[] = [
  { id: 'equals', label: 'is equal to', needsValue: true },
  { id: 'notEquals', label: 'is not equal to', needsValue: true },
  { id: 'gt', label: 'is greater than', needsValue: true },
  { id: 'gte', label: 'is greater than or equal', needsValue: true },
  { id: 'lt', label: 'is less than', needsValue: true },
  { id: 'lte', label: 'is less than or equal', needsValue: true },
  { id: 'contains', label: 'contains', needsValue: true },
  { id: 'notContains', label: 'does not contain', needsValue: true },
  { id: 'isTrue', label: 'is true', needsValue: false },
  { id: 'isFalse', label: 'is false', needsValue: false },
  { id: 'exists', label: 'exists', needsValue: false },
  { id: 'isEmpty', label: 'is empty', needsValue: false },
]

const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN)

/** Evaluate one condition against an item. Unknown operators evaluate to false. */
export function evaluate(item: Item, field: string, op: string, raw: string): boolean {
  const left = getPath(item, field)
  const right: JsonValue = raw === 'true' ? true : raw === 'false' ? false : raw
  switch (op as Operator) {
    case 'equals':
      return Number.isFinite(num(left)) && Number.isFinite(num(right)) ? num(left) === num(right) : String(left ?? '') === String(right)
    case 'notEquals':
      return !evaluate(item, field, 'equals', raw)
    case 'gt':
      return num(left) > num(right)
    case 'gte':
      return num(left) >= num(right)
    case 'lt':
      return num(left) < num(right)
    case 'lte':
      return num(left) <= num(right)
    case 'contains':
      return Array.isArray(left) ? left.map(String).includes(String(right)) : String(left ?? '').toLowerCase().includes(String(right).toLowerCase())
    case 'notContains':
      return !evaluate(item, field, 'contains', raw)
    case 'isTrue':
      return left === true || left === 'true'
    case 'isFalse':
      return left === false || left === 'false'
    case 'exists':
      return left !== undefined && left !== null
    case 'isEmpty':
      return left === undefined || left === null || left === '' || (Array.isArray(left) && left.length === 0)
    default:
      return false
  }
}

/** Minimal RFC-4180-ish CSV parser (quoted fields, escaped quotes, header row). */
export function parseCsv(text: string, delimiter = ','): Item[] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') q = false
      else field += c
    } else if (c === '"') q = true
    else if (c === delimiter) {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      field = ''
      if (row.some((f) => f !== '')) rows.push(row)
      row = []
    } else field += c
  }
  row.push(field)
  if (row.some((f) => f !== '')) rows.push(row)
  if (!rows.length) return []
  const [head, ...body] = rows
  return body.map((r) =>
    Object.fromEntries(
      head.map((h, i) => {
        const v = (r[i] ?? '').trim()
        const n = Number(v)
        return [h.trim(), v !== '' && Number.isFinite(n) ? n : v]
      }),
    ),
  )
}

export type SchemaNode = { key: string; type: string; children?: SchemaNode[] }

/** Infer a merged schema from items, for the "Schema" data view. */
export function inferSchema(items: Item[]): SchemaNode[] {
  const typeOf = (v: JsonValue): string => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v)
  const walk = (values: JsonValue[]): SchemaNode[] => {
    const keys = new Map<string, JsonValue[]>()
    values.forEach((v) => {
      if (v && typeof v === 'object' && !Array.isArray(v))
        Object.entries(v).forEach(([k, x]) => keys.set(k, [...(keys.get(k) ?? []), x]))
    })
    return [...keys.entries()].map(([key, vs]) => {
      const types = [...new Set(vs.map(typeOf))]
      const objs = vs.filter((x) => x && typeof x === 'object' && !Array.isArray(x))
      const arrItems = vs.filter(Array.isArray).flat() as JsonValue[]
      const children = objs.length ? walk(objs) : arrItems.some((x) => x && typeof x === 'object') ? walk(arrItems) : undefined
      const t = types.join(' | ')
      return { key, type: t === 'array' && arrItems.length ? `array<${[...new Set(arrItems.map(typeOf))].join('|')}>` : t, children }
    })
  }
  return walk(items)
}

const PII: [RegExp, (m: string) => string][] = [
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, (m) => `${m[0]}•••@${m.split('@')[1]}`],
  [/\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]\b/g, (m) => `${m.slice(0, 2)}•••••••••${m.slice(-4)}`], // GSTIN
  [/\b[A-Z]{5}\d{4}[A-Z]\b/g, (m) => `${m.slice(0, 2)}••••••${m.slice(-2)}`], // PAN
  [/(\+91[\s-]?)?\b[6-9]\d{4}[\s-]?\d{5}\b/g, (m) => `${m.slice(0, m.length - 10)}••••••${m.slice(-4)}`], // Indian mobile
]

/** Mask common Indian PII patterns in a string (DPDP-minded display control). */
export function maskPii(s: string): string {
  return PII.reduce((acc, [re, f]) => acc.replace(re, f), s)
}

/** Deep-mask PII in a JSON value. */
export function maskValue(v: JsonValue): JsonValue {
  if (typeof v === 'string') return maskPii(v)
  if (Array.isArray(v)) return v.map(maskValue)
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, maskValue(x)]))
  return v
}

/** Deterministic 32-bit hash for stable simulated metrics. */
export function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export const uid = (p = 'n') => `${p}${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`

export function safeJson(text: string): { ok: true; value: JsonValue } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(text) as JsonValue }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Invalid JSON' }
  }
}

/** Coerce a parsed JSON value into an item array. */
export function toItems(v: JsonValue): Item[] {
  if (Array.isArray(v)) return v.map((x) => (x && typeof x === 'object' && !Array.isArray(x) ? (x as Item) : { value: x }))
  if (v && typeof v === 'object') return [v as Item]
  return [{ value: v }]
}
