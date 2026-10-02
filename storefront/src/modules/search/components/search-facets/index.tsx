import Link from "next/link"

export type FacetGroup = {
  key: string
  title: string
  param: string
  values: { value: string; label: string }[]
  active: string[]
  basePath: string
  persist: Record<string, string | string[]>
}

/**
 * Server-rendered facet sidebar: checkbox rows are plain links toggling one
 * value (page resets, other filters + sort preserved). No counts shown —
 * inventory depth stays private.
 */
function toggleHref(
  basePath: string,
  persist: Record<string, string | string[]>,
  param: string,
  active: string[],
  value: string
) {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(persist)) {
    for (const val of Array.isArray(v) ? v : [v]) {
      if (val) params.append(k, val)
    }
  }
  const next = active.includes(value)
    ? active.filter((v) => v !== value)
    : [...active, value]
  params.delete(param)
  for (const v of next) params.append(param, v)
  const qs = params.toString()
  return qs ? `${basePath}?${qs}` : basePath
}

export default function SearchFacets({ groups }: { groups: FacetGroup[] }) {
  const visible = groups.filter((g) => g.values.length > 0)
  if (!visible.length) return null
  return (
    <div className="d-flex flex-column gap-4">
      {visible.map((g) => (
        <div key={g.key}>
          <div className="menu-heading mb-2">{g.title}</div>
          <ul className="menu-list d-flex flex-column gap-1">
            {g.values.map((v) => {
              const on = g.active.includes(v.value)
              return (
                <li key={v.value} className="menu-item-li">
                  <Link
                    href={toggleHref(
                      g.basePath,
                      g.persist,
                      g.param,
                      g.active,
                      v.value
                    )}
                    className={`menu-link-text d-flex align-items-center gap-2 ${
                      on ? "active fw-6" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      readOnly
                      tabIndex={-1}
                      aria-hidden
                    />
                    {v.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}
