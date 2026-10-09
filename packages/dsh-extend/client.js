/**
 * Browser half of @qwqweeo123/dsh-extend — one bundle carrying three features that used to
 * ship as three separate packages: Open In… (@qwqweeo123/dsh-open-in-app),
 * Desktop Pet (@qwqweeo123/dsh-pet) and Wallpaper (@qwqweeo123/dsh-wallpaper).
 *
 * The file registers four modules: one per feature (the standalone client.js
 * verbatim, re-homed under this package's submodule ids, with style-tag
 * ownership moved to this package so unload still reclaims them) and the
 * composition module the shell activates.
 */

window.__ModuleLoader__.load({
	id: "@qwqweeo123/dsh-extend/open-in-app",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_store = require("@deepseek-ai/dsh-client-store");
		let react_jsx_runtime = require("react/jsx-runtime");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		/** Browser-relative form of {@link OPEN_IN_APP_APPS_PATH}. */
		const OPEN_IN_APP_APPS_ROUTE = "/open-in-app/apps".slice(1);
		/** Browser-relative form of {@link OPEN_IN_APP_ICON_PREFIX_PATH}. */
		const OPEN_IN_APP_ICON_PREFIX_ROUTE = "/open-in-app/icon".slice(1);
		/** Browser-relative form of {@link OPEN_IN_APP_OPEN_PATH}. */
		const OPEN_IN_APP_OPEN_ROUTE = "/open-in-app/open".slice(1);
		//#endregion
		//#region lib/types/client/applications.js
		/** Label keys for applications supported by this client. */
		const APP_LABEL_KEY = {
			finder: "app.finder",
			explorer: "app.explorer",
			filemanager: "app.filemanager",
			cursor: "app.cursor",
			vscode: "app.vscode",
			vscodeinsiders: "app.vscodeinsiders",
			windsurf: "app.windsurf",
			zed: "app.zed",
			sublimetext: "app.sublimetext",
			xcode: "app.xcode",
			androidstudio: "app.androidstudio",
			intellij: "app.intellij",
			pycharm: "app.pycharm",
			webstorm: "app.webstorm",
			phpstorm: "app.phpstorm",
			goland: "app.goland",
			rider: "app.rider",
			rustrover: "app.rustrover",
			fork: "app.fork",
			sourcetree: "app.sourcetree",
			github: "app.github",
			tower: "app.tower",
			gitkraken: "app.gitkraken",
			smartgit: "app.smartgit",
			sublimemerge: "app.sublimemerge",
			ghostty: "app.ghostty",
			warp: "app.warp",
			iterm: "app.iterm",
			kitty: "app.kitty",
			terminal: "app.terminal",
			windowsterminal: "app.windowsterminal",
			gitbash: "app.gitbash",
			gnometerminal: "app.gnometerminal",
			konsole: "app.konsole"
		};
		//#endregion
		//#region lib/types/client/controller.js
		/** Browser availability/choice state and the launch carrier for the split button. */
		/**
		* Owns the once-per-page availability read, the persisted last choice, and
		* the launch POST. Availability and choice publish through uSES-safe sources
		* so every Session header shares one truth.
		*/
		var OpenInAppController = class {
			fetcher;
			/** Installed app ids in host menu order; null until the host answered. */
			apps = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(null);
			/** Last chosen app id, or empty before the first choice, shared across sessions and browser restarts. */
			choice = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)("", { persist: { name: "dsh.open-in-app.choice" } });
			/** Current launch, shared by pointer and keyboard gestures. */
			operation = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)({
				phase: "idle",
				path: null
			});
			/**
			* Resolve the remembered nameable installed application, with the button's first-app fallback.
			* @returns the installed app id, or undefined while unavailable.
			*/
			currentApp() {
				const apps = (this.apps.getSnapshot() ?? []).filter((id) => APP_LABEL_KEY[id] !== void 0);
				const choice = this.choice.getSnapshot();
				return apps.includes(choice) ? choice : apps[0];
			}
			loading;
			/**
			* @param fetcher - HTTP carrier for the apps read and the launch POST.
			*/
			constructor(fetcher = (input, init) => fetch(input, init)) {
				this.fetcher = fetcher;
			}
			/**
			* Read availability once per controller life; concurrent calls share the read.
			* A failed read publishes an empty list, which renders no button at all.
			* @returns after availability is published.
			*/
			load() {
				this.loading ??= this.run();
				return this.loading;
			}
			/**
			* Remember one picked app id.
			* @param appId - catalog id from the availability list.
			*/
			choose(appId) {
				if (this.operation.getSnapshot().phase !== "busy") this.choice.set(appId);
			}
			/**
			* Launch one installed app on a workspace directory.
			* @param appId - catalog id from the availability list.
			* @param path - the session's absolute workspace directory.
			* Concurrent gestures are ignored until the current Host request settles.
			* @returns after the host acknowledged the launch; rejects on any failure.
			*/
			async launch(appId, path) {
				if (this.operation.getSnapshot().phase === "busy") return;
				this.operation.set({
					phase: "busy",
					path
				});
				const body = {
					app: appId,
					path
				};
				try {
					const response = await this.fetcher(OPEN_IN_APP_OPEN_ROUTE, {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify(body)
					});
					if (!response.ok) throw new Error(`open failed: HTTP ${String(response.status)}`);
					this.operation.set({
						phase: "idle",
						path
					});
				} catch (error) {
					this.operation.set({
						phase: "error",
						path
					});
					throw error;
				}
			}
			async run() {
				let apps = [];
				try {
					const response = await this.fetcher(OPEN_IN_APP_APPS_ROUTE, { headers: { accept: "application/json" } });
					if (response.ok) {
						const payload = await response.json();
						if (Array.isArray(payload.apps)) apps = payload.apps.filter((id) => typeof id === "string");
					}
				} catch {}
				this.apps.set(apps);
			}
		};
		//#endregion
		//#region lib/types/client/open-failure-toast.js
		/** Per-control failure banner for path gestures. */
		/**
		* Transient failure banner owned by the control that initiated the gesture,
		* so one failed request announces once, from the control the user pressed.
		* @returns `toast` owned by the control and `show` to announce one
		* failure with resolved copy; announcing again replays the banner.
		*/
		function useOpenFailureToast() {
			const seq = (0, react.useRef)(0);
			const [banner, setBanner] = (0, react.useState)(null);
			const dismiss = (0, react.useCallback)(() => {
				setBanner(null);
			}, []);
			return {
				toast: banner === null ? null : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Toast, {
					text: banner.text,
					icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconWarningOutlineRegular, {}),
					onDone: dismiss
				}, banner.seq),
				show: (text) => {
					seq.current += 1;
					setBanner({
						seq: seq.current,
						text
					});
				}
			};
		}
		//#endregion
		//#region \0dsh-css:D:\develop\dsh-harness-windows-x64\packages\client\ui-open-in-app\src\client\OpenTargetButton.module.css.mjs
		const css = ".WgQWqa_menuAnchor{flex:none;align-self:center;display:inline-flex}.WgQWqa_split{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-sm);height:24px;font-family:var(--dsw-font-family);align-items:stretch;display:inline-flex;overflow:hidden}.WgQWqa_main,.WgQWqa_chevron{color:var(--dsw-alias-label-primary);white-space:nowrap;cursor:pointer;background:0 0;border:0;justify-content:center;align-items:center;font-size:11px;line-height:16px;display:inline-flex}.WgQWqa_main{gap:4px;padding:3px 5px}.WgQWqa_chevron{border-left:.5px solid var(--dsw-alias-border-l4);color:var(--dsw-alias-label-secondary);padding:3px 4px 3px 3px}.WgQWqa_main:hover:not(:disabled),.WgQWqa_main:focus-visible,.WgQWqa_chevron:hover:not(:disabled),.WgQWqa_chevron:focus-visible{background:var(--dsw-alias-interactive-bg-hover)}.WgQWqa_main:disabled,.WgQWqa_chevron:disabled{cursor:default}.WgQWqa_appIcon{object-fit:contain}.WgQWqa_split[data-size=large]{border-radius:var(--dsw-radius-md);border-color:var(--dsw-alias-border-l2);height:36px}.WgQWqa_split[data-size=large] .WgQWqa_main{gap:6px;padding:6px 14px;font-size:14px}.WgQWqa_split[data-size=large] .WgQWqa_chevron{padding:6px 10px}.WgQWqa_skeleton{border-radius:var(--dsw-radius-xs);background:var(--dsw-alias-interactive-bg-hover);flex:none;display:inline-block}";
		const tagId = "@qwqweeo123/dsh-extend/open-in-app/OpenTargetButton.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@qwqweeo123/dsh-extend";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var OpenTargetButton_module_css_default = {
			"appIcon": "WgQWqa_appIcon",
			"chevron": "WgQWqa_chevron",
			"main": "WgQWqa_main",
			"menuAnchor": "WgQWqa_menuAnchor",
			"skeleton": "WgQWqa_skeleton",
			"split": "WgQWqa_split"
		};
		//#endregion
		//#region lib/types/client/OpenTargetButton.js
		/** Shared file and directory opener: one default action, application menu, and per-gesture feedback. */
		/**
		* Serialize gestures and announce their failures through the initiating control's toast.
		* @param execute - target adapter that returns the failure to announce, or null.
		* @param t - localized control copy.
		* @returns the pending state, feedback, and guarded action callback.
		*/
		function useOpenTargetGesture(execute, t) {
			const [pending, setPending] = (0, react.useState)(false);
			const inFlight = (0, react.useRef)(false);
			const { toast, show } = useOpenFailureToast();
			return {
				pending,
				toast,
				act: (operation) => {
					if (inFlight.current) return;
					inFlight.current = true;
					setPending(true);
					execute(operation).then((failure) => {
						if (failure !== null) show(t(`path.${failure}`));
					}).finally(() => {
						inFlight.current = false;
						setPending(false);
					});
				}
			};
		}
		/** One application image with a per-image fallback, shared by main and menu buttons. */
		function ApplicationIcon({ source, size = 14 }) {
			const [failed, setFailed] = (0, react.useState)(false);
			return source === null || failed ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRightUpOutlineRegular, { size }) : (0, react_jsx_runtime.jsx)("img", {
				src: source,
				width: size,
				height: size,
				className: OpenTargetButton_module_css_default.appIcon,
				alt: "",
				draggable: false,
				onError: () => {
					setFailed(true);
				}
			});
		}
		/**
		* Render identical split buttons for files and directories. File reveal always
		* stays last; it is the default only when no application is registered.
		* @param props - target applications, default selection, and operations.
		* @returns the control and its transient failure feedback.
		*/
		function OpenTargetButton(props) {
			const { applications, defaultId, kind, t } = props;
			const [menuOpen, setMenuOpen] = (0, react.useState)(false);
			const { pending, toast, act } = useOpenTargetGesture(props.execute, t);
			const preferred = kind === "file" ? applications.find((app) => app.id === defaultId) ?? applications[0] : applications.find((app) => app.id === defaultId);
			const disabled = pending || props.busy === true || props.loading === true;
			const hasMenu = props.loading === true || props.failed || applications.length + (kind === "file" ? 1 : 0) > 1;
			const revealDefault = kind === "file" && preferred === void 0 && props.loading !== true;
			const primaryLabel = preferred === void 0 ? t("path.reveal") : t("open.title", { app: preferred.name });
			const run = (operation) => {
				setMenuOpen(false);
				act(operation);
			};
			const primary = () => {
				if (revealDefault) {
					run({ kind: "reveal" });
					return;
				}
				if (preferred !== void 0 && preferred.id !== defaultId) {
					run({
						kind: "application",
						id: preferred.id
					});
					return;
				}
				run({ kind: "default" });
			};
			const icon = props.loading === true && preferred === void 0 ? (0, react_jsx_runtime.jsx)("span", {
				className: OpenTargetButton_module_css_default.skeleton,
				"data-open-target-skeleton": true,
				"aria-hidden": "true",
				style: {
					width: props.prominent ? 18 : 13,
					height: props.prominent ? 18 : 13
				}
			}) : revealDefault ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpenOutlineRegular, { size: props.prominent ? 18 : 13 }) : (0, react_jsx_runtime.jsx)(ApplicationIcon, {
				source: preferred?.icon ?? null,
				size: props.prominent ? 18 : 13
			}, preferred?.icon);
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
				className: OpenTargetButton_module_css_default.menuAnchor,
				open: menuOpen && !disabled && hasMenu,
				autoFocus: true,
				portal: true,
				dense: true,
				align: "end",
				onClose: () => {
					setMenuOpen(false);
				},
				items: [...applications.map((app) => ({
					id: `app:${app.id}`,
					icon: (0, react_jsx_runtime.jsx)(ApplicationIcon, { source: app.icon }, app.icon),
					label: app.id === preferred?.id ? t("path.appDefault", { app: app.name }) : app.name
				})), ...props.failed ? [{
					id: "unavailable",
					label: t("path.appsError"),
					disabled: true
				}] : []],
				footer: kind === "file" ? [{
					id: "reveal",
					icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpenOutlineRegular, {}),
					label: revealDefault ? t("path.appDefault", { app: t("path.reveal") }) : t("path.reveal")
				}] : [],
				onSelect: (id) => {
					run(id === "reveal" ? { kind: "reveal" } : {
						kind: "application",
						id: id.slice(4)
					});
				},
				anchor: (0, react_jsx_runtime.jsxs)("div", {
					className: OpenTargetButton_module_css_default.split,
					"data-open-target": kind,
					"data-size": props.prominent ? "large" : "compact",
					"data-open-path": kind === "file" && !props.prominent ? "" : void 0,
					"data-state": disabled ? "busy" : "idle",
					children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
						portal: true,
						label: primaryLabel,
						shortcutKeys: props.shortcut?.keys,
						side: "bottom",
						delayMs: 500,
						children: (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: OpenTargetButton_module_css_default.main,
							disabled,
							"aria-label": props.prominent ? void 0 : primaryLabel,
							"aria-keyshortcuts": props.shortcut?.aria,
							"data-open-path-open": kind === "file" && !props.prominent ? "" : void 0,
							"data-open-path-unpreviewable": props.prominent ? "" : void 0,
							onClick: primary,
							children: [icon, props.prominent && (revealDefault ? t("path.reveal") : t("path.open"))]
						})
					}), hasMenu && (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: OpenTargetButton_module_css_default.chevron,
						disabled,
						"aria-haspopup": "menu",
						"aria-expanded": menuOpen && !disabled,
						"aria-label": t("path.more"),
						"data-open-path-more": kind === "file" && !props.prominent ? "" : void 0,
						onClick: () => {
							if (!menuOpen) props.refresh?.();
							setMenuOpen((value) => !value);
						},
						children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, { size: props.prominent ? 14 : 10 })
					})]
				})
			}), toast] });
		}
		//#endregion
		//#region lib/types/client/OpenInAppAction.js
		/**
		* Adapt the installed directory catalog to the shared opening control.
		* @param props - displayed directory, installed catalog, and launch operations.
		* @returns the shared control, or null without an eligible application.
		*/
		function OpenInAppAction(props) {
			const { absolutePath, useOpenInAppApps, useOpenInAppChoice, t } = props;
			const available = useOpenInAppApps((apps) => apps);
			const choice = useOpenInAppChoice((id) => id);
			const operation = props.useOpenInAppLaunch((value) => value);
			const shortcut = props.useShortcuts((rows) => rows.find((row) => row.id === "workspace.openLocal"));
			const apps = (available ?? []).flatMap((id) => {
				const key = APP_LABEL_KEY[id];
				return key === void 0 ? [] : [{
					id,
					name: t(key),
					icon: props.iconUrl(id)
				}];
			});
			const preferred = apps.find((app) => app.id === choice) ?? apps[0];
			if (preferred === void 0) return null;
			return (0, react_jsx_runtime.jsx)(OpenTargetButton, {
				kind: "directory",
				applications: apps,
				defaultId: preferred.id,
				failed: false,
				t,
				busy: operation.phase === "busy",
				shortcut,
				execute: async (operation) => {
					const id = operation.kind === "application" ? operation.id : preferred.id;
					try {
						await props.launch(id, absolutePath);
					} catch (_error) {
						return "openError";
					}
					if (operation.kind === "application") props.choose(id);
					return null;
				}
			}, absolutePath);
		}
		//#endregion
		//#region lib/types/client/open-path.js
		/**
		* Host desktop availability, file associations, and open/reveal actions over the Session Remote.
		* The desktop answer is read once per page; a failed read renders no control.
		*/
		/** Page-lifetime desktop availability and the open/reveal carrier shared by every path control. */
		var OpenInAppPathController = class {
			remote;
			/** Whether the Host desktop can open paths; null until the Host answered, false also after a failed read. */
			desktop = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(null);
			loading;
			/**
			* @param remote - the Session Remote namespace answering availability and running gestures.
			*/
			constructor(remote) {
				this.remote = remote;
			}
			/**
			* Read desktop availability once per controller life; concurrent calls share the read.
			* @returns after availability is published.
			*/
			load() {
				this.loading ??= this.run();
				return this.loading;
			}
			/**
			* Open one Host path in its default application, or reveal it in the file manager.
			* @param path - absolute path on the Host, as the file's metadata reports it.
			* @param action - default application open, or file-manager reveal.
			* @param application - registered application path for an explicit open.
			* @returns the failure kind to announce, or `null` once the Host acknowledged.
			*/
			async openPath(path, action, application) {
				const request = action === "reveal" ? {
					path,
					action
				} : {
					path,
					...application === void 0 ? {} : { application }
				};
				let ok = false;
				try {
					ok = (await this.remote.session.openWorkspacePath(request)).ok;
				} catch {}
				return ok ? null : action === "open" ? "openError" : "revealError";
			}
			/**
			* Refresh the file's OS associations; failures remain distinct from an empty handler list.
			* @param path - file path reported by the Host.
			* @param signal - lifetime of the requesting preview.
			* @returns application metadata, or null when the query fails.
			*/
			async applications(path, signal) {
				let result;
				try {
					result = await this.remote.session.workspacePathApplications({ path }, signal);
				} catch (_error) {
					return null;
				}
				return result.ok ? result.value : null;
			}
			async run() {
				let available = false;
				try {
					const result = await this.remote.session.canOpenWorkspacePath();
					available = result.ok && result.value;
				} catch {}
				this.desktop.set(available);
			}
		};
		//#endregion
		//#region lib/types/client/file-applications.js
		/** File association reads shared by mounted controls using the same reader and target. */
		const EMPTY = {
			apps: [],
			loading: true,
			failed: false
		};
		const readers = /* @__PURE__ */ new WeakMap();
		/** Each mounted consumer retains the query; the last release cancels and discards it. */
		function subscribe(query, target, listener) {
			let targets = readers.get(query);
			if (targets === void 0) {
				targets = /* @__PURE__ */ new Map();
				readers.set(query, targets);
			}
			let entry = targets.get(target);
			const initial = entry === void 0;
			if (entry === void 0) {
				const created = {
					state: (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(EMPTY),
					users: 0,
					controller: null,
					refresh: () => {
						created.controller?.abort();
						const controller = new AbortController();
						created.controller = controller;
						query(target, controller.signal).then((apps) => {
							if (!controller.signal.aborted) created.state.set({
								apps: apps ?? [],
								loading: false,
								failed: apps === null
							});
						});
					}
				};
				entry = created;
				targets.set(target, entry);
			}
			const retained = entry;
			retained.users += 1;
			const release = retained.state.subscribe(listener);
			if (initial) retained.refresh();
			return () => {
				release();
				retained.users -= 1;
				if (retained.users === 0) {
					retained.controller?.abort();
					targets.delete(target);
				}
			};
		}
		/**
		* Share associations and refreshes across mounted controls for the same file and reader.
		* @param target - path or authenticated route identifying the current file.
		* @param query - stable reader scoped to the serving Host; failures resolve to null.
		* @param enabled - whether a native desktop is available.
		* @returns metadata, initial loading state, failure state, and a shared refresh callback.
		*/
		function useFileApplications(target, query, enabled) {
			const retain = (0, react.useCallback)((listener) => enabled ? subscribe(query, target, listener) : () => {}, [
				enabled,
				query,
				target
			]);
			const snapshot = (0, react.useCallback)(() => enabled ? readers.get(query)?.get(target)?.state.getSnapshot() ?? EMPTY : EMPTY, [
				enabled,
				query,
				target
			]);
			const state = (0, react.useSyncExternalStore)(retain, snapshot, snapshot);
			const refresh = (0, react.useCallback)(() => {
				readers.get(query)?.get(target)?.refresh();
			}, [query, target]);
			return {
				...state,
				refresh
			};
		}
		//#endregion
		//#region lib/types/client/OpenPathAction.js
		/** File association adapter for the shared file/directory opening control. */
		/**
		* Resolve file associations and adapt operations without embedding platform behavior in the control.
		* @param props - verified file path, desktop query, native operations, and display variant.
		* @returns the shared opening control, or null without a desktop.
		*/
		function FileOpenTarget(props) {
			const desktop = props.useOpenInAppDesktop((value) => value);
			const association = useFileApplications(props.absolutePath, props.applications, desktop === true);
			(0, react.useEffect)(() => {
				if (desktop === null) props.loadDesktop();
			}, [desktop, props.loadDesktop]);
			if (desktop !== true) return null;
			const { apps } = association;
			return (0, react_jsx_runtime.jsx)(OpenTargetButton, {
				kind: "file",
				applications: apps,
				defaultId: apps.find((app) => app.default)?.id,
				loading: association.loading,
				failed: association.failed,
				prominent: props.empty === true,
				t: props.t,
				refresh: association.refresh,
				execute: (operation) => props.openPath(props.absolutePath, operation.kind === "reveal" ? "reveal" : "open", operation.kind === "application" ? operation.id : void 0)
			}, props.absolutePath);
		}
		/**
		* Render the file adapter in the document header.
		* @param props - document owner inputs and injected opening capabilities.
		* @returns the shared split button.
		*/
		function OpenPathAction(props) {
			return (0, react_jsx_runtime.jsx)(FileOpenTarget, { ...props });
		}
		//#endregion
		//#region ../../util/native-command/src/types.ts
		/**
		* Validate file association metadata received from a native process or authenticated Host.
		* @param value - decoded application list.
		* @returns validated application metadata.
		* @throws Error for malformed entries or unsupported icon URLs.
		*/
		function parseNativeFileApplications(value) {
			if (!Array.isArray(value)) throw new Error("Invalid native application list");
			const applications = [];
			const entries = value;
			for (const entry of entries) {
				if (typeof entry !== "object" || entry === null || !("id" in entry) || !("name" in entry) || !("default" in entry) || !("icon" in entry) || typeof entry.id !== "string" || entry.id.length === 0 || typeof entry.name !== "string" || typeof entry.default !== "boolean" || !(entry.icon === null || typeof entry.icon === "string" && /^data:image\/(?:png|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(entry.icon))) throw new Error("Invalid native application entry");
				applications.push({
					id: entry.id,
					name: entry.name,
					default: entry.default,
					icon: entry.icon
				});
			}
			return applications;
		}
		//#endregion
		//#region lib/types/client/FileRouteAction.js
		async function queryRoute(url, signal) {
			try {
				const response = await fetch(url, { signal });
				if (!response.ok) return null;
				return parseNativeFileApplications(await response.json());
			} catch (_error) {
				return null;
			}
		}
		/**
		* Render file actions without bypassing the owning Session's authorization route.
		* @param props - authenticated route, desktop availability, and native gesture callback.
		* @returns the shared compact control, or null without a desktop.
		*/
		function FileRouteAction(props) {
			const association = useFileApplications(props.actionUrl, queryRoute, props.available);
			if (!props.available) return null;
			return (0, react_jsx_runtime.jsx)(OpenTargetButton, {
				kind: "file",
				applications: association.apps,
				defaultId: association.apps.find((app) => app.default)?.id,
				failed: association.failed,
				loading: association.loading,
				busy: props.pending,
				refresh: association.refresh,
				t: props.t,
				execute: async (operation) => {
					return props.onAction(operation.kind === "reveal" ? "reveal" : "open", operation.kind === "application" ? operation.id : void 0);
				}
			}, props.actionUrl);
		}
		//#endregion
		//#region lib/types/client/OpenPathEmptyAction.js
		/**
		* Render the shared file opening menu with a larger labeled main button.
		* @param props - unpreviewable file and injected opening capabilities.
		* @returns the shared file opening action.
		*/
		function OpenPathEmptyAction(props) {
			return (0, react_jsx_runtime.jsx)(FileOpenTarget, {
				...props,
				empty: true
			});
		}
		//#endregion
		//#region lib/types/client/locales.js
		/** `open-in-app` namespace dictionaries: the workspace split button and the document-preview path controls. */
		/** Dictionary namespace owned by this plugin. */
		const NS = "open-in-app";
		/** Application labels shared verbatim by both dictionaries (product names). */
		const PRODUCT_NAMES = {
			"app.cursor": "Cursor",
			"app.vscode": "VS Code",
			"app.vscodeinsiders": "VS Code Insiders",
			"app.windsurf": "Windsurf",
			"app.zed": "Zed",
			"app.sublimetext": "Sublime Text",
			"app.xcode": "Xcode",
			"app.androidstudio": "Android Studio",
			"app.intellij": "IntelliJ IDEA",
			"app.pycharm": "PyCharm",
			"app.webstorm": "WebStorm",
			"app.phpstorm": "PhpStorm",
			"app.goland": "GoLand",
			"app.rider": "Rider",
			"app.rustrover": "RustRover",
			"app.fork": "Fork",
			"app.sourcetree": "Sourcetree",
			"app.github": "GitHub Desktop",
			"app.tower": "Tower",
			"app.gitkraken": "GitKraken",
			"app.smartgit": "SmartGit",
			"app.sublimemerge": "Sublime Merge",
			"app.ghostty": "Ghostty",
			"app.warp": "Warp",
			"app.iterm": "iTerm2",
			"app.kitty": "kitty",
			"app.windowsterminal": "Windows Terminal",
			"app.gitbash": "Git Bash",
			"app.gnometerminal": "GNOME Terminal",
			"app.konsole": "Konsole"
		};
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"open.title": "用 {app} 打开",
			"path.appDefault": "{app}（默认）",
			"path.appsError": "无法获取应用列表",
			"shortcut.busy": "正在打开工作区",
			"shortcut.unavailable": "当前工作区或本地应用不可用",
			"open.tooltip": "在本地打开",
			"path.open": "打开",
			"path.more": "更多打开方式",
			"path.reveal": "显示文件位置",
			"path.openError": "打开失败，请重试",
			"path.revealError": "无法显示文件位置，请重试",
			...PRODUCT_NAMES,
			"app.finder": "访达",
			"app.explorer": "文件资源管理器",
			"app.filemanager": "文件管理器",
			"app.terminal": "终端"
		};
		/** English dictionary, key-identical to the Chinese source of truth. */
		const en = {
			"open.title": "Open in {app}",
			"path.appDefault": "{app} (default)",
			"path.appsError": "Could not load applications",
			"shortcut.busy": "Opening workspace",
			"shortcut.unavailable": "Current workspace or local application unavailable",
			"open.tooltip": "Open locally",
			"path.open": "Open",
			"path.more": "More ways to open",
			"path.reveal": "Show file location",
			"path.openError": "Could not open. Try again.",
			"path.revealError": "Could not show the file location. Try again.",
			...PRODUCT_NAMES,
			"app.finder": "Finder",
			"app.explorer": "File Explorer",
			"app.filemanager": "Files",
			"app.terminal": "Terminal"
		};
		//#endregion
		//#region lib/types/client/index.js
		/**
		* Shared native opening controls for workspace directories, document previews,
		* delivery cards, and changed-file review. Directory choices persist in the browser;
		* file defaults and application lists come from the serving Host desktop.
		*/
		/** Required services: sessions, layout selection, the slot registry, copy, Remote calls, and shortcuts. */
		const inject = [
			"sessions",
			"slots",
			"locale",
			"remote",
			"remote.session",
			"shortcuts",
			"layout"
		];
		/**
		* Client plugin body: register dictionaries, workspace directory controls, and
		* document preview path controls.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			const controller = new OpenInAppController();
			controller.load();
			const paths = new OpenInAppPathController(ctx.remote);
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "open-in-app: dictionaries");
			const t = ctx.locale.bind(NS);
			const target = () => {
				if (ctx.layout.panelInfo.getSnapshot().activePanelId !== null) return void 0;
				const session = Object.values(ctx.sessions.list.getSnapshot().byId).find((row) => (row.retainedBy.mainView ?? 0) > 0);
				const appId = controller.currentApp();
				return session?.cwd && appId !== void 0 ? {
					appId,
					path: session.cwd
				} : void 0;
			};
			ctx.effect(() => ctx.shortcuts.register({
				id: "workspace.openLocal",
				label: () => t("open.tooltip"),
				aliases: ["open workspace locally", "open in app"],
				defaults: {
					"desktop:macos": {
						code: "KeyO",
						modifiers: ["primary", "alt"]
					},
					"desktop:windows": {
						code: "KeyO",
						modifiers: ["primary", "alt"]
					},
					"desktop:linux": {
						code: "KeyO",
						modifiers: ["primary", "alt"]
					},
					"web:macos": {
						code: "KeyO",
						modifiers: ["primary", "shift"]
					},
					"web:windows": {
						code: "KeyO",
						modifiers: ["primary", "shift"]
					}
				},
				regions: ["page", "editable"],
				modals: [],
				resolve: () => {
					if (controller.operation.getSnapshot().phase === "busy") return {
						status: "blocked",
						reason: t("shortcut.busy")
					};
					const selected = target();
					if (selected === void 0) return {
						status: "blocked",
						reason: t("shortcut.unavailable")
					};
					return {
						status: "handled",
						run: () => {
							controller.launch(selected.appId, selected.path).catch((error) => {
								console.warn("workspace open rejected:", error);
							});
						}
					};
				}
			}), "open-in-app: workspace command");
			const directoryInjected = () => ({
				hooks: {
					openInAppApps: controller.apps,
					openInAppChoice: controller.choice,
					openInAppLaunch: controller.operation,
					shortcuts: ctx.shortcuts.catalog
				},
				launch: (appId, path) => controller.launch(appId, path),
				choose: (appId) => {
					controller.choose(appId);
				},
				iconUrl: (appId) => `${OPEN_IN_APP_ICON_PREFIX_ROUTE}/${appId}`
			});
			function SessionOpenInAppAction(props) {
				const { sessionId, useSessions } = props;
				const cwd = useSessions((state) => state.byId[sessionId]?.cwd);
				return cwd ? (0, react.createElement)(OpenInAppAction, {
					...props,
					absolutePath: cwd
				}) : null;
			}
			ctx.slots.inject("conversation.session.header.utilities", () => ctx.slots.register({
				name: "conversation.session.header.utilities",
				id: "open-in-app",
				order: -10,
				locale: NS,
				inject: directoryInjected
			}, SessionOpenInAppAction));
			ctx.slots.inject("sidebar.right.tab.files.actions", () => ctx.slots.register({
				name: "sidebar.right.tab.files.actions",
				id: "open-in-app",
				locale: NS,
				inject: directoryInjected
			}, OpenInAppAction));
			const applications = (path, signal) => paths.applications(path, signal);
			const pathInjected = () => ({
				hooks: { openInAppDesktop: paths.desktop },
				loadDesktop: () => paths.load(),
				openPath: (path, action, application) => paths.openPath(path, action, application),
				applications
			});
			ctx.slots.inject("sidebar.right.tab.document.actions", () => ctx.slots.register({
				name: "sidebar.right.tab.document.actions",
				id: "open-in-app",
				locale: NS,
				inject: pathInjected
			}, OpenPathAction));
			ctx.slots.inject("sidebar.right.tab.document.unpreviewable", () => ctx.slots.register({
				name: "sidebar.right.tab.document.unpreviewable",
				id: "open-in-app",
				locale: NS,
				inject: pathInjected
			}, OpenPathEmptyAction));
			ctx.slots.inject("deliverables.file.actions", () => ctx.slots.register({
				name: "deliverables.file.actions",
				id: "open-in-app",
				locale: NS
			}, FileRouteAction));
			ctx.slots.inject("deliverables.review.file.actions", () => ctx.slots.register({
				name: "deliverables.review.file.actions",
				id: "open-in-app",
				locale: NS
			}, FileRouteAction));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

/**
 * Browser half of the Desktop Pet feature (@qwqweeo123/dsh-extend/pet).
 *
 * Renders into the shell's overlay: a draggable desktop pet driven by the
 * Codex `/pet` spritesheet format (ported from codeg's `lib/pet/animation.ts`),
 * plus the pet manager and the codex-pets.net marketplace dialog. The
 * management entry point is Settings › 桌宠, mirroring codeg's Settings UI.
 * All network and disk access goes through the bundle's Host routes under
 * `/dsh-pet/api/*`; this file never touches the upstream CDN directly.
 */
window.__ModuleLoader__.load({
  id: '@qwqweeo123/dsh-extend/pet',
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
      'data-plugin': '@qwqweeo123/dsh-extend',
      'data-plugin-css': '@qwqweeo123/dsh-extend/pet/client.css',
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

/**
 * Browser half of the Wallpaper feature (@qwqweeo123/dsh-extend/wallpaper).
 *
 * Applies a global wallpaper to the shell frame (frame-transparent +
 * translucent surfaces, the same model as codeg's workspace background) and
 * owns the Settings › 壁纸 page: enable/opacity, the current wallpaper, local
 * uploads, and the wallhaven.cc marketplace rendered inline. All network and
 * disk access goes through the bundle's Host routes under
 * `/dsh-wallpaper/api/*`; this file never touches the upstream CDN directly.
 */
window.__ModuleLoader__.load({
  id: '@qwqweeo123/dsh-extend/wallpaper',
  factory(require) {
    const React = require('react')
    const { useCallback, useEffect, useRef, useState, useSyncExternalStore } = React
    const h = React.createElement

    const NS = 'wallpaper'
    const API = '/dsh-wallpaper'
    // DSH's client module system claims every untagged <style> for the next
    // activating plugin and deletes it with that entry — which wipes this
    // plugin's CSS. Tagging the element keeps it ours.
    const STYLE_ATTRS = { 'data-plugin': '@qwqweeo123/dsh-extend' }

    // ─── Locale dictionaries (flat dotted keys, {name} interpolation) ───────

    const zh = {
      'wallpaper.title': '壁纸设置',
      'wallpaper.enable': '启用壁纸',
      'wallpaper.fill': '填充方式',
      'wallpaper.fill.cover': '覆盖',
      'wallpaper.fill.contain': '包含',
      'wallpaper.fill.center': '居中',
      'wallpaper.fill.tile': '平铺',
      'wallpaper.mask': '不透明度',
      'wallpaper.blur': '图片模糊',
      'settings.fillHint': '图片铺满窗口的方式：覆盖裁切、包含留白、居中原始大小、平铺重复。',
      'settings.maskHint': '数值越高，图片越向主题背景色淡化，文字对比越清晰。',
      'settings.blurHint': '模糊背景图片本身（0 表示不模糊），不影响面板与文字。',
      'wallpaper.upload': '上传本地图片…',
      'wallpaper.remove': '移除壁纸',
      'wallpaper.searchPlaceholder': '搜索壁纸…',
      'wallpaper.applied': '使用中',
      'wallpaper.unavailable': '不可用',
      'wallpaper.appliedToast': '壁纸已应用',
      'wallpaper.downloadFailed': '下载失败',
      'wallpaper.applyFailed': '应用失败',
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
      'wallpaper.categories.downloaded': '已下载',
      'wallpaper.market': '壁纸市场',
      'wallpaper.marketHint': '点击卡片即可下载并应用为全局背景',
      'wallpaper.libraryHint': '点击卡片即可应用，无需重新下载；悬停卡片左上角 × 可删除单张',
      'wallpaper.libraryEmpty': '还没有已下载的壁纸',
      'wallpaper.libraryCount': '共 {count} 张',
      'wallpaper.delete': '删除',
      'wallpaper.cardDelete': '删除壁纸 {id}',
      'wallpaper.deleteAll': '全部删除',
      'wallpaper.deleteAllConfirm': '确认全部删除？',
      'wallpaper.cancel': '取消',
      'wallpaper.deleted': '已删除',
      'wallpaper.deleteFailed': '删除失败',
      'wallpaper.current': '当前壁纸',
      'wallpaper.none': '尚未设置壁纸',
      'wallpaper.localImage': '本地图片',
      'settings.nav': '壁纸',
      'settings.wallpaper': '壁纸',
      'settings.wallpaperHint': '为整个界面应用全局背景',
      'settings.enabledHint': '关闭后界面恢复默认背景，壁纸文件保留',
    }

    const en = {
      'wallpaper.title': 'Wallpaper',
      'wallpaper.enable': 'Enable wallpaper',
      'wallpaper.fill': 'Fill mode',
      'wallpaper.fill.cover': 'Cover',
      'wallpaper.fill.contain': 'Contain',
      'wallpaper.fill.center': 'Center',
      'wallpaper.fill.tile': 'Tile',
      'wallpaper.mask': 'Opacity',
      'wallpaper.blur': 'Image blur',
      'settings.fillHint': 'How the image fills the window: cover crops, contain letterboxes, center keeps its size, tile repeats.',
      'settings.maskHint': 'Higher values fade the image toward the theme background and keep text contrast.',
      'settings.blurHint': 'Blurs the background image itself (0 = sharp). Panels and text are untouched.',
      'wallpaper.upload': 'Upload a local image…',
      'wallpaper.remove': 'Remove wallpaper',
      'wallpaper.searchPlaceholder': 'Search wallpapers…',
      'wallpaper.applied': 'In use',
      'wallpaper.unavailable': 'Unavailable',
      'wallpaper.appliedToast': 'Wallpaper applied',
      'wallpaper.downloadFailed': 'Download failed',
      'wallpaper.applyFailed': 'Apply failed',
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
      'wallpaper.categories.downloaded': 'Downloaded',
      'wallpaper.market': 'Wallpaper marketplace',
      'wallpaper.marketHint': 'Click a card to download and apply it as the global background',
      'wallpaper.libraryHint': 'Click a card to apply it — no second download; × on the card removes one',
      'wallpaper.libraryEmpty': 'No downloaded wallpapers yet',
      'wallpaper.libraryCount': '{count} saved',
      'wallpaper.delete': 'Delete',
      'wallpaper.cardDelete': 'Delete wallpaper {id}',
      'wallpaper.deleteAll': 'Delete all',
      'wallpaper.deleteAllConfirm': 'Delete all?',
      'wallpaper.cancel': 'Cancel',
      'wallpaper.deleted': 'Deleted',
      'wallpaper.deleteFailed': 'Delete failed',
      'wallpaper.current': 'Current wallpaper',
      'wallpaper.none': 'No wallpaper set',
      'wallpaper.localImage': 'Local image',
      'settings.nav': 'Wallpaper',
      'settings.wallpaper': 'Wallpaper',
      'settings.wallpaperHint': 'Apply a global background to the whole interface',
      'settings.enabledHint': 'Turning this off restores the default background; the file stays',
    }

    // ─── Store ──────────────────────────────────────────────────────────────

    function createStore() {
      const listeners = new Set()
      const state = {
        loaded: false,
        config: { wallpaperEnabled: false, wallpaperSourceUrl: null },
        wallpaperVersion: 'none',
        /** Fill mode / opacity / blur — shared by layer + section. */
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
.dshwp-btn32-danger { border-color: transparent; background: var(--dsw-alias-label-error); color: #fff; }
.dshwp-btn32-danger:hover:not(:disabled) { filter: brightness(1.1); }
.dshwp-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(178px, 1fr)); gap: 10px; }
.dshwp-card { position: relative; aspect-ratio: 16/10; border-radius: var(--dsw-radius-lg, 12px); border: .5px solid var(--dsw-alias-border-l3); background: var(--dsw-alias-bg-layer-2); overflow: hidden; cursor: pointer; padding: 0; }
.dshwp-card:disabled { cursor: default; }
.dshwp-card img { width: 100%; height: 100%; object-fit: cover; display: block; }
.dshwp-card-empty { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; }
.dshwp-tag { position: absolute; padding: 1px 6px; border-radius: 4px; font-size: 10px; line-height: 16px; background: rgb(0 0 0 / 55%); color: #fff; }
.dshwp-shade { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgb(0 0 0 / 35%); opacity: 0; transition: opacity 0.12s; color: #fff; }
.dshwp-card:hover:not(:disabled) .dshwp-shade { opacity: 1; }
/* A downloadable card gets a wrapper so the delete button is a sibling of the
   card button (interactive elements must not nest), and the card keeps its box. */
.dshwp-cardwrap { position: relative; aspect-ratio: 16/10; }
.dshwp-cardwrap .dshwp-card { width: 100%; height: 100%; }
.dshwp-del { position: absolute; top: 6px; left: 6px; z-index: 2; display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; padding: 0; border: 0; border-radius: 6px; background: rgb(0 0 0 / 55%); color: #fff; font-size: 14px; line-height: 1; cursor: pointer; opacity: 0; transition: opacity 0.12s; }
.dshwp-cardwrap:hover .dshwp-del:not(:disabled), .dshwp-del:focus-visible { opacity: 1; }
.dshwp-del:hover:not(:disabled) { background: var(--dsw-alias-label-error, #d33); }
.dshwp-del:disabled { cursor: default; opacity: 0.4; }
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
    const WP_CATEGORIES = ['all', 'general', 'anime', 'people', 'downloaded']
    /**
     * The one category that is not a wallhaven search: it lists the downloads
     * the Host already keeps under `$DSH_HOME/wallpaper/library/` and applies
     * them from disk.
     */
    const WP_LIBRARY_CATEGORY = 'downloaded'

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

    /**
     * One market card. `thumbPath` overrides the upstream thumbnail route:
     * library entries show their stored thumbnail — or, when the download could
     * not keep one, the stored image — instead of proxying wallhaven again.
     * `onDelete` is passed only by the download library; it wraps the card so
     * the delete button sits beside it rather than inside it.
     */
    function WallpaperCard({ wallpaper, thumbPath, t, assetCache, applied, downloading, busy, onApply, onDelete }) {
      const thumbApiPath =
        thumbPath ?? (wallpaper.thumbUrl ? `/api/market/asset?url=${encodeURIComponent(wallpaper.thumbUrl)}` : null)
      const thumb = useProxiedAsset(assetCache, thumbApiPath)
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
      const card = h(
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
          : h(
              'span',
              { className: 'dshwp-card-empty' },
              thumb.failed ? '×' : thumbApiPath ? h(Spinner) : h(ImageIcon, { size: 20 })
            ),
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
      if (typeof onDelete !== 'function') return card
      return h(
        'div',
        { className: 'dshwp-cardwrap' },
        card,
        h(
          'button',
          {
            type: 'button',
            className: 'dshwp-del',
            disabled: busy,
            title: t('wallpaper.delete'),
            'aria-label': t('wallpaper.cardDelete', { id: wallpaper.id }),
            onClick: () => onDelete(wallpaper),
          },
          '×'
        )
      )
    }

    /**
     * The wallhaven.cc market, inline in the settings page (and reused wherever
     * else the surface is needed), with a 已下载 category that lists the Host's
     * download library instead of searching upstream. Single-flight applies:
     * two concurrent writes would race on the same background file — and that
     * guard covers the library, which writes that file too.
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
      /** 全部删除 is a two-step action: the button arms, the second click fires. */
      const [confirmClear, setConfirmClear] = useState(false)
      const downloadingRef = useRef(null)
      const seqRef = useRef(0)
      const committedQuery = useRef('')
      const inLibrary = category === WP_LIBRARY_CATEGORY

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
          if (c === WP_LIBRARY_CATEGORY) {
            // Local by definition: one page, nothing to search for.
            const data = await apiJson('/api/library')
            if (seq !== seqRef.current) return
            setItems(data.items)
            setLastPage(1)
            setShownPage(1)
            return
          }
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
            // The listing's own fields travel with the download so the Host can
            // file it in the download library (thumbnail, dimensions, category).
            // The id is not sent: the Host derives it from the validated
            // sourceUrl page URL.
            body: JSON.stringify({
              url: wallpaper.fullUrl,
              sourceUrl: wallpaper.sourceUrl,
              thumbUrl: wallpaper.thumbUrl,
              width: wallpaper.width,
              height: wallpaper.height,
              category: wallpaper.category,
            }),
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

      /** Apply a stored download: the Host copies its own file, no network. */
      const onLibraryApply = async (item) => {
        if (downloadingRef.current !== null) return
        downloadingRef.current = item.id
        setDownloadingId(item.id)
        setNotice(null)
        setError(null)
        try {
          await apiJson('/api/library/apply', { method: 'POST', body: JSON.stringify({ id: item.id }) })
          const data = await apiJson('/api/config')
          store.setConfig(data.config)
          const v = await apiJson('/api/version')
          store.setWallpaperVersion(v.version)
          setNotice(t('wallpaper.appliedToast'))
        } catch (err) {
          setError(`${t('wallpaper.applyFailed')}: ${err.message}`)
        } finally {
          downloadingRef.current = null
          setDownloadingId(null)
        }
      }

      /**
       * Delete one stored download. The wallpaper that is applied right now is
       * left alone — the Host only drops its source URL — so the two lists are
       * refreshed from the Host rather than patched locally.
       */
      const onLibraryDelete = async (item) => {
        if (downloadingRef.current !== null) return
        downloadingRef.current = item.id
        setDownloadingId(item.id)
        setNotice(null)
        setError(null)
        try {
          await apiJson('/api/library/remove', { method: 'POST', body: JSON.stringify({ id: item.id }) })
          const data = await apiJson('/api/config')
          store.setConfig(data.config)
          await load(query, category, page)
          setNotice(t('wallpaper.deleted'))
        } catch (err) {
          setError(`${t('wallpaper.deleteFailed')}: ${err.message}`)
        } finally {
          downloadingRef.current = null
          setDownloadingId(null)
        }
      }

      /** Delete every stored download (armed by the first click on 全部删除). */
      const onClearLibrary = async () => {
        if (downloadingRef.current !== null) return
        downloadingRef.current = 'clear'
        setNotice(null)
        setError(null)
        try {
          await apiJson('/api/library/clear', { method: 'POST' })
          const data = await apiJson('/api/config')
          store.setConfig(data.config)
          setConfirmClear(false)
          await load(query, category, page)
          setNotice(t('wallpaper.deleted'))
        } catch (err) {
          setError(`${t('wallpaper.deleteFailed')}: ${err.message}`)
        } finally {
          downloadingRef.current = null
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
            inLibrary
              ? t('wallpaper.libraryCount', { count: items.length })
              : `${t('wallpaper.credit')}${loading ? '' : ` · ${t('wallpaper.pageInfo', { page: shownPage, lastPage })}`}`
          )
        ),
        h('p', { className: 'dshwp-intro' }, t(inLibrary ? 'wallpaper.libraryHint' : 'wallpaper.marketHint')),
        h(
          'div',
          { className: 'dshwp-toolbar32' },
          // Search is a wallhaven concept; the library is short enough to scan.
          inLibrary
            ? null
            : h('input', {
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
                  // The two sources share one item list: drop the other one's
                  // cards now, or they stay clickable until the fetch lands —
                  // and a wallhaven card has no library entry to apply.
                  if ((c === WP_LIBRARY_CATEGORY) !== inLibrary) setItems([])
                  setConfirmClear(false)
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
          ),
          // Only the library has anything to delete, and the second click is
          // what actually clears it.
          inLibrary && items.length > 0
            ? confirmClear
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'dshwp-btn32 dshwp-btn32-danger',
                    disabled: loading,
                    onClick: () => void onClearLibrary(),
                  },
                  t('wallpaper.deleteAllConfirm')
                )
              : h(
                  'button',
                  { type: 'button', className: 'dshwp-btn32', onClick: () => setConfirmClear(true) },
                  t('wallpaper.deleteAll')
                )
            : null,
          inLibrary && confirmClear
            ? h(
                'button',
                { type: 'button', className: 'dshwp-btn32', onClick: () => setConfirmClear(false) },
                t('wallpaper.cancel')
              )
            : null
        ),
        error ? h('p', { className: 'dshwp-error' }, error) : null,
        notice ? h('p', { className: 'dshwp-ok' }, notice) : null,
        loading && items.length === 0
          ? h('div', { style: { display: 'flex', justifyContent: 'center', padding: 40 } }, h(Spinner))
          : items.length === 0 && !error
            ? h(
                'div',
                { className: 'dshwp-empty' },
                h(ImageIcon, { size: 24 }),
                h('span', null, t(inLibrary ? 'wallpaper.libraryEmpty' : 'wallpaper.empty'))
              )
            : h(
                'div',
                { className: 'dshwp-grid', style: loading ? { opacity: 0.6 } : undefined },
                items.map((w) =>
                  h(WallpaperCard, {
                    key: w.id,
                    wallpaper: w,
                    // A stored thumbnail is preferred; the stored image is the
                    // fallback for entries that could not keep one.
                    thumbPath: inLibrary ? (w.thumbPath ?? w.imagePath) : undefined,
                    t,
                    assetCache,
                    applied: config.wallpaperSourceUrl === w.sourceUrl,
                    downloading: downloadingId === w.id,
                    busy: downloadingId !== null,
                    onApply: (item) => void (inLibrary ? onLibraryApply(item) : onCardApply(item)),
                    onDelete: inLibrary ? onLibraryDelete : undefined,
                  })
                )
              ),
        inLibrary
          ? null
          : h(
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
    const WP_DEFAULTS = { fillMode: 'cover', maskOpacity: 0.82, imageBlur: 0 }
    const WP_RANGE = {
      maskOpacity: { min: 0, max: 0.99, step: 0.01 },
      imageBlur: { min: 0, max: 24, step: 1 },
    }
    /**
     * Frost for the chrome that keeps a glass look. codeg uses 8px for every
     * structural surface; the old 20px on the sidebar read as mush over a busy
     * image, so the sidebar and the top bar share this value.
     */
    const WP_FROST = 'blur(8px) saturate(140%)'
    /**
     * Alpha of every structural surface above the wallpaper: the frame, the
     * columns, the panels and the tab strips. The panel-opacity slider is gone,
     * and 0 is the value it was asked to keep — surfaces are painted fully
     * transparent, so the image reads the same behind the whole window. What is
     * left as chrome is the sidebar's frost and the region hairlines; text and
     * controls keep their own colours, only the box fills go.
     */
    const WP_PANEL_ALPHA = 0

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
            backgroundStyle.setAttribute('data-plugin', '@qwqweeo123/dsh-extend')
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
          const alpha = Math.round(WP_PANEL_ALPHA * 100)

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
            const useAlpha = alpha
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
               * on top, so the composer showed more of the wallpaper than the
               * surface it sits on — each translucent ancestor lightens it
               * again. The ancestor colours are read from computed style — the
               * exact pixels the canvas composites — so the two recipes can
               * never drift apart.
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

// ─── Composition ────────────────────────────────────────────────────────────
//
// The shell activates the module whose id equals this package's name. It
// requires the three feature modules registered above out of the module table
// (each a verbatim copy of its standalone package's browser half) and applies
// them one by one on the same context. The inject list is the union of the
// three, so the suite activates with the full shell exactly as the separate
// packages did.

window.__ModuleLoader__.load({
  id: '@qwqweeo123/dsh-extend',
  factory(require) {
    const parts = [
      require('@qwqweeo123/dsh-extend/open-in-app'),
      require('@qwqweeo123/dsh-extend/pet'),
      require('@qwqweeo123/dsh-extend/wallpaper'),
    ]
    const inject = [...new Set(parts.flatMap((part) => part.inject || []))]
    return {
      name: '@qwqweeo123/dsh-extend',
      inject,
      apply(ctx) {
        for (const part of parts) part.apply(ctx)
      },
    }
  },
})
