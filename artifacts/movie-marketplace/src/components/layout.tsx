import { Link, useLocation } from "wouter";
import { Film, History, Tv, Clapperboard, LogOut, User } from "lucide-react";
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
        className="text-sm font-semibold px-4 py-1.5 rounded-lg bg-primary text-white hover:bg-primary/90 transition">
        Sign in
      </Link>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50 transition text-sm font-medium">
        <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">
          {user.username[0].toUpperCase()}
        </div>
        <span className="hidden sm:block text-foreground">{user.username}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-44 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="px-3 py-2.5 border-b border-border">
            <p className="text-xs font-semibold text-foreground">{user.username}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
          <div className="p-1">
            <button onClick={() => { logout(); setOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition">
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
        className={`text-sm flex items-center gap-1.5 font-medium transition-colors hover:text-primary ${active ? "text-primary" : "text-muted-foreground"}`}
      >
        {icon}
        {label}
      </Link>
    );
  };

  return (
    <div className="min-h-[100dvh] bg-background px-2 sm:px-3 lg:px-5">
    <div className="min-h-[100dvh] flex flex-col max-w-[1600px] mx-auto overflow-hidden rounded-sm shadow-xl">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="bg-primary text-white p-1.5 rounded-lg group-hover:scale-105 transition-transform">
              <Film size={20} className="fill-current" />
            </div>
            <span className="font-bold text-xl tracking-tight text-foreground">
              Cine<span className="text-primary">Vault</span>
            </span>
          </Link>

          <nav className="flex items-center gap-5">
            {navLink("/", "Movies")}
            {navLink("/series", "Series", <Tv size={15} />)}
            {navLink("/requests", "Requests", <Clapperboard size={15} />)}
            {user && navLink("/purchases", "Purchases", <History size={15} />)}
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

      <footer className="border-t border-border py-8 mt-12 bg-card">
        <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Film size={18} />
            <span className="font-semibold text-foreground">CineVault</span>
            <span className="text-sm">© {new Date().getFullYear()}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Premium cinema downloads. Instant delivery to Telegram.
          </p>
        </div>
      </footer>
    </div>
    </div>
  );
}
