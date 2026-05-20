import type { Metadata } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const brandMono = IBM_Plex_Mono({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: {
    default: "Northwall - Agentic AppSec Orchestration",
    template: "%s | Northwall",
  },
  description:
    "Northwall runs AppSec missions with specialist AI agents, parallel MoE orchestration, application security knowledge graphs, human approval gates, and owner-ready remediation handoff.",
  keywords: [
    "agentic AppSec orchestration",
    "AI application security",
    "multi-agent security",
    "AppSec knowledge graph",
    "parallel security agents",
    "MoE agents",
    "AI code security",
    "application security automation",
    "security remediation workflow",
    "owner-ready remediation",
    "GitHub security review",
    "dependency reachability",
    "CI/CD security",
    "OWASP ASVS",
    "CWE",
    "CVSS",
    "EPSS",
    "SBOM",
    "SAST",
    "SCA",
  ],
  openGraph: {
    title: "Northwall - Agentic AppSec Orchestration",
    description:
      "Build an AppSec knowledge graph, dispatch parallel specialist AI agents, approve governed missions, and send owner-ready remediation work.",
    siteName: "Northwall",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Northwall - Agentic AppSec Orchestration",
    description:
      "Specialist AI agents, AppSec knowledge graphs, parallel investigation, human approval, and owner-ready remediation handoff.",
  },
  icons: [{ rel: "icon", url: "/favicon.svg", type: "image/svg+xml" }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${brandMono.variable}`}>
      <body className="antialiased font-sans">{children}</body>
    </html>
  );
}
