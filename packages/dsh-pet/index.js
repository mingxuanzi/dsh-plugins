/**
 * Host half of @local/dsh-pet.
 *
 * Registers same-origin HTTP routes on the DSH web server (`ctx.webServer`)
 * that proxy the codex-pets.net marketplace and own all pet on-disk state,
 * mirroring the security posture of the codeg Tauri backend this feature is
 * ported from:
 *
 * - The upstream host is allowlisted (`codex-pets.net`), redirects are
 *   followed manually with the allowlist re-applied per hop.
 * - Every download is streamed with a hard byte cap.
 * - Pet packages are zips validated entry-by-entry (allowlist of two files,
 *   decompression caps, webp sniff) and installed via staging + atomic rename.
 * - Mutating routes require a browser-same-origin fetch (`Sec-Fetch-Site`
 *   absent/`none`/`same-origin`/`same-site`), which cross-site pages cannot
 *   forge.
 *
 * State lives under `$DSH_HOME/pet/` (pets/, config.json) so it survives
 * profile edits and app upgrades.
 */

import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import zlib from 'node:zlib'

// ─── Constants ──────────────────────────────────────────────────────────────

const ROUTE_PREFIX = '/dsh-pet'
const USER_AGENT = 'dsh-pet/1.0'

const PETS_MARKET_BASE = 'https://codex-pets.net'
const PETS_MARKET_PREFIX = 'https://codex-pets.net/'
const MAX_PET_LIST_BYTES = 4 * 1024 * 1024
const MAX_PET_ZIP_BYTES = 32 * 1024 * 1024
const MAX_PET_MANIFEST_BYTES = 64 * 1024
const MAX_PET_SHEET_BYTES = 16 * 1024 * 1024
const MAX_PET_ASSET_BYTES = 16 * 1024 * 1024
const PET_MANIFEST_NAME = 'pet.json'
const PET_SHEET_NAME = 'spritesheet.webp'

const MAX_QUERY_CHARS = 128
const MAX_REDIRECT_HOPS = 5
const PET_ID_RE = /^[a-z0-9_-]{1,64}$/

/** The transparent always-on-top window helper (own process, Windows only). */
const DESKTOP_SCRIPT = fileURLToPath(new URL('./desktop/pet-window.ps1', import.meta.url))
const MAX_DESKTOP_SHEET_BYTES = 32 * 1024 * 1024

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
const conflict = (msg) => new HttpError(409, 'conflict', msg)
const notFound = (msg) => new HttpError(404, 'not-found', msg)

function storageRoot() {
  const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
  return path.join(home, 'pet')
}

function petsRoot() {
  return path.join(storageRoot(), 'pets')
}

