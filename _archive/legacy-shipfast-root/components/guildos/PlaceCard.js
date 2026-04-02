import Link from "next/link";

/**
 * @param {{ href: string, title: string, subtitle?: string, children: import('react').ReactNode, icon?: import('react').ReactNode }} props
 */
export default function PlaceCard({ href, title, subtitle, children, icon }) {
  return (
    <Link
      href={href}
      className="card card-border bg-base-100 transition hover:border-primary/40 hover:shadow-md"
    >
      <div className="card-body gap-2 p-4">
        <div className="flex items-start gap-3">
          {icon ? (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              {icon}
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <h3 className="card-title text-base">{title}</h3>
            {subtitle ? (
              <p className="text-xs font-medium uppercase tracking-wide text-base-content/50">
                {subtitle}
              </p>
            ) : null}
          </div>
        </div>
        <div className="text-sm text-base-content/70">{children}</div>
      </div>
    </Link>
  );
}
