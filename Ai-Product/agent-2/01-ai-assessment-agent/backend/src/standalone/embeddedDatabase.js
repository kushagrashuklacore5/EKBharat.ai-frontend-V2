'use strict';
/**
 * Standalone replacement for the LMS database interface the assessment adapter uses
 * ({ get, all, run, transaction } with `?` placeholders, promises).
 *
 * In the LMS this interface came from server/helpers/dbAsync.js over server/config/pg-db.js (a pg Pool).
 * Here it runs the SAME PostgreSQL SQL on PGlite (PostgreSQL compiled to WebAssembly), so the original
 * PostgresAssessmentLmsAdapter is used unchanged and nothing needs to be installed besides npm packages.
 *
 * The statement translation is ported from the LMS's pg-db.js:
 *   - `?` placeholders become $1, $2, ... (outside string literals, quoted names and comments);
 *   - an INSERT into a table with an identity `id` gets `RETURNING id`, which fills lastID;
 *   - an INSERT that supplies `id` itself moves that table's id sequence past it;
 *   - result columns get back the camelCase the code uses (PostgreSQL folds unquoted names to lower case);
 *   - BIGINT / NUMERIC arrive as JS numbers, booleans as 1/0, JS booleans are sent as 1/0.
 *
 * PGlite has one connection, so statements are serialised: a transaction holds the connection until it
 * commits or rolls back, and every statement issued from inside it (any depth, tracked with
 * AsyncLocalStorage) runs in it. Statements from other requests wait.
 *
 * dataDir: undefined = in memory (lost on exit); a folder path = persisted on disk.
 */
const fs = require('fs');
const path = require('path');
const { AsyncLocalStorage } = require('async_hooks');

const SCHEMA_FILE = path.join(__dirname, 'schema.sql');

// lower-case name -> spelling used by the code, for every camelCase table/column of the schema
function schemaNames(sqlText) {
  const names = new Map();
  for (const m of sqlText.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?([A-Za-z_]\w*)/g)) names.set(m[1].toLowerCase(), m[1]);
  for (const m of sqlText.matchAll(/^\s+([A-Za-z_]\w*) (?:BIGINT|TEXT|SMALLINT|DOUBLE PRECISION|NUMERIC|INTEGER)\b/gm)) names.set(m[1].toLowerCase(), m[1]);
  for (const [k, v] of names) if (k === v) names.delete(k);
  return names;
}

const IDENT = /[A-Za-z_][A-Za-z0-9_]*/y;
const translated = new Map();

function translate(sql) {
  const cached = translated.get(sql);
  if (cached) return cached;
  let text = '';
  let index = 0;
  const names = new Map();
  for (let i = 0; i < sql.length; ) {
    const ch = sql[i];
    if (ch === "'" || ch === '"') {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === ch) {
          if (sql[j + 1] === ch) { j += 2; continue; }
          break;
        }
        j++;
      }
      text += sql.slice(i, j + 1);
      i = j + 1;
    } else if (ch === '-' && sql[i + 1] === '-') {
      const end = sql.indexOf('\n', i);
      const j = end === -1 ? sql.length : end;
      text += sql.slice(i, j);
      i = j;
    } else if (ch === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2);
      const j = end === -1 ? sql.length : end + 2;
      text += sql.slice(i, j);
      i = j;
    } else if (ch === '?') {
      text += `$${++index}`;
      i++;
    } else if (/[A-Za-z_]/.test(ch) && !/[A-Za-z0-9_$]/.test(sql[i - 1] || '')) {
      IDENT.lastIndex = i;
      const word = IDENT.exec(sql)[0];
      if (word !== word.toLowerCase() && word !== word.toUpperCase() && !names.has(word.toLowerCase())) names.set(word.toLowerCase(), word);
      text += word;
      i += word.length;
    } else {
      text += ch;
      i++;
    }
  }
  const insert = /^\s*INSERT\s+INTO\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:\(([^)]*)\))?/i.exec(text);
  const entry = {
    text: text.replace(/;\s*$/, ''),
    names,
    isInsert: Boolean(insert),
    insertTable: insert ? insert[1].toLowerCase() : null,
    insertsId: insert && insert[2] ? insert[2].split(',').some((c) => c.trim().replace(/"/g, '').toLowerCase() === 'id') : false,
    returns: /\bRETURNING\b/i.test(text),
  };
  if (translated.size > 5000) translated.clear();
  translated.set(sql, entry);
  return entry;
}

/**
 * Ported from the LMS pg-db.js. For an "invalid input syntax" / "out of range" error caused by a bound
 * value, the set of parameter indexes to bind as NULL instead, or null to report the error:
 *   - '' (an empty form field) anywhere: NULL is "no value";
 *   - any other value used only to filter (a SELECT parameter, or a WHERE-clause parameter of an
 *     UPDATE / DELETE): it can never match, and NULL matches nothing.
 */
function uncastableFilterParams(err, t, text, params) {
  if (!err || (err.code !== '22P02' && err.code !== '22003')) return null;
  const quoted = /"((?:[^"]|"")*)"/.exec(err.message || '');
  if (!quoted) return null;
  const value = quoted[1].replace(/""/g, '"');
  if (value === '') {
    const empty = new Set(params.map((p, i) => (p === '' ? i : -1)).filter((i) => i >= 0));
    return empty.size ? empty : null;
  }
  if (t.isInsert) return null;
  const statement = /^\s*(\w+)/.exec(text);
  const kind = statement ? statement[1].toUpperCase() : '';
  if (!['SELECT', 'WITH', 'UPDATE', 'DELETE'].includes(kind)) return null;
  const where = kind === 'SELECT' || kind === 'WITH' ? -1 : text.search(/\bWHERE\b/i);
  if (kind !== 'SELECT' && kind !== 'WITH' && where < 0) return null;
  const hits = new Set();
  params.forEach((p, i) => {
    if (p === null || String(p) !== value) return;
    const placeholder = new RegExp(`\\$${i + 1}(?!\\d)`, 'g');
    let m;
    while ((m = placeholder.exec(text))) if (m.index < where) return; // also written as a value
    hits.add(i);
  });
  return hits.size ? hits : null;
}

