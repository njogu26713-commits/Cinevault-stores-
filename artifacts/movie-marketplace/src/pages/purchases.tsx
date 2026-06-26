import { useState } from "react";
import { Link } from "wouter";
import { Layout } from "../components/layout";
import { useGetUserOrders, getGetUserOrdersQueryKey } from "@workspace/api-client-react";
import { Search, Loader2, History, AlertCircle } from "lucide-react";
import { formatKes } from "../lib/utils";

export default function Purchases() {
  const [searchInput, setSearchInput] = useState("");
  const [username, setUsername] = useState<string | null>(null);

  const { data: orders, isLoading, isError } = useGetUserOrders(username!, {
    query: { 
      enabled: !!username,
      queryKey: getGetUserOrdersQueryKey(username!)
    }
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    let val = searchInput.trim();
    if (val && !val.startsWith('@')) val = '@' + val;
    if (val.length > 2) {
      setUsername(val);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="text-center mb-12">
          <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 text-white/50">
            <History size={32} />
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-white mb-4">Purchase History</h1>
          <p className="text-white/50 max-w-md mx-auto">
            Enter your Telegram username to view all your past movie purchases and delivery status.
          </p>
        </div>

        <form onSubmit={handleSearch} className="relative max-w-xl mx-auto mb-16 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-primary transition-colors" size={20} />
          <input 
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="@username"
            className="w-full bg-card border-2 border-white/5 rounded-2xl py-4 pl-12 pr-32 text-lg text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50 focus:bg-background transition-all shadow-xl"
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
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              Orders for <span className="text-primary">{username}</span>
              <span className="text-sm font-normal text-white/40 bg-white/5 px-2 py-0.5 rounded-full ml-2">
                {orders.length} total
              </span>
            </h2>
            
            {orders.length === 0 ? (
              <div className="text-center py-16 bg-card border border-white/5 rounded-3xl">
                <p className="text-white/50">No purchases found for this account.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {orders.map(order => (
                  <Link 
                    key={order.id} 
                    href={`/order/${order.id}`}
                    className="flex flex-col sm:flex-row items-center gap-6 bg-card border border-white/5 hover:border-white/10 hover:bg-white/[0.02] p-4 rounded-2xl transition-all group"
                  >
                    <img 
                      src={order.moviePosterUrl} 
                      className="w-16 h-24 object-cover rounded shadow-lg group-hover:scale-105 transition-transform"
                      alt={order.movieTitle}
                    />
                    <div className="flex-1 text-center sm:text-left">
                      <h3 className="text-lg font-bold text-white mb-1">{order.movieTitle}</h3>
                      <p className="text-sm text-white/50 mb-3 sm:mb-0">
                        {new Date(order.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    </div>
                    
                    <div className="flex sm:flex-col items-center sm:items-end gap-4 sm:gap-2 w-full sm:w-auto">
                      <div className="font-mono font-bold text-white">
                        {formatKes(order.amount)}
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${
                        order.status === 'delivered' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        order.status === 'failed' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                        'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      }`}>
                        {order.status.replace('_', ' ')}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </Layout>
  );
}
