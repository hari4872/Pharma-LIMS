# Pharma LIMS — Frontend

React 18 · TypeScript · Vite · Redux Toolkit · React Router v6

---

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build → dist/
npm run preview    # preview production build
```

The Vite dev server proxies all `/api/*` requests to the backend at `http://localhost:5204` (configured in `vite.config.ts`).

---

## Architecture

### State Management
- **Redux Toolkit** — single store at `src/store/`
- **`authSlice`** — holds `token`, `fullName`, `userId`; token persisted in `localStorage` so refresh preserves login
- All API calls use the shared `src/api/axios.ts` instance which reads the token from Redux state and attaches `Authorization: Bearer <token>` automatically

### Routing
- React Router v6 nested routes
- `RequireAuth` wrapper — redirects to `/login` if no token
- `Layout` is the persistent shell (sidebar + topbar); all authenticated pages render via `<Outlet />`

### Styling
- **Inline `React.CSSProperties`** throughout — no CSS framework, no CSS modules
- `src/index.css` — minimal global reset only (box-sizing, font, scrollbar, focus ring)
- Font: **Inter** loaded via Google Fonts in `index.html`
- Design tokens (sidebar colour, accent blue, etc.) are defined as constants in `Layout.tsx`

### Shared Components
| Component | Location | Purpose |
|---|---|---|
| `Layout` | `src/components/Layout.tsx` | Sidebar nav + topbar + `<Outlet />` |
| `DataTable<T>` | `src/components/DataTable.tsx` | Generic typed table with hover state, loading state, empty state |

---

## Sidebar Structure

### Overview
| Label | Route |
|---|---|
| Dashboard | `/dashboard` |
| Compliance | `/compliance` |

### Master Data
| Label | Route |
|---|---|
| Laboratories | `/master-data/laboratories` |
| Instruments | `/master-data/instruments` |
| Materials | `/master-data/materials` |
| Test Methods | `/master-data/test-methods` |
| Parameters | `/master-data/parameters` |
| Spec Limits | `/master-data/spec-limits` |
| Form Templates | `/master-data/form-templates` |
| Users | `/master-data/users` |
| Sample Types | `/master-data/sample-types` |
| Storage Locations | `/master-data/storage-locations` |
| Reagents & Standards | `/master-data/reagents` |
| Training Records | `/master-data/training-records` |

### Operations
| Label | Route |
|---|---|
| Sample Registration | `/samples` |
| Checkpoints | `/checkpoints` |
| Work Queue | `/work-queue` |
| OOS Investigations | `/oos-investigations` |
| Digital Logbook | `/digital-logbook` |
| Results Review | `/results-review` |
| CoA Review | `/coa-review` |
| Dispatch QC | `/dispatch-qc` |

### Inventory & Traceability
| Label | Route |
|---|---|
| Traceability | `/traceability` |
| Stability Pulls | `/stability-pulls` |
| Retain Samples | `/retain-samples` |
| Condition Excursions | `/condition-excursions` |

---

## Key Hooks

### `useOfflineScanQueue` — EU GMP Annex 11 §4.3
Located at `src/hooks/useOfflineScanQueue.ts`.

Queues checkpoint scans to `localStorage` (`lims_offline_scan_queue`) when the device loses network. On reconnect, flushes the queue atomically — each queued scan is posted with `isOfflineSync: true` so the backend audit log records the offline origin.

```ts
const { triggerCheckpoint, pendingCount, isOnline } = useOfflineScanQueue()
```

- `triggerCheckpoint(checkpointId)` — fires immediately if online, queues if offline
- `pendingCount` — number of scans waiting to sync (shown in banner on CheckpointsPage)
- `isOnline` — reflects `navigator.onLine` + `online`/`offline` events

---

## TypeScript Config
- **Strict mode** enabled (`strict: true` in `tsconfig.app.json`)
- Path alias: `@/` maps to `src/` — use `import Foo from '@/components/Foo'`
- No `any` — all API responses typed via interfaces in each page file

---

## Page Pattern

Each page follows this structure:

```tsx
// 1. Local interface matching backend DTO
interface Foo { fooId: number; name: string; ... }

// 2. State
const [data, setData] = useState<Foo[]>([])
const [loading, setLoading] = useState(true)

// 3. Load on mount
useEffect(() => { load() }, [])
async function load() {
  setLoading(true)
  const r = await api.get('/foos')
  setData(r.data)
  setLoading(false)
}

// 4. Render with DataTable<Foo>
return <DataTable columns={columns} data={data} loading={loading} />
```

No business logic in the frontend — all filtering, computation, and validation lives in the .NET backend.
