import { useState, useEffect, useRef } from "react";
import { Search, X, Film, Tv } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TmdbResult {
  id: string;
  title: string;
  year: string;
  posterUrl: string | null;
}

interface Props {
  value: string;
  onChange: (id: string) => void;
  type: "movie" | "tv";
  label?: string;
}

export function TmdbSearchField({ value, onChange, type, label }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TmdbResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/admin/research/tmdb-search?q=${encodeURIComponent(query)}&type=${type}`);
        const data = await res.json();
        if (!res.ok) { setError(data.error || "Search failed"); setResults([]); }
        else { setResults(data); setOpen(data.length > 0); }
      } catch {
        setError("Search failed");
      } finally {
        setLoading(false);
      }
    }, 350);
  }, [query, type]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = (result: TmdbResult) => {
    onChange(result.id);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  const clear = () => { onChange(""); setQuery(""); setResults([]); setOpen(false); };

  return (
    <div className="space-y-1.5" ref={containerRef}>
      <Label>{label ?? (type === "tv" ? "TMDB ID (for VidSrc fallback)" : "TMDB ID (for VidSrc fallback)")}</Label>

      {value ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md border bg-muted text-sm">
          {type === "tv" ? <Tv className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <Film className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
          <span className="flex-1 font-mono text-xs text-foreground">{value}</span>
          <button type="button" onClick={clear} className="text-muted-foreground hover:text-destructive transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder={`Search ${type === "tv" ? "series" : "movie"} title…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            className="pl-9 text-sm"
          />
          {loading && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground animate-pulse">Searching…</span>
          )}
          {open && results.length > 0 && (
            <div className="absolute z-50 top-full mt-1 w-full rounded-md border bg-popover shadow-lg overflow-hidden">
              {results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => select(r)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-accent transition-colors"
                >
                  {r.posterUrl ? (
                    <img src={r.posterUrl} alt="" className="w-8 h-12 object-cover rounded shrink-0 bg-muted" />
                  ) : (
                    <div className="w-8 h-12 rounded bg-muted shrink-0 flex items-center justify-center">
                      {type === "tv" ? <Tv className="w-4 h-4 text-muted-foreground" /> : <Film className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.title}</p>
                    <p className="text-xs text-muted-foreground">ID: {r.id}{r.year ? ` · ${r.year}` : ""}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
      <p className="text-[11px] text-muted-foreground">
        If no Telegram file is attached, the player streams via VidSrc using this ID.
        {!value && " Start typing to search TMDB."}
      </p>
    </div>
  );
}
