/**
 * Host half of @local/dsh-wallpaper.
 *
 * Registers same-origin HTTP routes on the DSH web server (`ctx.webServer`)
 * that proxy the wallhaven.cc wallpaper market and own all wallpaper on-disk
 * state, mirroring the security posture of the codeg Tauri backend this
 * feature is ported from:
 *
 * - `purity=100` (SFW) is hard-coded into every upstream search; the app
 *   structurally cannot request NSFW results.
 * - The upstream hosts are allowlisted (`wallhaven.cc` + subdomains, https
 *   only, no userinfo), redirects are followed manually with the allowlist
 *   re-applied per hop.
 * - Downloads and local uploads share one validation path (magic-byte sniff,
 *   16 MiB / 40 Mpx caps) and one atomic write, exactly like codeg's
 *   `backgrounds::marketplace`.
 * - Mutating routes require a browser-same-origin fetch (`Sec-Fetch-Site`
 *   absent/`none`/`same-origin`/`same-site`), which cross-site pages cannot
 *   forge.
 *
 * State lives under `$DSH_HOME/wallpaper/` (wallpaper/, config.json) so it
 * survives profile edits and app upgrades.
 */

import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// ─── Constants ──────────────────────────────────────────────────────────────

const ROUTE_PREFIX = '/dsh-wallpaper'
const USER_AGENT = 'dsh-wallpaper/1.0'

const WALLHAVEN_SEARCH_URL = 'https://wallhaven.cc/api/v1/search'
const WALLHAVEN_PURITY = '100' // SFW only, permanently — never taken from params.
const MAX_WP_SEARCH_BYTES = 4 * 1024 * 1024
const MAX_WP_THUMB_BYTES = 4 * 1024 * 1024
const MAX_WP_BYTES = 16 * 1024 * 1024
const MAX_WP_PIXELS = 40_000_000
const MAX_QUERY_CHARS = 128
const MAX_REDIRECT_HOPS = 5

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp'])

// ─── Small utilities ────────────────────────────────────────────────────────

class HttpError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

const invalid = (msg) => new HttpError(400, 'invalid-input', msg)
const network = (msg) => new HttpError(502, 'network', msg)
const notFound = (msg) => new HttpError(404, 'not-found', msg)

function storageRoot() {
  const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
  return path.join(home, 'wallpaper')
}

function wallpaperDir() {
  return path.join(storageRoot(), 'wallpaper')
}

function configPath() {
  return path.join(storageRoot(), 'config.json')
}

