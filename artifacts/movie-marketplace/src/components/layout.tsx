import { Link, useLocation } from "wouter";
import { Film, History } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="bg-primary text-white p-1.5 rounded-lg group-hover:scale-105 transition-transform">
              <Film size={20} className="fill-current" />
            </div>
            <span className="font-bold text-xl tracking-tight text-foreground">
              Cine<span className="text-primary">Vault</span>
            </span>
          </Link>

          <nav className="flex items-center gap-6">
            <Link
              href="/"
              className={`text-sm font-medium transition-colors hover:text-primary ${location === '/' ? 'text-foreground' : 'text-muted-foreground'}`}
            >
              Browse
            </Link>
            <Link
              href="/purchases"
              className={`text-sm flex items-center gap-1.5 font-medium transition-colors hover:text-primary ${location === '/purchases' ? 'text-foreground' : 'text-muted-foreground'}`}
            >
              <History size={16} />
              Purchases
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {children}
      </main>

      <footer className="border-t border-border py-8 mt-12 bg-card">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
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
  );
}
