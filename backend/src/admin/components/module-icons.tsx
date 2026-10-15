import type { ReactNode } from "react";

/**
 * Sidebar icons for the custom admin modules (#17). Inline SVGs on purpose:
 * zero new dependencies (no @medusajs/icons in backend deps), stroke-based
 * so they inherit the sidebar's currentColor in both themes.
 */
function Base({ children }: { children: ReactNode }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const AnalyticsIcon = () => (
  <Base>
    <path d="M4 20V10" />
    <path d="M10 20V4" />
    <path d="M16 20v-7" />
    <path d="M22 20H2" />
  </Base>
);

export const AttentionIcon = () => (
  <Base>
    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </Base>
);

export const PaymentsIcon = () => (
  <Base>
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <path d="M2 10h20" />
  </Base>
);

export const BundlesIcon = () => (
  <Base>
    <path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z" />
    <path d="M4 7.5 12 12l8-4.5" />
    <path d="M12 12v9" />
  </Base>
);

export const CampaignsIcon = () => (
  <Base>
    <path d="M3 11v3l4 1 2 5h2l-1.5-5.5L17 17V7l-7.5 3L3 11Z" />
    <circle cx="17" cy="7" r="2" />
  </Base>
);

export const FlowsIcon = () => (
  <Base>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </Base>
);

export const LoyaltyIcon = () => (
  <Base>
    <path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-3-5.4 3 1.1-6L3.2 9.4l6.1-.8L12 3Z" />
  </Base>
);

export const PreordersIcon = () => (
  <Base>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M8 3v4M16 3v4M3 10h18" />
    <path d="m12 14 2 2 3-3" />
  </Base>
);

export const PricingIcon = () => (
  <Base>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v10M15 9.5c-.6-1-1.7-1.5-3-1.5-1.7 0-3 .9-3 2.2 0 2.9 6 1.4 6 4.3 0 1.3-1.3 2.2-3 2.2-1.3 0-2.4-.5-3-1.5" />
  </Base>
);

export const RedirectsIcon = () => (
  <Base>
    <path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5" />
    <path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5" />
  </Base>
);

export const ReviewsIcon = () => (
  <Base>
    <path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5Z" />
    <path d="m12 8 1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2Z" />
  </Base>
);

export const SeoIcon = () => (
  <Base>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3Z" />
  </Base>
);

export const ShippingIcon = () => (
  <Base>
    <path d="M3 7h11v8H3zM14 10h4l4 4v1h-8" />
    <circle cx="7" cy="17" r="1.6" />
    <circle cx="17" cy="17" r="1.6" />
  </Base>
);

export const SpendIcon = () => (
  <Base>
    <rect x="3" y="6" width="18" height="13" rx="2" />
    <path d="M3 10h18M7 15h4" />
  </Base>
);

/** Lollies wordmark for module headers that want the brand logo. */
export const LolliesMark = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.12" />
    <text
      x="12"
      y="16.5"
      textAnchor="middle"
      fontSize="11"
      fontWeight="700"
      fill="currentColor"
      fontFamily="inherit"
    >
      L
    </text>
  </svg>
);
