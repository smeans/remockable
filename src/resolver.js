import { promises as fs } from 'node:fs';
import path from 'node:path';

const HTTP_VERBS = new Set([
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
  'OPTIONS',
  'TRACE',
  'CONNECT',
]);

function isSafeSegment(seg) {
  if (seg === '' || seg === '.' || seg === '..') return false;
  if (seg.startsWith('.')) return false; // hidden
  if (seg.includes('/') || seg.includes('\\') || seg.includes('\0')) return false;
  return true;
}

// Parse a filename into its logical (verb-stripped) name and HTTP verb.
// The verb, if present, is a dotted component after the first one.
function parseEntry(filename) {
  const tokens = filename.split('.');
  let verb = null;
  let logicalTokens = tokens;
  for (let i = 1; i < tokens.length; i += 1) {
    if (HTTP_VERBS.has(tokens[i])) {
      verb = tokens[i];
      logicalTokens = tokens.slice(0, i).concat(tokens.slice(i + 1));
      break;
    }
  }
  return { verb, logicalName: logicalTokens.join('.') };
}

async function statOrNull(p) {
  try {
    return await fs.stat(p);
  } catch {
    return null;
  }
}

// Find the file in `dir` that answers `requestName` for `method`.
// Returns an absolute file path, or null (not found / ambiguous).
async function matchFile(dir, requestName, method) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return null;
  }

  const wantGet = method === 'GET';
  // For GET, an explicit `.GET` file takes precedence over a verbless file, so
  // track the two tiers separately. Non-GET methods only use the explicit tier.
  const explicitExact = [];
  const explicitByExt = [];
  const defaultExact = [];
  const defaultByExt = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (entry.name.startsWith('.')) continue; // hidden

    const { verb, logicalName } = parseEntry(entry.name);

    let exactBucket;
    let byExtBucket;
    if (wantGet && verb === null) {
      exactBucket = defaultExact;
      byExtBucket = defaultByExt;
    } else if (verb === method) {
      exactBucket = explicitExact;
      byExtBucket = explicitByExt;
    } else {
      continue;
    }

    if (logicalName === requestName) {
      exactBucket.push(entry.name);
    } else {
      const dot = logicalName.lastIndexOf('.');
      if (dot > 0 && logicalName.slice(0, dot) === requestName) {
        // logicalName === requestName + '.' + <ext>
        byExtBucket.push(entry.name);
      }
    }
  }

  // Explicit verb files win outright; fall back to verbless files only for GET.
  for (const [exact, byExt] of [
    [explicitExact, explicitByExt],
    [defaultExact, defaultByExt],
  ]) {
    if (exact.length === 1) return path.join(dir, exact[0]);
    if (exact.length > 1) return null; // ambiguous
    if (byExt.length === 1) return path.join(dir, byExt[0]);
    if (byExt.length > 1) return null; // ambiguous
  }
  return null; // not found
}

/**
 * Resolve an HTTP request to a mock file on disk.
 * @param {string} root absolute mocks root directory
 * @param {string} method HTTP method
 * @param {string} pathname decoded URL pathname (starts with '/')
 * @param {Array<[string,string]>} queryPairs ordered query key/value pairs
 * @returns {Promise<string|null>} absolute file path, or null for 404
 */
export async function resolve(root, method, pathname, queryPairs = []) {
  const effectiveMethod = method === 'HEAD' ? 'GET' : method;

  const rawSegments = pathname.split('/').filter((s) => s.length > 0);

  // The final path segment is the requested resource name; the rest are dirs.
  const endsWithSlash = pathname.endsWith('/') || rawSegments.length === 0;
  const dirSegments = endsWithSlash ? rawSegments : rawSegments.slice(0, -1);
  let requestName = endsWithSlash ? '' : rawSegments[rawSegments.length - 1];

  for (const seg of dirSegments) {
    if (!isSafeSegment(seg)) return null;
  }
  if (requestName !== '' && !isSafeSegment(requestName)) return null;

  // Query parameters traverse the tree. A key=value pair contributes two
  // segments (key then value); a valueless flag (e.g. ?_doc) contributes one.
  const querySegments = [];
  for (const [key, value] of queryPairs) {
    if (!isSafeSegment(key)) return null;
    querySegments.push(key);
    if (value !== '') {
      if (!isSafeSegment(value)) return null;
      querySegments.push(value);
    }
  }

  // Resolve the resource's own directory before applying query traversal, so
  // that a request naming a directory descends into it (leaf becomes index)
  // and query segments are inserted inside that directory.
  let baseDir = path.join(root, ...dirSegments);
  let leaf = requestName;
  if (leaf !== '') {
    const candidate = path.join(baseDir, leaf);
    const st = await statOrNull(candidate);
    if (st && st.isDirectory()) {
      baseDir = candidate;
      leaf = '';
    }
  }
  if (leaf === '') leaf = 'index';

  // Query segments sit between the resource's directory and the leaf name.
  const dir = path.join(baseDir, ...querySegments);

  // Confine everything to root (defense in depth against traversal).
  const rootResolved = path.resolve(root);
  const dirResolved = path.resolve(dir);
  if (dirResolved !== rootResolved &&
      !dirResolved.startsWith(rootResolved + path.sep)) {
    return null;
  }

  return matchFile(dir, leaf, effectiveMethod);
}
