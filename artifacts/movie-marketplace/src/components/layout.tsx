import { Link, useLocation } from "wouter";
import { Film, History, Tv, Clapperboard, LogOut } from "lucide-react";
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
        className="text-sm font-bold px-5 py-2 rounded-full bg-primary text-white hover:bg-primary/90 transition-all shadow-sm shadow-primary/20">
        Sign in
      </Link>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border hover:border-primary/40 hover:bg-primary/5 transition-all text-sm font-medium">
        <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold shadow-sm">
          {user.username[0].toUpperCase()}
        </div>
        <span className="hidden sm:block text-foreground">{user.username}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/40">
            <p className="text-xs font-bold text-foreground">{user.username}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
          <div className="p-1.5">
            <button onClick={() => { logout(); setOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-xl transition">
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

  const navLink = (href: string, label: string, icon?: React.ReactNode) => {
    const active = location === href || (href !== "/" && location.startsWith(href));
    return (
      <Link
        href={href}
        className={`text-sm flex items-center gap-1.5 font-semibold transition-all px-3 py-1.5 rounded-full ${
          active
            ? "text-primary bg-primary/10"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
        }`}
      >
        {icon}
        {label}
      </Link>
    );
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-white/90 backdrop-blur-xl shadow-sm">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center shadow-md shadow-primary/25 group-hover:shadow-lg group-hover:shadow-primary/30 transition-all group-hover:scale-105">
              <Film size={18} className="text-white fill-white" />
            </div>
            <span className="font-black text-xl tracking-tight text-foreground">
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
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {children}
      </main>

      <footer className="border-t border-border py-10 mt-16 bg-white">
        <div className="max-w-[1600px] mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Film size={15} className="text-white fill-white" />
            </div>
            <span className="font-black text-foreground">CineVault</span>
            <span className="text-sm text-muted-foreground">© {new Date().getFullYear()}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Premium cinema downloads · Instant delivery to Telegram
          </p>
        </div>
      </footer>
    </div>
  );
}
