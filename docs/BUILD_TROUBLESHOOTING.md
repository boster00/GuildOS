# Build troubleshooting

## npm run build

### Type error: Route handler exports (Next.js 15)

**Symptom:** Build fails with:

```
Type error: ... does not satisfy the constraint '{ [x: string]: never; }'.
  Property 'ACTIONS' is incompatible with index signature.
```

**Cause:** Next.js 15's generated route types expect route files under `app/` to export only HTTP method handlers (e.g. `GET`, `POST`) and a small set of allowed config keys. Exporting extra names (e.g. a large `ACTIONS` object) makes the type checker fail.

**Fix:** Move non-handler exports to a separate module and import them in the route.

**Example (applied to `app/api/test-metering/run-action/`):**

1. Create `app/api/test-metering/run-action/actions.js` and move the `ACTIONS` object there; export it.
2. In `app/api/test-metering/run-action/route.js`, remove the inline `ACTIONS` and add:  
   `import { ACTIONS } from "./actions.js";`
3. If another route (e.g. `app/api/test-metering/actions/route.js`) imported `ACTIONS` from the run-action route, update that import to:  
   `import { ACTIONS } from "../run-action/actions.js";`

After this, `npm run build` should complete successfully.
