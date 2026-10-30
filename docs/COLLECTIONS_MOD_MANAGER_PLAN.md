# Implementation Plan: Collections & Mod Manager Features

> **Rules:** Do not invent new design systems. Use existing shadcn/ui + Base UI components, follow existing patterns (spacing, colors, typography), extend existing stores/features only. Only download/install shadcn-based components if absolutely necessary. All UI must follow the global style.

## 1) Goals (recap)
- Add **Mod Manager** page to view installed mods from disk (`mods/`), read `mod-list.json`, enable/disable/uninstall with dependency awareness.
- **Virtual / Core Mods handling**: Recognize game packages (`base`, `space-age`, `quality`, `elevated-rails`) from `mod-list.json`. Never delete or stash them. Lock `base` as always enabled; allow expansion DLCs to be toggled in `mod-list.json`.
- **Disable via `mod-list.json`** only (never rename/move zips). Use atomic writes + backups. Block/warn if Factorio is running.
- **Uninstall** behaves like a package manager: track provenance (explicit/dependency/external), cascade-remove deps with refcount == 0 (counting disabled mods as referenced), preview before action, permanent deletion with explicit confirmation (no hidden deletions, no inconsistent trash).
- **Updates via Portal Namelist API**: Single batched portal lookup using `https://mods.factorio.com/api/mods?namelist=...&page_size=max&hide_deprecated=false`, chunked in batches of 30–50 to respect URL length. Compare newest compatible with target Factorio version, pin/hold, rollback, sha1 verify.
- **Multi-tier Thumbnail Pipeline**: Local zip extraction (100% offline & instant) -> portal cache -> lazy full details fetch -> procedural category fallback.
- **Collections/Profiles**: Save/load/apply switchable playthrough profiles. Create from queue/installed/pasted list. Export/import with schema, diff, review, transactional apply, and optional snapshotting of `mod-settings.dat`.
- **Offline-friendly**: Cache portal metadata, Mod Manager works completely offline with local zip metadata and disk-extracted thumbnails.
- **Add sidebar entry** for Mod Manager and Collections following existing navigation patterns.

---

## 2) Current state audit (what exists)
- **Frontend**: `apps/gui-v2/src/features/{explore,queue,downloads,settings}/`, stores `use-mod-queue-store.ts`, `use-downloads-store.ts`, `use-settings-store.ts`. Sidebar has Explore/Queue/Downloads/Settings. UI uses shadcn/ui (Base UI primitives) with existing components.
- **Rust backend**:
  - `apps/gui-v2/src-tauri/src/features/{config,downloader,explore,logger,mod}.rs`: Manages window state, config, downloads, browse_mods.
  - `crates/factorio/src/installed.rs`: Has `scan_installed_mods` (currently deletes older versions on disk - **must make pure/read-only**), `check_updates_for_installed_mods`, `is_release_compatible`.
  - `crates/parser/`: Has `parse_dependencies` and `IGNORED_MOD_IDS` (`base`, `space-age`, `quality`, etc.).
  - `crates/downloader/`: Manages queue, chunked downloading, sha1 verification.
  - `crates/common/`: Event bus for cross-crate communication.
- **Data**: `mod-list.json` is the game source of truth for enabled state. Mods stored as `.zip` files (or unpacked developer folders) in user-configured mods folder. `mod-settings.dat` stores startup/runtime settings.

---

## 3) Data model & storage

### App data dir (OS): `dirs::data_dir()/factorio-mod-downloader/`
- `config.json` (existing)
- `installed-manifest.json` - provenance tracking & local pins:
  ```json
  {
    "mods": {
      "<name>": {
        "source": "explicit" | "dependency" | "external",
        "installed_by": ["<parent-name>"],
        "installed_at": "2026-10-27T21:00:00Z",
        "pinned": false,
        "pinned_policy": "exact" | "latest_compatible" | null,
        "pinned_by_profile_id": "profile_uuid_or_null",
        "active_version": "1.2.3"
      }
    }
  }
  ```
- `collections/` - each profile saved as `<id>.json` with schema version, mod list, and optional `mod-settings.dat` binary backup.
- `cache/portal/` - cached mod metadata/release lists with TTL.
- `cache/thumbnails/` - extracted mod thumbnails (`<name>_<version>.png`) for instant local UI rendering.
- `backups/mod-list/` - timestamped rolling backups before mutations (`mod-list.json` only).

