// Business details shown on the policy pages (/terms, /privacy, /refunds, /contact).
// Cashfree and other Indian payment aggregators check these against your KYC: the legal name,
// address and phone must match what you registered with them. Set them in the environment;
// anything left unset shows as a bracketed placeholder so it's obvious before going live.

const env = (v: string | undefined, fallback: string) => (v && v.trim()) || fallback

export const LEGAL = {
  brand: "Muse-ing",
  /** Registered legal name, e.g. "Muse-ing Entertainment Private Limited" or the proprietor's name */
  legalName: env(process.env.NEXT_PUBLIC_LEGAL_NAME, "Hyphening Marketing LLP"),
  /** Registered / operating address, one line */
  address: env(process.env.NEXT_PUBLIC_LEGAL_ADDRESS, "No. 10, K No. 569/456/10, Brundavan Layout, Kodogehalli Village, Kempegowda International Airport Road, Chikkajala, Bengaluru Urban, Bengaluru, Karnataka 562157"),
  email: env(process.env.NEXT_PUBLIC_SUPPORT_EMAIL, "omkar@hypheningmedia.com"),
  phone: env(process.env.NEXT_PUBLIC_SUPPORT_PHONE, "+91 72781 78402"),
  /** City whose courts have jurisdiction */
  jurisdiction: env(process.env.NEXT_PUBLIC_LEGAL_JURISDICTION, "Bengaluru, Karnataka"),
  hours: "Monday to Saturday, 10:00 to 19:00 IST",
  /** Date the policies last changed; bump it when you edit them */
  updated: "9 November 2026",
}

export const POLICY_LINKS = [
  { label: "Terms & Conditions", href: "/terms" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Refund & Cancellation", href: "/refunds" },
  { label: "Contact Us", href: "/contact" },
] as const