function desktopDir() {
  return path.join(storageRoot(), 'desktop')
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

function validatePetId(id) {
  if (typeof id !== 'string' || !PET_ID_RE.test(id)) {
    throw invalid('Pet id must be 1-64 chars of [a-z0-9_-].')
  }
  return id
}

// ─── Config ─────────────────────────────────────────────────────────────────

const CONFIG_DEFAULTS = {
  activePetId: null,
  petScale: 0.75,
  petPosition: null, // {x, y} viewport px, null = default corner
  petVisible: true,
  desktopPet: false, // desktop window helper running instead of the in-page pet
  desktopPosition: null, // {x, y} screen px (DIP) of that window
}

function sanitizeConfig(input) {
  const out = { ...CONFIG_DEFAULTS }
  if (!input || typeof input !== 'object') return out
  if (typeof input.activePetId === 'string' && PET_ID_RE.test(input.activePetId)) {
    out.activePetId = input.activePetId
  }
  if (typeof input.petScale === 'number' && input.petScale >= 0.25 && input.petScale <= 3) {
    out.petScale = input.petScale
  }
  if (
    input.petPosition &&
    typeof input.petPosition === 'object' &&
    Number.isFinite(input.petPosition.x) &&
    Number.isFinite(input.petPosition.y)
  ) {
    out.petPosition = {
      x: Math.round(input.petPosition.x),
      y: Math.round(input.petPosition.y),
    }
  }
  if (typeof input.petVisible === 'boolean') out.petVisible = input.petVisible
  if (typeof input.desktopPet === 'boolean') out.desktopPet = input.desktopPet
  if (
    input.desktopPosition &&
    typeof input.desktopPosition === 'object' &&
    Number.isFinite(input.desktopPosition.x) &&
    Number.isFinite(input.desktopPosition.y)
  ) {
    out.desktopPosition = {
      x: Math.round(input.desktopPosition.x),
      y: Math.round(input.desktopPosition.y),
    }
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
 * `isAllowed`, streaming the body with a hard cap. Returns {mime, bytes, url}.
 */
async function fetchCapped(url, { isAllowed, cap, timeoutMs, label, acceptImage }) {
  let current = url
  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
    if (!isAllowed(current)) {
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

function isCodexPetsUrl(raw) {
  // Trailing-slash prefix blocks `https://codex-pets.net.evil/` subdomain bypasses.
  return typeof raw === 'string' && raw.startsWith(PETS_MARKET_PREFIX)
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

// ─── Zip reading (store + deflate, entry allowlist enforced by caller) ──────

function readZipEntries(bytes) {
  if (bytes.length < 22) throw invalid('Pet package is not a valid zip.')
  // Locate the End Of Central Directory record (scan the tail for its signature).
  let eocd = -1
  const minScan = Math.max(0, bytes.length - 22 - 65536)
  for (let i = bytes.length - 22; i >= minScan; i--) {
    if (bytes.readUInt32LE(i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw invalid('Pet package is not a valid zip.')
  const count = bytes.readUInt16LE(eocd + 10)
  let offset = bytes.readUInt32LE(eocd + 16)
  const entries = []
  for (let i = 0; i < count; i++) {
    if (offset + 46 > bytes.length || bytes.readUInt32LE(offset) !== 0x02014b50) {
      throw invalid('Pet package has a corrupt central directory.')
    }
    const method = bytes.readUInt16LE(offset + 10)
    const compressedSize = bytes.readUInt32LE(offset + 20)
    const nameLen = bytes.readUInt16LE(offset + 28)
    const extraLen = bytes.readUInt16LE(offset + 30)
    const commentLen = bytes.readUInt16LE(offset + 32)
    const localOffset = bytes.readUInt32LE(offset + 42)
    const name = bytes.toString('utf8', offset + 46, offset + 46 + nameLen)
    entries.push({ name, method, compressedSize, localOffset })
    offset += 46 + nameLen + extraLen + commentLen
  }
  return entries
}

function extractZipEntry(bytes, entry, cap, label) {
  const { localOffset, method, compressedSize } = entry
  if (localOffset + 30 > bytes.length || bytes.readUInt32LE(localOffset) !== 0x04034b50) {
    throw invalid(`Zip entry '${label}' has a corrupt local header.`)
  }
  const nameLen = bytes.readUInt16LE(localOffset + 26)
  const extraLen = bytes.readUInt16LE(localOffset + 28)
  const dataStart = localOffset + 30 + nameLen + extraLen
  if (dataStart + compressedSize > bytes.length) {
    throw invalid(`Zip entry '${label}' is truncated.`)
  }
  const raw = bytes.subarray(dataStart, dataStart + compressedSize)
  let out
  if (method === 0) {
    out = Buffer.from(raw)
  } else if (method === 8) {
    try {
      out = zlib.inflateRawSync(raw, { maxOutputLength: cap + 1 })
    } catch {
      throw invalid(`Zip entry '${label}' exceeds the ${cap} byte cap or is corrupt.`)
    }
  } else {
    throw invalid(`Zip entry '${label}' uses unsupported compression method ${method}.`)
  }
  if (out.length > cap) {
    throw invalid(`Zip entry '${label}' exceeds the ${cap} byte cap.`)
  }
  return out
}

// ─── Pets on disk ───────────────────────────────────────────────────────────

async function listInstalledPetIds() {
  try {
    const names = await fs.readdir(petsRoot())
    return new Set(names.filter((n) => PET_ID_RE.test(n)))
  } catch {
    return new Set()
  }
}

async function listInstalledPets() {
  const ids = await listInstalledPetIds()
  const pets = []
  for (const id of ids) {
    try {
      const manifest = JSON.parse(
        await fs.readFile(path.join(petsRoot(), id, PET_MANIFEST_NAME), 'utf8')
      )
      pets.push({
        id,
        displayName: String(manifest.displayName || id),
        description: String(manifest.description || ''),
      })
    } catch {
      /* a pet with an unreadable manifest is skipped, not fatal */
    }
  }
  pets.sort((a, b) => a.displayName.localeCompare(b.displayName))
  return pets
}

const installLocks = new Map()

function withInstallLock(id, fn) {
  const prev = installLocks.get(id) || Promise.resolve()
  const next = prev.then(fn, fn)
  installLocks.set(
    id,
    next.catch(() => {})
  )
  return next
}

async function installPetFromZip(id, zipBytes, overwrite) {
  validatePetId(id)
  const entries = readZipEntries(zipBytes)
  let manifestBytes = null
  let sheetBytes = null
  for (const entry of entries) {
    const name = entry.name.replace(/\\/g, '/')
    // Strict allow-list, and refuse traversal / nesting outright.
    if (name.includes('..') || name.startsWith('/') || name.includes(':')) {
      throw invalid(`Zip entry '${name}' has an invalid path.`)
    }
    if (name === PET_MANIFEST_NAME) {
      manifestBytes = extractZipEntry(zipBytes, entry, MAX_PET_MANIFEST_BYTES, name)
    } else if (name === PET_SHEET_NAME) {
      sheetBytes = extractZipEntry(zipBytes, entry, MAX_PET_SHEET_BYTES, name)
    } else if (name.endsWith('/')) {
      continue
    } else {
      throw invalid(`Unexpected zip entry '${name}'.`)
    }
  }
  if (!manifestBytes) throw invalid('Pet package is missing pet.json.')
  if (!sheetBytes) throw invalid('Pet package is missing spritesheet.webp.')

  let manifest
  try {
    manifest = JSON.parse(manifestBytes.toString('utf8'))
  } catch (err) {
    throw invalid(`Invalid pet.json in download: ${err.message}`)
  }
  validatePetId(manifest.id)
  if (manifest.id !== id) {
    throw invalid(`Manifest id '${manifest.id}' does not match requested pet id '${id}'.`)
  }
  if (typeof manifest.displayName !== 'string' || manifest.displayName.trim() === '') {
    throw invalid('Manifest displayName is empty.')
  }
  if (sniffImageMime(sheetBytes) !== 'image/webp') {
    throw invalid('spritesheet.webp is not a WebP image.')
  }
  manifest.spritesheetPath = PET_SHEET_NAME

  const root = petsRoot()
  const target = path.join(root, id)
  const staging = path.join(root, `${id}.market.tmp`)
  const aside = path.join(root, `${id}.replaced.tmp`)

  await fs.mkdir(root, { recursive: true })
  await fs.rm(staging, { recursive: true, force: true })
  await fs.rm(aside, { recursive: true, force: true })

  const targetExisted = await pathExists(target)
  if (targetExisted && !overwrite) {
    throw conflict(`Pet '${id}' is already installed.`)
  }

  await fs.mkdir(staging, { recursive: true })
  try {
    await writeFileAtomic(
      path.join(staging, PET_MANIFEST_NAME),
      Buffer.from(JSON.stringify(manifest, null, 2) + '\n')
    )
    await writeFileAtomic(path.join(staging, PET_SHEET_NAME), sheetBytes)
  } catch (err) {
    await fs.rm(staging, { recursive: true, force: true })
    throw err
  }

  if (targetExisted) {
    await fs.rename(target, aside)
  }
  try {
    await fs.rename(staging, target)
  } catch (err) {
    await fs.rm(staging, { recursive: true, force: true })
    if (targetExisted) {
      await fs.rename(aside, target).catch(() => {})
    }
    throw err
  }
  if (targetExisted) {
    await fs.rm(aside, { recursive: true, force: true })
  }
  return {
    id: manifest.id,
    displayName: manifest.displayName,
    description: String(manifest.description || ''),
  }
}

// ─── Marketplace: codex-pets.net ────────────────────────────────────────────

async function petMarketList(query) {
  const params = new URLSearchParams()
  const page = Math.max(1, Number(query.get('page')) || 1)
  const pageSize = Math.min(60, Math.max(1, Number(query.get('pageSize')) || 30))
  params.set('page', String(page))
  params.set('pageSize', String(pageSize))
  for (const key of ['q', 'kind', 'sort']) {
    const value = (query.get(key) || '').trim()
    if (value) params.set(key, value.slice(0, MAX_QUERY_CHARS))
  }
  const { bytes } = await fetchCapped(`${PETS_MARKET_BASE}/api/pets?${params}`, {
    isAllowed: isCodexPetsUrl,
    cap: MAX_PET_LIST_BYTES,
    timeoutMs: 30_000,
    label: 'Pet marketplace listing',
  })
  let upstream
  try {
    upstream = JSON.parse(bytes.toString('utf8'))
  } catch {
    throw network('Marketplace response is not valid JSON.')
  }
  const installed = await listInstalledPetIds()
  const pets = (Array.isArray(upstream.pets) ? upstream.pets : []).map((p) => ({
    id: String(p.id ?? ''),
    displayName: String(p.displayName ?? p.id ?? ''),
    description: String(p.description ?? ''),
    kind: p.kind ?? null,
    tags: Array.isArray(p.tags) ? p.tags.map(String).slice(0, 8) : [],
    ownerName: p.ownerName ?? null,
    ownerHandle: p.ownerHandle ?? null,
    viewCount: Number(p.viewCount) || 0,
    downloadCount: Number(p.downloadCount) || 0,
    likeCount: Number(p.likeCount) || 0,
    uploadedAt: p.uploadedAt ?? null,
    posterUrl: typeof p.posterUrl === 'string' ? p.posterUrl : null,
    previewUrl: typeof p.previewUrl === 'string' ? p.previewUrl : null,
    downloadUrl:
      typeof p.downloadUrl === 'string' && p.downloadUrl
        ? p.downloadUrl
        : `/api/pets/${encodeURIComponent(p.id)}/download`,
    alreadyInstalled: installed.has(String(p.id ?? '')),
  }))
  return {
    pets,
    page: Number(upstream.page) || page,
    pageSize: Number(upstream.pageSize) || pageSize,
    total: Number(upstream.total) || 0,
    totalPages: Math.max(1, Number(upstream.totalPages) || 1),
  }
}

async function petMarketInstall(body) {
  const id = validatePetId(body?.id)
  const rawUrl = typeof body?.downloadUrl === 'string' ? body.downloadUrl.trim() : ''
  if (!rawUrl) throw invalid('Download URL is empty.')
  const url = rawUrl.startsWith('/') ? `${PETS_MARKET_BASE}${rawUrl}` : rawUrl
  if (!isCodexPetsUrl(url)) {
    throw invalid(`Download URL must point to ${PETS_MARKET_BASE}.`)
  }
  const overwrite = body?.overwrite === true
  return withInstallLock(id, async () => {
    const { bytes } = await fetchCapped(url, {
      isAllowed: isCodexPetsUrl,
      cap: MAX_PET_ZIP_BYTES,
      timeoutMs: 120_000,
      label: 'Pet package',
    })
    const pet = await installPetFromZip(id, bytes, overwrite)
    return { pet }
  })
}

async function petMarketAsset(query) {
  const url = query.get('url') || ''
  if (!isCodexPetsUrl(url)) {
    throw invalid(`Asset URL must point to ${PETS_MARKET_BASE}.`)
  }
  const { mime, bytes } = await fetchCapped(url, {
    isAllowed: isCodexPetsUrl,
    cap: MAX_PET_ASSET_BYTES,
    timeoutMs: 30_000,
    label: 'Pet asset',
    acceptImage: true,
  })
  return { mime: mime.startsWith('image/') ? mime : 'image/webp', bytes }
}

// ─── Desktop window (transparent, always on top, own process) ───────────────

/**
 * The pet's desktop mode: the browser exports the spritesheet as PNG and hands
 * the Host a layout, then the Host spawns `desktop/pet-window.ps1` — a WPF
 * window with no frame, no taskbar entry and `Topmost`, so the pet can be
 * dragged across the whole desktop, outside the DSH window. Nothing in the DSH
 * installation is modified; killing the app or stopping the pet kills this
 * process.
 */
const desktop = {
  proc: null,
  mood: 'idle',
  /** Sessions the page reports as running; the helper paints it as a badge. */
  sessions: 0,
  /** Last "manage pet" request from the helper; the page opens the pet UI. */
  reveal: 0,
  baseUrl: null,
  /** Set while the host is intentionally stopping the window. */
  stopping: false,
  /** What the exported assets on disk describe, so a page can skip re-exporting. */
  assets: null,
}

function desktopSheetPath() {
  return path.join(desktopDir(), 'sheet.png')
}

function desktopLayoutPath() {
  return path.join(desktopDir(), 'layout.json')
}

/**
 * `{petId, scale}` of the exported desktop assets. Read from layout.json once
 * per write: the browser re-encodes a multi-megabyte PNG for every start, so a
 * page that reloads while the window is already running should be able to tell
 * that the assets on disk are current and leave the window alone.
 */
async function desktopAssets() {
  if (desktop.assets !== null) return desktop.assets
  try {
    const layout = JSON.parse(await fs.readFile(desktopLayoutPath(), 'utf8'))
    desktop.assets = {
      petId: typeof layout.petId === 'string' ? layout.petId : null,
      scale: Number.isFinite(layout.scale) ? layout.scale : null,
    }
  } catch {
    desktop.assets = { petId: null, scale: null }
  }
  return desktop.assets
}

function desktopRunning() {
  return desktop.proc !== null && desktop.proc.exitCode === null && !desktop.proc.killed
}

function stopDesktopPet(reason) {
  const proc = desktop.proc
  desktop.proc = null
  desktop.stopping = true
  desktop.sessions = 0
  if (proc !== null) {
    try {
      proc.kill()
    } catch {
      /* already gone */
    }
  }
  void reason
  // Reflect the stopped state in config so the UI does not claim it is running.
  return readConfig()
    .then((config) => {
      if (config.desktopPet) {
        config.desktopPet = false
        return writeConfig(config)
      }
      return config
    })
    .catch(() => null)
}

async function writeDesktopSheet(bytes) {
  if (bytes.length < 8 || bytes[0] !== 0x89 || bytes[1] !== 0x50) {
    throw invalid('Desktop sheet must be a PNG image.')
  }
  await fs.mkdir(desktopDir(), { recursive: true })
  await writeFileAtomic(desktopSheetPath(), bytes)
  return { bytes: bytes.length }
}

async function writeDesktopLayout(body) {
  const frameWidth = Number(body?.frameWidth)
  const frameHeight = Number(body?.frameHeight)
  const scale = Number(body?.scale)
  const states = body?.states
  const petId = typeof body?.petId === 'string' && PET_ID_RE.test(body.petId) ? body.petId : null
  if (!Number.isFinite(frameWidth) || frameWidth < 8 || frameWidth > 1024) {
    throw invalid('frameWidth must be 8..1024.')
  }
  if (!Number.isFinite(frameHeight) || frameHeight < 8 || frameHeight > 1024) {
    throw invalid('frameHeight must be 8..1024.')
  }
  if (!Number.isFinite(scale) || scale < 0.25 || scale > 3) {
    throw invalid('scale must be 0.25..3.')
  }
  if (!states || typeof states !== 'object') throw invalid('states is required.')
  const clean = {}
  for (const [name, def] of Object.entries(states)) {
    if (!/^[a-z_]{2,24}$/.test(name)) throw invalid(`bad state name '${name}'.`)
    const row = Number(def?.row)
    const durations = Array.isArray(def?.durations) ? def.durations.map(Number) : null
    if (!Number.isInteger(row) || row < 0 || row > 31) throw invalid(`state '${name}': bad row.`)
    if (!durations || durations.length === 0 || durations.length > 32) {
      throw invalid(`state '${name}': durations must be 1..32 entries.`)
    }
    if (!durations.every((d) => Number.isFinite(d) && d >= 30 && d <= 10000)) {
      throw invalid(`state '${name}': durations must be 30..10000 ms.`)
    }
    clean[name] = { row, durations: durations.map((d) => Math.round(d)) }
  }
  if (!clean.idle) throw invalid('states must include an idle entry.')
  await fs.mkdir(desktopDir(), { recursive: true })
  await writeFileAtomic(
    desktopLayoutPath(),
    Buffer.from(
      JSON.stringify({ petId, frameWidth, frameHeight, scale, states: clean }, null, 2) + '\n'
    )
  )
  desktop.assets = { petId, scale }
  return { states: Object.keys(clean).length }
}

async function startDesktopPet() {
  if (process.platform !== 'win32') {
    throw invalid('The desktop pet window is only available on Windows.')
  }
  const config = await readConfig()
  if (!config.activePetId) throw invalid('No active pet to show.')
  if (!desktop.baseUrl) throw network('The web server is not ready yet.')
  for (const file of [desktopSheetPath(), desktopLayoutPath()]) {
    if (!(await pathExists(file))) {
      throw invalid('Desktop assets are missing; re-export the pet first.')
    }
  }
  if (desktopRunning()) await stopDesktopPet('restart')
  desktop.stopping = false
  // No `detached: true`: a detached child is spawned with DETACHED_PROCESS and
  // therefore no console, and Windows PowerShell exits immediately in that
  // state (exit code 0, the script never runs) — which is exactly why the pet
  // window never appeared. `stdio: 'ignore'` plus `unref()` keep the helper
  // independent of this process without breaking its startup.
  const child = spawn(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-WindowStyle',
      'Hidden',
      '-File',
      DESKTOP_SCRIPT,
      '-BaseUrl',
      desktop.baseUrl,
      '-SheetPath',
      desktopSheetPath(),
      '-LayoutPath',
      desktopLayoutPath(),
    ],
    { stdio: 'ignore', windowsHide: true }
  )
  child.on('error', () => {
    if (desktop.proc === child) desktop.proc = null
  })
  child.on('exit', () => {
    // A helper that was superseded (stop-then-restart for a pet or scale
    // change) must not clear the flag belonging to its replacement: doing so
    // made the *new* window see `alive: false` and close itself.
    const current = desktop.proc === child
    if (current) desktop.proc = null
    if (!current) return
    // The window closed on its own (right-click hide or a crash): clear the flag.
    void readConfig()
      .then((cfg) => {
        if (cfg.desktopPet) {
          cfg.desktopPet = false
          return writeConfig(cfg)
        }
        return null
      })
      .catch(() => {})
  })
  child.unref()
  desktop.proc = child
  const next = { ...config, desktopPet: true }
  const saved = await writeConfig(next)
  return { pid: child.pid, config: saved }
}

async function desktopState() {
  const config = await readConfig()
  return {
    alive: desktopRunning() && config.desktopPet,
    state: desktop.mood,
    // Running-session count for the pet's corner badge (0 hides it).
    sessions: desktop.sessions,
    scale: config.petScale,
    position: config.desktopPosition,
  }
}

/** Status payload shared by the page's supervisor and the helper window. */
async function desktopStatus() {
  const assets = await desktopAssets()
  return {
    running: desktopRunning(),
    pid: desktop.proc?.pid ?? null,
    mood: desktop.mood,
    sessions: desktop.sessions,
    reveal: desktop.reveal,
    platform: process.platform,
    // What the sheet/layout on disk were exported from: a page that reloads
    // while the window already runs can reuse them instead of re-exporting.
    petId: assets.petId,
    assetScale: assets.scale,
  }
}

// ─── HTTP route plumbing ────────────────────────────────────────────────────

const MUTATION_METHODS = new Set(['POST', 'PUT', 'DELETE'])

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

function sendBytes(res, mime, bytes, { immutable = false } = {}) {
  res.writeHead(200, {
    'content-type': mime,
    'content-length': bytes.length,
    // Loopback-only static bytes; `*` lets the Electron file:// shell read them too.
    'access-control-allow-origin': '*',
    'cache-control': immutable ? 'private, max-age=3600' : 'no-store',
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
  if (declared > cap) throw invalid(`Body exceeds the ${cap} byte cap.`)
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    total += chunk.length
    if (total > cap) throw invalid(`Body exceeds the ${cap} byte cap.`)
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

  // ── Installed pets ──
  if (route === `GET ${ROUTE_PREFIX}/api/pets`) {
    return sendJson(res, 200, { ok: true, pets: await listInstalledPets() })
  }
  const sheetMatch = pathname.match(/^\/dsh-pet\/api\/pets\/([a-z0-9_-]{1,64})\/spritesheet$/)
  if (req.method === 'GET' && sheetMatch) {
    const id = sheetMatch[1]
    const file = path.join(petsRoot(), id, PET_SHEET_NAME)
    if (!(await pathExists(file))) throw notFound(`No spritesheet for pet '${id}'.`)
    return sendBytes(res, 'image/webp', await fs.readFile(file), { immutable: true })
  }
  if (route === `POST ${ROUTE_PREFIX}/api/pets/delete`) {
    if (!mutationAllowed(req)) throw new HttpError(403, 'forbidden', 'Cross-site request refused.')
    const body = await readJsonBody(req)
    const id = validatePetId(body?.id)
    const target = path.join(petsRoot(), id)
    if (!(await pathExists(target))) throw notFound(`Pet '${id}' is not installed.`)
    await fs.rm(target, { recursive: true, force: true })
    const config = await readConfig()
    if (config.activePetId === id) {
      config.activePetId = null
      await writeConfig(config)
    }
    return sendJson(res, 200, { ok: true })
  }

  // ── Pet marketplace ──
  if (route === `GET ${ROUTE_PREFIX}/api/pet-market/list`) {
    return sendJson(res, 200, { ok: true, ...(await petMarketList(query)) })
  }
  if (route === `POST ${ROUTE_PREFIX}/api/pet-market/install`) {
    if (!mutationAllowed(req)) throw new HttpError(403, 'forbidden', 'Cross-site request refused.')
    return sendJson(res, 200, { ok: true, ...(await petMarketInstall(await readJsonBody(req))) })
  }
  if (route === `GET ${ROUTE_PREFIX}/api/pet-market/asset`) {
    const { mime, bytes } = await petMarketAsset(query)
    return sendBytes(res, mime, bytes)
  }

  // ── Desktop window ──
  if (route === `POST ${ROUTE_PREFIX}/api/desktop/sheet`) {
    if (!mutationAllowed(req)) throw new HttpError(403, 'forbidden', 'Cross-site request refused.')
    const bytes = await readRawBody(req, MAX_DESKTOP_SHEET_BYTES)
    return sendJson(res, 200, { ok: true, ...(await writeDesktopSheet(bytes)) })
  }
  if (route === `POST ${ROUTE_PREFIX}/api/desktop/layout`) {
    if (!mutationAllowed(req)) throw new HttpError(403, 'forbidden', 'Cross-site request refused.')
    return sendJson(res, 200, { ok: true, ...(await writeDesktopLayout(await readJsonBody(req, 256 * 1024))) })
  }
  if (route === `POST ${ROUTE_PREFIX}/api/desktop/start`) {
    if (!mutationAllowed(req)) throw new HttpError(403, 'forbidden', 'Cross-site request refused.')
    return sendJson(res, 200, { ok: true, ...(await startDesktopPet()) })
  }
  if (route === `POST ${ROUTE_PREFIX}/api/desktop/stop`) {
    if (!mutationAllowed(req)) throw new HttpError(403, 'forbidden', 'Cross-site request refused.')
    const config = await stopDesktopPet('api')
    return sendJson(res, 200, { ok: true, config: config ?? (await readConfig()) })
  }
  if (route === `POST ${ROUTE_PREFIX}/api/desktop/mood`) {
    const body = await readJsonBody(req, 16 * 1024)
    const mood = typeof body?.state === 'string' ? body.state : ''
    if (!/^[a-z_]{2,24}$/.test(mood)) throw invalid('state must be a lowercase animation name.')
    desktop.mood = mood
    // Optional: the page also reports how many sessions are running, which the
    // helper paints as a badge (0 keeps it hidden).
    if (body?.sessions !== undefined) {
      const sessions = Number(body.sessions)
      if (!Number.isFinite(sessions) || sessions < 0 || sessions > 999) {
        throw invalid('sessions must be a number between 0 and 999.')
      }
      desktop.sessions = Math.round(sessions)
    }
    return sendJson(res, 200, { ok: true, state: desktop.mood, sessions: desktop.sessions })
  }
  if (route === `POST ${ROUTE_PREFIX}/api/desktop/position`) {
    const body = await readJsonBody(req, 16 * 1024)
    const x = Number(body?.x)
    const y = Number(body?.y)
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw invalid('x and y are required.')
    const config = await readConfig()
    config.desktopPosition = { x: Math.round(x), y: Math.round(y) }
    await writeConfig(config)
    return sendJson(res, 200, { ok: true })
  }
  if (route === `POST ${ROUTE_PREFIX}/api/desktop/reveal`) {
    // The helper window cannot reach the webview. It raises a token here and
    // the pet's client acts on it during its next status poll.
    if (!mutationAllowed(req)) throw new HttpError(403, 'forbidden', 'Cross-site request refused.')
    await readJsonBody(req, 4 * 1024)
    desktop.reveal = Date.now()
    return sendJson(res, 200, { ok: true, reveal: desktop.reveal })
  }
  if (route === `GET ${ROUTE_PREFIX}/api/desktop/state`) {
    return sendJson(res, 200, { ok: true, ...(await desktopState()) })
  }
  if (route === `GET ${ROUTE_PREFIX}/api/desktop/status`) {
    return sendJson(res, 200, { ok: true, ...(await desktopStatus()) })
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
    webCtx.effect(() => {
      // The desktop-window helper polls this host over loopback, so it needs
      // the port the server actually bound.
      const port = webCtx.webServer.port
      if (typeof port === 'number' && port > 0) desktop.baseUrl = `http://127.0.0.1:${port}`
      return () => {
        desktop.baseUrl = null
      }
    }, 'pet: desktop helper base url')
    webCtx.effect(
      () =>
        webCtx.webServer.register({
          kind: 'prefix',
          path: ROUTE_PREFIX,
          handler: handleRequest,
        }),
      'pet: api routes'
    )
    // The helper window must not outlive the plugin (app quit, profile edit).
    webCtx.effect(
      () => () => {
        if (desktopRunning()) void stopDesktopPet('dispose')
      },
      'pet: desktop helper lifecycle'
    )
  })
}