async function pathExists(p) {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

/** Atomic file write: tmp file in the same directory, fsync, rename. */
async function writeFileAtomic(target, bytes) {
  const tmp = `${target}.tmp-${process.pid}-${Date.now()}`
  const handle = await fs.open(tmp, 'w')
  try {
    await handle.write(bytes)
    await handle.sync()
  } finally {
    await handle.close()
  }
  await fs.rename(tmp, target)
}

// ─── Config ─────────────────────────────────────────────────────────────────

const CONFIG_DEFAULTS = {
  wallpaperEnabled: false,
  wallpaperOpacity: 0.85, // surface alpha over the wallpaper, 0.5..1
  wallpaperSourceUrl: null,
}

function sanitizeConfig(input) {
  const out = { ...CONFIG_DEFAULTS }
  if (!input || typeof input !== 'object') return out
  if (typeof input.wallpaperEnabled === 'boolean') out.wallpaperEnabled = input.wallpaperEnabled
  if (
    typeof input.wallpaperOpacity === 'number' &&
    input.wallpaperOpacity >= 0.5 &&
    input.wallpaperOpacity <= 1
  ) {
    out.wallpaperOpacity = Math.round(input.wallpaperOpacity * 100) / 100
  }
  if (typeof input.wallpaperSourceUrl === 'string' && input.wallpaperSourceUrl.length <= 512) {
    out.wallpaperSourceUrl = input.wallpaperSourceUrl
  }
  return out
}

async function readConfig() {
  try {
    const raw = await fs.readFile(configPath(), 'utf8')
    return sanitizeConfig(JSON.parse(raw))
  } catch {
    return { ...CONFIG_DEFAULTS }
  }
}

let configWriteChain = Promise.resolve()

/** Serialize config writes so concurrent PUTs cannot interleave tmp files. */
async function writeConfig(next) {
  const clean = sanitizeConfig(next)
  const run = configWriteChain.then(async () => {
    await fs.mkdir(storageRoot(), { recursive: true })
    await writeFileAtomic(configPath(), Buffer.from(JSON.stringify(clean, null, 2) + '\n'))
  })
  configWriteChain = run.catch(() => {})
  await run
  return clean
}

// ─── HTTP fetch with allowlist + caps ───────────────────────────────────────

/**
 * Fetch `url` manually following redirects, re-validating every hop against
 * the wallhaven allowlist, streaming the body with a hard cap.
 */
async function fetchCapped(url, { cap, timeoutMs, label, acceptImage }) {
  let current = url
  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
    if (!isWallhavenUrl(current)) {
      throw invalid(`${label}: URL host is not allowlisted.`)
    }
    let response
    try {
      response = await fetch(current, {
        redirect: 'manual',
        signal: AbortSignal.timeout(timeoutMs),
        headers: { 'user-agent': USER_AGENT, accept: acceptImage ? 'image/*' : '*/*' },
      })
    } catch (err) {
      throw network(`${label} failed: ${err instanceof Error ? err.message : String(err)}`)
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      response.body?.cancel().catch(() => {})
      if (!location) throw network(`${label}: redirect without Location header.`)
      current = new URL(location, current).toString()
      continue
    }
    if (!response.ok) {
      response.body?.cancel().catch(() => {})
      throw network(`${label} returned HTTP ${response.status}`)
    }
    const declared = Number(response.headers.get('content-length') || 0)
    if (declared > cap) {
      response.body?.cancel().catch(() => {})
      throw invalid(`${label} is ${declared} bytes, exceeds ${cap} byte cap.`)
    }
    const mime = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
    const chunks = []
    let total = 0
    const reader = response.body?.getReader()
    if (!reader) throw network(`${label}: empty response body.`)
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        total += value.byteLength
        if (total > cap) {
          throw invalid(`${label} exceeds ${cap} byte cap.`)
        }
        chunks.push(Buffer.from(value))
      }
    } finally {
      reader.releaseLock()
    }
    return { mime, bytes: Buffer.concat(chunks), url: current }
  }
  throw network(`${label}: more than ${MAX_REDIRECT_HOPS} redirects.`)
}

function isWallhavenUrl(raw) {
  let url
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  if (url.protocol !== 'https:') return false
  if (url.username !== '' || url.password !== '') return false
  const host = url.hostname
  return host === 'wallhaven.cc' || host.endsWith('.wallhaven.cc')
}

function sniffImageMime(bytes) {
  if (bytes.length >= 12) {
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
      return 'image/png'
    }
    if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') {
      return 'image/webp'
    }
  }
  return null
}

/** Decode PNG/JPEG/WebP pixel dimensions from the header; null when unreadable. */
function sniffImagePixels(bytes, mime) {
  try {
    if (mime === 'image/png' && bytes.length >= 24) {
      return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
    }
    if (mime === 'image/webp' && bytes.length >= 30) {
      const fourcc = bytes.toString('ascii', 12, 16)
      if (fourcc === 'VP8X') {
        return {
          width: 1 + bytes.readUIntLE(24, 3),
          height: 1 + bytes.readUIntLE(27, 3),
        }
      }
      if (fourcc === 'VP8 ' && bytes.length >= 30) {
        return { width: bytes.readUInt16LE(26) & 0x3fff, height: bytes.readUInt16LE(28) & 0x3fff }
      }
      if (fourcc === 'VP8L' && bytes.length >= 25) {
        const b0 = bytes[21]
        const b1 = bytes[22]
        const b2 = bytes[23]
        const b3 = bytes[24]
        return {
          width: 1 + (((b1 & 0x3f) << 8) | b0),
          height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
        }
      }
      return null
    }
    if (mime === 'image/jpeg') {
      let offset = 2
      while (offset + 9 < bytes.length) {
        if (bytes[offset] !== 0xff) break
        const marker = bytes[offset + 1]
        const length = bytes.readUInt16BE(offset + 2)
        if (length < 2) break
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) }
        }
        offset += 2 + length
      }
    }
  } catch {
    /* fall through: unknown dimensions are not a rejection by themselves */
  }
  return null
}

