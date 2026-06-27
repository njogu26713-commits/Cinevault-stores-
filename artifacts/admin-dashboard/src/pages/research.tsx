import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Search, Film, Tv, Star, Calendar, Clock, Globe, Users, Clapperboard,
  Sparkles, Tag, TrendingUp, DollarSign, CheckCircle2, ExternalLink,
  AlertCircle, Loader2, ArrowRight, Info
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type MediaType = "movie" | "series";

interface ResearchResult {
  title: string;
  originalTitle?: string;
  overview: string;
  posterUrl: string;
  bannerUrl: string;
  genres: string[];
  releaseDate: string;
  year: number;
  runtime?: string;
  tmdbRating?: number;
  tmdbVoteCount?: number;
  imdbId?: string;
  cast: string[];
  director?: string;
  creators?: string[];
  language: string;
  country: string;
  trailerUrl?: string;
  youtubeTrailerId?: string;
  productionCompany?: string;
  ageRating?: string;
  status?: string;
  tagline?: string;
  keywords?: string[];
  numberOfSeasons?: number;
  numberOfEpisodes?: number;
  seasons?: any[];
  type: MediaType;
  ai?: {
    seoDescription?: string;
    keywords?: string[];
    suggestedPriceKes?: number;
    featured?: boolean;
    trending?: boolean;
    priceRationale?: string;
  };
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="text-muted-foreground min-w-[120px] shrink-0">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export function Research() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [mediaType, setMediaType] = useState<MediaType>("movie");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/admin/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: query.trim(), type: mediaType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Research failed");
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFillForm = () => {
    if (!result) return;
    // Store in localStorage for the form to pick up
    localStorage.setItem("cinevault_prefill", JSON.stringify(result));
    if (result.type === "movie") {
      navigate("/movies/add");
    } else {
      navigate("/series/add");
    }
    toast({ title: "Form pre-filled!", description: "Review the details then upload and publish." });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Search className="w-6 h-6 text-primary" />
          Research Assistant
        </h1>
        <p className="text-muted-foreground mt-1">
          Search any movie or series — auto-fills the form with TMDb data + AI-generated description, keywords, and pricing.
        </p>
      </div>

      {/* Search Box */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="space-y-4">
            {/* Type Toggle */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant={mediaType === "movie" ? "default" : "outline"}
                size="sm"
                onClick={() => setMediaType("movie")}
                className="gap-2"
              >
                <Film className="w-4 h-4" /> Movie
              </Button>
              <Button
                type="button"
                variant={mediaType === "series" ? "default" : "outline"}
                size="sm"
                onClick={() => setMediaType("series")}
                className="gap-2"
              >
                <Tv className="w-4 h-4" /> TV Series
              </Button>
            </div>

            <div className="flex gap-2">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={mediaType === "movie" ? 'e.g. "Avatar: The Way of Water"' : 'e.g. "Wednesday" or "Breaking Bad"'}
                className="flex-1"
                disabled={loading}
                autoFocus
              />
              <Button type="submit" disabled={loading || !query.trim()} className="gap-2 min-w-[120px]">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {loading ? "Searching..." : "Search"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-destructive">Search failed</p>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
              {error.includes("TMDB_API_KEY") && (
                <p className="text-sm mt-2">
                  Get a free key at{" "}
                  <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener noreferrer"
                    className="text-primary underline">
                    themoviedb.org/settings/api
                  </a>
                  {" "}then add it to your Replit Secrets as <code className="bg-muted px-1 rounded text-xs">TMDB_API_KEY</code>.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading skeleton */}
      {loading && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-6 animate-pulse">
              <div className="w-40 h-60 bg-muted rounded-md shrink-0" />
              <div className="flex-1 space-y-3 pt-2">
                <div className="h-6 bg-muted rounded w-2/3" />
                <div className="h-4 bg-muted rounded w-1/3" />
                <div className="h-4 bg-muted rounded w-full" />
                <div className="h-4 bg-muted rounded w-5/6" />
                <div className="h-4 bg-muted rounded w-4/5" />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="space-y-4">
          {/* Hero Card */}
          <Card className="overflow-hidden">
            {result.bannerUrl && (
              <div className="relative h-48 overflow-hidden">
                <img src={result.bannerUrl} alt="banner" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />
              </div>
            )}
            <CardContent className={cn("pt-6", result.bannerUrl && "-mt-20 relative z-10")}>
              <div className="flex gap-5">
                {/* Poster */}
                {result.posterUrl ? (
                  <img
                    src={result.posterUrl}
                    alt={result.title}
                    className="w-32 h-48 object-cover rounded-md border border-border shadow-lg shrink-0"
                  />
                ) : (
                  <div className="w-32 h-48 bg-muted rounded-md flex items-center justify-center shrink-0">
                    {result.type === "movie" ? <Film className="w-8 h-8 text-muted-foreground" /> : <Tv className="w-8 h-8 text-muted-foreground" />}
                  </div>
                )}

                {/* Core Info */}
                <div className="flex-1 min-w-0 space-y-3">
                  <div>
                    <h2 className="text-2xl font-bold leading-tight">{result.title}</h2>
                    {result.originalTitle && (
                      <p className="text-sm text-muted-foreground mt-0.5">Original: {result.originalTitle}</p>
                    )}
                    {result.tagline && <p className="text-sm italic text-muted-foreground mt-1">"{result.tagline}"</p>}
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-2">
                    {result.tmdbRating && (
                      <Badge variant="secondary" className="gap-1">
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                        {result.tmdbRating} TMDb
                      </Badge>
                    )}
                    {result.year && <Badge variant="outline">{result.year}</Badge>}
                    {result.runtime && <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />{result.runtime}</Badge>}
                    {result.ageRating && <Badge variant="outline">{result.ageRating}</Badge>}
                    {result.status && <Badge variant="outline">{result.status}</Badge>}
                    {result.type === "series" && result.numberOfSeasons && (
                      <Badge variant="outline">{result.numberOfSeasons} Season{result.numberOfSeasons !== 1 ? "s" : ""}</Badge>
                    )}
                    {result.type === "series" && result.numberOfEpisodes && (
                      <Badge variant="outline">{result.numberOfEpisodes} Episodes</Badge>
                    )}
                  </div>

                  {/* Genres */}
                  <div className="flex flex-wrap gap-1">
                    {result.genres.map(g => (
                      <Badge key={g} className="text-xs">{g}</Badge>
                    ))}
                  </div>

                  {/* Overview */}
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4">
                    {result.overview}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* People & Production */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="w-4 h-4" /> People & Production
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {result.director && <InfoRow label="Director" value={result.director} />}
                {result.creators && result.creators.length > 0 && (
                  <InfoRow label="Created by" value={result.creators.join(", ")} />
                )}
                <InfoRow label="Cast" value={result.cast.join(", ")} />
                <InfoRow label="Studio" value={result.productionCompany} />
                <InfoRow label="Language" value={result.language} />
                <InfoRow label="Country" value={result.country} />
                {result.trailerUrl && (
                  <div className="flex gap-2 text-sm pt-1">
                    <span className="text-muted-foreground min-w-[120px]">Trailer</span>
                    <a href={result.trailerUrl} target="_blank" rel="noopener noreferrer"
                      className="text-primary flex items-center gap-1 hover:underline font-medium">
                      Watch on YouTube <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* AI Suggestions */}
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" /> AI Suggestions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {result.ai?.suggestedPriceKes !== undefined && (
                  <div className="flex items-center gap-3 p-3 bg-background rounded-md border">
                    <DollarSign className="w-5 h-5 text-green-500" />
                    <div>
                      <p className="font-bold text-lg">KES {result.ai.suggestedPriceKes?.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{result.ai.priceRationale}</p>
                    </div>
                  </div>
                )}
                <div className="flex gap-3">
                  <div className={cn("flex items-center gap-2 text-sm px-3 py-1.5 rounded-full border",
                    result.ai?.featured ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-500" : "border-border text-muted-foreground")}>
                    <Star className="w-3 h-3" /> Featured: {result.ai?.featured ? "Yes" : "No"}
                  </div>
                  <div className={cn("flex items-center gap-2 text-sm px-3 py-1.5 rounded-full border",
                    result.ai?.trending ? "border-blue-500/50 bg-blue-500/10 text-blue-500" : "border-border text-muted-foreground")}>
                    <TrendingUp className="w-3 h-3" /> Trending: {result.ai?.trending ? "Yes" : "No"}
                  </div>
                </div>
                {result.ai?.seoDescription && (
                  <div className="text-sm text-muted-foreground leading-relaxed">
                    <p className="text-xs font-medium text-foreground mb-1">SEO Description:</p>
                    {result.ai.seoDescription}
                  </div>
                )}
                {result.ai?.keywords && result.ai.keywords.length > 0 && (
                  <div>
                    <p className="text-xs font-medium mb-1.5 flex items-center gap-1"><Tag className="w-3 h-3" /> Keywords</p>
                    <div className="flex flex-wrap gap-1">
                      {result.ai.keywords.map(k => (
                        <Badge key={k} variant="secondary" className="text-xs">{k}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {!result.ai && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Info className="w-3 h-3" /> AI enrichment unavailable
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Keywords from TMDb */}
          {result.keywords && result.keywords.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Tag className="w-4 h-4" /> TMDb Keywords / Tags
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1">
                  {result.keywords.slice(0, 20).map(k => (
                    <Badge key={k} variant="outline" className="text-xs">{k}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Series Seasons Preview */}
          {result.type === "series" && result.seasons && result.seasons.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clapperboard className="w-4 h-4" /> Seasons & Episodes
                </CardTitle>
                <CardDescription>{result.numberOfSeasons} seasons · {result.numberOfEpisodes} total episodes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {result.seasons.slice(0, 5).map((s: any) => (
                    <div key={s.seasonNumber} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                      <span className="font-medium">Season {s.seasonNumber}</span>
                      <span className="text-muted-foreground">{s.episodeCount} episodes</span>
                    </div>
                  ))}
                  {result.seasons.length > 5 && (
                    <p className="text-xs text-muted-foreground pt-1">+ {result.seasons.length - 5} more seasons</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* CTA */}
          <Card className="border-primary/40 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="font-semibold">Ready to add <span className="text-primary">"{result.title}"</span>?</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    All details will be pre-filled in the form. Just upload the file and click Publish.
                  </p>
                </div>
                <Button size="lg" onClick={handleFillForm} className="gap-2 shrink-0">
                  Fill {result.type === "movie" ? "Movie" : "Series"} Form
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