function toParam(value) {
  if (value === undefined) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value instanceof Date) return value.getTime();
  return value;
}

const PARSERS = {
  20: (v) => { const n = Number(v); return Number.isSafeInteger(n) ? n : v; }, // INT8
  1700: (v) => Number(v), // NUMERIC
  16: (v) => (v === 't' || v === true ? 1 : 0), // BOOL
};

// In-memory databases start from a snapshot of an empty, migrated database (built once per process).
let emptySnapshot = null;
async function emptyDatabaseSnapshot(PGlite, schemaText) {
  if (!emptySnapshot) {
    emptySnapshot = (async () => {
      const pg = new PGlite();
      await pg.exec(schemaText);
      const dump = await pg.dumpDataDir();
      await pg.close();
      return dump;
    })();
  }
  return emptySnapshot;
}

/** Opens (and if needed creates) the embedded database. Resolves to { get, all, run, transaction, exec, close, sql }. */
async function openEmbeddedDatabase({ dataDir } = {}) {
  const { PGlite } = require('@electric-sql/pglite');
  const schemaText = fs.readFileSync(SCHEMA_FILE, 'utf8');
  const SCHEMA_NAMES = schemaNames(schemaText);
  let pg;
  if (dataDir) {
    fs.mkdirSync(dataDir, { recursive: true });
    pg = new PGlite(dataDir, { parsers: PARSERS });
  } else {
    pg = new PGlite({ parsers: PARSERS, loadDataDir: await emptyDatabaseSnapshot(PGlite, schemaText) });
  }
  await pg.waitReady;

  const exists = await pg.query("SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'users'");
  if (exists.rows.length === 0) await pg.exec(schemaText);

  let identityTables = new Set();
  const loadIdentityTables = async () => {
    const idRows = await pg.query("SELECT table_name FROM information_schema.columns WHERE table_schema = current_schema() AND column_name = 'id' AND is_identity = 'YES'");
    identityTables = new Set(idRows.rows.map((r) => r.table_name));
  };
  await loadIdentityTables();

  // ---- connection lock (one statement or one transaction at a time) ----
  const txContext = new AsyncLocalStorage();
  let tail = Promise.resolve();
  const withLock = (work) => {
    const run = tail.then(work, work);
    tail = run.catch(() => {});
    return run;
  };

  const renameColumns = (result, names) => {
    const fields = result.fields || [];
    const mapped = fields.map((f) => names.get(f.name) || SCHEMA_NAMES.get(f.name) || f.name);
    if (mapped.every((name, i) => name === fields[i].name)) return result.rows;
    return result.rows.map((row) => {
      const out = {};
      fields.forEach((f, i) => { out[mapped[i]] = row[f.name]; });
      return out;
    });
  };

  const resyncIdentity = (table) =>
    pg.query(`SELECT setval(pg_get_serial_sequence($1, 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 0) + 1, false)`, [table]);

  async function rawQuery(sql, params, inTransaction) {
    const t = translate(sql);
    const text = t.isInsert && !t.returns && identityTables.has(t.insertTable) ? `${t.text} RETURNING id` : t.text;
    const values = (params || []).map(toParam);
    let result;
    try {
      result = await pg.query(text, values);
    } catch (err) {
      // As in the LMS: a filter value that cannot be the column's type matches nothing (not inside a
      // transaction, which PostgreSQL has already aborted).
      const retry = !inTransaction && uncastableFilterParams(err, t, text, values);
      if (!retry) throw err;
      result = await pg.query(text, values.map((p, i) => (retry.has(i) ? null : p)));
    }
    if (t.insertsId && identityTables.has(t.insertTable)) await resyncIdentity(t.insertTable);
    const rows = renameColumns(result, t.names);
    const lastID = t.isInsert && rows.length ? rows[rows.length - 1].id : undefined;
    return { rows, lastID, changes: result.affectedRows || 0 };
  }

  // Inside a transaction: run directly on the held connection. Outside: wait for the lock.
  const query = (sql, params) => (txContext.getStore() ? rawQuery(sql, params, true) : withLock(() => rawQuery(sql, params, false)));

  const get = async (sql, params = []) => (await query(sql, params)).rows[0];
  const all = async (sql, params = []) => (await query(sql, params)).rows;
  const run = async (sql, params = []) => {
    const r = await query(sql, params);
    return { lastID: r.lastID, changes: r.changes };
  };

  /** work() runs in one transaction; called from inside one, it joins it. */
  const transaction = (work) => {
    if (txContext.getStore()) return work();
    return withLock(async () => {
      await pg.query('BEGIN');
      try {
        const result = await txContext.run({ open: true }, () => work());
        await pg.query('COMMIT');
        return result;
      } catch (err) {
        await pg.query('ROLLBACK').catch(() => {});
        throw err;
      }
    });
  };

  const exec = (text) => withLock(async () => {
    await pg.exec(text);
    await loadIdentityTables(); // the statements may have created or dropped tables
    for (const table of identityTables) await resyncIdentity(table);
  });

  const sql = Object.freeze({ get, all, run, transaction });
  return { ...sql, sql, exec, close: () => pg.close(), pglite: pg };
}

module.exports = { openEmbeddedDatabase, translate };
