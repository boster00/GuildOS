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

export function ItemsListDisplay({ items }) {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) return null;

  return (
    <div className="mt-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-base-content/55">Items ({list.length})</h2>
      <div className="mt-2 space-y-2">
        {list.map((item, i) => {
          const key = item?.item_key || `item-${i}`;
          const source = item?.source ? ` — ${item.source}` : "";
          return (
            <details key={`${key}-${i}`} className="rounded-lg border border-base-300 bg-base-200/30">
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-base-content/80">
                <span className="font-mono text-xs">{key}</span>
                <span className="ml-2 text-xs text-base-content/50">{source}</span>
              </summary>
              <pre className="max-h-48 overflow-auto border-t border-base-300 p-3 font-mono text-[10px] text-base-content/75">
                {item?.payload != null ? JSON.stringify(item.payload, null, 2) : "(empty)"}
              </pre>
            </details>
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
