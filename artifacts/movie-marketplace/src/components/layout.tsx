import { Link, useLocation } from "wouter";
import { Film, History, Tv, Clapperboard, LogOut, Menu, X } from "lucide-react";
import { NotificationBell } from "./notification-bell";
import { useUserAuth } from "../contexts/user-auth";
import { useState, useRef, useEffect } from "react";

function UserMenu() {
  const { user, logout } = useUserAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!user) {
    return (
      <Link href="/login"
        className="text-sm font-bold px-5 py-2 rounded-full bg-primary text-white hover:bg-primary/90 transition-all shadow-md shadow-primary/20">
        Sign in
      </Link>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 hover:border-white/25 hover:bg-white/8 transition-all text-sm font-medium">
        <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold shadow-sm">
          {user.username[0].toUpperCase()}
        </div>
        <span className="hidden sm:block text-white/80">{user.username}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/8 bg-white/4">
            <p className="text-xs font-bold text-white">{user.username}</p>
            <p className="text-xs text-white/40 truncate">{user.email}</p>
          </div>
          <div className="p-1.5">
            <button onClick={() => { logout(); setOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-white/50 hover:text-white hover:bg-white/6 rounded-xl transition">
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user } = useUserAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLink = (href: string, label: string, icon?: React.ReactNode) => {
    const active = location === href || (href !== "/" && location.startsWith(href));
    return (
      <Link
        href={href}
        onClick={() => setMobileOpen(false)}
        className={`text-sm flex items-center gap-1.5 font-semibold transition-all px-3 py-1.5 rounded-full ${
          active
            ? "text-white bg-white/12"
            : "text-white/60 hover:text-white hover:bg-white/8"
        }`}
      >
        {icon}
        {label}
      </Link>
    );
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className={`fixed top-0 z-50 w-full transition-all duration-500 ${
        scrolled
          ? "bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/6 shadow-2xl"
          : "bg-gradient-to-b from-black/70 to-transparent border-transparent"
      }`}
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/30 group-hover:shadow-primary/50 transition-all group-hover:scale-105">
              <Film size={18} className="text-white fill-white" />
            </div>
            <span className="font-black text-xl tracking-tight text-white">
              Cine<span className="text-primary">Vault</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navLink("/", "Movies")}
            {navLink("/series", "Series", <Tv size={14} />)}
            {navLink("/requests", "Requests", <Clapperboard size={14} />)}
            {user && navLink("/purchases", "Purchases", <History size={14} />)}
          </nav>

          <div className="flex items-center gap-2">
            <NotificationBell />
            <UserMenu />
            <button
              className="md:hidden w-9 h-9 flex items-center justify-center rounded-full border border-white/15 text-white/70 hover:text-white hover:bg-white/8 transition"
              onClick={() => setMobileOpen(o => !o)}
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="md:hidden bg-[#0a0a0a]/98 backdrop-blur-xl border-t border-white/8 px-6 py-4 flex flex-col gap-1">
            {navLink("/", "Movies")}
            {navLink("/series", "Series", <Tv size={14} />)}
            {navLink("/requests", "Requests", <Clapperboard size={14} />)}
            {user && navLink("/purchases", "Purchases", <History size={14} />)}
          </div>
        )}
      </header>

      <main className="flex-1 flex flex-col" style={{ paddingTop: "calc(4rem + env(safe-area-inset-top))" }}>
        {children}
      </main>

      <footer className="border-t border-white/8 py-10 mt-16 bg-[#0a0a0a]"
        style={{ paddingBottom: "calc(2.5rem + env(safe-area-inset-bottom))" }}
      >
        <div className="max-w-[1600px] mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Film size={15} className="text-white fill-white" />
            </div>
            <span className="font-black text-white">CineVault</span>
            <span className="text-sm text-white/30">© {new Date().getFullYear()}</span>
          </div>
          <p className="text-sm text-white/30">
            Premium cinema downloads · Instant delivery to Telegram
          </p>
        </div>
      </footer>
    </div>
  );
}