### Mods folder (user-configurable):
Stashed/extra versions live **inside the mods folder** for transparency, atomic cross-folder renames on the same drive, and cross-platform safety:
- `<mods-folder>/` - **root contains ONLY active zips** (what Factorio loads) and unpacked dev folders. Never put stashed versions here.
- `<mods-folder>/.factorio-mod-downloader/versions/<mod-name>/<version>/<original-filename>.zip` - inactive/stashed versions.
- Factorio ignores dotfolders, so this is 100% safe. Show full paths in UI (e.g. `<mods-folder>\.factorio-mod-downloader\versions\...`).

### Mod Thumbnail Strategy (Multi-Tier)
Because `/api/mods?namelist=...` provides high-speed bulk release data without thumbnail URLs, thumbnails use a 4-tier pipeline:
1. **Tier 1 (Instant, Local & Offline)**: During zip inspection, check for `thumbnail.png` inside the `.zip` archive (e.g. `<mod_folder>/thumbnail.png` or root `thumbnail.png`). Cache extracted PNG in `cache/thumbnails/<name>_<version>.png` or emit as `data:image/png;base64,...`. Instant, 0 network requests, 100% offline.
2. **Tier 2 (Portal Cache)**: If zip lacks `thumbnail.png` (common in small script mods), check `cache/portal/<name>.json` if previously queried in Explore.
3. **Tier 3 (Lazy Fetch)**: When user clicks into the `mod-details-panel.tsx`, fetch `GET /api/mods/{name}/full` on demand to load and cache the official portal thumbnail.
4. **Tier 4 (Polished Procedural Fallback)**:
   - Built-in DLCs: `base` (Factorio Cog/App icon), `space-age` (Rocket icon), `quality` (Gem/Star icon), `elevated-rails` (Train icon).
   - Regular mods: Polished avatar container with mod initials and category accent color (e.g., blue for logistics, purple for overhaul, amber for library).

### Rules:
- **Virtual / Core Mods Protection**: `base` and DLCs (`space-age`, `quality`, `elevated-rails`) are never scanned as zips, never deleted, and never stashed. `base` cannot be disabled.
- **Never move/rename zips for disable**: Only toggle `"enabled": true|false` in `mod-list.json`.
- **Permanent Deletion with Warning**: Deleting stashed versions or uninstalling active mods permanently deletes the file from disk after an explicit confirmation dialog detailing what will be removed. No contradictory trash behavior.
- **Unpacked / Dev Mods**: Read `info.json` from extracted folders in `mods/`. Display as "Unpacked / Dev Mod". Disallow automatic stash swapping or deletion, but support enabling/disabling via `mod-list.json`.
- **Only one active zip per mod name** in the mods root. If multiple exist externally, flag as "Needs attention".

---

## 4) Backend (Rust) - changes needed

**Rule: Crate-first. Tauri must remain IPC-only (no business logic).**

### New crate: `crates/mod_manager/` (add to workspace `Cargo.toml`)
Own all orchestration and stateful logic:
- **Grouping**: Build grouped views from disk (`<mods-folder>/` root + `<mods-folder>/.factorio-mod-downloader/versions/` + virtual core mods) with active/stashed/health states.
- **Thumbnail Extractor**: Extract `thumbnail.png` from `.zip` on scan, save to `cache/thumbnails/`, and populate in mod details.
- **Manifest**: `installed-manifest.json` read/write (provenance tracking, source promotion from `dependency` to `explicit` when manually installed/pinned).
- **Versioning & Stash**:
  - Safe transactional swapping between root and `.factorio-mod-downloader/versions/` with rollback on failure.
  - Guard file operations if `Factorio.exe` is running to prevent Windows `ERROR_SHARING_VIOLATION`.
  - Direct delete for non-active stashed versions with safety checks (block if referenced by an active profile).
- **Mod-list management**: Atomic writes, mutex locking, automatic rolling backups via `crates/factorio/`.
- **Uninstall Cascade**: Reverse dependency DAG analysis (using `crates/parser/`), compute refcounts (treating disabled mods as referenced), preview cascades, and warn if disabling a mod breaks enabled dependents.
- **Collections/Profiles**:
  - Schema, save/load/apply, diff, drift detection, revert.
  - Optional `mod-settings.dat` snapshotting and restoration.