function validateWallpaperBytes(bytes) {
  const mime = sniffImageMime(bytes)
  if (!mime) throw invalid('Image is not a JPEG, PNG, or WebP.')
  if (bytes.length > MAX_WP_BYTES) {
    throw invalid(`Image exceeds the ${MAX_WP_BYTES} byte cap.`)
  }
  const pixels = sniffImagePixels(bytes, mime)
  if (pixels && pixels.width * pixels.height > MAX_WP_PIXELS) {
    throw invalid(`Image exceeds the ${MAX_WP_PIXELS} pixel cap.`)
  }
  const ext = mime === 'image/jpeg' ? '.jpg' : mime === 'image/png' ? '.png' : '.webp'
  return { mime, ext }
}

// ─── Marketplace: wallhaven.cc ──────────────────────────────────────────────

function wallhavenCategories(category) {
  switch (category) {
    case undefined:
    case null:
    case '':
    case 'all':
      return '111'
    case 'general':
      return '100'
    case 'anime':
      return '010'
    case 'people':
      return '001'
    default:
      throw invalid(`Unknown wallpaper market category: ${category}`)
  }
}

async function wallpaperMarketSearch(query) {
  const q = (query.get('query') || '').trim()
  if (q.length > MAX_QUERY_CHARS) {
    throw invalid(`Search query exceeds ${MAX_QUERY_CHARS} characters.`)
  }
  const page = Math.max(1, Number(query.get('page')) || 1)
  const categories = wallhavenCategories(query.get('category'))
  const params = new URLSearchParams({ categories, purity: WALLHAVEN_PURITY, page: String(page) })
  if (q) {
    params.set('q', q)
    params.set('sorting', 'relevance')
  } else {
    params.set('sorting', 'toplist')
    params.set('topRange', '1M')
  }
  const { bytes } = await fetchCapped(`${WALLHAVEN_SEARCH_URL}?${params}`, {
    cap: MAX_WP_SEARCH_BYTES,
    timeoutMs: 30_000,
    label: 'wallhaven search',
  })
  let payload
  try {
    payload = JSON.parse(bytes.toString('utf8'))
  } catch {
    throw network('wallhaven returned malformed JSON.')
  }
  const items = []
  for (const item of Array.isArray(payload.data) ? payload.data : []) {
    const fullUrl = item?.path
    const thumbUrl = item?.thumbs?.small
    if (typeof fullUrl !== 'string' || typeof thumbUrl !== 'string') continue
    // A listing entry pointing off wallhaven is dropped, not trusted.
    if (!isWallhavenUrl(fullUrl) || !isWallhavenUrl(thumbUrl)) continue
    const id = String(item.id ?? '')
    items.push({
      id,
      thumbUrl,
      fullUrl,
      sourceUrl: `https://wallhaven.cc/w/${encodeURIComponent(id)}`,
      width: Number(item.dimension_x) || 0,
      height: Number(item.dimension_y) || 0,
      fileSizeBytes: Number(item.file_size) || 0,
      category: String(item.category ?? ''),
    })
  }
  const meta = payload.meta || {}
  return {
    items,
    page: Math.max(1, Number(meta.current_page) || 1),
    lastPage: Math.max(1, Number(meta.last_page) || 1),
  }
}

async function wallpaperMarketAsset(query) {
  const url = query.get('url') || ''
  if (!isWallhavenUrl(url)) throw invalid('Asset URL must be a wallhaven.cc URL.')
  const { mime, bytes } = await fetchCapped(url, {
    cap: MAX_WP_THUMB_BYTES,
    timeoutMs: 30_000,
    label: 'wallhaven thumbnail',
    acceptImage: true,
  })
  if (!IMAGE_MIMES.has(mime)) throw network(`Thumbnail returned unsupported content-type '${mime}'.`)
  return { mime, bytes }
}

