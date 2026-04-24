/** Presentational blocks for quest detail (safe to import from client). */

function stepDisplayMeta(step) {
  if (typeof step === "string") {
    const t = step.trim();
    return { title: t || "Next step", subtitle: null };
  }
  if (step && typeof step === "object" && !Array.isArray(step)) {
    const o = /** @type {Record<string, unknown>} */ (step);
    if (typeof o.instruction === "string" && o.instruction.trim()) {
      return {
        title: o.instruction.trim(),
        subtitle: typeof o.description === "string" ? o.description : null,
      };
    }
    if (typeof o.title === "string" && o.title.trim()) {
      return {
        title: o.title.trim(),
        subtitle: typeof o.description === "string" ? o.description : null,
      };
    }
  }
  return { title: "Next step", subtitle: null };
}

const IMG_EXT_RE = /\.(png|jpg|jpeg|gif|webp|svg|bmp|avif)(\?.*)?$/i;
const SUPABASE_STORAGE_RE = /storage\/v1\/object\/public\//i;

function looksLikeImageUrl(url) {
  return typeof url === "string" && (IMG_EXT_RE.test(url) || SUPABASE_STORAGE_RE.test(url));
}

export function ItemsListDisplay({ items }) {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) return null;

  return (
    <div className="mt-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-base-content/55">Items ({list.length})</h2>
      <div className="mt-2 space-y-3">
        {list.map((item, i) => {
          const key = item?.item_key || `item-${i}`;
          const payload = item?.payload;
          const url = payload && typeof payload === "object" ? payload.url : null;
          const description = payload && typeof payload === "object" ? payload.description : null;
          const source = item?.source || (payload && typeof payload === "object" ? payload.source : null);
          const isImage = looksLikeImageUrl(url);

          return (
            <div key={`${key}-${i}`} className="rounded-lg border border-base-300 bg-base-200/30 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-xs text-base-content/80">{key}</span>
                {source ? <span className="text-xs text-base-content/50">{source}</span> : null}
              </div>
              {isImage ? (
                <a href={url} target="_blank" rel="noopener noreferrer" className="mt-2 block">
                  <img
                    src={url}
                    alt={description || key}
                    className="max-h-[500px] w-auto max-w-full rounded border border-base-300 bg-black/5 object-contain"
                    loading="lazy"
                  />
                </a>
              ) : url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 block break-all text-xs text-primary hover:underline"
                >
                  {url}
                </a>
              ) : null}
              {description ? (
                <p className="mt-2 whitespace-pre-wrap text-sm text-base-content/80">{description}</p>
              ) : null}
              {!url && !description ? (
                <pre className="mt-2 max-h-48 overflow-auto rounded border border-base-300 bg-base-100/50 p-2 font-mono text-[10px] text-base-content/75">
                  {payload != null ? JSON.stringify(payload, null, 2) : "(empty)"}
                </pre>
              ) : (
                <details className="mt-2">
                  <summary className="cursor-pointer text-[10px] text-base-content/40">raw</summary>
                  <pre className="mt-1 max-h-48 overflow-auto rounded border border-base-300 bg-base-100/50 p-2 font-mono text-[10px] text-base-content/75">
                    {payload != null ? JSON.stringify(payload, null, 2) : "(empty)"}
                  </pre>
                </details>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function NextStepsListDisplay({ steps, omitHeading = false }) {
  const list = Array.isArray(steps) ? steps : [];
  if (list.length === 0) {
    return (
      <div className={omitHeading ? "" : "mt-4"}>
        {!omitHeading ? (
          <h2 className="text-xs font-semibold uppercase tracking-wide text-base-content/55">Next steps</h2>
        ) : null}
        <p className={`text-sm text-base-content/50 ${omitHeading ? "mt-1" : "mt-1"}`}>None queued.</p>
      </div>
    );
  }

  return (
    <div className={omitHeading ? "" : "mt-4"}>
      {!omitHeading ? (
        <h2 className="text-xs font-semibold uppercase tracking-wide text-base-content/55">
          Next steps ({list.length})
        </h2>
      ) : null}
      <ol
        className={`list-inside list-decimal space-y-2 text-sm text-base-content/85 ${omitHeading ? "mt-1" : "mt-2"}`}
      >
        {list.map((step, i) => {
          const { title, subtitle } = stepDisplayMeta(step);
          return (
            <li key={i} className="rounded-lg border border-base-300 bg-base-200/20 px-3 py-2">
              <span className="font-medium">{title}</span>
              {subtitle ? (
                <p className="mt-1 whitespace-pre-wrap text-xs text-base-content/65">{subtitle}</p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