- **Export/Import**: JSON export/import + Factorio-style compressed base64 share string, diff preview, transactional apply.
- **Offline Awareness**: Serve cached data and disk state when offline; disable network actions with clear actionable feedback.

### `crates/factorio/`
Low-level primitives only:
- **`installed.rs`**:
  - Make `scan_installed_mods` pure/read-only (remove auto-deletion of old versions).
  - Add unpacked directory mod detection (`<folder>/info.json`).
  - Read embedded `thumbnail.png` directly from `.zip` archive.
  - Add atomic read/write helpers for `mod-list.json` with timestamped backup rotation.
- **`mods.rs`**:
  - Add **Batch Namelist Update Lookup**: `get_mods_by_namelist(api_client, mod_names: &[String])` querying `https://mods.factorio.com/api/mods?namelist=...&page_size=max&hide_deprecated=false`. Automatically split into chunks of 30–50 names if URL length exceeds ~2000 characters.
  - Add rate-limited single lookups (`tokio::sync::Semaphore` with 4–6 permits) for on-demand details.
- **`cache.rs` (new)**: `PortalCache` with `CacheEntry<T>`, TTLs, read-through + **stale-on-error** fallback, atomic writes to `cache/portal/`.
- **`resolver.rs`**: Continue handling dependency resolution using cached metadata when offline.

### `crates/downloader/`
- Download missing versions for profile application and update flows.
- Verify sha1 hashes for all downloaded archives before promoting to active or stash.

### `apps/gui-v2/src-tauri/` (IPC-only)
Thin `#[tauri::command]` wrappers that **delegate** to crates:
- `features/mod_manager/mod.rs`: `get_installed_mod_groups`, `toggle_mod_enabled`, `set_active_mod_version`, `delete_mod_version`, `uninstall_mods_preview`, `uninstall_mods`, `cleanup_unused_stashed_versions`, `check_mod_updates`.
- `features/collections/mod.rs`: `get_collections`, `save_collection`, `apply_collection`, `export_collection`, `import_collection`.
- `features/config.rs`: Path helpers and running process checks (`is_factorio_running`).
- Re-read `mod-list.json` on Tauri window focus event (`WindowEvent::Focused`) to catch in-game changes without waiting for disk poll.

---

## 5) Frontend (`apps/gui-v2/src`)

### New stores
- `stores/use-mod-manager-store.ts`:
  - Installed mod groups, filters (All, Enabled, Disabled, Updates, Attention, Game/DLC).
  - Optimistic toggle state for instant UI responsiveness with error rollback.
  - Bulk selection set (`selectedModNames: Set<string>`).
  - Health issues, reverse dependency index, loading, provenance.
- `stores/use-collections-store.ts`:
  - Collections list, active profile, diff state, import/export dialog states.

### New feature: `features/mod-manager/`
```
features/mod-manager/
  components/
    mod-manager-view.tsx           // Main view with search, filter tabs, bulk action toolbar
    mod-bulk-actions.tsx           // Enable All, Disable All, Update Selected, Batch Delete
    mod-list-table.tsx             // Clean list/card view with virtualized or smooth scrolling
    mod-row.tsx                    // Thumbnail, title, author, version badge, enable switch, action menu
    mod-thumbnail.tsx              // Multi-tier thumbnail (extracted PNG -> cache -> procedural icon)
    mod-details-panel.tsx          // Slide-out sheet: "Why is this installed?", reverse deps, releases
    manage-versions-dialog.tsx     // Swap active/stash versions, show full paths, delete stashed
    uninstall-preview-dialog.tsx   // Cascade tree preview ("Will remove X", "Keeps Y")
    health-badge.tsx               // Missing deps, incompatible conflicts, duplicate root zips
    updates-banner.tsx             // Quick notification: "X updates available" + 1-click update
  hooks/
    use-mod-updates.ts
    use-mod-toggle.ts
  utils/
    format-provenance.ts
  types.ts
  index.ts
```

### New feature: `features/collections/`
```
features/collections/
  components/
    collections-view.tsx           // Grid/list of saved profiles
    collection-card.tsx            // Card showing mod count, target Factorio version, drift indicator
    collection-editor.tsx          // Create/edit profile from current installed mods or queue
    apply-collection-dialog.tsx    // Diff view, review missing downloads, transactional apply
    import-export-dialog.tsx       // JSON upload/download & compressed share string copy-paste
    diff-view.tsx                  // Visual comparison (version changes, additions, removals)
  index.ts
```

