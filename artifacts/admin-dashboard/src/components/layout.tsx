import { Link, useLocation } from "wouter";
import { LayoutDashboard, Film, Tv, ShoppingCart, Users, Settings, Sparkles, Menu, Video, Search, LogOut, Wifi, WifiOff, Flag, Clapperboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

function useMtprotoStatus() {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const res = await fetch("/api/admin/mtproto/status", { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setIsConnected(data.state === "connected");
      } catch {}
    }
    check();
    const interval = setInterval(check, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return isConnected;
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { logout, email } = useAuth();
  const { toast } = useToast();
  const mtprotoConnected = useMtprotoStatus();

  const handleLogout = async () => {
    await logout();
    toast({ title: "Signed out successfully" });
  };

  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Research", href: "/research", icon: Search },
    { name: "Movies", href: "/movies", icon: Film },
    { name: "Series", href: "/series", icon: Tv },
    { name: "Orders", href: "/orders", icon: ShoppingCart },
    { name: "Users", href: "/users", icon: Users },
    { name: "Moderation", href: "/moderation", icon: Flag },
    { name: "Requests", href: "/requests", icon: Clapperboard },
    { name: "Settings", href: "/settings", icon: Settings },
    { name: "AI Features", href: "/ai", icon: Sparkles },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 transform bg-sidebar border-r transition-transform duration-200 ease-in-out md:static md:translate-x-0",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center px-6 border-b border-sidebar-border gap-3">
          <Video className="w-6 h-6 text-primary" />
          <span className="text-lg font-bold tracking-tight text-sidebar-foreground">CineVault Admin</span>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link key={item.name} href={item.href} onClick={() => setIsMobileMenuOpen(false)}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                  data-testid={`nav-${item.name.toLowerCase().replace(" ", "-")}`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {item.name}
                </div>
              </Link>
            );
          })}

          {/* Telegram Connect — with live status dot */}
          <Link href="/telegram" onClick={() => setIsMobileMenuOpen(false)}>
            <div
              className={cn(
                "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer",
                location === "/telegram"
                  ? "bg-primary text-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              {mtprotoConnected ? (
                <Wifi className="w-5 h-5 flex-shrink-0 text-green-500" />
              ) : (
                <WifiOff className="w-5 h-5 flex-shrink-0" />
              )}
              <span className="flex-1">Connect Telegram</span>
              <span
                className={cn(
                  "w-2 h-2 rounded-full flex-shrink-0",
                  mtprotoConnected ? "bg-green-500" : "bg-muted-foreground/40"
                )}
              />
            </div>
          </Link>
        </nav>

        {/* Logout */}
        <div className="border-t border-sidebar-border px-3 py-3">
          <div className="text-xs text-muted-foreground px-3 pb-2 truncate">{email}</div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2 text-sm font-medium rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            Sign out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 flex-shrink-0 items-center justify-between border-b bg-card px-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <Menu className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-semibold">
              {[...navigation, { name: "Connect Telegram", href: "/telegram" }].find(
                (n) => location === n.href || (n.href !== "/" && location.startsWith(n.href))
              )?.name || "Dashboard"}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {/* MTProto status pill in header */}
            <div className={cn(
              "hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium",
              mtprotoConnected
                ? "bg-green-500/10 text-green-600"
                : "bg-muted text-muted-foreground"
            )}>
              <span className={cn("w-1.5 h-1.5 rounded-full", mtprotoConnected ? "bg-green-500" : "bg-muted-foreground/50")} />
              {mtprotoConnected ? "Telegram Connected" : "Telegram Disconnected"}
            </div>
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
              AD
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6 bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
