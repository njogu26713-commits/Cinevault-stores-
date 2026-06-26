import { useState, useMemo } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Film, PlayCircle, Loader2 } from "lucide-react";
import { 
  useListMovies, 
  useListFeaturedMovies, 
  useListGenres, 
  useGetMovieStats,
  getListMoviesQueryKey
} from "@workspace/api-client-react";
import { Layout } from "../components/layout";
import { MovieCard } from "../components/movie-card";

export default function Home() {
  const [selectedGenre, setSelectedGenre] = useState<string | undefined>();
  
  const { data: featuredMovies, isLoading: loadingFeatured } = useListFeaturedMovies();
  const { data: genres } = useListGenres();
  const { data: stats } = useGetMovieStats();
  
  const { data: moviesRes, isLoading: loadingMovies } = useListMovies(
    { genre: selectedGenre }, 
    { query: { queryKey: getListMoviesQueryKey({ genre: selectedGenre }) } }
  );

  const heroMovie = featuredMovies?.[0];

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative w-full aspect-[21/9] min-h-[500px] max-h-[800px] bg-background">
        {loadingFeatured ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="animate-spin text-white/20" size={32} />
          </div>
        ) : heroMovie ? (
          <>
            <div className="absolute inset-0 select-none">
              <img 
                src={heroMovie.bannerUrl || heroMovie.posterUrl} 
                alt={heroMovie.title}
                className="w-full h-full object-cover object-top opacity-50"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-background via-background/60 to-transparent" />
            </div>
            
            <div className="absolute inset-0 flex items-center">
              <div className="container mx-auto px-4">
                <motion.div 
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="max-w-2xl"
                >
                  <div className="flex gap-2 mb-4">
                    <span className="px-2 py-0.5 rounded bg-primary/20 text-primary text-xs font-bold uppercase border border-primary/20">Featured</span>
                    <span className="px-2 py-0.5 rounded bg-white/10 text-white/80 text-xs font-bold uppercase">{heroMovie.quality}</span>
                  </div>
                  <h1 className="text-5xl md:text-7xl font-black text-white leading-tight mb-4 drop-shadow-2xl">
                    {heroMovie.title}
                  </h1>
                  <p className="text-lg text-white/70 mb-8 line-clamp-3 leading-relaxed max-w-xl">
                    {heroMovie.description}
                  </p>
                  <div className="flex items-center gap-4">
                    <Link href={`/movie/${heroMovie.id}`} className="bg-primary hover:bg-primary/90 text-white font-bold py-3 px-8 rounded-lg flex items-center gap-2 transition-transform hover:scale-105 active:scale-95 shadow-lg shadow-primary/25">
                      <PlayCircle size={20} />
                      View Details
                    </Link>
                  </div>
                </motion.div>
              </div>
            </div>
          </>
        ) : null}
      </section>

      {/* Main Content */}
      <section className="container mx-auto px-4 py-12 -mt-12 relative z-10">
        
        {/* Stats & Genres */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Explore the Vault</h2>
            {stats && (
              <p className="text-sm text-white/50">
                {stats.total} premium films available for instant download
              </p>
            )}
          </div>
          
          {/* Genre Pills */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
            <button
              onClick={() => setSelectedGenre(undefined)}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
                !selectedGenre 
                  ? 'bg-white text-black border-white' 
                  : 'bg-card text-white/70 border-white/10 hover:bg-white/10 hover:text-white'
              }`}
            >
              All Movies
            </button>
            {genres?.map(genre => (
              <button
                key={genre}
                onClick={() => setSelectedGenre(genre)}
                className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors border flex items-center gap-2 ${
                  selectedGenre === genre 
                    ? 'bg-white text-black border-white' 
                    : 'bg-card text-white/70 border-white/10 hover:bg-white/10 hover:text-white'
                }`}
              >
                {genre}
                {stats?.byGenre[genre] && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${selectedGenre === genre ? 'bg-black/10' : 'bg-white/10'}`}>
                    {stats.byGenre[genre]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Movie Grid */}
        {loadingMovies ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="animate-spin text-primary" size={40} />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
            {moviesRes?.movies.map((movie, i) => (
              <MovieCard key={movie.id} movie={movie} index={i} />
            ))}
            {moviesRes?.movies.length === 0 && (
              <div className="col-span-full py-20 text-center text-white/50">
                <Film size={48} className="mx-auto mb-4 opacity-20" />
                <p>No movies found for this selection.</p>
              </div>
            )}
          </div>
        )}

      </section>
    </Layout>
  );
}