### Sidebar & Navigation Update
- Add **"Mods"** (Mod Manager) and **"Collections"** tabs to `app-sidebar.tsx` using `lucide-react` icons (`Package2` / `Layers`).
- Update `TabId` union in `app-sidebar.tsx` and render in `app-layout.tsx`.
- Add badge indicator to "Mods" tab displaying pending update count.

---

## 6) Implementation phases

### Phase 0: Prep & safety fixes (Crate-first)
- [ ] **Add crate `crates/mod_manager/`** to workspace `Cargo.toml`. Define public traits and data models.
- [ ] **Make `scan_installed_mods` pure/read-only** in `crates/factorio/src/installed.rs` (remove deletion of old versions).
- [ ] Add **Virtual Mod definitions** (`base`, `space-age`, `quality`, `elevated-rails`) so they are recognized from `mod-list.json` without requiring `.zip` files.
- [ ] Add unpacked directory mod detection (`<folder>/info.json`) in `installed.rs`.
- [ ] Implement **local thumbnail extraction** in `crates/factorio` (extract `thumbnail.png` from `.zip` into `cache/thumbnails/` or base64 data URI).
- [ ] Add `read_mod_list` / `write_mod_list_atomic` with rolling backups in `crates/factorio/`.
- [ ] Implement process check (`is_factorio_running`) in `crates/mod_manager/` to prevent file conflicts on Windows.
- [ ] Add **Offline cache foundation**: `crates/factorio/src/cache.rs` with `PortalCache`, `CacheEntry<T>`, TTLs, read-through + stale-on-error.

### Phase 1: Mod Manager (Read-only + Toggle + UI)
- [ ] **Crate**: Grouping logic in `crates/mod_manager/` (combines active root zips, `.factorio-mod-downloader/versions/`, unpacked folders, and virtual DLCs).
- [ ] **Tauri**: Thin IPC commands: `get_installed_mod_groups`, `toggle_mod_enabled`.
- [ ] Frontend store `use-mod-manager-store.ts` with optimistic UI toggles.
- [ ] Feature `features/mod-manager/` with list view, search, filters (All, Enabled, Disabled, Updates, Attention).
- [ ] `mod-thumbnail.tsx` displaying local extracted thumbnail or procedural category/DLC icon.
- [ ] Add "Mods" tab to sidebar + `app-layout.tsx`.
- [ ] Health badges (missing dependencies, incompatible conflicts, duplicate zips in root).
- [ ] Re-read `mod-list.json` when window regains focus.

### Phase 2: Dependency Cascade, Uninstall & Toggle Safety
- [ ] **Crate**: Reverse dependency graph in `crates/mod_manager/` (using `crates/parser/`).
- [ ] Warn on toggle if disabling a mod breaks enabled dependents; offer to disable dependents recursively.
- [ ] Uninstall preview calculation: refcount analysis, cascade removal of unused dependencies, preserve explicit mods.
- [ ] **Tauri**: Thin `uninstall_mods_preview`, `uninstall_mods`.
- [ ] UI: `uninstall-preview-dialog.tsx` with clear explanation of what is kept and what is removed.
- [ ] Direct permanent deletion of active mod files upon confirmed uninstall (no inconsistent trash behavior).

### Phase 3: Fast Updates via Portal Namelist API & Manual Pinning
- [ ] **Crate**: Implement `get_mods_by_namelist` in `crates/factorio/src/mods.rs` using `https://mods.factorio.com/api/mods?namelist=...&page_size=max&hide_deprecated=false`.
- [ ] Chunk requests into batches of 30–50 to prevent URL length overflow.
- [ ] Compatibility filtering based on target Factorio version.
- [ ] Support manual mod pinning (`pinned: true`, `pinned_policy: "exact" | "latest_compatible"`) in `installed-manifest.json`.
- [ ] UI: Updates badge in sidebar, updates banner, "Pin version" action, and single/bulk update actions.
- [ ] Verify sha1 hash on download before promoting updated mod to active.

