/**
 * Browser half of @local/dsh-wallpaper.
 *
 * Applies a global wallpaper to the shell frame (frame-transparent +
 * translucent surfaces, the same model as codeg's workspace background) and
 * owns the Settings › 壁纸 page: enable/opacity, the current wallpaper, local
 * uploads, and the wallhaven.cc marketplace rendered inline. All network and
 * disk access goes through the bundle's Host routes under
 * `/dsh-wallpaper/api/*`; this file never touches the upstream CDN directly.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-wallpaper',
  factory(require) {
    const React = require('react')
    const { useCallback, useEffect, useRef, useState, useSyncExternalStore } = React
    const h = React.createElement

    const NS = 'wallpaper'
    const API = '/dsh-wallpaper'
    // DSH's client module system claims every untagged <style> for the next
    // activating plugin and deletes it with that entry — which wipes this
    // plugin's CSS. Tagging the element keeps it ours.
    const STYLE_ATTRS = { 'data-plugin': '@local/dsh-wallpaper' }

    // ─── Locale dictionaries (flat dotted keys, {name} interpolation) ───────

    const zh = {
      'wallpaper.title': '壁纸设置',
      'wallpaper.enable': '启用壁纸',
      'wallpaper.opacity': '面板不透明度',
      'wallpaper.fill': '填充方式',
      'wallpaper.fill.cover': '覆盖',
      'wallpaper.fill.contain': '包含',
      'wallpaper.fill.center': '居中',
      'wallpaper.fill.tile': '平铺',
      'wallpaper.mask': '遮罩不透明度',
      'wallpaper.blur': '图片模糊',
      'wallpaper.panel': '面板不透明度',
      'settings.fillHint': '图片铺满窗口的方式：覆盖裁切、包含留白、居中原始大小、平铺重复。',
      'settings.maskHint': '数值越高，图片越向主题背景色淡化，文字对比越清晰。',
      'settings.blurHint': '模糊背景图片本身（0 表示不模糊），不影响面板与文字。',
      'settings.panelHint': '侧栏、面板与标签栏的不透明程度。越低，透出的图片越多。',
      'wallpaper.upload': '上传本地图片…',
      'wallpaper.remove': '移除壁纸',
      'wallpaper.searchPlaceholder': '搜索壁纸…',
      'wallpaper.applied': '使用中',
      'wallpaper.unavailable': '不可用',
      'wallpaper.appliedToast': '壁纸已应用',
      'wallpaper.downloadFailed': '下载失败',
      'wallpaper.tooLarge': '超过上限（{actual} / 上限 {limit}）',
      'wallpaper.empty': '没有找到壁纸',
      'wallpaper.pageInfo': '第 {page} / {lastPage} 页',
      'wallpaper.prevPage': '上一页',
      'wallpaper.nextPage': '下一页',
      'wallpaper.refresh': '刷新',
      'wallpaper.credit': '来自 wallhaven.cc',
      'wallpaper.cardLabel': '壁纸 {id}',
      'wallpaper.categories.all': '全部',
      'wallpaper.categories.general': '常规',
      'wallpaper.categories.anime': '动漫',
      'wallpaper.categories.people': '人物',
      'wallpaper.market': '壁纸市场',
      'wallpaper.marketHint': '点击卡片即可下载并应用为全局背景',
      'wallpaper.current': '当前壁纸',
      'wallpaper.none': '尚未设置壁纸',
      'wallpaper.localImage': '本地图片',
      'settings.nav': '壁纸',
      'settings.wallpaper': '壁纸',
      'settings.wallpaperHint': '为整个界面应用全局背景',
      'settings.opacityHint': '面板在壁纸上方的不透明度，越低壁纸越明显',
      'settings.enabledHint': '关闭后界面恢复默认背景，壁纸文件保留',
    }

    const en = {
      'wallpaper.title': 'Wallpaper',
      'wallpaper.enable': 'Enable wallpaper',
      'wallpaper.opacity': 'Panel opacity',
      'wallpaper.fill': 'Fill mode',
      'wallpaper.fill.cover': 'Cover',
      'wallpaper.fill.contain': 'Contain',
      'wallpaper.fill.center': 'Center',
      'wallpaper.fill.tile': 'Tile',
      'wallpaper.mask': 'Mask opacity',
      'wallpaper.blur': 'Image blur',
      'wallpaper.panel': 'Panel opacity',
      'settings.fillHint': 'How the image fills the window: cover crops, contain letterboxes, center keeps its size, tile repeats.',
      'settings.maskHint': 'Higher values fade the image toward the theme background and keep text contrast.',
      'settings.blurHint': 'Blurs the background image itself (0 = sharp). Panels and text are untouched.',
      'settings.panelHint': 'Opacity of the sidebar, panels and tab strips. Lower values reveal more of the image.',
      'wallpaper.upload': 'Upload a local image…',
      'wallpaper.remove': 'Remove wallpaper',
      'wallpaper.searchPlaceholder': 'Search wallpapers…',
      'wallpaper.applied': 'In use',
      'wallpaper.unavailable': 'Unavailable',
      'wallpaper.appliedToast': 'Wallpaper applied',
      'wallpaper.downloadFailed': 'Download failed',
      'wallpaper.tooLarge': 'Over the limit ({actual} / limit {limit})',
      'wallpaper.empty': 'No wallpapers found',
      'wallpaper.pageInfo': 'Page {page} of {lastPage}',
      'wallpaper.prevPage': 'Prev',
      'wallpaper.nextPage': 'Next',
      'wallpaper.refresh': 'Refresh',
      'wallpaper.credit': 'from wallhaven.cc',
      'wallpaper.cardLabel': 'Wallpaper {id}',
      'wallpaper.categories.all': 'All',
      'wallpaper.categories.general': 'General',
      'wallpaper.categories.anime': 'Anime',
      'wallpaper.categories.people': 'People',
      'wallpaper.market': 'Wallpaper marketplace',
      'wallpaper.marketHint': 'Click a card to download and apply it as the global background',
      'wallpaper.current': 'Current wallpaper',
      'wallpaper.none': 'No wallpaper set',
      'wallpaper.localImage': 'Local image',
      'settings.nav': 'Wallpaper',
      'settings.wallpaper': 'Wallpaper',
      'settings.wallpaperHint': 'Apply a global background to the whole interface',
      'settings.opacityHint': 'Opacity of panels above the wallpaper; lower shows more of it',
      'settings.enabledHint': 'Turning this off restores the default background; the file stays',
    }

    // ─── Store ──────────────────────────────────────────────────────────────

    function createStore() {
      const listeners = new Set()
      const state = {
        loaded: false,
        config: { wallpaperEnabled: false, wallpaperOpacity: 0.85, wallpaperSourceUrl: null },
        wallpaperVersion: 'none',
        /** Fill mode / mask / blur / panel opacity — shared by layer + section. */
        display: readWallpaperSettings(),
      }
      let snapshot = { ...state }
      const emit = () => {
        snapshot = { ...state }
        for (const fn of listeners) fn()
      }
      return {
        subscribe(fn) {
          listeners.add(fn)
          return () => listeners.delete(fn)
        },
        getSnapshot() {
          return snapshot
        },
        setLoaded(config) {
          state.loaded = true
          state.config = config
          emit()
        },
        setConfig(config) {
          state.config = config
          emit()
        },
        setWallpaperVersion(version) {
          if (state.wallpaperVersion !== version) {
            state.wallpaperVersion = version
            emit()
          }
        },
        setDisplay(patch) {
          const next = { ...state.display, ...patch }
          state.display = next
          try {
            window.localStorage.setItem(WP_SETTINGS_KEY, JSON.stringify(next))
          } catch {
            /* private mode: settings simply do not persist */
          }
          emit()
        },
      }
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

    /** Per-page cache of proxied thumbnail blob URLs. */
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
            if (!cancelled) setState({ src: url, failed: false, key: apiPath })
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
.dshwp-btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 7px; border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-button-tool-bar-fill); color: var(--dsw-alias-label-primary); font-size: 12px; cursor: pointer; }
.dshwp-btn:hover { background: var(--dsw-alias-button-tool-bar-hover); }
.dshwp-btn:disabled { opacity: 0.5; cursor: default; }
.dshwp-btn-primary { background: var(--dsw-alias-button-primary-fill); border-color: transparent; color: var(--dsw-alias-label-primary-foreground); }
.dshwp-btn-primary:hover { background: var(--dsw-alias-button-primary-hover); }
.dshwp-btn-sm { padding: 3px 9px; font-size: 11px; }
.dshwp-muted { color: var(--dsw-alias-label-tertiary); font-size: 11px; }
.dshwp-error { color: var(--dsw-alias-label-error); font-size: 12px; }
.dshwp-ok { color: var(--dsw-alias-state-success-primary); font-size: 12px; }
.dshwp-spinner { width: 16px; height: 16px; border-radius: 50%; border: 2px solid var(--dsw-alias-border-l2); border-top-color: var(--dsw-alias-brand-primary); animation: dshwp-spin 0.8s linear infinite; }
@keyframes dshwp-spin { to { transform: rotate(360deg); } }
.dshwp-range { accent-color: var(--dsw-alias-brand-primary); }
.dshwp-switch { position: relative; width: 32px; height: 18px; border-radius: 9px; border: 0; background: var(--dsw-alias-border-l2); cursor: pointer; transition: background 0.15s; padding: 0; }
.dshwp-switch[data-on='true'] { background: var(--dsw-alias-brand-primary); }
.dshwp-switch::after { content: ''; position: absolute; top: 2px; left: 2px; width: 14px; height: 14px; border-radius: 50%; background: var(--dsw-alias-switch-thumb, #fff); transition: left 0.15s; }
.dshwp-switch[data-on='true']::after { left: 16px; }
/* Settings page: host-consistent section, groups, rows and market grid. */
.dshwp-section { display: flex; flex-direction: column; gap: 24px; width: 100%; max-width: 860px; color: var(--dsw-alias-label-primary); }
.dshwp-group { display: flex; flex-direction: column; }
.dshwp-group-head { display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px; }
.dshwp-group-title { margin: 0; font-size: 14px; font-weight: 500; line-height: 22px; }
.dshwp-intro { margin: 0 0 10px; color: var(--dsw-alias-label-secondary); font-size: 13px; line-height: 20px; }
.dshwp-srow { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 14px 0; border-bottom: .5px solid var(--dsw-alias-border-l2); }
.dshwp-srow[data-last='true'] { border-bottom: none; }
.dshwp-srow-title { font-size: 14px; line-height: 20px; }
.dshwp-srow-desc { margin-top: 4px; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
.dshwp-srow-control { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.dshwp-toolbar32 { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
.dshwp-input32 { height: 32px; padding: 0 10px; border: .5px solid var(--dsw-alias-border-l4); border-radius: var(--dsw-radius-md, 8px); background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); font-size: 13px; outline: none; }
.dshwp-input32:focus { border-color: var(--dsw-alias-brand-primary); }
.dshwp-chip { height: 28px; padding: 0 10px; border: .5px solid var(--dsw-alias-border-l4); border-radius: 14px; background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); font-size: 12.5px; cursor: pointer; }
.dshwp-chip:hover { color: var(--dsw-alias-label-primary); }
.dshwp-chip[data-active='true'] { border-color: var(--dsw-alias-brand-primary); background: var(--dsw-alias-bg-layer-3); color: var(--dsw-alias-label-primary); }
.dshwp-btn32 { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px; border: .5px solid var(--dsw-alias-border-l3); border-radius: var(--dsw-radius-md, 8px); background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); font-size: 13px; line-height: 20px; cursor: pointer; }
.dshwp-btn32:hover:not(:disabled) { background: var(--dsw-alias-bg-layer-3); }
.dshwp-btn32:disabled { opacity: .6; cursor: default; }
.dshwp-btn32-primary { border-color: transparent; background: var(--dsw-alias-button-primary-fill); color: var(--dsw-alias-label-primary-foreground); }
.dshwp-btn32-primary:hover:not(:disabled) { background: var(--dsw-alias-button-primary-hover); }
.dshwp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(178px, 1fr)); gap: 10px; }
.dshwp-card { position: relative; aspect-ratio: 16/10; border-radius: var(--dsw-radius-lg, 12px); border: .5px solid var(--dsw-alias-border-l3); background: var(--dsw-alias-bg-layer-2); overflow: hidden; cursor: pointer; padding: 0; }
.dshwp-card:disabled { cursor: default; }
.dshwp-card img { width: 100%; height: 100%; object-fit: cover; display: block; }
.dshwp-card-empty { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; }
.dshwp-tag { position: absolute; padding: 1px 6px; border-radius: 4px; font-size: 10px; line-height: 16px; background: rgb(0 0 0 / 55%); color: #fff; }
.dshwp-shade { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgb(0 0 0 / 35%); opacity: 0; transition: opacity 0.12s; color: #fff; }
.dshwp-card:hover:not(:disabled) .dshwp-shade { opacity: 1; }
.dshwp-pager { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 12px; }
.dshwp-current { display: flex; align-items: center; gap: 12px; }
.dshwp-current-thumb { width: 104px; height: 64px; flex: none; border: .5px solid var(--dsw-alias-border-l3); border-radius: var(--dsw-radius-md, 8px); overflow: hidden; background: var(--dsw-alias-bg-layer-3); }
.dshwp-current-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.dshwp-empty { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 22px; border: .5px dashed var(--dsw-alias-border-l2); border-radius: var(--dsw-radius-lg, 12px); color: var(--dsw-alias-label-tertiary); font-size: 13px; line-height: 20px; }
`

    function Switch({ on, onChange, label }) {
      return h('button', {
        type: 'button',
        className: 'dshwp-switch',
        role: 'switch',
        'aria-checked': on ? 'true' : 'false',
        'aria-label': label,
        'data-on': on ? 'true' : 'false',
        onClick: () => onChange(!on),
      })
    }

    function Spinner() {
      return h('span', { className: 'dshwp-spinner', role: 'status' })
    }

    function ImageIcon({ size = 16 }) {
      return h(
        'svg',
        { viewBox: '0 0 64 64', width: size, height: size, 'aria-hidden': true },
        h('rect', { x: 6, y: 10, width: 52, height: 40, rx: 5, fill: 'none', stroke: 'currentColor', strokeWidth: 5 }),
        h('circle', { cx: 22, cy: 24, r: 5, fill: 'currentColor' }),
        h('path', { d: 'M8 44l14-14 10 10 9-11 15 15v6H8z', fill: 'currentColor' })
      )
    }

    function SettingsRow({ title, description, last, children }) {
      return h(
        'div',
        { className: 'dshwp-srow', 'data-last': last ? 'true' : undefined },
        h(
          'div',
          null,
          h('div', { className: 'dshwp-srow-title' }, title),
          description ? h('div', { className: 'dshwp-srow-desc' }, description) : null
        ),
        h('div', { className: 'dshwp-srow-control' }, children)
      )
    }

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
        console.error('dsh-wallpaper: part crashed', error)
      }
      render() {
        if (this.state.failed) return null
        return this.props.children
      }
    }

    // ─── Marketplace ────────────────────────────────────────────────────────

    const SEARCH_DEBOUNCE = 300
    const MAX_WP_BYTES_CLIENT = 16 * 1024 * 1024
    const MAX_WP_PIXELS_CLIENT = 40_000_000
    const WP_CATEGORIES = ['all', 'general', 'anime', 'people']

    function wallpaperBlocker(w) {
      if (w.fileSizeBytes > MAX_WP_BYTES_CLIENT) return 'tooManyBytes'
      if (w.width * w.height > MAX_WP_PIXELS_CLIENT) return 'tooManyPixels'
      return null
    }

    function formatBytes(bytes) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    function formatPixels(pixels) {
      return `${(pixels / 1_000_000).toFixed(1)} MP`
    }

    function WallpaperCard({ wallpaper, t, assetCache, applied, downloading, busy, onApply }) {
      const thumb = useProxiedAsset(
        assetCache,
        `/api/market/asset?url=${encodeURIComponent(wallpaper.thumbUrl)}`
      )
      const blocker = wallpaperBlocker(wallpaper)
      const blockerHint =
        blocker === 'tooManyBytes'
          ? t('wallpaper.tooLarge', { actual: formatBytes(wallpaper.fileSizeBytes), limit: formatBytes(MAX_WP_BYTES_CLIENT) })
          : blocker === 'tooManyPixels'
            ? t('wallpaper.tooLarge', {
                actual: formatPixels(wallpaper.width * wallpaper.height),
                limit: formatPixels(MAX_WP_PIXELS_CLIENT),
              })
            : null
      const resolution = wallpaper.width > 0 && wallpaper.height > 0 ? `${wallpaper.width}×${wallpaper.height}` : ''
      return h(
        'button',
        {
          type: 'button',
          className: 'dshwp-card',
          disabled: busy || blocker !== null,
          style: blocker ? { opacity: 0.5 } : undefined,
          title: blockerHint || resolution || wallpaper.id,
          'aria-label': [t('wallpaper.cardLabel', { id: wallpaper.id }), resolution, applied ? t('wallpaper.applied') : null, blockerHint]
            .filter(Boolean)
            .join(' · '),
          onClick: () => onApply(wallpaper),
        },
        thumb.src
          ? h('img', { src: thumb.src, alt: '', loading: 'lazy' })
          : h('span', { className: 'dshwp-card-empty' }, thumb.failed ? '×' : h(Spinner)),
        (blocker === 'tooManyBytes' ? formatBytes(wallpaper.fileSizeBytes) : resolution)
          ? h(
              'span',
              { className: 'dshwp-tag', style: { left: 6, bottom: 6 } },
              blocker === 'tooManyBytes' ? formatBytes(wallpaper.fileSizeBytes) : resolution
            )
          : null,
        applied
          ? h('span', { className: 'dshwp-tag', style: { right: 6, top: 6, background: 'var(--dsw-alias-state-success-primary)' } }, t('wallpaper.applied'))
          : blocker
            ? h('span', { className: 'dshwp-tag', style: { right: 6, top: 6 } }, t('wallpaper.unavailable'))
            : null,
        !blocker
          ? h(
              'span',
              { className: 'dshwp-shade', style: downloading ? { opacity: 1 } : undefined },
              downloading ? h(Spinner) : '↓'
            )
          : null
      )
    }

    /**
     * The wallhaven.cc market, inline in the settings page (and reused wherever
     * else the surface is needed). Single-flight downloads: two concurrent
     * writes would race on the same background file.
     */
    function WallpaperMarket({ store, t }) {
      const assetCacheRef = useRef(null)
      if (!assetCacheRef.current) assetCacheRef.current = createAssetCache()
      const assetCache = assetCacheRef.current
      useEffect(() => () => assetCache.dispose(), [assetCache])

      const config = useStore(store, (s) => s.config)
      const [searchInput, setSearchInput] = useState('')
      const [query, setQuery] = useState('')
      const [category, setCategory] = useState('all')
      const [page, setPage] = useState(1)
      const [shownPage, setShownPage] = useState(1)
      const [items, setItems] = useState([])
      const [lastPage, setLastPage] = useState(1)
      const [loading, setLoading] = useState(false)
      const [error, setError] = useState(null)
      const [notice, setNotice] = useState(null)
      const [downloadingId, setDownloadingId] = useState(null)
      const downloadingRef = useRef(null)
      const seqRef = useRef(0)
      const committedQuery = useRef('')

      useEffect(() => {
        const handle = setTimeout(() => {
          const next = searchInput.trim()
          if (next === committedQuery.current) return
          committedQuery.current = next
          setQuery(next)
          setPage(1)
        }, SEARCH_DEBOUNCE)
        return () => clearTimeout(handle)
      }, [searchInput])

      const load = useCallback(async (q, c, p) => {
        const seq = ++seqRef.current
        setLoading(true)
        setError(null)
        setShownPage(p)
        try {
          const params = new URLSearchParams({ query: q, category: c, page: String(p) })
          const data = await apiJson(`/api/market/search?${params}`)
          if (seq !== seqRef.current) return
          setItems(data.items)
          setLastPage(data.lastPage)
          setShownPage(data.page)
          // Upstream clamps out-of-range pages; pull the cursor back (never forward).
          if (data.page < p) setPage(data.page)
        } catch (err) {
          if (seq !== seqRef.current) return
          setItems([])
          setLastPage(1)
          setError(err.message)
        } finally {
          if (seq === seqRef.current) setLoading(false)
        }
      }, [])

      useEffect(() => {
        void load(query, category, page)
      }, [query, category, page, load])

      const onCardApply = async (wallpaper) => {
        if (downloadingRef.current !== null) return
        downloadingRef.current = wallpaper.id
        setDownloadingId(wallpaper.id)
        setNotice(null)
        setError(null)
        try {
          await apiJson('/api/market/download', {
            method: 'POST',
            body: JSON.stringify({ url: wallpaper.fullUrl, sourceUrl: wallpaper.sourceUrl }),
          })
          const data = await apiJson('/api/config', {
            method: 'PUT',
            body: JSON.stringify({ wallpaperEnabled: true, wallpaperSourceUrl: wallpaper.sourceUrl }),
          })
          store.setConfig(data.config)
          const v = await apiJson('/api/version')
          store.setWallpaperVersion(v.version)
          setNotice(t('wallpaper.appliedToast'))
        } catch (err) {
          setError(`${t('wallpaper.downloadFailed')}: ${err.message}`)
        } finally {
          downloadingRef.current = null
          setDownloadingId(null)
        }
      }

      return h(
        'div',
        { className: 'dshwp-group' },
        h(
          'div',
          { className: 'dshwp-group-head' },
          h('h3', { className: 'dshwp-group-title' }, t('wallpaper.market')),
          h('span', { className: 'dshwp-muted' },
            `${t('wallpaper.credit')}${loading ? '' : ` · ${t('wallpaper.pageInfo', { page: shownPage, lastPage })}`}`
          )
        ),
        h('p', { className: 'dshwp-intro' }, t('wallpaper.marketHint')),
        h(
          'div',
          { className: 'dshwp-toolbar32' },
          h('input', {
            className: 'dshwp-input32',
            style: { width: 220 },
            value: searchInput,
            placeholder: t('wallpaper.searchPlaceholder'),
            'aria-label': t('wallpaper.searchPlaceholder'),
            onChange: (event) => setSearchInput(event.target.value),
          }),
          WP_CATEGORIES.map((c) =>
            h(
              'button',
              {
                key: c,
                type: 'button',
                className: 'dshwp-chip',
                'data-active': category === c ? 'true' : undefined,
                onClick: () => {
                  setCategory(c)
                  setPage(1)
                },
              },
              t(`wallpaper.categories.${c}`)
            )
          ),
          h(
            'button',
            { type: 'button', className: 'dshwp-btn32', disabled: loading, onClick: () => void load(query, category, page) },
            loading ? h(Spinner) : t('wallpaper.refresh')
          )
        ),
        error ? h('p', { className: 'dshwp-error' }, error) : null,
        notice ? h('p', { className: 'dshwp-ok' }, notice) : null,
        loading && items.length === 0
          ? h('div', { style: { display: 'flex', justifyContent: 'center', padding: 40 } }, h(Spinner))
          : items.length === 0 && !error
            ? h('div', { className: 'dshwp-empty' }, h(ImageIcon, { size: 24 }), h('span', null, t('wallpaper.empty')))
            : h(
                'div',
                { className: 'dshwp-grid', style: loading ? { opacity: 0.6 } : undefined },
                items.map((w) =>
                  h(WallpaperCard, {
                    key: w.id,
                    wallpaper: w,
                    t,
                    assetCache,
                    applied: config.wallpaperSourceUrl === w.sourceUrl,
                    downloading: downloadingId === w.id,
                    busy: downloadingId !== null,
                    onApply: (item) => void onCardApply(item),
                  })
                )
              ),
        h(
          'div',
          { className: 'dshwp-pager' },
          h('span', { className: 'dshwp-muted' }, t('wallpaper.pageInfo', { page: shownPage, lastPage })),
          h(
            'div',
            { style: { display: 'flex', gap: 8 } },
            h(
              'button',
              {
                type: 'button',
                className: 'dshwp-btn32',
                disabled: shownPage <= 1 || loading,
                onClick: () => setPage(Math.max(1, shownPage - 1)),
              },
              t('wallpaper.prevPage')
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dshwp-btn32',
                disabled: shownPage >= lastPage || loading,
                onClick: () => setPage(shownPage + 1),
              },
              t('wallpaper.nextPage')
            )
          )
        )
      )
    }

    // ─── Display settings (localStorage, codeg's model) ─────────────────────
    //
    // The image bytes belong to the Host, but the cheap display knobs stay in
    // the browser: dragging a slider repaints instantly with no round trip, and
    // the Host schema never has to grow for them. Defaults mirror codeg.

    const WP_SETTINGS_KEY = 'dsh.wallpaper.display'
    const WP_FILL_MODES = ['cover', 'contain', 'center', 'tile']
    const WP_FILL_STYLE = {
      cover: { size: 'cover', repeat: 'no-repeat' },
      contain: { size: 'contain', repeat: 'no-repeat' },
      center: { size: 'auto', repeat: 'no-repeat' },
      tile: { size: 'auto', repeat: 'repeat' },
    }
    const WP_DEFAULTS = { fillMode: 'cover', maskOpacity: 0.82, imageBlur: 0, panelOpacity: 0.3 }
    const WP_RANGE = {
      maskOpacity: { min: 0, max: 0.99, step: 0.01 },
      imageBlur: { min: 0, max: 24, step: 1 },
      panelOpacity: { min: 0, max: 1, step: 0.05 },
    }
    /**
     * Frost for the chrome that keeps a glass look. codeg uses 8px for every
     * structural surface; the old 20px on the sidebar read as mush over a busy
     * image, so the sidebar and the top bar share this value.
     */
    const WP_FROST = 'blur(8px) saturate(140%)'

    function clampSetting(key, value) {
      const num = Number(value)
      if (!Number.isFinite(num)) return WP_DEFAULTS[key]
      const range = WP_RANGE[key]
      return Math.min(range.max, Math.max(range.min, num))
    }

    function readWallpaperSettings() {
      try {
        const raw = window.localStorage.getItem(WP_SETTINGS_KEY)
        if (!raw) return { ...WP_DEFAULTS }
        const parsed = JSON.parse(raw)
        return {
          fillMode: WP_FILL_MODES.includes(parsed?.fillMode) ? parsed.fillMode : WP_DEFAULTS.fillMode,
          maskOpacity: clampSetting('maskOpacity', parsed?.maskOpacity ?? WP_DEFAULTS.maskOpacity),
          imageBlur: clampSetting('imageBlur', parsed?.imageBlur ?? WP_DEFAULTS.imageBlur),
          panelOpacity: clampSetting('panelOpacity', parsed?.panelOpacity ?? WP_DEFAULTS.panelOpacity),
        }
      } catch {
        return { ...WP_DEFAULTS }
      }
    }

    // ─── Wallpaper layer (the global background itself) ─────────────────────

    /** Rewrite a computed colour literal with a different alpha. */
    function withAlpha(css, alpha) {
      if (/\/\s*[\d.]+%?\s*\)\s*$/.test(css)) return css.replace(/\/\s*[\d.]+%?\s*\)\s*$/, `/ ${alpha})`)
      const rgb = css.match(/^rgba?\(([^)]+)\)$/i)
      if (rgb) {
        const parts = rgb[1].split(/[,/\s]+/).filter(Boolean).slice(0, 3).join(', ')
        return `rgba(${parts}, ${alpha})`
      }
      return css
    }

    /**
     * Alpha of a computed CSS color, 1 when opaque. Handles `rgb()/rgba()` and
     * the `color(srgb ... / a)` form Chrome returns for `color-mix()`.
     */
    function colorAlpha(css) {
      if (!css) return 0
      if (css === 'transparent') return 0
      const rgb = css.match(/rgba?\(([^)]+)\)/i)
      if (rgb) {
        const parts = rgb[1].split(/[,/\s]+/).filter((p) => p !== '')
        if (parts.length >= 4) {
          const v = Number(parts[3])
          return Number.isFinite(v) ? v : 1
        }
        return 1
      }
      const slash = css.match(/\/\s*([\d.]+%?)\s*\)/)
      if (slash) {
        const raw = slash[1]
        const v = raw.endsWith('%') ? Number(raw.slice(0, -1)) / 100 : Number(raw)
        return Number.isFinite(v) ? v : 1
      }
      return 1
    }

    /**
     * Apply the wallpaper to the shell frame: find the top-level app frame by
     * walking up from our own overlay node (robust against hashed CSS-module
     * class names), make it transparent, mount our own image div behind its
     * content, then repaint the frame's large surfaces as translucent
     * `color-mix` overlays — codeg's "background + panel alpha" model.
     *
     * Two rules keep the effect stable and complete:
     * - Each surface's alpha is always computed from the color captured on the
     *   first touch, never from the already-mixed computed value, so moving the
     *   opacity slider cannot compound transparency away.
     * - Coverage is classified by geometry, not by one area threshold: the
     *   frame, the columns (including the narrow left sidebar and the wide top
     *   bar), and the deeper panels each get a treatment. The sidebar and bar
     *   also get a frosted-glass backdrop so they read as distinct chrome.
     *
     * Everything is restored on cleanup.
     */
    function useWallpaperLayer(hostRef, enabled, settings, version) {
      const repaintRef = useRef(null)
      const settingsRef = useRef(settings)
      settingsRef.current = settings

      // Mount/unmount the layer and repaint surfaces (settings read via a ref so
      // slider drags never re-fetch the image or re-mount the layer).
      useEffect(() => {
        const host = hostRef.current
        if (!host) return
        if (!enabled) return
        let disposed = false
        let observer = null
        let scanTimer = null
        let wallpaperUrl = null
        let bodyBackground = null
        let backgroundStyle = null
        let frameOriginalPosition = null
        /** el -> {backgroundColor, backgroundImage, backdropFilter, base, kind} */
        const originals = new Map()

        const findFrame = () => {
          let node = host
          const root = host.closest('#root')
          if (!root) return null
          while (node && node.parentElement !== root) node = node.parentElement
          return node
        }

        const frame = findFrame()
        if (!frame) {
          console.warn('dsh-wallpaper: app frame not found; layer idle')
          return
        }
        // The image covers the whole window (not just the frame's box): a fixed
        // body-level layer also shows behind a titlebar row that the desktop
        // shell may render outside #root.
        const mountRoot = document.body
        if (getComputedStyle(frame).position === 'static') {
          frameOriginalPosition = ''
          frame.style.position = 'relative'
        }

        const classify = (el, frameRect) => {
          if (el === frame) return 'frame'
          const rect = el.getBoundingClientRect()
          if (rect.width <= 0 || rect.height <= 0) return null
          const frameArea = frameRect.width * frameRect.height
          const area = rect.width * rect.height
          // The top bar is measured relative to the frame, not in absolute
          // pixels: the Windows titlebar row is ~100px tall in a tall window
          // and was missed by a fixed cap.
          const inTopBand = rect.top <= frameRect.top + frameRect.height * 0.3
          const wideShort =
            rect.width >= frameRect.width * 0.5 &&
            rect.height <= frameRect.height * 0.25 &&
            inTopBand
          const tallNarrow = rect.width <= frameRect.width * 0.45 && rect.height >= frameRect.height * 0.5
          if (wideShort) return 'bar'
          if (tallNarrow) return 'sidebar'
          if (area >= frameArea * 0.08) return 'panel'
          return null
        }

        /**
         * Panels that must stay opaque: settings pages and floating dialogs are
         * content surfaces, not the canvas the wallpaper shows through. Chrome
         * (frame, columns, bars) is exempt from this check so the sidebar keeps
         * its glass even while a settings page is open.
         *
         * The settings panel can stay mounted while closed (hidden), so a plain
         * `querySelector` match proved nothing and silently excluded the whole
         * canvas: the slot must actually be laid out to count.
         */
        const isContentPanel = (el) => {
          const dialog = el.closest('[role="dialog"], [aria-modal="true"]')
          if (dialog !== null && dialog.getClientRects().length > 0) return true
          const settings = el.querySelector('[data-slot^="settings."]')
          return settings !== null && settings.getClientRects().length > 0
        }

        /** The styles the layer wrote, so a theme switch can re-capture bases. */
        const restoreOne = (el, orig) => {
          el.style.backgroundColor = orig.backgroundColor
          el.style.backgroundImage = orig.backgroundImage
          el.style.backdropFilter = orig.backdropFilter
          el.style.backgroundAttachment = orig.backgroundAttachment
          el.style.backgroundSize = orig.backgroundSize
          el.style.backgroundRepeat = orig.backgroundRepeat
          el.style.backgroundPosition = orig.backgroundPosition
          el.style.borderTopLeftRadius = orig.borderTopLeftRadius
          el.style.borderRight = orig.borderRight
          el.style.borderBottom = orig.borderBottom
        }

        /**
         * Inline `border-top-left-radius` of every element this layer squared
         * off, keyed by element so the value can be handed back on cleanup.
         */
        const flattened = new Map()

        const restoreFlattened = () => {
          for (const [el, radius] of flattened) el.style.borderTopLeftRadius = radius
          flattened.clear()
        }

        const restoreAll = () => {
          for (const [el, orig] of originals) restoreOne(el, orig)
          originals.clear()
          restoreFlattened()
        }

        let themeKey = ''
        const seen = new Set()

        let warned = false

        const repaint = () => {
          if (disposed) return
          try {
            repaintInner()
          } catch (error) {
            // A throw mid-walk must never escape into the observer/interval or
            // leave the layer half-painted: report once and keep the app alive.
            if (!warned) {
              warned = true
              console.warn('dsh-wallpaper: surface repaint failed', error)
            }
          }
        }

        /**
         * The frame's visible box. `findFrame` can land on a `display: contents`
         * wrapper — the Windows shell nests the real grid frame inside one — and
         * such an element measures 0x0. Geometry-driven decisions (the top band,
         * the minimum child area) silently degrade to nothing when that happens,
         * so fall back to the first laid-out child and then to the viewport.
         */
        const measureFrameBox = () => {
          const own = frame.getBoundingClientRect()
          if (own.width > 0 && own.height > 0) return own
          for (const child of frame.children) {
            if (!(child instanceof HTMLElement)) continue
            const rect = child.getBoundingClientRect()
            if (rect.width > 0 && rect.height > 0) return rect
          }
          return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight }
        }

        /**
         * The laid-out box of the app frame. `findFrame` can land on a
         * `display: contents` wrapper (the Windows shell nests the real grid
         * inside one); the tint — and the empty strip above the columns — belong
         * to the grid element inside it.
         */
        const laidOutRoot = () => {
          const own = frame.getBoundingClientRect()
          if (own.width > 0 && own.height > 0) return frame
          for (const child of frame.children) {
            if (!(child instanceof HTMLElement)) continue
            const rect = child.getBoundingClientRect()
            if (rect.width > 0 && rect.height > 0) return child
          }
          return null
        }

        /**
         * The background stack, built from two fixed pseudo-elements on <body>
         * rather than the body background itself: an image layer plus a mask
         * veil. `filter: blur()` on <body> would blur the whole application, and
         * a `z-index: -1` child would be hidden by an opaque body background
         * (exactly what bit this plugin before), so <body> is made transparent
         * and both layers sit behind all content — codeg's model.
         */
        const applyBackgroundStack = () => {
          const tuned = settingsRef.current
          const fill = WP_FILL_STYLE[tuned.fillMode] ?? WP_FILL_STYLE.cover
          if (backgroundStyle === null) {
            backgroundStyle = document.createElement('style')
            backgroundStyle.setAttribute('data-plugin', '@local/dsh-wallpaper')
            backgroundStyle.setAttribute('data-dshwp-bg', '1')
            document.head.appendChild(backgroundStyle)
          }
          backgroundStyle.textContent = [
            'body::before {',
            "  content: '';",
            '  position: fixed;',
            '  inset: 0;',
            '  z-index: -1;',
            '  pointer-events: none;',
            '  background-image: var(--dshwp-image);',
            `  background-size: ${fill.size};`,
            `  background-repeat: ${fill.repeat};`,
            '  background-position: center;',
            tuned.imageBlur > 0 ? `  filter: blur(${tuned.imageBlur}px);` : '',
            '}',
            'body::after {',
            "  content: '';",
            '  position: fixed;',
            '  inset: 0;',
            '  z-index: -1;',
            '  pointer-events: none;',
            `  background-color: color-mix(in srgb, var(--dsw-alias-bg-base) ${Math.round(tuned.maskOpacity * 100)}%, transparent);`,
            '}',
          ].join('\n')
        }

        /** Region separators: one hairline wherever two regions meet. */
        const line = 'color-mix(in srgb, currentColor 28%, transparent)'

        /**
         * The Windows caption strip is opaque chrome painted twice over the page:
         * the shell's own `[data-windows-titlebar]` strip, filled with the
         * sidebar-fill token, and the window-controls overlay above it, whose
         * colour the shell publishes to the main process from a hidden probe
         * element that reads the same token. Point that token at `transparent`
         * and both follow: the strip keeps its drag region and its hairlines but
         * lets the wallpaper through, so the top bar no longer reads as a block.
         * Scoped to the body so the theme's own value returns on cleanup, and
         * only in the desktop shell, whose preload marks the document — a plain
         * browser never paints that strip.
         */
        const CAPTION_FILL = '--dsw-specific-sidebar-fill'
        const applyCaptionFill = () => {
          if (!('windowsTitlebar' in document.documentElement.dataset)) return
          // Writing the body's style attribute is also what makes the shell's
          // MutationObserver re-read its probe and re-publish the overlay colour.
          if (document.body.style.getPropertyValue(CAPTION_FILL) !== 'transparent') {
            document.body.style.setProperty(CAPTION_FILL, 'transparent')
          }
        }

        /**
         * DSH's composer is a contenteditable box, not a <textarea>. Shared by
         * `isComposerBox` and the walk.
         */
        const EDITABLE_SELECTOR = 'textarea, [contenteditable="true"], [role="textbox"]'

        /**
         * Is this walked box the composer?
         *
         * The old test keyed on the box's TOP edge (`top >= 60 % of the frame`),
         * which is exactly what broke the moment the composer was stretched: a
         * tall draft pushes the top edge far up the window, the test failed, and
         * the box fell through to the generic translucent panel treatment — the
         * conversation showed straight through the input box.
         *
         * The composer is bottom-anchored chrome instead, so the test is
         * anchored to its BOTTOM edge, with a cap on how tall it may be: the
         * conversation column is taller than 70 % of the frame and would
         * otherwise swallow the message canvas as well. The visibility test
         * rejects a laid-out but hidden mirror of the editor (AutoSize helpers
         * are commonly `visibility: hidden`), and an already-booked composer
         * stays one, so a passing geometry change can never drop the recipe
         * mid-expansion.
         *
         * `box` is the frame rect measured by the current repaint pass.
         */
        const isComposerBox = (el, rect, box) => {
          if (originals.get(el)?.kind === 'composer') return true
          if (el.querySelector(EDITABLE_SELECTOR) === null) return false
          if (rect.height <= 0 || rect.height > box.height * 0.7) return false
          if (rect.bottom < box.top + box.height * 0.6) return false
          const cs = getComputedStyle(el)
          if (cs.visibility === 'hidden' || cs.display === 'none') return false
          return Number(cs.opacity) > 0.05
        }

        const repaintInner = () => {
          // A theme switch changes every surface's base color; captured bases
          // would otherwise keep painting the previous palette.
          const nextThemeKey = `${document.documentElement.style.colorScheme}|${document.body.dataset.dsDarkTheme ?? ''}`
          if (nextThemeKey !== themeKey) {
            restoreAll()
            themeKey = nextThemeKey
          }
          seen.clear()
          applyCaptionFill()
          if (wallpaperUrl !== null) applyBackgroundStack()
          const frameRect = measureFrameBox()
          const frameArea = Math.max(1, frameRect.width * frameRect.height)
          const tuned = settingsRef.current
          const alpha = Math.round(tuned.panelOpacity * 100)
          /**
           * The chrome keeps the same alpha as the panels (codeg drives every
           * structural surface from one slider) — the frost is what separates
           * the sidebar from the canvas, not a second opacity.
           */
          const chromeAlpha = alpha

          /** Region separators: one hairline wherever two regions meet. */
          const line = 'color-mix(in srgb, currentColor 28%, transparent)'

          /**
           * Square off the top-left corner of every big surface in the top band
           * of the window. On Windows the shell rounds the content column's
           * corner (`--dsh-windows-content-radius`, 16px) against the sidebar
           * fill; once the surfaces above the wallpaper are translucent that
           * radius reads as a wedge of bare frame colour next to the wallpaper.
           *
           * This is its own pass rather than part of `apply`: the corner belongs
           * to the content column, which the paint walk may skip entirely as a
           * content panel, and the fix must not depend on that classification.
           * Only wall-sized boxes qualify, so buttons and cards keep their shape.
           */
          const flattenTopLeftCorners = () => {
            const minArea = frameArea * 0.04
            const topLimit = frameRect.top + (frameRect.height || window.innerHeight) * 0.35
            const desired = new Set()
            let frontier = [...frame.children].filter((el) => el instanceof HTMLElement)
            for (let depth = 0; depth < 20 && frontier.length > 0; depth++) {
              const next = []
              for (const el of frontier) {
                if (host.contains(el)) continue
                const rect = el.getBoundingClientRect()
                // Prune: nothing inside a box smaller than the threshold can
                // itself be big enough, so the walk stays a few dozen elements.
                // Zero-area elements are exempt — a `display: contents` wrapper
                // measures 0x0 while holding the whole frame below it.
                if (rect.width * rect.height > 0 && rect.width * rect.height < minArea) continue
                const cs = getComputedStyle(el)
                const radius = Number.parseFloat(cs.borderTopLeftRadius) || 0
                const already = flattened.has(el)
                if ((radius >= 8 || already) && rect.top <= topLimit) {
                  desired.add(el)
                  if (!already) {
                    flattened.set(el, el.style.borderTopLeftRadius)
                    el.style.borderTopLeftRadius = '0px'
                  }
                }
                next.push(...el.children)
              }
              frontier = next.filter((el) => el instanceof HTMLElement)
            }
            for (const [el, radius] of [...flattened]) {
              if (!desired.has(el) || !el.isConnected) {
                el.style.borderTopLeftRadius = radius
                flattened.delete(el)
              }
            }
          }

          const apply = (el, kind) => {
            if (!(el instanceof HTMLElement)) return
            if (host.contains(el)) return
            seen.add(el)
            const cs = getComputedStyle(el)
            const barLike = kind === 'bar' || kind === 'bar-child' || kind === 'bar-inner'
            // The walk decides this (see `isComposerBox`) and books the box as
            // 'composer'; `apply` only has to honour it rather than re-derive a
            // guess of its own.
            const isComposer = kind === 'composer'
            let entry = originals.get(el)
            if (!entry) {
              const bgColor = cs.backgroundColor
              const bgImage = cs.backgroundImage
              const hasImage = bgImage && bgImage !== 'none'
              const opaque = colorAlpha(bgColor) >= 0.9
              // Runtime images (a plugin's blob: sprite, a chat attachment) are
              // content, never a paint surface. Only true chrome may be treated
              // through its background image.
              const chrome = kind === 'frame' || kind === 'sidebar' || barLike
              // `inner` and `composer` bypass the opacity gate: the visible
              // "blocks" are exactly the boxes with a *translucent* dark
              // background, and the composer box is one of them — a >= 0.9
              // gate can never reach them, which is why clearing them never
              // worked before.
              const bypass = kind === 'inner' || kind === 'composer'
              if (!bypass) {
                if (!opaque && !(chrome && hasImage)) return
                if (!opaque && bgImage.includes('blob:')) return
              } else if (kind === 'inner' && !opaque && !hasImage && cs.backdropFilter === 'none') {
                // Booking thousands of already-transparent boxes costs a repaint
                // pass per change for nothing: they have nothing to clear.
                return
              }
              entry = {
                backgroundColor: el.style.backgroundColor,
                backgroundImage: el.style.backgroundImage,
                backdropFilter: el.style.backdropFilter,
                backgroundAttachment: el.style.backgroundAttachment,
                backgroundSize: el.style.backgroundSize,
                backgroundRepeat: el.style.backgroundRepeat,
                backgroundPosition: el.style.backgroundPosition,
                borderTopLeftRadius: el.style.borderTopLeftRadius,
                borderRight: el.style.borderRight,
                borderBottom: el.style.borderBottom,
                base: opaque ? bgColor : 'var(--dsw-alias-bg-base)',
                kind,
              }
              originals.set(el, entry)
            }
            // The role changes between passes (a panel that moves into the chrome
            // band, a box that becomes the composer): the entry keeps the box's
            // ORIGINAL paint, never the role it was booked with. A stale role
            // would leave the wallpaper recipe painted on a box that is no
            // longer the composer.
            entry.kind = kind
            const useAlpha = kind === 'sidebar' || barLike ? chromeAlpha : alpha
            if (isComposer) {
              /**
               * The composer sits above the conversation, so plain transparency
               * would show the text behind it. Paint the wallpaper *itself* here
               * with `fixed` attachment so it lines up pixel-for-pixel with the
               * canvas — and then reproduce every layer the canvas shows above
               * that image, in paint order: the mask veil, then each ancestor
               * surface the walk made translucent.
               *
               * Painting the image under the veil alone is what left the input
               * box reading brighter/clearer than the conversation around it:
               * the canvas is the same image *and* the frame/column/panel tints
               * on top, so the composer showed about (1 - panelOpacity)^n more
               * of the wallpaper than the surface it sits on. The ancestor
               * colours are read from computed style — the exact pixels the
               * canvas composites — so the two recipes can never drift apart.
               */
              const tuned = settingsRef.current
              const fill = WP_FILL_STYLE[tuned.fillMode] ?? WP_FILL_STYLE.cover
              const veil = `color-mix(in srgb, var(--dsw-alias-bg-base) ${Math.round(tuned.maskOpacity * 100)}%, transparent)`
              const covers = []
              for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
                // A nested composer wrapper already paints this same recipe;
                // stacking it again would composite the image onto itself.
                if (originals.get(node)?.kind === 'composer') continue
                const above = getComputedStyle(node).backgroundColor
                // Innermost ancestor first: that one paints last, on top.
                if (colorAlpha(above) > 0) covers.push(`linear-gradient(${above}, ${above})`)
                if (node === frame) break
              }
              const layers = covers.length + 2
              el.style.backgroundColor = 'transparent'
              el.style.backgroundImage = [...covers, `linear-gradient(${veil}, ${veil})`, 'var(--dshwp-image)'].join(', ')
              el.style.backgroundSize = [...covers.map(() => 'auto'), 'auto', fill.size].join(', ')
              el.style.backgroundRepeat = [...covers.map(() => 'no-repeat'), 'no-repeat', fill.repeat].join(', ')
              el.style.backgroundPosition = Array.from({ length: layers }, () => 'center').join(', ')
              // Only the wallpaper itself needs viewport-anchored painting (it
              // has to line up with the canvas); the tints and the veil are flat
              // colours, so keeping them out of fixed attachment spares the
              // compositor a stack of viewport-sized layers.
              el.style.backgroundAttachment = [...covers.map(() => 'scroll'), 'scroll', 'fixed'].join(', ')
              el.style.backdropFilter = 'none'
            } else if (kind === 'inner') {
              // Chrome descendants: colourless, so only the region tint and the
              // separator lines remain.
              el.style.backgroundColor = 'transparent'
            } else if (barLike) {
              // The top strip is fully transparent (codeg's ws-transparent-bg):
              // the image shows straight through, and the hairline below keeps
              // it readable instead of a frost. The descendants that actually
              // paint the strip's colour go transparent too — but they never
              // get a border, which is what produced stray hairlines before.
              el.style.backgroundColor = 'transparent'
            } else {
              el.style.backgroundColor = `color-mix(in srgb, ${entry.base} ${useAlpha}%, transparent)`
            }
            if (!isComposer && cs.backgroundImage !== 'none') el.style.backgroundImage = 'none'
            if (kind === 'sidebar') {
              // Frost without the dark tint: the blur keeps the sidebar
              // readable over the image, and without a colour-mix layer it no
              // longer reads as one big block (the user's "色块" was exactly
              // that tint over a bright wallpaper).
              el.style.backgroundColor = 'transparent'
              el.style.backdropFilter = WP_FROST
              el.style.borderRight = `1px solid ${line}`
            } else if (kind === 'bar') {
              el.style.backdropFilter = 'none'
              el.style.borderBottom = `1px solid ${line}`
            } else {
              el.style.backdropFilter = 'none'
            }
          }

          /**
           * One column's translucent tint stack: the surfaces that span the
           * column and sit above the base tint. Collapsed into a single colour
           * — the innermost layer's colour at the combined alpha — because the
           * strip needs one hard-edged stop per column, not a stack.
           */
          const columnTint = (col) => {
            const colRect = col.getBoundingClientRect()
            let alpha = 0
            let css = null
            let frontier = [col]
            for (let depth = 0; depth < 6 && frontier.length > 0; depth++) {
              const next = []
              for (const el of frontier) {
                if (!(el instanceof HTMLElement)) continue
                const entry = originals.get(el)
                const rect = el.getBoundingClientRect()
                // Only a surface that spans the whole column counts: a card or
                // a message row is content, never the column's own tint.
                if (entry && rect.width >= colRect.width * 0.95 && (entry.kind === 'panel' || entry.kind === 'frame')) {
                  const above = getComputedStyle(el).backgroundColor
                  const a = colorAlpha(above)
                  if (a > 0) {
                    alpha = 1 - (1 - alpha) * (1 - a)
                    css = above
                  }
                }
                next.push(...el.children)
              }
              frontier = next
            }
            return css === null || alpha <= 0.001 ? null : withAlpha(css, Number(alpha.toFixed(3)))
          }

          /**
           * The window's top strip — the titlebar band above the first laid-out
           * column — has no element of its own, so it showed only the base tint
           * and the wallpaper read brighter there than in the column beneath it.
           * Paint the base surface as a horizontal gradient that carries each
           * column's tint stack up across the strip above it: the top bar
           * continues whichever column it sits on instead of forming a band.
           * The base colour stays the element's own background-color, so
           * nothing below the strip changes.
           */
          const applyColumnTints = () => {
            const root = laidOutRoot()
            if (root === null) return
            const rootRect = root.getBoundingClientRect()
            // One layer per tinted column, hard-edged to that column's x-range:
            // the grid also holds full-width overlays and a thin splitter, and a
            // single shared gradient would let those split the stop order.
            const columns = []
            for (const col of root.children) {
              if (!(col instanceof HTMLElement)) continue
              const rect = col.getBoundingClientRect()
              // Columns only: a short child is a row (the top bar itself).
              if (rect.width <= 0 || rect.height < rootRect.height * 0.2 || rect.top <= rootRect.top) continue
              columns.push({ col, rect })
            }
            if (columns.length === 0) {
              root.style.backgroundImage = ''
              return
            }
            // Only the strip above the highest column is empty of paint: below
            // that line every column draws its own stack.
            const stripHeight = Math.max(0, Math.round(Math.min(...columns.map((c) => c.rect.top)) - rootRect.top))
            const layers = []
            for (const { col, rect } of columns) {
              const tint = columnTint(col)
              if (tint === null || stripHeight <= 0) continue
              const from = Math.round(rect.left - rootRect.left)
              const to = Math.round(rect.right - rootRect.left)
              layers.push(
                `linear-gradient(90deg, transparent 0 ${from}px, ${tint} ${from}px ${to}px, transparent ${to}px 100%)`
              )
            }
            root.style.backgroundImage = layers.join(', ')
            root.style.backgroundSize = layers.map(() => `100% ${stripHeight}px`).join(', ')
            root.style.backgroundRepeat = layers.map(() => 'no-repeat').join(', ')
            root.style.backgroundPosition = layers.map(() => 'left top').join(', ')
          }

          flattenTopLeftCorners()
          apply(frame, 'frame')
          // Breadth-first walk over the app's own tree. Everything opaque that
          // sits above the wallpaper has to be made translucent, so the walk
          // errs on the side of visiting too much rather than too little: a
          // single opaque panel left behind hides the wallpaper completely.
          const minChildArea = frameRect.width * frameRect.height * 0.05
          const skipped = new Set()
          /** element -> depth inside a top bar (1 = child, 2 = grandchild) */
          const barContext = new Map()
          /** composer subtree: colourless descendants under its wallpaper paint */
          const composerContext = new Map()
          const walk = (root, depthLimit) => {
            let frontier = [...root.children]
            for (let depth = 0; depth < depthLimit && frontier.length > 0; depth++) {
              const next = []
              for (const el of frontier) {
                if (!(el instanceof HTMLElement)) continue
                // Only the app's own tree holds paint surfaces. DOM another
                // plugin appended to <body> (the desktop pet's portal) is off
                // limits — treating it turned the pet into a blank block.
                if (el.closest('#root') === null) {
                  // One exception: chrome the shell renders OUTSIDE #root. DSH's
                  // titlebar row sits above the app tree, and nothing inside
                  // #root can make it translucent. The shape test is deliberately
                  // strict — full width, short, flush with the top — and `apply`
                  // only recolours genuinely opaque boxes, so a near miss costs
                  // nothing.
                  const outer = el.getBoundingClientRect()
                  const isTopStrip =
                    outer.height > 0 &&
                    outer.height <= 96 &&
                    outer.top <= frameRect.top + 8 &&
                    outer.width >= frameRect.width * 0.6
                  if (isTopStrip) apply(el, 'bar')
                  continue
                }
                const kind = el === frame ? 'frame' : classify(el, frameRect)
                const barDepth = barContext.get(el) ?? 0
                const composerDepth = composerContext.get(el) ?? 0
                const probeRect = el.getBoundingClientRect()
                // Pure geometry, no classification: everything that lies wholly
                // inside the titlebar band or the sidebar column loses its own
                // colour. Classification kept missing these — the row stayed
                // painted while `classify` returned no kind — and the user's
                // rule is simply "lines, not blocks".
                const inChromeBand =
                  probeRect.height > 0 &&
                  (probeRect.bottom <= frameRect.top + 96 ||
                    probeRect.right <= frameRect.left + frameRect.width * 0.35)
                const regionKind = kind === 'sidebar' || kind === 'frame' || kind === 'bar'
                // Recognised BEFORE the prune below: a one-line composer is
                // smaller than the prune threshold, and pruning its subtree is
                // what used to leave the translucent boxes inside the editor
                // untouched. `isComposerBox` is anchored to the box's bottom edge
                // (see its comment), so a stretched composer keeps the recipe.
                // Settings pages and dialogs are excluded even when they happen
                // to end in a text box — they are content, by decision.
                const isComposerHere =
                  !regionKind &&
                  !(kind === 'panel' && isContentPanel(el)) &&
                  isComposerBox(el, probeRect, frameRect)
                if (kind === 'panel' && isContentPanel(el)) {
                  // Settings pages and dialogs stay opaque by decision.
                  skipped.add(el)
                } else if (barDepth > 0 || composerDepth > 0 || (inChromeBand && !regionKind)) {
                  // Inside the chrome or the composer: give up the colour
                  // entirely — that removes the stray blocks. The REGION
                  // elements themselves are exempt: the sidebar keeps its tint
                  // and frost, the bar keeps its hairline — only inner boxes
                  // (panels and unclassified) go colourless.
                  apply(el, 'inner')
                } else {
                  // `apply` itself only touches opaque surfaces (and chrome
                  // that carries a background image), so the paint decision
                  // does not need a size threshold — and must not have one:
                  // small nested panels are exactly what used to stay opaque
                  // and hide the wallpaper.
                  apply(el, kind ?? 'panel')
                }
                if (isComposerHere) {
                  // Only the outermost surface of a composer stack paints the
                  // recipe. The wrappers nested inside it are fully covered by
                  // that paint, so painting them too only stacked three
                  // full-viewport wallpapers on the compositor for identical
                  // pixels; they go transparent instead.
                  apply(el, composerDepth === 0 ? 'composer' : 'inner')
                }
                const barDepthNext =
                  kind === 'bar' || kind === 'sidebar' ? 1 : barDepth > 0 && barDepth < 3 ? barDepth + 1 : 0
                const composerDepthNext =
                  isComposerHere ? 1 : composerDepth > 0 && composerDepth < 3 ? composerDepth + 1 : 0
                if (barDepthNext > 0) {
                  for (const child of el.children) barContext.set(child, barDepthNext)
                }
                if (composerDepthNext > 0) {
                  // Grandchildren carry translucent backgrounds too — clearing
                  // only direct children left a second veil inside the editor,
                  // which read as a brightness mismatch against the canvas.
                  for (const child of el.children) composerContext.set(child, composerDepthNext)
                }
                const area = probeRect.width * probeRect.height
                // Prune small laid-out boxes, but never a zero-area element:
                // `display: contents` wrappers measure 0x0 while holding the
                // entire application frame below them. The top band is exempt:
                // a full-width 40px titlebar row is only ~4 % of the frame and
                // pruning it is exactly why the top bar kept its own colour.
                if (area > 0 && area < minChildArea && probeRect.top > frameRect.top + 96) continue
                next.push(...el.children)
              }
              frontier = next
            }
          }
          walk(mountRoot, 30)
          // The window's top strip — titlebar height above the first laid-out
          // column — has no element of its own, so it showed the bare base tint
          // and the wallpaper therefore read brighter there than in the column
          // under it. Continue each column's own tint stack across that strip
          // so the top bar is part of the surface it sits on, not a band.
          applyColumnTints()
          // Only surfaces we deliberately skipped are reverted; one that merely
          // fell outside this pass keeps its paint (a transient miss must not
          // flip the whole layer on and off).
          for (const [el, orig] of [...originals]) {
            if (!el.isConnected) {
              originals.delete(el)
            } else if (skipped.has(el)) {
              restoreOne(el, orig)
              originals.delete(el)
            }
          }
        }
        repaintRef.current = repaint

        let repaintTimer = null
        let frameHandle = null
        let lastLeadAt = 0
        /**
         * Repaint on both edges of a churn burst.
         *
         * Switching sessions replaces the conversation subtree in one commit, and
         * the freshly mounted panels — the "载入历史…" state included — still
         * carry their own opaque colours. A trailing-only debounce therefore left
         * the wallpaper hidden for its whole window: the flash the user sees
         * before it "refreshes" back. The leading repaint runs on the next frame,
         * before the browser paints the new content, and is throttled so a
         * streaming answer cannot turn into a repaint per token; the trailing one
         * then catches whatever mounted after it.
         */
        const scheduleRepaint = () => {
          const now = Date.now()
          if (frameHandle === null && now - lastLeadAt >= 150) {
            lastLeadAt = now
            frameHandle = requestAnimationFrame(() => {
              frameHandle = null
              repaint()
            })
          }
          if (repaintTimer !== null) return
          repaintTimer = setTimeout(() => {
            repaintTimer = null
            repaint()
          }, 500)
        }

        const mount = async () => {
          try {
            const res = await fetch(`${API}/api/current`)
            if (!res.ok) {
              console.warn('dsh-wallpaper: wallpaper bytes unavailable', res.status)
              return
            }
            const blob = await res.blob()
            if (disposed) return
            wallpaperUrl = URL.createObjectURL(blob)
            // The image is a custom property consumed by the fixed body::before
            // layer, and <body> itself goes transparent so that layer is not
            // hidden behind an opaque body background.
            bodyBackground = {
              backgroundImage: mountRoot.style.backgroundImage,
              backgroundColor: mountRoot.style.backgroundColor,
              backgroundSize: mountRoot.style.backgroundSize,
              backgroundPosition: mountRoot.style.backgroundPosition,
              backgroundAttachment: mountRoot.style.backgroundAttachment,
              backgroundRepeat: mountRoot.style.backgroundRepeat,
            }
            document.documentElement.style.setProperty('--dshwp-image', `url("${wallpaperUrl}")`)
            mountRoot.style.backgroundImage = 'none'
            mountRoot.style.backgroundColor = 'transparent'
            applyBackgroundStack()
            repaint()
            const kinds = [...originals.values()].map((entry) => entry.kind)
            console.info('dsh-wallpaper: layer mounted', {
              surfaces: originals.size,
              kinds,
              settings: settingsRef.current,
            })
            // Child-list churn catches mounts (rails, panels); the interval
            // catches class/style changes without observing every attribute
            // write the chat stream produces.
            observer = new MutationObserver(scheduleRepaint)
            observer.observe(mountRoot, { childList: true, subtree: true })
            scanTimer = setInterval(scheduleRepaint, 3000)
          } catch (error) {
            /* wallpaper layer is best-effort; the app must never break */
            console.warn('dsh-wallpaper: layer mount failed', error)
          }
        }

        void mount()
        return () => {
          disposed = true
          repaintRef.current = null
          if (repaintTimer !== null) clearTimeout(repaintTimer)
          if (frameHandle !== null) cancelAnimationFrame(frameHandle)
          if (scanTimer !== null) clearInterval(scanTimer)
          if (observer) observer.disconnect()
          restoreAll()
          originals.clear()
          if (bodyBackground !== null) {
            mountRoot.style.backgroundImage = bodyBackground.backgroundImage
            mountRoot.style.backgroundColor = bodyBackground.backgroundColor
            mountRoot.style.backgroundSize = bodyBackground.backgroundSize
            mountRoot.style.backgroundPosition = bodyBackground.backgroundPosition
            mountRoot.style.backgroundAttachment = bodyBackground.backgroundAttachment
            mountRoot.style.backgroundRepeat = bodyBackground.backgroundRepeat
            bodyBackground = null
          }
          document.documentElement.style.removeProperty('--dshwp-image')
          // Hand the caption strip back to the theme (the shell re-reads it on
          // this body mutation and restores the window-controls overlay).
          document.body.style.removeProperty(CAPTION_FILL)
          if (backgroundStyle !== null) {
            backgroundStyle.remove()
            backgroundStyle = null
          }
          if (wallpaperUrl) URL.revokeObjectURL(wallpaperUrl)
          if (frameOriginalPosition !== null) frame.style.position = frameOriginalPosition
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [hostRef, enabled, version])

      // Setting changes (opacity, mask, blur, fill) repaint in place: the image
      // bytes and the surface bookkeeping stay exactly as they are.
      useEffect(() => {
        if (repaintRef.current) repaintRef.current()
      }, [settings])
    }

    // ─── Sync ───────────────────────────────────────────────────────────────

    function useConfigSync(store) {
      useEffect(() => {
        let disposed = false
        const load = () => {
          apiJson('/api/config')
            .then((cfg) => {
              if (!disposed) store.setLoaded(cfg.config)
            })
            .catch(() => {
              if (!disposed) store.setLoaded(store.getSnapshot().config)
            })
          apiJson('/api/version')
            .then((data) => {
              if (!disposed) store.setWallpaperVersion(data.version)
            })
            .catch(() => {})
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

    /** Poll the host wallpaper version so other windows' changes propagate. */
    function useWallpaperVersionSync(store, enabled) {
      useEffect(() => {
        if (!enabled) return
        let disposed = false
        const poll = () => {
          apiJson('/api/version')
            .then((data) => {
              if (!disposed) store.setWallpaperVersion(data.version)
            })
            .catch(() => {})
        }
        poll()
        const timer = setInterval(poll, 5000)
        return () => {
          disposed = true
          clearInterval(timer)
        }
      }, [store, enabled])
    }

    // ─── Settings section (the wallpaper page) ──────────────────────────────

    function CurrentWallpaper({ store, t }) {
      const config = useStore(store, (s) => s.config)
      const version = useStore(store, (s) => s.wallpaperVersion)
      const hasWallpaper = version !== 'none'
      const [url, setUrl] = useState(null)

      useEffect(() => {
        if (!hasWallpaper) {
          setUrl(null)
          return
        }
        let cancelled = false
        let owned = null
        apiBlobUrl('/api/current')
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
      }, [hasWallpaper, version])

      const source = config.wallpaperSourceUrl
      const label = source ? source.replace('https://wallhaven.cc/w/', '') : t('wallpaper.localImage')
      return h(
        'div',
        { className: 'dshwp-current' },
        h(
          'div',
          { className: 'dshwp-current-thumb' },
          url ? h('img', { src: url, alt: '' }) : h('div', { className: 'dshwp-card-empty' }, h(ImageIcon, { size: 20 }))
        ),
        h(
          'div',
          { style: { minWidth: 0 } },
          h('div', { className: 'dshwp-srow-title' }, hasWallpaper ? t('wallpaper.current') : t('wallpaper.none')),
          h('div', { className: 'dshwp-srow-desc' },
            hasWallpaper ? `${label} · ${config.wallpaperSourceUrl ? t('wallpaper.credit') : ''}`.trim() : ''
          )
        )
      )
    }

    function WallpaperSection({ store, t }) {
      const settings = useStore(store, (s) => s.display)
      const updateSettings = store.setDisplay
      const config = useStore(store, (s) => s.config)
      const version = useStore(store, (s) => s.wallpaperVersion)
      const [error, setError] = useState(null)
      const [notice, setNotice] = useState(null)
      const [uploading, setUploading] = useState(false)
      const fileInputRef = useRef(null)

      const putConfig = useCallback(
        (patch) =>
          apiJson('/api/config', { method: 'PUT', body: JSON.stringify(patch) })
            .then((data) => store.setConfig(data.config))
            .catch((err) => setError(err.message)),
        [store]
      )

      const refreshVersion = useCallback(async () => {
        try {
          const data = await apiJson('/api/version')
          store.setWallpaperVersion(data.version)
        } catch {
          /* the version poll covers transient failures */
        }
      }, [store])

      const onUploadFile = async (file) => {
        if (!file) return
        setError(null)
        setNotice(null)
        setUploading(true)
        try {
          if (file.size > MAX_WP_BYTES_CLIENT + 1) {
            throw new Error(
              t('wallpaper.tooLarge', {
                actual: formatBytes(file.size),
                limit: formatBytes(MAX_WP_BYTES_CLIENT),
              })
            )
          }
          const res = await fetch(`${API}/api/upload`, {
            method: 'POST',
            headers: { 'content-type': file.type || 'application/octet-stream' },
            body: file,
          })
          const data = await res.json().catch(() => null)
          if (!res.ok || !data?.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`)
          await putConfig({ wallpaperEnabled: true, wallpaperSourceUrl: null })
          await refreshVersion()
          setNotice(t('wallpaper.appliedToast'))
        } catch (err) {
          setError(err.message)
        } finally {
          setUploading(false)
        }
      }

      return h(
        'div',
        { className: 'dshwp-section' },
        h('style', STYLE_ATTRS, styles),
        h(
          'div',
          { className: 'dshwp-group' },
          h(
            SettingsRow,
            { title: t('settings.wallpaper'), description: t('settings.wallpaperHint') },
            h(Switch, {
              on: config.wallpaperEnabled,
              onChange: (v) => putConfig({ wallpaperEnabled: v }),
              label: t('settings.wallpaper'),
            })
          ),
          h(
            SettingsRow,
            {
              title: t('wallpaper.fill'),
              description: t('settings.fillHint'),
            },
            h(
              'select',
              {
                className: 'dshwp-input32',
                value: settings.fillMode,
                'aria-label': t('wallpaper.fill'),
                onChange: (event) => updateSettings({ fillMode: event.target.value }),
              },
              ...WP_FILL_MODES.map((mode) =>
                h('option', { key: mode, value: mode }, t(`wallpaper.fill.${mode}`))
              )
            )
          ),
          h(
            SettingsRow,
            {
              title: t('wallpaper.mask'),
              description: t('settings.maskHint'),
            },
            h('input', {
              type: 'range',
              min: WP_RANGE.maskOpacity.min,
              max: WP_RANGE.maskOpacity.max,
              step: WP_RANGE.maskOpacity.step,
              value: settings.maskOpacity,
              className: 'dshwp-range',
              style: { width: 148 },
              'aria-label': t('wallpaper.mask'),
              onChange: (event) => updateSettings({ maskOpacity: clampSetting('maskOpacity', event.target.value) }),
            }),
            h('span', { className: 'dshwp-muted' }, `${Math.round(settings.maskOpacity * 100)}%`)
          ),
          h(
            SettingsRow,
            { title: t('wallpaper.blur'), description: t('settings.blurHint') },
            h('input', {
              type: 'range',
              min: WP_RANGE.imageBlur.min,
              max: WP_RANGE.imageBlur.max,
              step: WP_RANGE.imageBlur.step,
              value: settings.imageBlur,
              className: 'dshwp-range',
              style: { width: 148 },
              'aria-label': t('wallpaper.blur'),
              onChange: (event) => updateSettings({ imageBlur: clampSetting('imageBlur', event.target.value) }),
            }),
            h('span', { className: 'dshwp-muted' }, `${settings.imageBlur}px`)
          ),
          h(
            SettingsRow,
            {
              title: t('wallpaper.panel'),
              description: t('settings.panelHint'),
            },
            h('input', {
              type: 'range',
              min: WP_RANGE.panelOpacity.min,
              max: WP_RANGE.panelOpacity.max,
              step: WP_RANGE.panelOpacity.step,
              value: settings.panelOpacity,
              className: 'dshwp-range',
              style: { width: 148 },
              'aria-label': t('wallpaper.panel'),
              onChange: (event) => updateSettings({ panelOpacity: clampSetting('panelOpacity', event.target.value) }),
            }),
            h('span', { className: 'dshwp-muted' }, `${Math.round(settings.panelOpacity * 100)}%`)
          ),
          h(
            SettingsRow,
            { title: t('wallpaper.current'), last: true },
            h(
              'div',
              { style: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' } },
              h(Boundary, null, h(CurrentWallpaper, { store, t })),
              h(
                'button',
                {
                  type: 'button',
                  className: 'dshwp-btn32',
                  disabled: uploading,
                  onClick: () => fileInputRef.current?.click(),
                },
                uploading ? h(Spinner) : t('wallpaper.upload')
              ),
              version !== 'none'
                ? h(
                    'button',
                    {
                      type: 'button',
                      className: 'dshwp-btn32',
                      onClick: () => {
                        setError(null)
                        apiJson('/api/clear', { method: 'POST' })
                          .then(() => apiJson('/api/config'))
                          .then((data) => {
                            store.setConfig(data.config)
                            return refreshVersion()
                          })
                          .catch((err) => setError(err.message))
                      },
                    },
                    t('wallpaper.remove')
                  )
                : null
            )
          ),
          h('input', {
            ref: fileInputRef,
            type: 'file',
            accept: 'image/jpeg,image/png,image/webp',
            style: { display: 'none' },
            onChange: (event) => {
              void onUploadFile(event.target.files?.[0])
              event.target.value = ''
            },
          }),
          error ? h('p', { className: 'dshwp-error', style: { marginTop: 8 } }, error) : null,
          notice ? h('p', { className: 'dshwp-ok', style: { marginTop: 8 } }, notice) : null
        ),
        h(Boundary, null, h(WallpaperMarket, { store, t }))
      )
    }

    // ─── Overlay root (the layer itself) ────────────────────────────────────

    function OverlayRoot({ store }) {
      const hostRef = useRef(null)
      const config = useStore(store, (s) => s.config)
      const version = useStore(store, (s) => s.wallpaperVersion)
      // The layer lives here and reads these live, so the section's sliders
      // repaint the running layer without going through the Host.
      const settings = useStore(store, (s) => s.display)

      useConfigSync(store)
      useWallpaperVersionSync(store, config.wallpaperEnabled)
      useWallpaperLayer(hostRef, config.wallpaperEnabled, settings, version)

      return h(
        'div',
        { ref: hostRef, style: { display: 'contents' } },
        h('style', STYLE_ATTRS, styles)
      )
    }

    // ─── Plugin entry ───────────────────────────────────────────────────────

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'wallpaper: dictionaries')
        const t = ctx.locale.bind(NS)
        const store = createStore()

        ctx.slots.inject('shell.overlay', () =>
          ctx.slots.register(
            {
              name: 'shell.overlay',
              id: 'wallpaper.overlay',
              locale: NS,
              inject: () => ({ store, t }),
            },
            OverlayRoot
          )
        )

        // Settings › 壁纸 — the whole feature lives on this page.
        ctx.slots.inject('settings.section', () =>
          ctx.slots.register(
            {
              name: 'settings.section',
              id: 'dsh-wallpaper',
              order: 41,
              label: () => t('settings.nav'),
              locale: NS,
              inject: () => ({ store, t }),
            },
            WallpaperSection
          )
        )
      },
    }
  },
})
