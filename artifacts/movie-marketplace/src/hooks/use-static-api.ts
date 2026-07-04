/**
 * Static drop-in replacements for @workspace/api-client-react hooks.
 * Returns hardcoded data so the marketplace works without the API server.
 */
import type { Movie, MovieStats, Order, Series } from "@workspace/api-client-react";
import { STATIC_MOVIES, STATIC_SERIES } from "../data/movies";

// ── Movies ────────────────────────────────────────────────────────────────────

export function useListMovies(
  params?: { genre?: string; search?: string; limit?: number },
  _opts?: unknown
) {
  let movies = STATIC_MOVIES.filter((m) => !m.comingSoon);
  if (params?.genre) movies = movies.filter((m) => m.genre.includes(params.genre!));
  if (params?.search) {
    const q = params.search.toLowerCase();
    movies = movies.filter((m) => m.title.toLowerCase().includes(q));
  }
  if (params?.limit) movies = movies.slice(0, params.limit);
  return {
    data: { movies, total: movies.length, page: 1, totalPages: 1 },
    isLoading: false,
    isError: false,
  };
}

export function useListFeaturedMovies(_opts?: unknown) {
  return {
    data: STATIC_MOVIES.filter((m) => m.featured && !m.comingSoon),
    isLoading: false,
    isError: false,
  };
}

export function useListGenres(_opts?: unknown) {
  const genres = Array.from(new Set(STATIC_MOVIES.flatMap((m: Movie) => m.genre))).sort();
  return { data: genres, isLoading: false, isError: false };
}

export function useGetMovieStats(_opts?: unknown) {
  const byGenre: Record<string, number> = {};
  const byQuality: Record<string, number> = {};
  STATIC_MOVIES.filter((m) => !m.comingSoon).forEach((m) => {
    m.genre.forEach((g: string) => { byGenre[g] = (byGenre[g] ?? 0) + 1; });
    byQuality[m.quality] = (byQuality[m.quality] ?? 0) + 1;
  });
  const stats: MovieStats = {
    total: STATIC_MOVIES.filter((m) => !m.comingSoon).length,
    byGenre,
    byQuality,
  };
  return { data: stats, isLoading: false, isError: false };
}

export function useListComingSoonMovies(_opts?: unknown) {
  return { data: STATIC_MOVIES.filter((m) => m.comingSoon), isLoading: false, isError: false };
}

export function useGetMovie(id: string, _opts?: unknown) {
  const movie: Movie | undefined = STATIC_MOVIES.find((m) => m.id === id);
  return { data: movie, isLoading: false, isError: false };
}

// Query key helpers
export function getListMoviesQueryKey(params?: unknown) {
  return ["static-movies", params] as const;
}

export function getGetMovieQueryKey(id: string) {
  return ["static-movie", id] as const;
}

// ── Series ────────────────────────────────────────────────────────────────────

export function useListSeries(
  params?: { genre?: string; search?: string; status?: string; quality?: string; limit?: number },
  _opts?: unknown
) {
  let series = STATIC_SERIES.filter((s) => !s.comingSoon);
  if (params?.genre) series = series.filter((s) => s.genre.includes(params.genre!));
  if (params?.status) series = series.filter((s) => s.status === params.status);
  if (params?.search) {
    const q = params.search.toLowerCase();
    series = series.filter((s) => s.title.toLowerCase().includes(q));
  }
  if (params?.limit) series = series.slice(0, params.limit);
  return {
    data: { series, total: series.length, page: 1, totalPages: 1 },
    isLoading: false,
    isError: false,
  };
}

export function useListSeriesGenres(_opts?: unknown) {
  const genres = Array.from(new Set(STATIC_SERIES.flatMap((s: Series) => s.genre))).sort();
  return { data: genres, isLoading: false, isError: false };
}

export function useListComingSoonSeries(_opts?: unknown) {
  return { data: STATIC_SERIES.filter((s) => s.comingSoon), isLoading: false, isError: false };
}

export function useGetSeries(id: string, _opts?: unknown) {
  const series: Series | undefined = STATIC_SERIES.find((s) => s.id === id);
  return { data: series, isLoading: false, isError: false };
}

export function getListSeriesQueryKey(params?: unknown) {
  return ["static-series", params] as const;
}

export function getGetSeriesQueryKey(id: string) {
  return ["static-series-item", id] as const;
}

// ── Orders (stub — no server) ─────────────────────────────────────────────────

export function useCreateOrder() {
  return {
    mutate(
      _data: unknown,
      opts?: {
        onSuccess?: (order: Order) => void;
        onError?: (e: Error) => void;
      }
    ) {
      opts?.onError?.(new Error("Payment is not available in preview mode."));
    },
    isPending: false,
  };
}

export function useGetOrder(_id: string, _opts?: unknown) {
  return { data: undefined as Order | undefined, isLoading: false, isError: false };
}

export function useGetUserOrders(_telegramUsername: string, _opts?: unknown) {
  return {
    data: [] as Order[],
    isLoading: false,
    isError: false,
  };
}

export function getGetUserOrdersQueryKey(telegramUsername: string) {
  return ["static-user-orders", telegramUsername] as const;
}

export function getGetOrderQueryKey(id: string) {
  return ["static-order", id] as const;
}