async function writeWallpaper(bytes) {
  const { mime, ext } = validateWallpaperBytes(bytes)
  const dir = wallpaperDir()
  await fs.mkdir(dir, { recursive: true })
  // Remove previous background files with other extensions, then atomic write.
  for (const old of ['background.jpg', 'background.png', 'background.webp']) {
    if (old !== `background${ext}`) await fs.rm(path.join(dir, old), { force: true })
  }
  await writeFileAtomic(path.join(dir, `background${ext}`), bytes)
  return { mime, ext }
}

async function readWallpaper() {
  const dir = wallpaperDir()
  for (const [file, mime] of [
    ['background.jpg', 'image/jpeg'],
    ['background.png', 'image/png'],
    ['background.webp', 'image/webp'],
  ]) {
    const p = path.join(dir, file)
    if (await pathExists(p)) {
      return { mime, bytes: await fs.readFile(p) }
    }
  }
  return null
}

async function wallpaperMarketDownload(body) {
  const url = typeof body?.url === 'string' ? body.url : ''
  const sourceUrl = typeof body?.sourceUrl === 'string' ? body.sourceUrl : ''
  if (!isWallhavenUrl(url)) throw invalid('Download URL must be a wallhaven.cc URL.')
  let source
  try {
    source = new URL(sourceUrl)
  } catch {
    throw invalid('sourceUrl must be a https://wallhaven.cc/w/<id> page URL.')
  }
  if (
    source.protocol !== 'https:' ||
    source.hostname !== 'wallhaven.cc' ||
    !source.pathname.startsWith('/w/')
  ) {
    throw invalid('sourceUrl must be a https://wallhaven.cc/w/<id> page URL.')
  }
  const { bytes } = await fetchCapped(url, {
    cap: MAX_WP_BYTES,
    timeoutMs: 300_000,
    label: 'wallpaper download',
    acceptImage: true,
  })
  // Byte sniff is the final authority, not the transport content-type.
  const written = await writeWallpaper(bytes)
  return { mime: written.mime }
}

/** ETag for the current wallpaper so windows can poll cheaply. */
async function wallpaperVersion() {
  const current = await readWallpaper()
  if (!current) return 'none'
  return createHash('sha1').update(current.bytes).digest('hex').slice(0, 12)
}

// ─── HTTP route plumbing ────────────────────────────────────────────────────

/**
 * Reject cross-site browser requests to mutating endpoints. `Sec-Fetch-Site`
 * cannot be forged by a cross-origin page; non-browser local callers simply
 * omit it. Read endpoints stay open because they proxy public data only.
 */
function mutationAllowed(req) {
  const site = req.headers['sec-fetch-site']
  if (site === undefined) return true
  return site === 'same-origin' || site === 'same-site' || site === 'none'
}

function sendJson(res, status, value) {
  const body = Buffer.from(JSON.stringify(value))
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': body.length,
    'cache-control': 'no-store',
  })
  res.end(body)
}

function sendBytes(res, mime, bytes) {
  res.writeHead(200, {
    'content-type': mime,
    'content-length': bytes.length,
    // Loopback-only static bytes; `*` lets the Electron file:// shell read them too.
    'access-control-allow-origin': '*',
    'cache-control': 'no-store',
  })
  res.end(bytes)
}

function sendError(res, err) {
  const status = err instanceof HttpError ? err.status : 500
  const code = err instanceof HttpError ? err.code : 'internal'
  const message = err instanceof Error ? err.message : String(err)
  sendJson(res, status, { ok: false, error: { code, message } })
}

async function readJsonBody(req, cap = 1024 * 1024) {
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    total += chunk.length
    if (total > cap) throw invalid('Request body is too large.')
    chunks.push(chunk)
  }
  if (chunks.length === 0) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw invalid('Request body is not valid JSON.')
  }
}

