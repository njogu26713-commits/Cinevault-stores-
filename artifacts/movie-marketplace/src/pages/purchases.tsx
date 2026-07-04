import { useState } from "react";
import { Link } from "wouter";
import { Layout } from "../components/layout";
import { useGetUserOrders, getGetUserOrdersQueryKey } from "@workspace/api-client-react";
import { Search, Loader2, History, AlertCircle, Play } from "lucide-react";
import { formatKes } from "../lib/utils";

export default function Purchases() {
  const [searchInput, setSearchInput] = useState("");
  const [username, setUsername] = useState<string | null>(
    () => localStorage.getItem("cv_username") || null
  );

  const { data: orders, isLoading, isError } = useGetUserOrders(username ?? "", {
    query: { queryKey: getGetUserOrdersQueryKey(username ?? ""), enabled: !!username },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    let val = searchInput.trim();
    if (val && !val.startsWith('@')) val = '@' + val;
    if (val.length > 2) {
      localStorage.setItem("cv_username", val);
      setUsername(val);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-6 py-12 max-w-4xl">
        <div className="text-center mb-12">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-6 text-muted-foreground">
            <History size={32} />
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-foreground mb-4">Purchase History</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Enter your Telegram username to view all your past movie purchases and delivery status.
          </p>
        </div>

        <form onSubmit={handleSearch} className="relative max-w-xl mx-auto mb-16 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={20} />
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="@username"
            className="w-full bg-card border-2 border-border rounded-2xl py-4 pl-12 pr-32 text-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 transition-all shadow-sm"
          />
          <button
            type="submit"
            className="absolute right-2 top-2 bottom-2 bg-primary hover:bg-primary/90 text-white font-bold px-6 rounded-xl transition-colors"
          >
            Lookup
          </button>
        </form>

        {isLoading && (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        )}

        {isError && (
          <div className="text-center py-12 bg-destructive/10 rounded-2xl border border-destructive/20 text-destructive">
            <AlertCircle className="mx-auto mb-2" size={24} />
            <p>Failed to load orders. Make sure the username is correct.</p>
          </div>
        )}

        {orders && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
              Orders for <span className="text-primary">{username}</span>
              <span className="text-sm font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full ml-2">
                {orders.length} total
              </span>
            </h2>

            {orders.length === 0 ? (
              <div className="text-center py-16 bg-card border border-border rounded-3xl">
                <p className="text-muted-foreground">No purchases found for this account.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {orders.map(order => (
                  <div
                    key={order.id}
                    className="flex flex-col sm:flex-row items-center gap-6 bg-card border border-border p-4 rounded-2xl"
                  >
                    <Link href={`/order/${order.id}`}>
                      <img
                        src={order.moviePosterUrl}
                        className="w-16 h-24 object-cover rounded shadow-md hover:scale-105 transition-transform cursor-pointer"
                        alt={order.movieTitle}
                      />
                    </Link>
                    <div className="flex-1 text-center sm:text-left">
                      <Link href={`/order/${order.id}`}>
                        <h3 className="text-lg font-bold text-foreground mb-1 hover:text-primary transition-colors cursor-pointer">
                          {order.movieTitle}
                        </h3>
                      </Link>
                      <p className="text-sm text-muted-foreground mb-3 sm:mb-0">
                        {new Date(order.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end gap-4 sm:gap-2 w-full sm:w-auto">
                      <div className="font-mono font-bold text-foreground">
                        {formatKes(order.amount)}
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                        order.status === 'delivered' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' :
                        order.status === 'failed' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                        'bg-blue-500/10 text-blue-600 border-blue-500/30'
                      }`}>
                        {order.status.replace('_', ' ')}
                      </div>

                      {order.status === 'delivered' && order.movieId && (
                        <Link
                          href={`/watch/${order.movieId}`}
                          className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors"
                        >
                          <Play size={12} className="fill-current" />
                          Watch
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
