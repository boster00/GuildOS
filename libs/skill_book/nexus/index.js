/**
 * Nexus skill book — knowledge registry for Boster Nexus / Nexus Armor.
 */

export const skillBook = {
  id: "nexus",
  title: "Boster Nexus — Nexus Armor & Zoho Integration",
  description: "Tactical instructions for Nexus development: Zoho data layers, RunPod deployment.",
  steps: [],
  toc: {
    syncZohoData: {
      description: "Work with Zoho Books/CRM/Desk integration following the layered architecture.",
      howTo: `
**Non-negotiable:** All Zoho HTTP must use the \`Zoho\` class singleton from \`libs/zoho/index.js\`. Never call fetch/axios directly to Zoho APIs.

**5-layer architecture:**

1. **API routes** (\`app/api/**\`) — Auth, validation, map body to DTOs, call application services, return JSON. Do NOT embed Zoho payload shaping or multi-step flows here.

2. **Application services** (\`libs/zoho/services/**\`) — Own use cases (e.g., resolve shipping_address_id). May use ZohoRepository, domain VOs, and the zoho client.

3. **Repository** (\`libs/zoho/repository/ZohoRepository.js\`) — DB cache read/write. Upsert after successful Zoho creates. No business rules.

4. **Domain** (\`libs/zoho/domain/**\`) — Value objects, equality, matchers. NO I/O.

5. **Entities** (\`libs/zoho/entities/**\`) — Column/API mapping. Each entity has \`extractFromResponse\` and \`transformToDbRecord\`.

**Example flow:**
checkout → BooksContactAddressService.resolveForSalesOrder → BooksContactAddress + BooksContactAddressMatcher + zoho.getBooksContact / createBooksContactAddress + ZohoRepository.upsertContactAddressFromApiResponse

**Tech debt:** BooksContactEntity / zoho_books_contacts cache table may be missing. Wire ZohoRepository.getById(BooksContactEntity, ...) when contacts cache is restored.
`,
    },
    deployRunPod: {
      description: "Build and push RunPod container image for the structure worker.",
      howTo: `
**Trigger:** When told to "update runpod" or "push live".

**Steps:**
\`\`\`bash
npm run runpod:push   # or: npm run push:live
\`\`\`

**What the script does:**
1. Commits uncommitted changes: \`git add -A\`, \`git commit -m "chore: update runpod container"\`, \`git push\`
2. Builds Docker image: \`docker build --platform linux/amd64 -t <REGISTRY>/boster-structure:latest runpod/structure\`
3. Pushes image: \`docker push <REGISTRY>/boster-structure:latest\`

**Prerequisites:**
- \`RUNPOD_IMAGE_REGISTRY\` set in \`.env.local\`
- Docker installed and logged in
- Git remote configured

**After push:** RunPod uses new image on next worker start. To force all workers: redeploy endpoint in RunPod Console (Endpoints → Edit → Save & Deploy).
`,
    },
  },
};