async function readRawBody(req, cap) {
  const declared = Number(req.headers['content-length'] || 0)
  if (declared > cap) throw invalid(`Upload exceeds the ${cap} byte cap.`)
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    total += chunk.length
    if (total > cap) throw invalid(`Upload exceeds the ${cap} byte cap.`)
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

async function handleApi(req, res, pathname, query) {
  const route = `${req.method} ${pathname}`

  // ── Config ──
  if (route === `GET ${ROUTE_PREFIX}/api/config`) {
    return sendJson(res, 200, { ok: true, config: await readConfig() })
  }
  if (route === `PUT ${ROUTE_PREFIX}/api/config`) {
    if (!mutationAllowed(req)) throw new HttpError(403, 'forbidden', 'Cross-site request refused.')
    const patch = await readJsonBody(req)
    const current = await readConfig()
    const merged = sanitizeConfig({ ...current, ...patch })
    return sendJson(res, 200, { ok: true, config: await writeConfig(merged) })
  }

  // ── Wallpaper marketplace ──
  if (route === `GET ${ROUTE_PREFIX}/api/market/search`) {
    return sendJson(res, 200, { ok: true, ...(await wallpaperMarketSearch(query)) })
  }
  if (route === `GET ${ROUTE_PREFIX}/api/market/asset`) {
    const { mime, bytes } = await wallpaperMarketAsset(query)
    return sendBytes(res, mime, bytes)
  }
  if (route === `POST ${ROUTE_PREFIX}/api/market/download`) {
    if (!mutationAllowed(req)) throw new HttpError(403, 'forbidden', 'Cross-site request refused.')
    return sendJson(res, 200, { ok: true, ...(await wallpaperMarketDownload(await readJsonBody(req))) })
  }

  // ── Current wallpaper ──
  if (route === `GET ${ROUTE_PREFIX}/api/current`) {
    const current = await readWallpaper()
    if (!current) throw notFound('No wallpaper is set.')
    return sendBytes(res, current.mime, current.bytes)
  }
  if (route === `GET ${ROUTE_PREFIX}/api/version`) {
    return sendJson(res, 200, { ok: true, version: await wallpaperVersion() })
  }
  if (route === `POST ${ROUTE_PREFIX}/api/upload`) {
    if (!mutationAllowed(req)) throw new HttpError(403, 'forbidden', 'Cross-site request refused.')
    const bytes = await readRawBody(req, MAX_WP_BYTES + 1)
    const written = await writeWallpaper(bytes)
    return sendJson(res, 200, { ok: true, mime: written.mime })
  }
  if (route === `POST ${ROUTE_PREFIX}/api/clear`) {
    if (!mutationAllowed(req)) throw new HttpError(403, 'forbidden', 'Cross-site request refused.')
    for (const old of ['background.jpg', 'background.png', 'background.webp']) {
      await fs.rm(path.join(wallpaperDir(), old), { force: true })
    }
    const config = await readConfig()
    config.wallpaperEnabled = false
    config.wallpaperSourceUrl = null
    await writeConfig(config)
    return sendJson(res, 200, { ok: true })
  }

  throw notFound(`Unknown route: ${route}`)
}

async function handleRequest(req, res) {
  const url = new URL(req.url || '/', 'http://localhost')
  const pathname = url.pathname
  if (req.method === 'OPTIONS') {
    // Preflight for the Electron file:// shell; browsers same-origin never send it.
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, POST, PUT, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'access-control-max-age': '600',
    })
    res.end()
    return
  }
  try {
    await handleApi(req, res, pathname, url.searchParams)
  } catch (err) {
    sendError(res, err)
  }
}

// ─── Plugin entry ───────────────────────────────────────────────────────────

/** @param {import('@deepseek-ai/cordis').Context} ctx */
export function apply(ctx) {
  // Optional dependency: profiles without a web server (pure Electron shell
  // composition) activate the plugin with no routes instead of failing.
  ctx.inject(['webServer'], (webCtx) => {
    webCtx.effect(
      () =>
        webCtx.webServer.register({
          kind: 'prefix',
          path: ROUTE_PREFIX,
          handler: handleRequest,
        }),
      'wallpaper: api routes'
    )
  })
}
