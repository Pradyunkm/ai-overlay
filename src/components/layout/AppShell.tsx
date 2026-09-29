import React, { useState, type ReactNode } from "react";
import { Link, Outlet } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Crosshair,
  ShieldAlert,
  Activity,
  Zap,
  FileText,
  Cpu,
  LineChart,
  Settings,
  UploadCloud,
  Menu,
  X,
  ChevronRight,
  User,
  Clock,
  ExternalLink,
} from "lucide-react";

// ==========================================
// BADGE COMPONENT
// ==========================================
interface BadgeProps {
  label: string;
  tone?: "neon" | "cyan" | "warning" | "violet" | "critical" | string;
  pulse?: boolean;
}

export function Badge({ label, tone = "cyan", pulse = false }: BadgeProps) {
  let toneClass = "";

  switch (tone) {
    case "neon":
      toneClass = "text-[color:var(--neon)] border-[color:var(--neon)]/30 bg-[color:var(--neon)]/10";
      break;
    case "warning":
      toneClass = "text-[color:var(--warning)] border-[color:var(--warning)]/30 bg-[color:var(--warning)]/10";
      break;
    case "violet":
      toneClass = "text-[color:var(--violet)] border-[color:var(--violet)]/30 bg-[color:var(--violet)]/10";
      break;
    case "critical":
      toneClass = "text-[color:var(--critical)] border-[color:var(--critical)]/30 bg-[color:var(--critical)]/10 font-semibold";
      break;
    case "cyan":
    default:
      toneClass = "text-[color:var(--cyan)] border-[color:var(--cyan)]/30 bg-[color:var(--cyan)]/10";
      break;
  }

  const dotColor =
    tone === "neon"
      ? "bg-[color:var(--neon)]"
      : tone === "warning"
      ? "bg-[color:var(--warning)]"
      : tone === "critical"
      ? "bg-[color:var(--critical)]"
      : tone === "violet"
      ? "bg-[color:var(--violet)]"
      : "bg-[color:var(--cyan)]";

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded border text-[10px] uppercase font-mono tracking-wider transition-all select-none ${toneClass}`}
    >
      {pulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColor}`} />
          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${dotColor}`} />
        </span>
      )}
      {label}
    </span>
  );
}

// ==========================================
// PAGEHEADER COMPONENT
// ==========================================
interface PageHeaderProps {
  title: string;
  crumbs?: string[];
}

export function PageHeader({ title, crumbs }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-1 mb-5">
      {crumbs && crumbs.length > 0 && (
        <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground uppercase tracking-widest font-mono">
          {crumbs.map((crumb, idx) => (
            <React.Fragment key={crumb}>
              <span>{crumb}</span>
              {idx < crumbs.length - 1 && <ChevronRight className="size-2 text-muted-foreground/45" />}
            </React.Fragment>
          ))}
        </div>
      )}
      <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-display">
        {title}
      </h1>
    </div>
  );
}

// ==========================================
// PANEL COMPONENT
// ==========================================
interface PanelProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Panel({ title, subtitle, action, className = "", children }: PanelProps) {
  return (
    <section className={`glass rounded-xl overflow-hidden flex flex-col h-full ${className}`}>
      <header className="flex items-center justify-between px-5 py-3.5 border-b border-border/50 bg-white/[0.01]">
        <div>
          <h3 className="section-title">{title}</h3>
          {subtitle && <p className="sub-text text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {action && <div className="flex items-center">{action}</div>}
      </header>
      <div className="p-5 flex-1 min-w-0">{children}</div>
    </section>
  );
}

// ==========================================
// APPSHELL LAYOUT COMPONENT
// ==========================================
interface NavItem {
  label: string;
  to: string;
  icon: React.ElementType;
  description: string;
}

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    to: "/",
    icon: LayoutDashboard,
    description: "Main overview",
  },
  {
    label: "Overlay Analysis",
    to: "/overlay",
    icon: Crosshair,
    description: "Wafer alignment shifts",
  },
  {
    label: "Defect Analytics",
    to: "/defects",
    icon: ShieldAlert,
    description: "AI classification logs",
  },
  {
    label: "Process Health",
    to: "/process",
    icon: Activity,
    description: "Oxidation & drift factors",
  },
  {
    label: "Predictive Analytics",
    to: "/predictive",
    icon: Zap,
    description: "Failure risk metrics",
  },

  {
    label: "Reports",
    to: "/reports",
    icon: FileText,
    description: "Inspection summaries",
  },
  {
    label: "System Monitor",
    to: "/system",
    icon: Cpu,
    description: "Server hardware health",
  },
  {
    label: "Trend Analysis",
    to: "/trends",
    icon: LineChart,
    description: "7-day rolling statistics",
  },
  {
    label: "Upload & Test",
    to: "/upload",
    icon: UploadCloud,
    description: "Run custom inference",
  },
  {
    label: "Settings",
    to: "/settings",
    icon: Settings,
    description: "Platform variables",
  },
];

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background relative overflow-hidden">
      {/* Background Grid Pattern Overlay */}
      <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />

      {/* DESKTOP SIDEBAR */}
      <aside className="hidden lg:flex flex-col w-[260px] shrink-0 border-r border-border bg-panel backdrop-blur-md z-30">
        {/* Sidebar Header */}
        <div className="flex items-center gap-3 px-6 h-16 border-b border-border">
          <div className="size-8 rounded-lg grid place-items-center bg-primary/10 border border-primary/30 glow-cyan animate-pulse">
            <Crosshair className="size-4 text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="font-display font-bold text-sm tracking-wider text-foreground uppercase">
              SDF OVERLAY
            </span>
            <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">
              Wafer Intelligence
            </span>
          </div>
        </div>

        {/* Sidebar Links */}
        <nav className="flex-1 py-4 px-3 overflow-y-auto space-y-1 scrollbar-thin">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg border border-transparent transition-all duration-200 group text-muted-foreground hover:text-foreground hover:bg-white/[0.02]"
                activeProps={{
                  className:
                    "bg-primary/10 text-primary border-primary/20 glow-cyan text-glow-cyan font-medium",
                }}
              >
                <Icon className="size-4 shrink-0 group-hover:scale-105 transition-transform" />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs">{item.label}</span>
                  <span className="text-[8.5px] text-muted-foreground/60 group-hover:text-muted-foreground/85 truncate">
                    {item.description}
                  </span>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-border bg-white/[0.01]">
          <div className="flex items-center gap-3 p-2.5 rounded-lg border border-border/30 bg-panel-2/50 backdrop-blur">
            <div className="size-7 rounded-full bg-white/5 border border-border flex items-center justify-center shrink-0">
              <User className="size-3.5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold text-foreground truncate">Operator Account</div>
              <div className="flex items-center gap-1">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[color:var(--neon)] opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[color:var(--neon)]" />
                </span>
                <span className="text-[8.5px] font-mono text-muted-foreground">RTX 3050 · ONLINE</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* MOBILE DRAWER */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden animate-fade-in">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />

          {/* Drawer Content */}
          <aside className="relative flex flex-col w-[280px] h-full border-r border-border bg-panel backdrop-blur-lg shadow-2xl p-4 animate-slide-in">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-lg grid place-items-center bg-primary/10 border border-primary/30 glow-cyan">
                  <Crosshair className="size-4 text-primary" />
                </div>
                <span className="font-display font-bold text-sm tracking-wider uppercase text-foreground">
                  SDF OVERLAY
                </span>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="size-7 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/5 transition"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Links */}
            <nav className="flex-1 overflow-y-auto space-y-1 pr-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-transparent transition-all group text-muted-foreground hover:text-foreground hover:bg-white/[0.02]"
                    activeProps={{
                      className: "bg-primary/10 text-primary border-primary/20 glow-cyan font-medium",
                    }}
                  >
                    <Icon className="size-4.5 shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs">{item.label}</span>
                      <span className="text-[9px] text-muted-foreground/60 truncate">
                        {item.description}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </nav>

            {/* Footer */}
            <div className="pt-4 border-t border-border mt-4">
              <div className="flex items-center gap-3 p-2 rounded-lg bg-white/5 border border-border/40">
                <User className="size-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-foreground truncate">Operator</div>
                  <div className="text-[9px] font-mono text-[color:var(--neon)]">RTX 3050 · ONLINE</div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 z-10 relative">
        {/* HEADER BAR */}
        <header className="h-16 border-b border-border bg-panel-2/30 backdrop-blur-md flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20">
          <div className="flex items-center gap-4">
            {/* Hamburger button for mobile */}
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden size-9 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/5 transition"
            >
              <Menu className="size-4.5" />
            </button>

            {/* Quick Status Pill */}
            <div className="hidden sm:flex items-center gap-4">
              <Badge label="SYS: DEPLOYED" tone="neon" pulse />
              <div className="text-[11px] font-mono text-muted-foreground/80 flex items-center gap-1.5">
                <Clock className="size-3 text-primary" />
                <span>2.3nm EUV Spec Active</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Stage stable indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/40 bg-white/[0.01] text-[10px] font-mono font-medium text-muted-foreground">
              <span className="size-1.5 rounded-full bg-[color:var(--cyan)] shadow-[0_0_8px_var(--cyan)]" />
              <span>STAGE: STABLE</span>
            </div>

            {/* Account Indicator */}
            <div className="size-8 rounded-full border border-border/60 bg-white/5 flex items-center justify-center shadow-lg hover:border-primary/50 cursor-pointer transition">
              <User className="size-4 text-muted-foreground" />
            </div>
          </div>
        </header>

        {/* PAGE CONTENT CONTAINER */}
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto relative">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