### Phase 4: Version Switching & Collections / Profiles
- [ ] **Crate**: Transactional version swapping between root and `.factorio-mod-downloader/versions/` (with automatic rollback on failure).
- [ ] Block version swaps if `Factorio.exe` is running.
- [ ] Collection schema definition (`id`, `name`, `description`, `factorio_version`, `mods`, optional `mod_settings_dat`).
- [ ] Create collections from: current installed state, queue, or manual selection.
- [ ] Save snapshot of `mod-settings.dat` alongside collection JSON.
- [ ] Apply collection: transactional flow (download missing -> swap active versions -> write `mod-list.json` -> restore `mod-settings.dat`).
- [ ] Profile-aware update rules: exact-pinned mods in active profile show "Pinned by Profile" and require confirmation + mark profile as drifted.
- [ ] UI: `features/collections/` view, collection cards, drift indicator, diff dialog.

### Phase 5: Export / Import & Sharing
- [ ] **Crate**: Export single or all profiles to JSON and compressed URL-safe base64 share string.
- [ ] Import review dialog with diff preview and modes:
  - *Add missing only* (safest default)
  - *Match exactly* (swaps/enables/disables to match collection 1:1)
- [ ] Transactional import: verify and download missing versions before applying.
- [ ] Offline guard: If missing mods need downloading while offline, disable apply with clear error message.

### Phase 6: Cleanup, Bulk Actions & Polish
- [ ] Bulk action bar in Mod Manager: Enable All, Disable All, Update All Compatible, Batch Uninstall.
- [ ] Cleanup UI: "Cleanup unused stashed versions" showing file size, paths under `.factorio-mod-downloader/`, and profile usage.
- [ ] Storage usage summary: "Using X GB in mods folder (active + stashed)".
- [ ] "Open in File Explorer" buttons for mods root and `.factorio-mod-downloader/`.
- [ ] Full keyboard navigation and accessibility polish.

---

## 7) Critical rules to follow
1. **Crate-first**: All non-trivial logic lives in `crates/mod_manager/`. **Tauri is IPC-only**.
2. **Never rename/move zips to disable**: Only toggle `mod-list.json`.
3. **Make `scan_installed_mods` pure**: Never delete files on disk during a scan.
4. **Protect Virtual Mods**: `base` and official DLCs (`space-age`, `quality`, `elevated-rails`) are never treated as missing zips, deleted, or stashed.
5. **No inconsistent trash**: File deletions (stashed versions or uninstalled mods) are permanent after an explicit, informative confirmation dialog.
6. **Windows file safety**: Block version swapping and file deletions while `Factorio.exe` is running.
7. **Transactional version swapping**: Use rollback mechanics if moving files fails mid-operation.
8. **Multi-tier thumbnails**: Prioritize instant offline zip-extracted thumbnails before network lookups.
9. **Use Namelist API for batch updates**: Use `api/mods?namelist=...` chunked in batches of 30–50 to eliminate 1-by-1 request overhead.
10. **Provenance matters**: Only cascade dependencies with refcount == 0; never auto-remove explicitly installed mods.
11. **Show full paths**: Always show full paths for `.factorio-mod-downloader/` in Manage Versions and Cleanup dialogs.
12. **Follow existing styling**: Use shadcn/ui and Base UI primitives matching existing explore and queue views.

---

## 8) Testing checklist
- [ ] Core game packages (`base`, `space-age`, `quality`, `elevated-rails`) display properly without `.zip` files and cannot be deleted.
- [ ] `base` mod cannot be disabled.
- [ ] Toggle enable/disable persists to `mod-list.json` with timestamped backup.
- [ ] Disabling a mod that has enabled dependents shows a warning dialog.
- [ ] Thumbnails render instantly from `.zip` extraction without network requests.
- [ ] Batch update check uses `api/mods?namelist=...` and correctly parses compatible releases.
- [ ] Version switching between root and `.factorio-mod-downloader/` is atomic; rollback works if destination is locked.
- [ ] Running Factorio blocks version swapping with a clear warning.
- [ ] Uninstall cascades only unreferenced dependencies; disabled mods count as references.
- [ ] Collections apply correctly and optionally restore `mod-settings.dat`.
- [ ] Profile drift is detected when an exact-pinned mod is manually updated or switched.
- [ ] Mod Manager operates completely offline using disk state and cached metadata.
- [ ] Switching focus back to the app refreshes `mod-list.json` if modified externally.
- [ ] Multiple root zips for the same mod are flagged as "Needs attention".
- [ ] Tauri commands contain zero business or filesystem swapping logic.
