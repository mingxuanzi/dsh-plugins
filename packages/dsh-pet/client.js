/**
 * Browser half of @local/dsh-pet.
 *
 * Renders into the shell's overlay: a draggable desktop pet driven by the
 * Codex `/pet` spritesheet format (ported from codeg's `lib/pet/animation.ts`),
 * plus the pet manager and the codex-pets.net marketplace dialog. The
 * management entry point is Settings › 桌宠, mirroring codeg's Settings UI.
 * All network and disk access goes through the bundle's Host routes under
 * `/dsh-pet/api/*`; this file never touches the upstream CDN directly.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-pet',
  factory(require) {
    const React = require('react')
    const ReactDOM = require('react-dom')
    const {
      useCallback,
      useEffect,
      useMemo,
      useRef,
      useState,
      useSyncExternalStore,
    } = React
    const h = React.createElement

    const NS = 'pet'
    const API = '/dsh-pet'

    /**
     * Every `<style>` this plugin renders must declare its owner. The shell's
     * module system claims each untagged style tag for whichever plugin entry
     * activates next and removes it together with that entry, so an untagged
     * pet stylesheet can vanish mid-session; the pet then loses
     * `position: fixed`, is laid out in normal flow one window below the
     * viewport and reads as "invisible" while still animating.
     */
    const STYLE_ATTRS = {
      'data-plugin': '@local/dsh-pet',
      'data-plugin-css': '@local/dsh-pet/client.css',
    }

    // ─── Locale dictionaries (flat dotted keys, {name} interpolation) ───────

    const zh = {
      'pet.showPanel': '显示会话面板',
      'pet.hidePanel': '隐藏会话面板',
      'pet.scale': '缩放',
      'pet.manager': '桌宠管理…',
      'pet.hide': '隐藏桌宠',
      'pet.noPet': '还没有安装桌宠',
      'pet.noPetHint': '点击打开桌宠管理',
      'pet.running': '运行中',
      'pet.waiting': '等待批准',
      'pet.errored': '出错',
      'pet.idle': '空闲',
      'pet.panelEmpty': '当前没有活跃的会话',
      'pet.untitled': '未命名会话',
      'manager.title': '桌宠管理',
      'manager.active': '当前使用',
      'manager.setActive': '设为当前',
      'manager.delete': '删除',
      'manager.deleteConfirm': '确定删除桌宠「{name}」吗？',
      'manager.cancel': '取消',
      'manager.empty': '还没有安装任何桌宠。',
      'manager.openMarket': '打开桌宠市场',
      'manager.scale': '桌宠大小',
      'manager.visible': '显示桌宠',
      'manager.close': '关闭',
      'market.title': '桌宠市场',
      'market.search': '搜索桌宠…',
      'market.kindAll': '全部类型',
      'market.sortLatest': '最新',
      'market.sortPopular': '最热',
      'market.sortViews': '最多浏览',
      'market.install': '安装',
      'market.installing': '安装中…',
      'market.reinstall': '重装',
      'market.reinstallConfirm': '已安装过「{name}」，要覆盖重装吗？',
      'market.cancel': '取消',
      'market.empty': '没有找到桌宠',
      'market.installFailed': '安装失败',
      'market.installed': '已安装「{name}」',
      'market.page': '第 {page} / {total} 页',
      'market.prev': '上一页',
      'market.next': '下一页',
      'market.refresh': '刷新',
      'market.views': '浏览',
      'market.downloads': '下载',
      'market.likes': '喜欢',
      'market.credit': '桌宠来自 codex-pets.net',
      'settings.nav': '桌宠',
      'settings.pet': '桌宠',
      'settings.petHint': '显示或隐藏桌面宠物',
      'settings.scaleHint': '调整桌宠在屏幕上的大小',
      'settings.activePet': '当前桌宠',
      'settings.noActivePet': '未设置',
      'settings.activePetHint': '选择要在桌面显示的桌宠',
      'settings.petMarket': '桌宠市场',
      'settings.petMarketHint': '浏览并安装来自 codex-pets.net 的桌宠',
      'settings.petMarketOpen': '打开桌宠市场',
      'settings.petManage': '桌宠管理…',
      'settings.desktop': '桌面显示',
      'settings.desktopHint': '桌宠显示在独立的透明置顶小窗里，可以拖到屏幕任意位置（包括 DSH 窗口之外）；在小窗上右键即可隐藏桌宠',
      'settings.desktopOn': '运行中',
      'settings.desktopOff': '未运行',
      'settings.desktopStarting': '正在启动…',
      'settings.desktopBusy': '正在启动…',
      'settings.desktopHidden': '已隐藏',
      'settings.desktopFailed': '启动失败，已回退到窗口内显示',
      'settings.desktopUnsupported': '当前系统不支持桌面小窗，桌宠显示在窗口内',
    }

    const en = {
      'pet.showPanel': 'Show session panel',
      'pet.hidePanel': 'Hide session panel',
      'pet.scale': 'Scale',
      'pet.manager': 'Pet manager…',
      'pet.hide': 'Hide pet',
      'pet.noPet': 'No pet installed',
      'pet.noPetHint': 'Click to open the pet manager',
      'pet.running': 'Running',
      'pet.waiting': 'Awaiting approval',
      'pet.errored': 'Error',
      'pet.idle': 'Idle',
      'pet.panelEmpty': 'No active sessions',
      'pet.untitled': 'Untitled session',
      'manager.title': 'Pet Manager',
      'manager.active': 'Active',
      'manager.setActive': 'Set active',
      'manager.delete': 'Delete',
      'manager.deleteConfirm': 'Delete pet "{name}"?',
      'manager.cancel': 'Cancel',
      'manager.empty': 'No pets installed yet.',
      'manager.openMarket': 'Open Pet Marketplace',
      'manager.scale': 'Pet size',
      'manager.visible': 'Show pet',
      'manager.close': 'Close',
      'market.title': 'Pet Marketplace',
      'market.search': 'Search pets…',
      'market.kindAll': 'All kinds',
      'market.sortLatest': 'Latest',
      'market.sortPopular': 'Popular',
      'market.sortViews': 'Most viewed',
      'market.install': 'Install',
      'market.installing': 'Installing…',
      'market.reinstall': 'Reinstall',
      'market.reinstallConfirm': '"{name}" is already installed. Overwrite it?',
      'market.cancel': 'Cancel',
      'market.empty': 'No pets found',
      'market.installFailed': 'Install failed',
      'market.installed': 'Installed "{name}"',
      'market.page': 'Page {page} of {total}',
      'market.prev': 'Prev',
      'market.next': 'Next',
      'market.refresh': 'Refresh',
      'market.views': 'Views',
      'market.downloads': 'Downloads',
      'market.likes': 'Likes',
      'market.credit': 'Pets from codex-pets.net',
      'settings.nav': 'Desktop Pet',
      'settings.pet': 'Desktop pet',
      'settings.petHint': 'Show or hide the desktop pet',
      'settings.scaleHint': 'Adjust how large the pet appears on screen',
      'settings.activePet': 'Active pet',
      'settings.noActivePet': 'Not set',
      'settings.activePetHint': 'Choose which pet appears on the desktop',
      'settings.petMarket': 'Pet marketplace',
      'settings.petMarketHint': 'Browse and install pets from codex-pets.net',
      'settings.petMarketOpen': 'Open Pet Marketplace',
      'settings.petManage': 'Pet manager…',
      'settings.desktop': 'On the desktop',
      'settings.desktopHint':
        'The pet lives in a transparent always-on-top window you can drag anywhere on screen, including outside DSH; right-click it to hide it',
      'settings.desktopOn': 'Running',
      'settings.desktopOff': 'Not running',
      'settings.desktopStarting': 'Starting…',
      'settings.desktopBusy': 'Starting…',
      'settings.desktopHidden': 'Hidden',
      'settings.desktopFailed': 'Could not start; showing the pet inside the window instead',
      'settings.desktopUnsupported': 'This platform has no desktop window; showing the pet inside the window',
    }

    // ─── Sprite-sheet animation (ported from codeg lib/pet/animation.ts) ────

    const GRID_COLS = 8
    const GRID_ROWS = 9
    const FRAME_W = 192
    const FRAME_H = 208

    const STATE_ROW = {
      idle: 0,
      running_right: 1,
      running_left: 2,
      waving: 3,
      jumping: 4,
      failed: 5,
      waiting: 6,
      running: 7,
      review: 8,
    }

    const FRAME_DURATIONS = {
      idle: [1680, 660, 660, 840, 840, 1920],
      running_right: [120, 120, 120, 120, 120, 120, 120, 220],
      running_left: [120, 120, 120, 120, 120, 120, 120, 220],
      waving: [140, 140, 140, 280],
      jumping: [140, 140, 140, 140, 280],
      failed: [140, 140, 140, 140, 140, 140, 140, 240],
      waiting: [150, 150, 150, 150, 150, 260],
      running: [120, 120, 120, 120, 120, 220],
      review: [150, 150, 150, 150, 150, 280],
    }

    const FLOURISH_MIN = 8000
    const FLOURISH_MAX = 15000
    const FLOURISH_OPTIONS = ['waving', 'jumping']
    const ONESHOT_LOOPS = { jumping: 3, waving: 3, failed: 2, review: 3 }

    function rowsFromHeight(naturalHeight) {
      if (!Number.isFinite(naturalHeight) || naturalHeight <= 0) return GRID_ROWS
      return Math.max(GRID_ROWS, Math.round(naturalHeight / FRAME_H))
    }

    function sheetBackgroundSize(rows) {
      return `${GRID_COLS * 100}% ${Math.max(1, rows) * 100}%`
    }

    function cellPosition(row, col, rows) {
      const x = GRID_COLS > 1 ? (col / (GRID_COLS - 1)) * 100 : 0
      const y = rows > 1 ? (row / (rows - 1)) * 100 : 0
      return `${x}% ${y}%`
    }

    function filmstripFrameCount(width, height) {
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return 0
      const frameWidth = height * (FRAME_W / FRAME_H)
      return frameWidth <= 0 ? 0 : Math.round(width / frameWidth)
    }

    /**
     * Drives the (row, col) cell for a state with chained setTimeout loops
     * (codeg's approach: cheap and naturally throttled in background tabs).
     * Idle inserts a random flourish every 8–15 s. A pending one-shot kind
     * from the store plays its loops first, then control returns to `state`.
     */
    function usePetAnimator(state, oneShot, onOneShotDone) {
      const [tick, setTick] = useState({ row: STATE_ROW[state] || 0, col: 0 })
      const genRef = useRef(0)
      const shotRef = useRef(null)

      useEffect(() => {
        const gen = ++genRef.current
        let timer = null
        let flourishTimer = null
        let loopCount = 0

        const playFrame = (s, col, onFinish) => {
          const durations = FRAME_DURATIONS[s] || FRAME_DURATIONS.idle
          setTick({ row: STATE_ROW[s] ?? 0, col })
          const dur = durations[col] ?? durations[durations.length - 1]
          timer = setTimeout(() => {
            if (gen !== genRef.current) return
            const nextCol = col + 1
            if (nextCol >= durations.length) {
              if (onFinish) onFinish()
              else playFrame(s, 0)
            } else {
              playFrame(s, nextCol, onFinish)
            }
          }, dur)
        }

        const startFlourish = () => {
          const delay = FLOURISH_MIN + Math.floor(Math.random() * (FLOURISH_MAX - FLOURISH_MIN))
          flourishTimer = setTimeout(() => {
            if (gen !== genRef.current || shotRef.current) return
            const pick = FLOURISH_OPTIONS[Math.floor(Math.random() * FLOURISH_OPTIONS.length)]
            if (timer) clearTimeout(timer)
            playFrame(pick, 0, () => {
              if (gen !== genRef.current) return
              if (!shotRef.current) playFrame(state, 0)
              startFlourish()
            })
          }, delay)
        }

        if (oneShot && FRAME_DURATIONS[oneShot.kind]) {
          shotRef.current = oneShot.seq
          loopCount = 0
          const loops = ONESHOT_LOOPS[oneShot.kind] || 2
          playFrame(oneShot.kind, 0, function loopDone() {
            if (gen !== genRef.current) return
            loopCount += 1
            if (loopCount < loops) {
              playFrame(oneShot.kind, 0, loopDone)
            } else {
              shotRef.current = null
              onOneShotDone(oneShot.seq)
            }
          })
        } else {
          playFrame(state, 0)
          if (state === 'idle') startFlourish()
        }

        return () => {
          if (timer) clearTimeout(timer)
          if (flourishTimer) clearTimeout(flourishTimer)
        }
      }, [state, oneShot, onOneShotDone])

      return tick
    }

    function useImageNaturalSize(url) {
      const [size, setSize] = useState(null)
      useEffect(() => {
        if (!url) {
          setSize(null)
          return
        }
        let cancelled = false
        const img = new Image()
        img.onload = () => {
          if (!cancelled) setSize({ width: img.naturalWidth, height: img.naturalHeight })
        }
        img.onerror = () => {
          if (!cancelled) setSize(null)
        }
        img.src = url
        return () => {
          cancelled = true
        }
      }, [url])
      return size
    }

    // ─── Store ──────────────────────────────────────────────────────────────

    function createStore() {
      const listeners = new Set()
      const state = {
        loaded: false,
        config: {
          activePetId: null,
          petScale: 1,
          petPosition: null,
          petVisible: true,
        },
        pets: [],
        sessions: new Map(), // sessionId -> {title, running, updatedAt}
        running: new Set(), // agentIds currently running
        waiting: new Map(), // agentId -> pending approval count
        errors: new Map(), // agentId -> timestamp of last error
        oneShot: null, // {kind, seq}
        ui: { manager: false, market: false },
        // Desktop-window supervisor state. `supported` is null until the first
        // status probe answers, `gaveUp` after the retry budget is spent (the
        // in-page copy then stays visible instead of leaving no pet at all).
        desktop: {
          supported: null,
          platform: null,
          running: false,
          starting: false,
          error: null,
          failures: 0,
          gaveUp: false,
        },
      }
      let snapshot = { ...state }
      let seq = 0

      const emit = () => {
        snapshot = { ...state }
        for (const fn of listeners) fn()
      }
      const store = {
        subscribe(fn) {
          listeners.add(fn)
          return () => listeners.delete(fn)
        },
        getSnapshot() {
          return snapshot
        },
        setLoaded(config, pets) {
          state.loaded = true
          state.config = config
          state.pets = pets
          emit()
        },
        setConfig(config) {
          state.config = config
          emit()
        },
        setPets(pets) {
          state.pets = pets
          emit()
        },
        setSessions(items) {
          const sessions = new Map()
          const running = new Set()
          for (const item of items) {
            sessions.set(item.sessionId, {
              title: item.projections?.values?.title || '',
              running: item.running === true,
              updatedAt: item.updatedAt || 0,
            })
            if (item.running === true) running.add(item.sessionId)
          }
          state.sessions = sessions
          state.running = running
          emit()
        },
        setRunning(agentId, isRunning) {
          if (!agentId) return
          const had = state.running.size
          if (isRunning) state.running.add(agentId)
          else state.running.delete(agentId)
          // Turn-complete celebration: everything just went idle.
          if (had > 0 && state.running.size === 0 && !state.oneShot) {
            state.oneShot = { kind: 'jumping', seq: ++seq }
          }
          emit()
        },
        setError(agentId) {
          if (!agentId) return
          state.errors.set(agentId, Date.now())
          if (!state.oneShot) state.oneShot = { kind: 'failed', seq: ++seq }
          emit()
        },
        celebrate(kind) {
          if (state.oneShot || !FRAME_DURATIONS[kind]) return
          state.oneShot = { kind, seq: ++seq }
          emit()
        },
        waitStart(agentId) {
          const key = agentId || '?'
          state.waiting.set(key, (state.waiting.get(key) || 0) + 1)
          emit()
        },
        waitEnd(agentId) {
          const key = agentId || '?'
          const next = (state.waiting.get(key) || 0) - 1
          if (next <= 0) state.waiting.delete(key)
          else state.waiting.set(key, next)
          emit()
        },
        finishOneShot(finishedSeq) {
          if (state.oneShot && state.oneShot.seq === finishedSeq) {
            state.oneShot = null
            emit()
          }
        },
        setUi(patch) {
          state.ui = { ...state.ui, ...patch }
          emit()
        },
        setDesktop(patch) {
          const next = { ...state.desktop, ...patch }
          const same = Object.keys(next).every((key) => next[key] === state.desktop[key])
          if (same) return
          state.desktop = next
          emit()
        },
        ambientState() {
          const now = Date.now()
          for (const [id, ts] of state.errors) {
            if (now - ts > 8000) state.errors.delete(id)
          }
          if (state.errors.size > 0) return 'failed'
          if (state.waiting.size > 0) return 'waiting'
          if (state.running.size > 0) return 'running'
          return 'idle'
        },
      }
      return store
    }

    function useStore(store, selector) {
      const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot)
      return selector(snapshot)
    }

    // ─── API helpers ────────────────────────────────────────────────────────

    async function apiJson(path, options = {}) {
      const res = await fetch(`${API}${path}`, {
        headers: options.body ? { 'content-type': 'application/json' } : undefined,
        ...options,
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data || data.ok !== true) {
        const message = data?.error?.message || `HTTP ${res.status}`
        const err = new Error(message)
        err.code = data?.error?.code
        throw err
      }
      return data
    }

    async function apiBlobUrl(path) {
      const res = await fetch(`${API}${path}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      return URL.createObjectURL(blob)
    }

    /**
     * How many sessions are running, from this page's own state. The session
     * list can lag behind the live agent status, so the running set is the more
     * direct signal and the larger number wins.
     */
    function localRunningCount(store) {
      const snapshot = store.getSnapshot()
      let count = 0
      for (const session of snapshot.sessions.values()) {
        if (session.running) count += 1
      }
      return Math.max(count, snapshot.running.size)
    }

    /**
     * Report to the Host what the desktop pet window should show. That helper is
     * a separate process: it can only know the mood and the running-session
     * count (its corner badge) because this page tells it.
     */
    function pushDesktopMood(store) {
      return fetch(`${API}/api/desktop/mood`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ state: store.ambientState(), sessions: localRunningCount(store) }),
      }).catch(() => {})
    }

    /**
     * Hand the desktop-window helper its assets. The browser already decodes
     * WebP, so it re-encodes the sheet as PNG here — the WPF helper then only
     * has to crop frames, with no image codecs of its own.
     */
    async function exportDesktopAssets(petId, scale) {
      const res = await fetch(`${API}/api/pets/${encodeURIComponent(petId)}/spritesheet`)
      if (!res.ok) throw new Error(`spritesheet HTTP ${res.status}`)
      const blob = await res.blob()
      const bitmap = await createImageBitmap(blob)
      const sheetWidth = bitmap.width
      const sheetHeight = bitmap.height
      const canvas = document.createElement('canvas')
      canvas.width = sheetWidth
      canvas.height = sheetHeight
      const context = canvas.getContext('2d')
      context.drawImage(bitmap, 0, 0)
      if (typeof bitmap.close === 'function') bitmap.close()
      const png = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (out) => (out ? resolve(out) : reject(new Error('PNG export failed'))),
          'image/png'
        )
      })
      const rows = rowsFromHeight(sheetHeight)
      const states = {}
      for (const [name, row] of Object.entries(STATE_ROW)) {
        const durations = FRAME_DURATIONS[name]
        if (!durations || row >= rows) continue
        states[name] = { row, durations }
      }
      const sheetRes = await fetch(`${API}/api/desktop/sheet`, {
        method: 'POST',
        headers: { 'content-type': 'image/png' },
        body: png,
      })
      const sheetData = await sheetRes.json().catch(() => null)
      if (!sheetRes.ok || sheetData?.ok !== true) {
        throw new Error(sheetData?.error?.message || `sheet HTTP ${sheetRes.status}`)
      }
      await apiJson('/api/desktop/layout', {
        method: 'POST',
        body: JSON.stringify({ petId, frameWidth: FRAME_W, frameHeight: FRAME_H, scale, states }),
      })
      return { rows, states: Object.keys(states) }
    }

    /** Per-page cache of proxied image blob URLs (posters, previews). */
    function createAssetCache() {
      const cache = new Map()
      return {
        load(url) {
          let entry = cache.get(url)
          if (!entry) {
            entry = apiBlobUrl(url).catch((err) => {
              cache.delete(url)
              throw err
            })
            cache.set(url, entry)
          }
          return entry
        },
        dispose() {
          for (const promise of cache.values()) {
            promise.then((url) => URL.revokeObjectURL(url)).catch(() => {})
          }
          cache.clear()
        },
      }
    }

    function useProxiedAsset(cache, apiPath) {
      const [state, setState] = useState({ src: null, failed: false, key: null })
      useEffect(() => {
        if (!apiPath) return
        let cancelled = false
        cache
          .load(apiPath)
          .then((url) => {
            if (cancelled) return
            setState({ src: url, failed: false, key: apiPath })
          })
          .catch(() => {
            if (!cancelled) setState({ src: null, failed: true, key: apiPath })
          })
        return () => {
          cancelled = true
        }
      }, [apiPath, cache])
      if (!apiPath) return { src: null, loading: false, failed: false }
      if (state.key === apiPath) return { src: state.src, loading: false, failed: state.failed }
      return { src: null, loading: true, failed: false }
    }

    // ─── Shared UI atoms (theme tokens only) ────────────────────────────────

    const styles = `
.dshpt-portal { position: fixed; inset: 0; z-index: 2147482000; pointer-events: none; }
.dshpt-portal > * { pointer-events: auto; }
.dshpt-pet { position: fixed; z-index: 80; user-select: none; touch-action: none; }
.dshpt-pet-sprite { cursor: grab; filter: drop-shadow(0 4px 10px rgb(0 0 0 / 22%)); }
.dshpt-pet-sprite:active { cursor: grabbing; }
.dshpt-badge { position: absolute; top: -4px; right: -4px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; color: #fff; box-shadow: 0 1px 4px rgb(0 0 0 / 30%); pointer-events: none; }
.dshpt-panel { position: fixed; z-index: 81; width: 264px; max-height: 320px; overflow-y: auto; border-radius: 10px; border: 1px solid var(--dsw-alias-border-l3); background: var(--dsw-alias-bg-layer-2); box-shadow: 0 10px 32px rgb(0 0 0 / 22%); padding: 6px; }
.dshpt-panel-row { display: flex; align-items: center; gap: 8px; padding: 7px 9px; border-radius: 7px; font-size: 12px; color: var(--dsw-alias-label-primary); }
.dshpt-panel-row:hover { background: var(--dsw-alias-interactive-bg-hover); }
.dshpt-panel-row-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dshpt-chip { flex-shrink: 0; font-size: 10px; padding: 1px 6px; border-radius: 4px; }
.dshpt-menu { position: fixed; z-index: 130; min-width: 160px; border-radius: 9px; border: 1px solid var(--dsw-alias-border-l3); background: var(--dsw-alias-bg-layer-2); box-shadow: 0 10px 32px rgb(0 0 0 / 25%); padding: 5px; }
.dshpt-menu-item { display: flex; align-items: center; width: 100%; gap: 8px; padding: 7px 10px; border: 0; border-radius: 6px; background: transparent; color: var(--dsw-alias-label-primary); font-size: 12.5px; text-align: left; cursor: pointer; }
.dshpt-menu-item:hover { background: var(--dsw-alias-interactive-bg-hover); }
.dshpt-menu-sep { height: 1px; margin: 5px 4px; background: var(--dsw-alias-border-l3); }
.dshpt-menu-label { padding: 5px 10px 3px; font-size: 10.5px; color: var(--dsw-alias-label-tertiary); }
.dshpt-overlay { position: fixed; inset: 0; z-index: 120; background: var(--dsw-alias-bg-mask-1); display: flex; align-items: center; justify-content: center; }
.dshpt-dialog { width: min(720px, calc(100vw - 48px)); max-height: min(640px, calc(100vh - 64px)); display: flex; flex-direction: column; border-radius: 12px; border: 1px solid var(--dsw-alias-border-l3); background: var(--dsw-alias-bg-layer-1); box-shadow: 0 24px 64px rgb(0 0 0 / 30%); color: var(--dsw-alias-label-primary); }
.dshpt-dialog-head { display: flex; align-items: center; gap: 8px; padding: 14px 16px 10px; font-size: 14px; font-weight: 600; }
.dshpt-dialog-body { flex: 1; min-height: 0; overflow-y: auto; padding: 4px 16px 12px; }
.dshpt-dialog-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 16px 14px; border-top: 1px solid var(--dsw-alias-border-l4); }
.dshpt-btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 7px; border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-button-tool-bar-fill); color: var(--dsw-alias-label-primary); font-size: 12px; cursor: pointer; }
.dshpt-btn:hover { background: var(--dsw-alias-button-tool-bar-hover); }
.dshpt-btn:disabled { opacity: 0.5; cursor: default; }
.dshpt-btn-primary { background: var(--dsw-alias-button-primary-fill); border-color: transparent; color: var(--dsw-alias-label-primary-foreground); }
.dshpt-btn-primary:hover { background: var(--dsw-alias-button-primary-hover); }
.dshpt-btn-sm { padding: 3px 9px; font-size: 11px; }
.dshpt-input { padding: 7px 10px; border-radius: 7px; border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); font-size: 12.5px; outline: none; }
.dshpt-input:focus { border-color: var(--dsw-alias-brand-primary); }
.dshpt-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
.dshpt-card { display: flex; flex-direction: column; border-radius: 10px; border: 1px solid var(--dsw-alias-border-l3); background: var(--dsw-alias-bg-layer-2); overflow: hidden; }
.dshpt-card-thumb { height: 92px; display: flex; align-items: center; justify-content: center; background: var(--dsw-alias-bg-layer-3); overflow: hidden; }
.dshpt-card-thumb img { max-width: 100%; max-height: 100%; object-fit: contain; }
.dshpt-card-body { display: flex; flex-direction: column; gap: 4px; padding: 8px 10px; }
.dshpt-card-title { font-size: 12.5px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dshpt-card-desc { font-size: 11px; color: var(--dsw-alias-label-secondary); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.dshpt-card-foot { display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 2px 10px 9px; }
.dshpt-muted { color: var(--dsw-alias-label-tertiary); font-size: 11px; }
.dshpt-error { color: var(--dsw-alias-label-error); font-size: 12px; }
.dshpt-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.dshpt-toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 2px 16px 10px; }
.dshpt-pet-row { display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: 10px; border: 1px solid var(--dsw-alias-border-l3); background: var(--dsw-alias-bg-layer-2); }
.dshpt-pet-thumb { width: 56px; height: 60px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; border-radius: 8px; background: var(--dsw-alias-bg-layer-3); overflow: hidden; }
.dshpt-placeholder { width: 96px; height: 104px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; border-radius: 12px; border: 1.5px dashed var(--dsw-alias-border-l2); color: var(--dsw-alias-label-tertiary); font-size: 11px; text-align: center; cursor: pointer; background: transparent; padding: 6px; }
.dshpt-placeholder:hover { border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-label-secondary); }
.dshpt-spinner { width: 16px; height: 16px; border-radius: 50%; border: 2px solid var(--dsw-alias-border-l2); border-top-color: var(--dsw-alias-brand-primary); animation: dshpt-spin 0.8s linear infinite; }
@keyframes dshpt-spin { to { transform: rotate(360deg); } }
.dshpt-range { accent-color: var(--dsw-alias-brand-primary); }
.dshpt-switch { position: relative; width: 32px; height: 18px; border-radius: 9px; border: 0; background: var(--dsw-alias-border-l2); cursor: pointer; transition: background 0.15s; padding: 0; }
.dshpt-switch[data-on='true'] { background: var(--dsw-alias-brand-primary); }
.dshpt-switch::after { content: ''; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: var(--dsw-alias-switch-thumb, #fff); transition: left 0.15s; }
.dshpt-switch[data-on='true']::after { left: 16px; }
.dshpt-select { padding: 6px 8px; border-radius: 7px; border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary); font-size: 12px; }
/* Settings page: host-consistent section, groups, rows and tiles. */
.dshpt-section { display: flex; flex-direction: column; gap: 24px; width: 100%; max-width: 720px; color: var(--dsw-alias-label-primary); }
.dshpt-group { display: flex; flex-direction: column; }
.dshpt-group-head { display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px; }
.dshpt-group-title { margin: 0; font-size: 14px; font-weight: 500; line-height: 22px; }
.dshpt-intro { margin: 0; color: var(--dsw-alias-label-secondary); font-size: 13px; line-height: 20px; }
.dshpt-srow { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 14px 0; border-bottom: .5px solid var(--dsw-alias-border-l2); }
.dshpt-srow[data-last='true'] { border-bottom: none; }
.dshpt-srow-title { font-size: 14px; line-height: 20px; }
.dshpt-srow-desc { margin-top: 4px; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
.dshpt-srow-control { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.dshpt-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(128px, 1fr)); gap: 10px; padding: 4px 0 8px; }
.dshpt-tile { position: relative; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 14px 10px 12px; border: .5px solid var(--dsw-alias-border-l3); border-radius: var(--dsw-radius-lg, 12px); background: var(--dsw-alias-bg-layer-2); cursor: pointer; }
.dshpt-tile:hover { background: var(--dsw-alias-bg-layer-3); }
.dshpt-tile[data-active='true'] { border-color: var(--dsw-alias-brand-primary); }
.dshpt-tile-sprite { width: 76px; height: 82px; background-repeat: no-repeat; image-rendering: pixelated; }
.dshpt-tile-name { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; line-height: 18px; }
.dshpt-tile-badge { position: absolute; top: 6px; right: 6px; padding: 1px 6px; border-radius: 4px; font-size: 10px; line-height: 16px; background: var(--dsw-alias-brand-primary); color: var(--dsw-alias-label-primary-foreground); }
.dshpt-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 22px; border: .5px dashed var(--dsw-alias-border-l2); border-radius: var(--dsw-radius-lg, 12px); color: var(--dsw-alias-label-tertiary); font-size: 13px; line-height: 20px; }
.dshpt-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding-top: 12px; }
.dshpt-btn32 { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px; border: .5px solid var(--dsw-alias-border-l3); border-radius: var(--dsw-radius-md, 8px); background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); font-size: 13px; line-height: 20px; cursor: pointer; }
.dshpt-btn32:hover:not(:disabled) { background: var(--dsw-alias-bg-layer-3); }
.dshpt-btn32:disabled { opacity: .6; cursor: default; }
.dshpt-btn32-primary { border-color: transparent; background: var(--dsw-alias-button-primary-fill); color: var(--dsw-alias-label-primary-foreground); }
.dshpt-btn32-primary:hover:not(:disabled) { background: var(--dsw-alias-button-primary-hover); }
.dshpt-range32 { width: 148px; }
`

    function Switch({ on, onChange, label }) {
      return h('button', {
        type: 'button',
        className: 'dshpt-switch',
        role: 'switch',
        'aria-checked': on ? 'true' : 'false',
        'aria-label': label,
        'data-on': on ? 'true' : 'false',
        onClick: () => onChange(!on),
      })
    }

    function Spinner() {
      return h('span', { className: 'dshpt-spinner', role: 'status' })
    }

    function PawIcon({ size = 16 }) {
      return h(
        'svg',
        { viewBox: '0 0 64 64', width: size, height: size, 'aria-hidden': true },
        h('circle', { cx: 20, cy: 24, r: 6, fill: 'currentColor' }),
        h('circle', { cx: 32, cy: 18, r: 6, fill: 'currentColor' }),
        h('circle', { cx: 44, cy: 24, r: 6, fill: 'currentColor' }),
        h('path', {
          d: 'M32 32c8.5 0 15 5.8 15 12.2 0 4.8-3.7 8-8.5 8-2.8 0-4.7-1.3-6.5-1.3s-3.7 1.3-6.5 1.3c-4.8 0-8.5-3.2-8.5-8C17 37.8 23.5 32 32 32z',
          fill: 'currentColor',
        })
      )
    }

    // Stacked modals: only the topmost answers Escape and backdrop clicks.
    const modalStack = []

    function Modal({ onClose, labelledBy, children }) {
      const ref = useRef(null)
      const tokenRef = useRef(null)
      if (tokenRef.current === null) tokenRef.current = {}
      useEffect(() => {
        const token = tokenRef.current
        modalStack.push(token)
        const onKey = (event) => {
          if (event.key === 'Escape' && modalStack[modalStack.length - 1] === token) {
            event.stopPropagation()
            onClose()
          }
        }
        document.addEventListener('keydown', onKey, true)
        const node = ref.current
        const previous = document.activeElement
        if (node) {
          const focusable = node.querySelector('input, button, select')
          if (focusable) focusable.focus()
        }
        return () => {
          const at = modalStack.indexOf(token)
          if (at !== -1) modalStack.splice(at, 1)
          document.removeEventListener('keydown', onKey, true)
          if (previous && previous.focus) previous.focus()
        }
      }, [onClose])
      return h(
        'div',
        {
          className: 'dshpt-overlay',
          onPointerDown: (event) => {
            if (
              event.target === event.currentTarget &&
              modalStack[modalStack.length - 1] === tokenRef.current
            ) {
              onClose()
            }
          },
        },
        h('div', { className: 'dshpt-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': labelledBy, ref }, children)
      )
    }

    // ─── Desktop window supervisor ──────────────────────────────────────────

    /**
     * The pet lives in a transparent, always-on-top desktop window: that is the
     * only place a sprite can be dragged outside the DSH frame and across the
     * whole screen. It is not a mode — while the pet is shown it is shown
     * there, and this supervisor keeps that window in step with the config
     * (show/hide, active pet, scale) without any switch to turn on.
     *
     * The in-page copy is the fallback: non-Windows platforms, a window helper
     * that cannot start, or a spent retry budget all fall back to rendering the
     * pet inside the app rather than leaving the user with no pet at all.
     */
    function useDesktopPet(store, enabled, t) {
      const ready = useStore(store, (s) => s.loaded)
      const configKey = useStore(
        store,
        (s) => `${s.config.petVisible}|${s.config.activePetId}|${s.config.petScale}`
      )
      const exportedKeyRef = useRef(null)
      /** Last 'manage pet' token acted on, so one request opens the UI once. */
      const revealSeenRef = useRef(0)
      const lastStartRef = useRef(0)

      useEffect(() => {
        if (!ready || !enabled) return
        // A config change (hide/show, pet switch, scale) is the user asking
        // again: hand the window helper a fresh retry budget instead of staying
        // given up until the next page load.
        if (store.getSnapshot().desktop.gaveUp) {
          lastStartRef.current = 0
          store.setDesktop({ gaveUp: false, failures: 0, error: null })
        }
        let disposed = false
        let busy = false

        const tick = async () => {
          if (disposed || busy) return
          busy = true
          const settle = (patch) => {
            if (!disposed) store.setDesktop(patch)
          }
          try {
            const status = await apiJson('/api/desktop/status')
            if (disposed) return
            // The Host forgets the running-session count whenever the window
            // helper restarts (hide/show, pet or scale change, a crash), and
            // the helper paints the corner badge from that number — so a stale
            // zero keeps the badge hidden until the next heartbeat. Compare it
            // with our own count and re-send the moment they disagree.
            if (typeof status.sessions === 'number' && status.sessions !== localRunningCount(store)) {
              void pushDesktopMood(store)
            }
            // "管理桌宠" in the desktop window's right-click menu: the helper
            // cannot reach this webview, so it raises a token on the Host and
            // this poll turns it into an opened pet manager.
            if (typeof status.reveal === 'number' && status.reveal > 0 && status.reveal !== revealSeenRef.current) {
              revealSeenRef.current = status.reveal
              store.setUi({ manager: true })
            }
            // Re-read the config every tick: the desktop window can change it
            // itself (its menu hides the pet or applies a size), and a stale
            // store would then fight the user — relaunching the window they
            // just hid, or ignoring the size they just picked.
            const snapshot = store.getSnapshot()
            const cfgData = await apiJson('/api/config').catch(() => null)
            const cfg =
              cfgData?.config && typeof cfgData.config === 'object' ? cfgData.config : snapshot.config
            const previous = snapshot.config
            // Compare the fields that matter instead of the whole object: JSON
            // key order is not stable between routes, and a stringify diff would
            // rewrite the store on every tick — which re-runs this effect and
            // restarts the window in a loop.
            if (
              cfgData?.config &&
              (cfg.petVisible !== previous.petVisible ||
                cfg.activePetId !== previous.activePetId ||
                cfg.petScale !== previous.petScale)
            ) {
              store.setConfig(cfg)
            }
            const supported = status.platform === 'win32'
            const wantPet = Boolean(cfg.petVisible && cfg.activePetId)

            if (!supported) {
              settle({ supported: false, platform: status.platform, running: false, starting: false })
              return
            }
            if (!wantPet) {
              if (status.running === true) {
                await apiJson('/api/desktop/stop', { method: 'POST', body: '{}' }).catch(() => {})
              }
              lastStartRef.current = 0
              settle({
                supported: true,
                platform: status.platform,
                running: false,
                starting: false,
                error: null,
                failures: 0,
                gaveUp: false,
              })
              return
            }
            if (snapshot.desktop.gaveUp) {
              settle({ supported: true, platform: status.platform, running: status.running === true, starting: false })
              return
            }

            const key = `${cfg.activePetId}@${cfg.petScale}`
            // Only the *pet* has to be re-exported. The sprite sheet holds
            // source-resolution frames and the helper resizes locally from the
            // Host's scale, so a size change must not cost a PNG encode plus a
            // window restart — that was the lag on every size click.
            const assetsReady = status.petId === cfg.activePetId
            if (status.running === true) {
              lastStartRef.current = 0
              if (assetsReady) {
                exportedKeyRef.current = key
                settle({
                  supported: true,
                  platform: status.platform,
                  running: true,
                  starting: false,
                  error: null,
                  failures: 0,
                })
                return
              }
            }

            // A helper we launched seconds ago is already gone: count it as a
            // failed launch instead of relaunching it every tick forever.
            if (
              status.running !== true &&
              assetsReady &&
              lastStartRef.current !== 0 &&
              Date.now() - lastStartRef.current < 20000
            ) {
              const failures = snapshot.desktop.failures + 1
              lastStartRef.current = 0
              settle({
                supported: true,
                platform: status.platform,
                running: false,
                starting: false,
                error: t('settings.desktopFailed'),
                failures,
                gaveUp: failures >= 3,
              })
              if (failures >= 3) return
            }

            settle({ supported: true, platform: status.platform, running: status.running === true, starting: true })
            // A pet or scale change needs fresh assets and a fresh window; the
            // helper crops frames out of the PNG this page exports for it.
            if (status.running === true) {
              await apiJson('/api/desktop/stop', { method: 'POST', body: '{}' }).catch(() => {})
            }
            await exportDesktopAssets(cfg.activePetId, cfg.petScale)
            exportedKeyRef.current = key
            lastStartRef.current = Date.now()
            const data = await apiJson('/api/desktop/start', { method: 'POST', body: '{}' })
            if (disposed) return
            if (data.config) store.setConfig(data.config)
            // `failures` is deliberately left alone here: a start call returns
            // as soon as the helper process is spawned, and only the next tick
            // can tell whether it survived.
            settle({ running: true, starting: false, error: null })
          } catch (error) {
            if (disposed) return
            const previous = store.getSnapshot().desktop
            const failures = previous.failures + 1
            settle({
              // An unanswered probe must not hide the pet forever: fall back
              // to the in-page copy until a later tick succeeds.
              supported: previous.supported === null ? false : previous.supported,
              running: false,
              starting: false,
              error: error instanceof Error ? error.message : String(error),
              failures,
              gaveUp: failures >= 3,
            })
          } finally {
            busy = false
          }
        }

        void tick()
        const timer = setInterval(tick, 4000)
        return () => {
          disposed = true
          clearInterval(timer)
        }
      }, [ready, enabled, configKey, store, t])
    }

    // ─── Pet widget ─────────────────────────────────────────────────────────

    const DEFAULT_PET_MARGIN = 28

    function PetWidget({ store, t, config, pets, onOpenManager }) {
      const [panelOpen, setPanelOpen] = useState(false)
      const [menu, setMenu] = useState(null) // {x, y}
      const [sheetUrl, setSheetUrl] = useState(null)
      const [dragState, setDragState] = useState(null) // 'running_left' | 'running_right' | null
      const [dragPos, setDragPos] = useState(null) // live {x, y} while dragging
      const dragPosRef = useRef(null) // mirror: updaters must stay side-effect free
      const rootRef = useRef(null)
      const saveTimerRef = useRef(null)
      const suppressClickRef = useRef(false)

      const activePet = config.activePetId
      const hasPet = Boolean(activePet) && pets.some((p) => p.id === activePet)

      // Load the active pet's spritesheet through the host route.
      useEffect(() => {
        if (!hasPet) {
          setSheetUrl(null)
          return
        }
        let cancelled = false
        let url = null
        apiBlobUrl(`/api/pets/${encodeURIComponent(activePet)}/spritesheet`)
          .then((u) => {
            if (cancelled) {
              URL.revokeObjectURL(u)
              return
            }
            url = u
            setSheetUrl(u)
          })
          .catch(() => {
            if (!cancelled) setSheetUrl(null)
          })
        return () => {
          cancelled = true
          if (url) URL.revokeObjectURL(url)
          setSheetUrl(null)
        }
      }, [activePet, hasPet])

      const ambient = useStore(store, (s) => {
        void s.running, s.waiting, s.errors, s.oneShot
        return store.ambientState()
      })
      const oneShot = useStore(store, (s) => s.oneShot)
      const badge = useStore(store, (s) => ({
        running: s.running.size,
        waiting: [...s.waiting.values()].reduce((a, b) => a + b, 0),
        errors: s.errors.size,
      }))
      const sessions = useStore(store, (s) => s.sessions)
      const desktop = useStore(store, (s) => s.desktop)
      const finishOneShot = useCallback((seq) => store.finishOneShot(seq), [store])

      const animState = dragState || ambient
      const tick = usePetAnimator(animState, dragState ? null : oneShot, finishOneShot)
      const sheetSize = useImageNaturalSize(sheetUrl)
      const rows = rowsFromHeight(sheetSize?.height)

      const scale = config.petScale
      const width = FRAME_W * scale
      const height = FRAME_H * scale

      const position = dragPos ||
        config.petPosition || {
          x: Math.max(0, window.innerWidth - width - DEFAULT_PET_MARGIN),
          y: Math.max(0, window.innerHeight - height - DEFAULT_PET_MARGIN),
        }

      const persistPosition = useCallback(
        (pos) => {
          if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
          saveTimerRef.current = setTimeout(() => {
            apiJson('/api/config', {
              method: 'PUT',
              body: JSON.stringify({ petPosition: pos }),
            })
              .then((data) => store.setConfig(data.config))
              .catch(() => {})
          }, 400)
        },
        [store]
      )

      const onPointerDown = useCallback(
        (event) => {
          if (event.button !== 0) return
          event.preventDefault()
          const start = { x: event.clientX, y: event.clientY }
          const origin = dragPosRef.current ||
            config.petPosition || {
              x: Math.max(0, window.innerWidth - width - DEFAULT_PET_MARGIN),
              y: Math.max(0, window.innerHeight - height - DEFAULT_PET_MARGIN),
            }
          let moved = false
          const onMove = (e) => {
            const dx = e.clientX - start.x
            const dy = e.clientY - start.y
            if (!moved && Math.hypot(dx, dy) > 6) {
              moved = true
              // A drag supersedes any in-flight one-shot; replaying it after
              // the drop would feel like the pet lagging behind the user.
              const inFlight = store.getSnapshot().oneShot
              if (inFlight) store.finishOneShot(inFlight.seq)
            }
            if (!moved) return
            setDragState(dx < 0 ? 'running_left' : dx > 0 ? 'running_right' : null)
            const live = {
              x: Math.min(Math.max(0, origin.x + dx), window.innerWidth - width),
              y: Math.min(Math.max(0, origin.y + dy), window.innerHeight - height),
            }
            dragPosRef.current = live
            setDragPos(live)
          }
          const onUp = (e) => {
            document.removeEventListener('pointermove', onMove)
            document.removeEventListener('pointerup', onUp)
            setDragState(null)
            if (moved) {
              suppressClickRef.current = true
              const finalPos = dragPosRef.current || origin
              dragPosRef.current = null
              setDragPos(null)
              store.setConfig({ ...store.getSnapshot().config, petPosition: finalPos })
              persistPosition(finalPos)
            } else {
              // Plain click on the pet body: play a jump, like codeg.
              store.celebrate('jumping')
            }
            void e
          }
          document.addEventListener('pointermove', onMove)
          document.addEventListener('pointerup', onUp)
        },
        [config.petPosition, width, height, store, persistPosition]
      )

      // Keep the pet inside the viewport on window resize.
      useEffect(() => {
        const onResize = () => {
          const snap = store.getSnapshot().config
          if (!snap.petPosition) return
          const nx = Math.min(snap.petPosition.x, window.innerWidth - width)
          const ny = Math.min(snap.petPosition.y, window.innerHeight - height)
          if (nx !== snap.petPosition.x || ny !== snap.petPosition.y) {
            const pos = { x: Math.max(0, nx), y: Math.max(0, ny) }
            store.setConfig({ ...snap, petPosition: pos })
            persistPosition(pos)
          }
        }
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
      }, [store, width, height, persistPosition])

      const badgeColor =
        badge.errors > 0
          ? 'var(--dsw-alias-state-error-primary)'
          : badge.waiting > 0
            ? 'var(--dsw-alias-state-warn-primary)'
            : badge.running > 0
              ? 'var(--dsw-alias-state-success-primary)'
              : null
      const badgeCount = badge.errors > 0 ? badge.errors : badge.waiting > 0 ? badge.waiting : badge.running

      const sessionRows = useMemo(() => {
        const rowsOut = []
        for (const [id, info] of sessions) {
          rowsOut.push({ id, ...info })
        }
        rowsOut.sort((a, b) => b.updatedAt - a.updatedAt)
        return rowsOut.slice(0, 12)
      }, [sessions])

      // Panel anchors to the pet and stays inside the viewport.
      const panelStyle = {
        left: Math.min(Math.max(8, position.x + width / 2 - 132), window.innerWidth - 272),
        top: Math.max(8, position.y - 336),
      }

      const openMenu = (event) => {
        event.preventDefault()
        setMenu({ x: event.clientX, y: event.clientY })
      }

      // The desktop window owns the pet whenever it is (or is about to be)
      // running; this in-page copy is only the fallback for platforms and
      // launches where that window cannot exist. The host's `desktopPet` flag
      // is deliberately not consulted here: it is a snapshot from the last
      // config read and would pin the pet off after the window already died.
      const desktopActive = desktop.supported !== false && !desktop.gaveUp
      if (!config.petVisible || desktopActive) return null

      if (!hasPet) {
        return h(
          'div',
          { ref: rootRef, className: 'dshpt-pet', style: { left: position.x, top: position.y, zIndex: 80 } },
          h(
            'button',
            { type: 'button', className: 'dshpt-placeholder', onClick: onOpenManager },
            h(PawIcon, { size: 28 }),
            h('span', null, t('pet.noPet')),
            h('span', { className: 'dshpt-muted' }, t('pet.noPetHint'))
          )
        )
      }

      return h(
        React.Fragment,
        null,
        h(
          'div',
          {
            ref: rootRef,
            className: 'dshpt-pet',
            style: { left: position.x, top: position.y, width, height },
            onContextMenu: openMenu,
          },
          h('div', {
            className: 'dshpt-pet-sprite',
            role: 'img',
            'aria-label': pets.find((p) => p.id === activePet)?.displayName || 'pet',
            onPointerDown,
            onClick: () => {
              // A finished drag also fires click; the panel toggle belongs to taps only.
              if (suppressClickRef.current) {
                suppressClickRef.current = false
                return
              }
              setPanelOpen((v) => !v)
            },
            style: {
              width,
              height,
              backgroundImage: sheetUrl ? `url("${sheetUrl}")` : 'none',
              backgroundRepeat: 'no-repeat',
              backgroundSize: sheetBackgroundSize(rows),
              backgroundPosition: cellPosition(tick.row, tick.col, rows),
              imageRendering: 'pixelated',
            },
          }),
          badgeColor
            ? h('span', { className: 'dshpt-badge', style: { background: badgeColor } }, badgeCount)
            : null
        ),
        panelOpen
          ? h(
              'div',
              { className: 'dshpt-panel', style: panelStyle, role: 'status' },
              sessionRows.length === 0
                ? h('div', { className: 'dshpt-panel-row dshpt-muted' }, t('pet.panelEmpty'))
                : sessionRows.map((row) => {
                    const status = row.running ? 'running' : 'idle'
                    return h(
                      'div',
                      { key: row.id, className: 'dshpt-panel-row', title: row.title || t('pet.untitled') },
                      h('span', { className: 'dshpt-panel-row-title' }, row.title || t('pet.untitled')),
                      h(
                        'span',
                        {
                          className: 'dshpt-chip',
                          style:
                            status === 'running'
                              ? { background: 'var(--dsw-alias-state-success-primary)', color: '#fff' }
                              : { background: 'var(--dsw-alias-bg-layer-3)', color: 'var(--dsw-alias-label-tertiary)' },
                        },
                        t(`pet.${status}`)
                      )
                    )
                  })
            )
          : null,
        menu
          ? h(PetMenu, {
              x: menu.x,
              y: menu.y,
              t,
              panelOpen,
              scale,
              onClose: () => setMenu(null),
              onTogglePanel: () => {
                setPanelOpen((v) => !v)
                setMenu(null)
              },
              onScale: (next) => {
                apiJson('/api/config', { method: 'PUT', body: JSON.stringify({ petScale: next }) })
                  .then((data) => store.setConfig(data.config))
                  .catch(() => {})
              },
              onManager: () => {
                setMenu(null)
                onOpenManager()
              },
              onHide: () => {
                setMenu(null)
                apiJson('/api/config', { method: 'PUT', body: JSON.stringify({ petVisible: false }) })
                  .then((data) => store.setConfig(data.config))
                  .catch(() => {})
              },
            })
          : null
      )
    }

    function PetMenu(props) {
      const ref = useRef(null)
      const onCloseRef = useRef(props.onClose)
      onCloseRef.current = props.onClose
      useEffect(() => {
        const onDown = (event) => {
          if (ref.current && !ref.current.contains(event.target)) onCloseRef.current()
        }
        document.addEventListener('pointerdown', onDown, true)
        return () => document.removeEventListener('pointerdown', onDown, true)
      }, [])
      const style = {
        left: Math.min(props.x, window.innerWidth - 180),
        top: Math.min(props.y, window.innerHeight - 260),
      }
      const item = (label, onClick, key) =>
        h('button', { key: key || label, type: 'button', className: 'dshpt-menu-item', onClick }, label)
      return h(
        'div',
        { ref, className: 'dshpt-menu', style, role: 'menu' },
        item(props.panelOpen ? props.t('pet.hidePanel') : props.t('pet.showPanel'), props.onTogglePanel),
        h('div', { className: 'dshpt-menu-sep' }),
        h('div', { className: 'dshpt-menu-label' }, props.t('pet.scale')),
        h(
          'div',
          { className: 'dshpt-row', style: { gap: 4, padding: '0 6px 4px' } },
          [0.5, 0.75, 1, 1.5, 2].map((s) =>
            h(
              'button',
              {
                key: s,
                type: 'button',
                className: 'dshpt-btn dshpt-btn-sm',
                style: s === props.scale ? { borderColor: 'var(--dsw-alias-brand-primary)' } : undefined,
                onClick: () => props.onScale(s),
              },
              `${s}×`
            )
          )
        ),
        h('div', { className: 'dshpt-menu-sep' }),
        item(props.t('pet.manager'), props.onManager),
        h('div', { className: 'dshpt-menu-sep' }),
        item(props.t('pet.hide'), props.onHide)
      )
    }

    // ─── Pet manager dialog ─────────────────────────────────────────────────

    function PetThumb({ petId, width = 56, height = 60 }) {
      const [url, setUrl] = useState(null)
      useEffect(() => {
        let cancelled = false
        let owned = null
        apiBlobUrl(`/api/pets/${encodeURIComponent(petId)}/spritesheet`)
          .then((u) => {
            if (cancelled) {
              URL.revokeObjectURL(u)
              return
            }
            owned = u
            setUrl(u)
          })
          .catch(() => {})
        return () => {
          cancelled = true
          if (owned) URL.revokeObjectURL(owned)
        }
      }, [petId])
      const size = useImageNaturalSize(url)
      const rows = rowsFromHeight(size?.height)
      if (!url) return h('div', { className: 'dshpt-pet-thumb' }, h(Spinner))
      return h('div', {
        className: 'dshpt-pet-thumb',
        style: {
          width,
          height,
          backgroundImage: `url("${url}")`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: sheetBackgroundSize(rows),
          backgroundPosition: cellPosition(0, 0, rows),
          imageRendering: 'pixelated',
        },
      })
    }

    function PetManagerDialog({ store, t, onClose, onOpenMarket }) {
      const config = useStore(store, (s) => s.config)
      const pets = useStore(store, (s) => s.pets)
      const [deleteTarget, setDeleteTarget] = useState(null)
      const [busy, setBusy] = useState(false)
      const [error, setError] = useState(null)

      const refreshPets = useCallback(() => {
        apiJson('/api/pets')
          .then((data) => store.setPets(data.pets))
          .catch(() => {})
      }, [store])

      const putConfig = useCallback(
        (patch) => {
          return apiJson('/api/config', { method: 'PUT', body: JSON.stringify(patch) })
            .then((data) => store.setConfig(data.config))
            .catch((err) => setError(err.message))
        },
        [store]
      )

      return h(
        Modal,
        { onClose, labelledBy: 'dshpt-manager-title' },
        h(
          'div',
          { className: 'dshpt-dialog-head', id: 'dshpt-manager-title' },
          h(PawIcon, { size: 18 }),
          t('manager.title'),
          h('span', { style: { flex: 1 } }),
          h('span', { className: 'dshpt-muted' }, t('manager.visible')),
          h(Switch, {
            on: config.petVisible,
            onChange: (v) => putConfig({ petVisible: v }),
            label: t('manager.visible'),
          })
        ),
        h(
          'div',
          { className: 'dshpt-dialog-body' },
          error ? h('p', { className: 'dshpt-error' }, error) : null,
          h(
            'div',
            { className: 'dshpt-row', style: { margin: '4px 0 12px' } },
            h('span', { className: 'dshpt-muted' }, t('manager.scale')),
            h('input', {
              type: 'range',
              min: 0.5,
              max: 2,
              step: 0.25,
              value: config.petScale,
              className: 'dshpt-range',
              onChange: (event) => putConfig({ petScale: Number(event.target.value) }),
            }),
            h('span', { className: 'dshpt-muted' }, `${config.petScale}×`)
          ),
          pets.length === 0
            ? h('p', { className: 'dshpt-muted' }, t('manager.empty'))
            : h(
                'div',
                { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
                pets.map((pet) => {
                  const active = pet.id === config.activePetId
                  return h(
                    'div',
                    { key: pet.id, className: 'dshpt-pet-row' },
                    h(PetThumb, { petId: pet.id }),
                    h(
                      'div',
                      { style: { flex: 1, minWidth: 0 } },
                      h('div', { className: 'dshpt-card-title' }, pet.displayName),
                      pet.description ? h('div', { className: 'dshpt-card-desc' }, pet.description) : null
                    ),
                    active
                      ? h(
                          'span',
                          {
                            className: 'dshpt-chip',
                            style: { background: 'var(--dsw-alias-state-success-primary)', color: '#fff' },
                          },
                          t('manager.active')
                        )
                      : h(
                          'button',
                          {
                            type: 'button',
                            className: 'dshpt-btn dshpt-btn-sm',
                            disabled: busy,
                            onClick: () => {
                              setBusy(true)
                              putConfig({ activePetId: pet.id, petVisible: true }).finally(() => setBusy(false))
                            },
                          },
                          t('manager.setActive')
                        ),
                    h(
                      'button',
                      {
                        type: 'button',
                        className: 'dshpt-btn dshpt-btn-sm',
                        disabled: busy,
                        onClick: () => setDeleteTarget(pet),
                      },
                      t('manager.delete')
                    )
                  )
                })
              )
        ),
        h(
          'div',
          { className: 'dshpt-dialog-foot' },
          h(
            'button',
            { type: 'button', className: 'dshpt-btn dshpt-btn-primary', onClick: onOpenMarket },
            t('manager.openMarket')
          ),
          h('button', { type: 'button', className: 'dshpt-btn', onClick: onClose }, t('manager.close'))
        ),
        deleteTarget
          ? h(
              Modal,
              { onClose: () => setDeleteTarget(null), labelledBy: 'dshpt-del-title' },
              h('div', { className: 'dshpt-dialog-head', id: 'dshpt-del-title' }, t('manager.delete')),
              h(
                'div',
                { className: 'dshpt-dialog-body' },
                t('manager.deleteConfirm', { name: deleteTarget.displayName })
              ),
              h(
                'div',
                { className: 'dshpt-dialog-foot' },
                h(
                  'button',
                  { type: 'button', className: 'dshpt-btn', onClick: () => setDeleteTarget(null) },
                  t('manager.cancel')
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'dshpt-btn dshpt-btn-primary',
                    disabled: busy,
                    onClick: () => {
                      setBusy(true)
                      apiJson('/api/pets/delete', {
                        method: 'POST',
                        body: JSON.stringify({ id: deleteTarget.id }),
                      })
                        .then(() => {
                          setDeleteTarget(null)
                          refreshPets()
                          return apiJson('/api/config').then((data) => store.setConfig(data.config))
                        })
                        .catch((err) => setError(err.message))
                        .finally(() => setBusy(false))
                    },
                  },
                  t('manager.delete')
                )
              )
            )
          : null
      )
    }

    // ─── Pet marketplace dialog ─────────────────────────────────────────────

    const PET_PAGE_SIZE = 30
    const SEARCH_DEBOUNCE = 300
    const KIND_OPTIONS = ['all', 'object', 'animal', 'person', 'creature']
    const SORT_OPTIONS = ['latest', 'popular', 'views']

    function Filmstrip({ url, height = 120 }) {
      const size = useImageNaturalSize(url)
      const [frame, setFrame] = useState(0)
      const frames = size ? filmstripFrameCount(size.width, size.height) : 0
      useEffect(() => {
        if (frames <= 1) return
        const timer = setInterval(() => setFrame((f) => (f + 1) % frames), 130)
        return () => clearInterval(timer)
      }, [frames])
      if (!url) return null
      if (!size || frames <= 0) {
        return h('img', { src: url, alt: '', style: { maxWidth: '100%', maxHeight: height, objectFit: 'contain' } })
      }
      const cellW = (height * FRAME_W) / FRAME_H
      return h('div', {
        style: {
          width: cellW,
          height,
          backgroundImage: `url("${url}")`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: `${frames * 100}% 100%`,
          backgroundPosition: `${frames > 1 ? (frame / (frames - 1)) * 100 : 0}% 0%`,
          imageRendering: 'pixelated',
        },
      })
    }

    function PetMarketCard({ pet, t, assetCache, installed, busy, busyAny, onInstall }) {
      const poster = useProxiedAsset(
        assetCache,
        pet.posterUrl
          ? `/api/pet-market/asset?url=${encodeURIComponent(pet.posterUrl)}`
          : pet.previewUrl
            ? `/api/pet-market/asset?url=${encodeURIComponent(pet.previewUrl)}`
            : null
      )
      const [previewOpen, setPreviewOpen] = useState(false)
      const preview = useProxiedAsset(
        assetCache,
        previewOpen && pet.previewUrl
          ? `/api/pet-market/asset?url=${encodeURIComponent(pet.previewUrl)}`
          : null
      )
      return h(
        'div',
        { className: 'dshpt-card' },
        h(
          'button',
          {
            type: 'button',
            className: 'dshpt-card-thumb',
            style: { border: 0, cursor: pet.previewUrl ? 'zoom-in' : 'default', padding: 0 },
            onClick: () => pet.previewUrl && setPreviewOpen((v) => !v),
          },
          poster.src
            ? h('img', { src: poster.src, alt: pet.displayName })
            : poster.loading
              ? h(Spinner)
              : h(PawIcon, { size: 24 })
        ),
        h(
          'div',
          { className: 'dshpt-card-body' },
          h('div', { className: 'dshpt-card-title', title: pet.displayName }, pet.displayName),
          pet.description ? h('div', { className: 'dshpt-card-desc', title: pet.description }, pet.description) : null,
          previewOpen && preview.src ? h(Filmstrip, { url: preview.src }) : null
        ),
        h(
          'div',
          { className: 'dshpt-card-foot' },
          h(
            'span',
            { className: 'dshpt-muted', title: `${t('market.views')} / ${t('market.downloads')} / ${t('market.likes')}` },
            `${pet.viewCount} / ${pet.downloadCount} / ${pet.likeCount}`
          ),
          h(
            'button',
            {
              type: 'button',
              className: `dshpt-btn dshpt-btn-sm${installed ? '' : ' dshpt-btn-primary'}`,
              disabled: busyAny && !busy,
              onClick: onInstall,
            },
            busy ? t('market.installing') : installed ? t('market.reinstall') : t('market.install')
          )
        )
      )
    }

    function PetMarketDialog({ store, t, onClose }) {
      const assetCacheRef = useRef(null)
      if (!assetCacheRef.current) assetCacheRef.current = createAssetCache()
      const assetCache = assetCacheRef.current
      useEffect(() => () => assetCache.dispose(), [assetCache])

      const pets = useStore(store, (s) => s.pets)
      const installedIds = useMemo(() => new Set(pets.map((p) => p.id)), [pets])

      const [searchInput, setSearchInput] = useState('')
      const [q, setQ] = useState('')
      const [kind, setKind] = useState('all')
      const [sort, setSort] = useState('latest')
      const [page, setPage] = useState(1)
      const [items, setItems] = useState([])
      const [totalPages, setTotalPages] = useState(1)
      const [total, setTotal] = useState(0)
      const [loading, setLoading] = useState(false)
      const [error, setError] = useState(null)
      const [installingId, setInstallingId] = useState(null)
      const [notice, setNotice] = useState(null)
      const [reinstallTarget, setReinstallTarget] = useState(null)
      const seqRef = useRef(0)

      useEffect(() => {
        const handle = setTimeout(() => {
          setQ(searchInput.trim())
          setPage(1)
        }, SEARCH_DEBOUNCE)
        return () => clearTimeout(handle)
      }, [searchInput])

      const reload = useCallback(async () => {
        const seq = ++seqRef.current
        setLoading(true)
        setError(null)
        try {
          const params = new URLSearchParams({ page: String(page), pageSize: String(PET_PAGE_SIZE) })
          if (q) params.set('q', q)
          if (kind !== 'all') params.set('kind', kind)
          if (sort !== 'latest') params.set('sort', sort)
          const data = await apiJson(`/api/pet-market/list?${params}`)
          if (seq !== seqRef.current) return
          setItems(data.pets)
          setTotal(data.total)
          setTotalPages(Math.max(1, data.totalPages))
        } catch (err) {
          if (seq !== seqRef.current) return
          setError(err.message)
        } finally {
          if (seq === seqRef.current) setLoading(false)
        }
      }, [page, q, kind, sort])

      useEffect(() => {
        void reload()
      }, [reload])

      const performInstall = useCallback(
        async (pet, overwrite) => {
          setInstallingId(pet.id)
          setNotice(null)
          try {
            await apiJson('/api/pet-market/install', {
              method: 'POST',
              body: JSON.stringify({ id: pet.id, downloadUrl: pet.downloadUrl, overwrite }),
            })
            setItems((prev) => prev.map((p) => (p.id === pet.id ? { ...p, alreadyInstalled: true } : p)))
            const fresh = await apiJson('/api/pets')
            store.setPets(fresh.pets)
            // First install: make it the active pet so the user sees it immediately.
            const snap = store.getSnapshot().config
            if (!snap.activePetId || snap.activePetId === pet.id) {
              const cfg = await apiJson('/api/config', {
                method: 'PUT',
                body: JSON.stringify({ activePetId: pet.id, petVisible: true }),
              })
              store.setConfig(cfg.config)
            }
            setNotice(t('market.installed', { name: pet.displayName }))
          } catch (err) {
            setError(`${t('market.installFailed')}: ${err.message}`)
          } finally {
            setInstallingId(null)
          }
        },
        [store, t]
      )

      return h(
        Modal,
        { onClose, labelledBy: 'dshpt-market-title' },
        h(
          'div',
          { className: 'dshpt-dialog-head', id: 'dshpt-market-title' },
          h(PawIcon, { size: 18 }),
          t('market.title'),
          total > 0 ? h('span', { className: 'dshpt-muted' }, `(${total})`) : null
        ),
        h(
          'div',
          { className: 'dshpt-toolbar' },
          h('input', {
            className: 'dshpt-input',
            style: { flex: 1, minWidth: 140 },
            value: searchInput,
            placeholder: t('market.search'),
            onChange: (event) => setSearchInput(event.target.value),
          }),
          h(
            'select',
            { className: 'dshpt-select', value: kind, onChange: (e) => { setKind(e.target.value); setPage(1) } },
            KIND_OPTIONS.map((k) => h('option', { key: k, value: k }, k === 'all' ? t('market.kindAll') : k))
          ),
          h(
            'select',
            { className: 'dshpt-select', value: sort, onChange: (e) => { setSort(e.target.value); setPage(1) } },
            SORT_OPTIONS.map((s) => h('option', { key: s, value: s }, t(`market.sort${s[0].toUpperCase()}${s.slice(1)}`)))
          ),
          h(
            'button',
            { type: 'button', className: 'dshpt-btn dshpt-btn-sm', disabled: loading, onClick: () => void reload() },
            t('market.refresh')
          )
        ),
        h(
          'div',
          { className: 'dshpt-dialog-body' },
          error ? h('p', { className: 'dshpt-error' }, error) : null,
          notice ? h('p', { style: { color: 'var(--dsw-alias-state-success-primary)', fontSize: 12 } }, notice) : null,
          loading && items.length === 0
            ? h('div', { style: { display: 'flex', justifyContent: 'center', padding: 40 } }, h(Spinner))
            : items.length === 0
              ? h('p', { className: 'dshpt-muted', style: { textAlign: 'center', padding: 32 } }, t('market.empty'))
              : h(
                  'div',
                  { className: 'dshpt-grid' },
                  items.map((pet) =>
                    h(PetMarketCard, {
                      key: pet.id,
                      pet,
                      t,
                      assetCache,
                      installed: installedIds.has(pet.id) || pet.alreadyInstalled,
                      busy: installingId === pet.id,
                      busyAny: Boolean(installingId),
                      onInstall: () => {
                        const installed = installedIds.has(pet.id) || pet.alreadyInstalled
                        if (installed) setReinstallTarget(pet)
                        else void performInstall(pet, false)
                      },
                    })
                  )
                )
        ),
        h(
          'div',
          { className: 'dshpt-dialog-foot' },
          h('span', { className: 'dshpt-muted' }, `${t('market.page', { page, total: totalPages })} · ${t('market.credit')}`),
          h(
            'div',
            { className: 'dshpt-row', style: { gap: 6 } },
            h(
              'button',
              {
                type: 'button',
                className: 'dshpt-btn dshpt-btn-sm',
                disabled: page <= 1 || loading,
                onClick: () => setPage((p) => Math.max(1, p - 1)),
              },
              t('market.prev')
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dshpt-btn dshpt-btn-sm',
                disabled: page >= totalPages || loading,
                onClick: () => setPage((p) => Math.min(totalPages, p + 1)),
              },
              t('market.next')
            )
          )
        ),
        reinstallTarget
          ? h(
              Modal,
              { onClose: () => setReinstallTarget(null), labelledBy: 'dshpt-re-title' },
              h('div', { className: 'dshpt-dialog-head', id: 'dshpt-re-title' }, t('market.reinstall')),
              h(
                'div',
                { className: 'dshpt-dialog-body' },
                t('market.reinstallConfirm', { name: reinstallTarget.displayName })
              ),
              h(
                'div',
                { className: 'dshpt-dialog-foot' },
                h(
                  'button',
                  { type: 'button', className: 'dshpt-btn', onClick: () => setReinstallTarget(null) },
                  t('market.cancel')
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'dshpt-btn dshpt-btn-primary',
                    onClick: () => {
                      const target = reinstallTarget
                      setReinstallTarget(null)
                      void performInstall(target, true)
                    },
                  },
                  t('market.reinstall')
                )
              )
            )
          : null
      )
    }

    // ─── Agent session engine ───────────────────────────────────────────────

    function agentIdOf(request) {
      const agent = request?.agent
      if (typeof agent === 'string') return agent
      if (agent && typeof agent === 'object') return agent.id || agent.sessionId || null
      return null
    }

    /**
     * Subscribe the store to agent activity and return the disposer. Runs on
     * the plugin context (`ctx.effect`), never inside a component: the pet's
     * session state must survive a slot entry being re-rendered or replaced.
     */
    function subscribeAgentSessions(ctx, store) {
      let disposed = false
      const remote = ctx.remote
      const refresh = () => {
        if (!remote?.session?.list) return
        remote.session
          .list({})
          .then((result) => {
            // The remote call answers with its envelope ({ ok, value }), not the
            // payload itself: reading `result.items` left the session list empty
            // forever, so the running-session count — and with it the desktop
            // window's corner badge — only ever came from live status events and
            // vanished on every plugin reload.
            const items = result?.items ?? result?.value?.items
            if (!disposed && Array.isArray(items)) store.setSessions(items)
          })
          .catch(() => {})
      }
      refresh()
      const offs = []
      try {
        offs.push(remote.$on('api-session/added', refresh))
        offs.push(remote.$on('api-session/removed', refresh))
        offs.push(remote.$on('api-session/activity', refresh))
        offs.push(
          remote.$on('api-session/status', (agentId, running) => {
            store.setRunning(agentId, running === true)
            refresh()
          })
        )
        offs.push(
          remote.$on('api-session/error', (agentId) => {
            store.setError(agentId)
          })
        )
        // Passive observer of the approval waterfall: count pending approvals
        // per agent, always passing the request through unchanged.
        offs.push(
          remote.$on('approval/request', function (request, next) {
            const id = agentIdOf(request)
            store.waitStart(id)
            let result
            try {
              result = next(request)
            } catch (err) {
              store.waitEnd(id)
              throw err
            }
            return Promise.resolve(result).finally(() => store.waitEnd(id))
          })
        )
      } catch (error) {
        console.warn('dsh-pet: session events unavailable', error)
      }
      try {
        offs.push(ctx.on('connection/reset', refresh))
      } catch {
        /* optional */
      }
      return () => {
        disposed = true
        for (const off of offs) {
          try {
            if (typeof off === 'function') off()
          } catch {
            /* disposers are best-effort */
          }
        }
      }
    }

    // ─── Config sync ────────────────────────────────────────────────────────

    function useConfigSync(store) {
      useEffect(() => {
        let disposed = false
        const load = () => {
          Promise.all([apiJson('/api/config'), apiJson('/api/pets')])
            .then(([cfg, pets]) => {
              if (!disposed) store.setLoaded(cfg.config, pets.pets)
            })
            .catch(() => {
              if (!disposed) store.setLoaded(store.getSnapshot().config, [])
            })
        }
        load()
        const onFocus = () => load()
        window.addEventListener('focus', onFocus)
        return () => {
          disposed = true
          window.removeEventListener('focus', onFocus)
        }
      }, [store])
    }

    // ─── Settings section ───────────────────────────────────────────────────

    function SettingsRow({ title, description, last, children }) {
      return h(
        'div',
        { className: 'dshpt-srow', 'data-last': last ? 'true' : 'false' },
        h(
          'div',
          null,
          h('div', { className: 'dshpt-srow-title' }, title),
          description ? h('div', { className: 'dshpt-srow-desc' }, description) : null
        ),
        h('div', { className: 'dshpt-srow-control' }, children)
      )
    }

    function PetSection({ store, t }) {
      const config = useStore(store, (s) => s.config)
      const pets = useStore(store, (s) => s.pets)
      const desktop = useStore(store, (s) => s.desktop)
      const [busyId, setBusyId] = useState(null)

      const putConfig = useCallback(
        (patch) => {
          return apiJson('/api/config', { method: 'PUT', body: JSON.stringify(patch) })
            .then((data) => store.setConfig(data.config))
            .catch(() => {})
        },
        [store]
      )
      const pickPet = useCallback(
        (pet) => {
          setBusyId(pet.id)
          void putConfig({ activePetId: pet.id, petVisible: true }).finally(() => setBusyId(null))
        },
        [putConfig]
      )
      const desktopStatus = (() => {
        if (desktop.supported === false) return { text: t('settings.desktopUnsupported'), tone: 'muted' }
        if (desktop.gaveUp) {
          return { text: `${t('settings.desktopFailed')}: ${desktop.error || ''}`, tone: 'error' }
        }
        if (desktop.starting) return { text: t('settings.desktopBusy'), tone: 'muted' }
        if (desktop.error) return { text: `${t('settings.desktopFailed')}: ${desktop.error}`, tone: 'error' }
        if (desktop.running) return { text: t('settings.desktopOn'), tone: 'ok' }
        return {
          text: config.petVisible ? t('settings.desktopStarting') : t('settings.desktopHidden'),
          tone: 'muted',
        }
      })()
      return h(
        'div',
        { className: 'dshpt-section' },
        h('style', STYLE_ATTRS, styles),
        h(
          'div',
          { className: 'dshpt-group' },
          h(
            SettingsRow,
            { title: t('settings.pet'), description: t('settings.petHint') },
            h(Switch, {
              on: config.petVisible,
              onChange: (v) => putConfig({ petVisible: v }),
              label: t('settings.pet'),
            })
          ),
          h(
            SettingsRow,
            {
              title: t('settings.desktop'),
              description: t('settings.desktopHint'),
            },
            h(
              'span',
              {
                className: 'dshpt-muted',
                style:
                  desktopStatus.tone === 'error'
                    ? { color: 'var(--dsw-alias-label-error)' }
                    : desktopStatus.tone === 'ok'
                      ? { color: 'var(--dsw-alias-state-success-primary)' }
                      : undefined,
              },
              desktopStatus.text
            )
          ),
          h(
            SettingsRow,
            { title: t('manager.scale'), description: t('settings.scaleHint'), last: true },
            h('input', {
              type: 'range',
              min: 0.5,
              max: 2,
              step: 0.25,
              value: config.petScale,
              className: 'dshpt-range dshpt-range32',
              'aria-label': t('manager.scale'),
              onChange: (event) => putConfig({ petScale: Number(event.target.value) }),
            }),
            h('span', { className: 'dshpt-muted' }, `${config.petScale}×`)
          )
        ),
        h(
          'div',
          { className: 'dshpt-group' },
          h(
            'div',
            { className: 'dshpt-group-head' },
            h('h3', { className: 'dshpt-group-title' }, t('settings.activePet')),
            h('span', { className: 'dshpt-muted' }, `${pets.length}`)
          ),
          h('p', { className: 'dshpt-intro' }, t('settings.activePetHint')),
          pets.length === 0
            ? h(
                'div',
                { className: 'dshpt-empty' },
                h(PawIcon, { size: 26 }),
                h('span', null, t('manager.empty'))
              )
            : h(
                'div',
                { className: 'dshpt-tiles' },
                pets.map((pet) =>
                  h(
                    'button',
                    {
                      key: pet.id,
                      type: 'button',
                      className: 'dshpt-tile',
                      'data-active': pet.id === config.activePetId ? 'true' : 'false',
                      disabled: busyId !== null,
                      title: pet.description || pet.displayName,
                      onClick: () => pickPet(pet),
                    },
                    h(PetTileSprite, { petId: pet.id }),
                    h('span', { className: 'dshpt-tile-name' }, pet.displayName),
                    pet.id === config.activePetId
                      ? h('span', { className: 'dshpt-tile-badge' }, t('manager.active'))
                      : null
                  )
                )
              ),
          h(
            'div',
            { className: 'dshpt-actions' },
            h(
              'button',
              {
                type: 'button',
                className: 'dshpt-btn32 dshpt-btn32-primary',
                onClick: () => store.setUi({ market: true }),
              },
              t('settings.petMarketOpen')
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dshpt-btn32',
                onClick: () => store.setUi({ manager: true }),
              },
              t('settings.petManage')
            )
          )
        )
      )
    }

    /** First idle frame of a pet's spritesheet, sized for the settings tiles. */
    function PetTileSprite({ petId }) {
      const [url, setUrl] = useState(null)
      useEffect(() => {
        let cancelled = false
        let owned = null
        apiBlobUrl(`/api/pets/${encodeURIComponent(petId)}/spritesheet`)
          .then((u) => {
            if (cancelled) {
              URL.revokeObjectURL(u)
              return
            }
            owned = u
            setUrl(u)
          })
          .catch(() => {})
        return () => {
          cancelled = true
          if (owned) URL.revokeObjectURL(owned)
        }
      }, [petId])
      const size = useImageNaturalSize(url)
      const rows = rowsFromHeight(size?.height)
      return h('span', {
        className: 'dshpt-tile-sprite',
        style: url
          ? {
              backgroundImage: `url("${url}")`,
              backgroundSize: sheetBackgroundSize(rows),
              backgroundPosition: cellPosition(0, 0, rows),
            }
          : { opacity: 0.25 },
      })
    }

    // ─── Overlay root ───────────────────────────────────────────────────────

    /** Keeps one crashing child from tearing down the styles and the rest. */
    class Boundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { failed: false }
      }
      static getDerivedStateFromError() {
        return { failed: true }
      }
      componentDidCatch(error) {
        console.error('dsh-pet: overlay part crashed', error)
      }
      render() {
        if (this.state.failed) return null
        return this.props.children
      }
    }

    function OverlayRoot({ store, t }) {
      const loaded = useStore(store, (s) => s.loaded)
      const config = useStore(store, (s) => s.config)
      const pets = useStore(store, (s) => s.pets)
      const ui = useStore(store, (s) => s.ui)
      const [portalHost, setPortalHost] = useState(null)

      useConfigSync(store)
      // Keeps the always-on-top desktop window in step with the pet config.
      useDesktopPet(store, true, t)

      // The pet lives in its own fixed layer on `document.body`: the shell's
      // frame columns create containing blocks (and clip), so a pet left in the
      // slot could never be dragged across the whole window.
      useEffect(() => {
        const el = document.createElement('div')
        el.className = 'dshpt-portal'
        document.body.appendChild(el)
        setPortalHost(el)
        return () => {
          el.remove()
          setPortalHost(null)
        }
      }, [])

      const openManager = useCallback(() => store.setUi({ manager: true }), [store])

      // The desktop window is a separate process: it can only know what the pet
      // is doing if this page tells the Host. Push the ambient mood and the
      // running-session count (the helper paints that as the corner badge) on
      // change, throttled, plus one baseline push on mount.
      const mood = useStore(store, (s) => {
        void s.running, s.waiting, s.errors, s.oneShot
        return store.ambientState()
      })
      const runningSessions = useStore(store, (s) => {
        let count = 0
        for (const session of s.sessions.values()) {
          if (session.running) count += 1
        }
        // The session list can lag behind the live agent status; the running
        // set is the more direct signal, so never report a smaller number.
        return Math.max(count, s.running.size)
      })
      useEffect(() => {
        const handle = setTimeout(() => void pushDesktopMood(store), 250)
        // Heartbeat: the Host forgets the count when it restarts the window
        // (scale change, hide/show), and a value that only moves on change
        // would leave the badge blank until the next session starts or ends.
        // The supervisor's own tick also re-sends the moment the two disagree,
        // so a window restart no longer blanks the badge for a whole interval.
        const beat = setInterval(() => void pushDesktopMood(store), 20000)
        return () => {
          clearTimeout(handle)
          clearInterval(beat)
        }
      }, [mood, runningSessions, store])

      const content = h(
        React.Fragment,
        null,
        h(
          Boundary,
          null,
          loaded
            ? h(PetWidget, {
                store,
                t,
                config,
                pets,
                onOpenManager: openManager,
              })
            : null
        ),
        h(
          Boundary,
          null,
          ui.manager
            ? h(PetManagerDialog, {
                store,
                t,
                onClose: () => store.setUi({ manager: false }),
                onOpenMarket: () => store.setUi({ manager: false, market: true }),
              })
            : null
        ),
        h(
          Boundary,
          null,
          ui.market ? h(PetMarketDialog, { store, t, onClose: () => store.setUi({ market: false }) }) : null
        )
      )

      return h(
        'div',
        { style: { display: 'contents' } },
        h('style', STYLE_ATTRS, styles),
        portalHost ? ReactDOM.createPortal(content, portalHost) : null
      )
    }

    // ─── Plugin entry ───────────────────────────────────────────────────────

    return {
      inject: ['slots', 'locale', 'remote', 'remote.session'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'pet: dictionaries')
        const store = createStore()
        // Session tracking lives on the plugin context, not inside a component:
        // slot props stay plain data (no cordis context crosses the slot face).
        ctx.effect(() => subscribeAgentSessions(ctx, store), 'pet: session engine')
        const t = ctx.locale.bind(NS)

        ctx.slots.inject('shell.overlay', () =>
          ctx.slots.register(
            {
              name: 'shell.overlay',
              id: 'pet.overlay',
              locale: NS,
              inject: () => ({ store, t }),
            },
            OverlayRoot
          )
        )

        // Settings › 桌宠 — the management entry point (mirrors codeg, where
        // the pet lives under Settings › Appearance).
        ctx.slots.inject('settings.section', () =>
          ctx.slots.register(
            {
              name: 'settings.section',
              id: 'dsh-pet',
              order: 40,
              label: () => t('settings.nav'),
              locale: NS,
              inject: () => ({ store, t }),
            },
            PetSection
          )
        )
      },
    }
  },
})
