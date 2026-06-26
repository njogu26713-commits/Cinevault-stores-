import { Router } from "express";
import { Movie } from "../models/Movie";
import { Series } from "../models/Series";

const router = Router();

const SEED_MOVIES = [
  {
    title: "The Dark Knight",
    description:
      "When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological and physical tests of his ability to fight injustice.",
    posterUrl: "https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg",
    bannerUrl: "https://image.tmdb.org/t/p/original/hkBaDkMWbLaf8B1lsWsYL5dF5cq.jpg",
    youtubeTrailerId: "EXeTwQWrcwY",
    genre: ["Action", "Crime", "Drama"],
    duration: "2h 32m",
    quality: "4K" as const,
    fileSize: "18.2 GB",
    price: 500,
    featured: true,
    rating: 9.0,
    year: 2008,
    telegramFileId: null,
  },
  {
    title: "Inception",
    description:
      "A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.",
    posterUrl: "https://image.tmdb.org/t/p/w500/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg",
    bannerUrl: "https://image.tmdb.org/t/p/original/s3TBrRGB1iav7gFOCNx3H31MoES.jpg",
    youtubeTrailerId: "YoHD9XEInc0",
    genre: ["Action", "Sci-Fi", "Thriller"],
    duration: "2h 28m",
    quality: "1080p" as const,
    fileSize: "8.4 GB",
    price: 350,
    featured: true,
    rating: 8.8,
    year: 2010,
    telegramFileId: null,
  },
  {
    title: "Interstellar",
    description:
      "A team of explorers travel through a wormhole in space in an attempt to ensure humanity's survival.",
    posterUrl: "https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
    bannerUrl: "https://image.tmdb.org/t/p/original/rAiYTfKGqDCRIIqo664sY9XZIvQ.jpg",
    youtubeTrailerId: "zSWdZVtXT7E",
    genre: ["Adventure", "Drama", "Sci-Fi"],
    duration: "2h 49m",
    quality: "4K" as const,
    fileSize: "22.1 GB",
    price: 500,
    featured: true,
    rating: 8.6,
    year: 2014,
    telegramFileId: null,
  },
  {
    title: "Black Panther",
    description:
      "T'Challa, heir to the hidden but advanced kingdom of Wakanda, must step forward to lead his people into a new future and must confront a challenger from his country's past.",
    posterUrl: "https://image.tmdb.org/t/p/w500/uxzzxijgPIY7slzFvMotPv8wjKA.jpg",
    bannerUrl: "https://image.tmdb.org/t/p/original/6ELCZlTA5lGUops70hKdB83WJxH.jpg",
    youtubeTrailerId: "xjDjIWPwcPU",
    genre: ["Action", "Adventure", "Sci-Fi"],
    duration: "2h 14m",
    quality: "1080p" as const,
    fileSize: "9.2 GB",
    price: 350,
    featured: false,
    rating: 7.3,
    year: 2018,
    telegramFileId: null,
  },
  {
    title: "The Lion King",
    description:
      "After the murder of his father, a young lion prince flees his kingdom only to learn the true meaning of responsibility and bravery.",
    posterUrl: "https://image.tmdb.org/t/p/w500/2bXbqYdUdNVa8VIWXVfclP2ICtT.jpg",
    bannerUrl: "https://image.tmdb.org/t/p/original/5E0e6eMW4cGQMHdVRoHVxKz0Vl0.jpg",
    youtubeTrailerId: "7TavVZMewpY",
    genre: ["Animation", "Adventure", "Drama"],
    duration: "1h 28m",
    quality: "1080p" as const,
    fileSize: "5.8 GB",
    price: 250,
    featured: false,
    rating: 8.5,
    year: 1994,
    telegramFileId: null,
  },
  {
    title: "Avengers: Endgame",
    description:
      "After the devastating events of Infinity War, the Avengers assemble once more to reverse the actions of Thanos and restore balance to the universe.",
    posterUrl: "https://image.tmdb.org/t/p/w500/or06FN3Dka5tukK1e9sl16pB3iy.jpg",
    bannerUrl: "https://image.tmdb.org/t/p/original/7RyHsO4yDXtBv1zUU3mTpHeQ0d5.jpg",
    youtubeTrailerId: "TcMBFSGVi1c",
    genre: ["Action", "Adventure", "Drama"],
    duration: "3h 1m",
    quality: "4K" as const,
    fileSize: "25.6 GB",
    price: 500,
    featured: false,
    rating: 8.4,
    year: 2019,
    telegramFileId: null,
  },
  {
    title: "Parasite",
    description:
      "Greed and class discrimination threaten the newly formed symbiotic relationship between the wealthy Park family and the destitute Kim clan.",
    posterUrl: "https://image.tmdb.org/t/p/w500/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg",
    bannerUrl: "https://image.tmdb.org/t/p/original/apnyF7Q6UCzDFJGatXBJyXrVJTp.jpg",
    youtubeTrailerId: "5xH0HfJHsaY",
    genre: ["Comedy", "Drama", "Thriller"],
    duration: "2h 12m",
    quality: "1080p" as const,
    fileSize: "7.1 GB",
    price: 300,
    featured: false,
    rating: 8.6,
    year: 2019,
    telegramFileId: null,
  },
  {
    title: "Spider-Man: No Way Home",
    description:
      "With Spider-Man's identity now revealed, our friendly neighbourhood web-slinger is unmasked and no longer able to separate his normal life from his superhero life.",
    posterUrl: "https://image.tmdb.org/t/p/w500/1g0dhYtq4irTY1GPXvft6k4YLjm.jpg",
    bannerUrl: "https://image.tmdb.org/t/p/original/14QbnygCuTO0vl7CAFmPf1fgZfV.jpg",
    youtubeTrailerId: "JfVOs4VSpmA",
    genre: ["Action", "Adventure", "Fantasy"],
    duration: "2h 28m",
    quality: "1080p" as const,
    fileSize: "8.9 GB",
    price: 350,
    featured: false,
    rating: 8.2,
    year: 2021,
    telegramFileId: null,
  },
  {
    title: "Dune",
    description:
      "A noble family becomes embroiled in a war for control over the galaxy's most valuable asset while its heir becomes troubled by visions of a dark future.",
    posterUrl: "https://image.tmdb.org/t/p/w500/d5NXSklpcvwE6GQxt0c04psqVP1.jpg",
    bannerUrl: "https://image.tmdb.org/t/p/original/jYEW5xZkZk2WTrdbMGAPFuBqbDc.jpg",
    youtubeTrailerId: "8g18jFHCLXk",
    genre: ["Adventure", "Drama", "Sci-Fi"],
    duration: "2h 35m",
    quality: "4K" as const,
    fileSize: "19.3 GB",
    price: 450,
    featured: true,
    rating: 8.0,
    year: 2021,
    telegramFileId: null,
  },
  {
    title: "Top Gun: Maverick",
    description:
      "After more than thirty years of service as one of the Navy's top aviators, Pete Mitchell is where he belongs, pushing the envelope as a courageous test pilot.",
    posterUrl: "https://image.tmdb.org/t/p/w500/62HCnUTHJl9VZVABUlGXcPnwnde.jpg",
    bannerUrl: "https://image.tmdb.org/t/p/original/AkJQpZp9WoNdj7pLYSj1L0RcMMN.jpg",
    youtubeTrailerId: "giXco2jaZ_4",
    genre: ["Action", "Drama"],
    duration: "2h 11m",
    quality: "4K" as const,
    fileSize: "16.8 GB",
    price: 450,
    featured: false,
    rating: 8.2,
    year: 2022,
    telegramFileId: null,
  },
  {
    title: "Everything Everywhere All at Once",
    description:
      "An aging Chinese immigrant is swept up in an insane adventure, where she alone can save the world by exploring other universes connecting with the lives she could have led.",
    posterUrl: "https://image.tmdb.org/t/p/w500/w3LxiVYdWWRvEVdn5RYq6jIqkb1.jpg",
    bannerUrl: "https://image.tmdb.org/t/p/original/ss0Os3uWJfQAENILHZUdX8Tt1OC.jpg",
    youtubeTrailerId: "wxN1T1uxQ2g",
    genre: ["Action", "Adventure", "Comedy"],
    duration: "2h 19m",
    quality: "1080p" as const,
    fileSize: "7.6 GB",
    price: 300,
    featured: false,
    rating: 8.0,
    year: 2022,
    telegramFileId: null,
  },
  {
    title: "The Godfather",
    description:
      "The aging patriarch of an organized crime dynasty transfers control of his clandestine empire to his reluctant son.",
    posterUrl: "https://image.tmdb.org/t/p/w500/3bhkrj58Vtu7enYsLori8pJkiuA.jpg",
    bannerUrl: "https://image.tmdb.org/t/p/original/tmU7GeKVybMWFButWEGl2M4GeiP.jpg",
    youtubeTrailerId: "sY1S34973zA",
    genre: ["Crime", "Drama"],
    duration: "2h 55m",
    quality: "720p" as const,
    fileSize: "3.2 GB",
    price: 200,
    featured: false,
    rating: 9.2,
    year: 1972,
    telegramFileId: null,
  },
];

const makeEpisodes = (count: number, durationMin = 50) =>
  Array.from({ length: count }, (_, i) => ({
    episodeNumber: i + 1,
    title: `Episode ${i + 1}`,
    duration: `${durationMin}m`,
    telegramFileId: null,
  }));

const SEED_SERIES = [
  {
    title: "Breaking Bad",
    description:
      "A high school chemistry teacher diagnosed with inoperable lung cancer turns to manufacturing and selling methamphetamine in order to secure his family's future.",
    posterUrl: "https://image.tmdb.org/t/p/w500/ggFHVNu6YYI5L9pCfOacjizRGt.jpg",
    bannerUrl: "https://image.tmdb.org/t/p/original/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg",
    youtubeTrailerId: "HhesaQXLuRY",
    genre: ["Crime", "Drama", "Thriller"],
    quality: "4K" as const,
    rating: 9.5,
    year: 2008,
    status: "Completed" as const,
    featured: true,
    pricePerSeason: 400,
    seasons: [
      { seasonNumber: 1, episodes: makeEpisodes(7, 48) },
      { seasonNumber: 2, episodes: makeEpisodes(13, 47) },
      { seasonNumber: 3, episodes: makeEpisodes(13, 48) },
      { seasonNumber: 4, episodes: makeEpisodes(13, 49) },
      { seasonNumber: 5, episodes: makeEpisodes(16, 55) },
    ],
  },
  {
    title: "Stranger Things",
    description:
      "When a young boy disappears, his mother, a police chief and his friends must confront terrifying supernatural forces in order to get him back.",
    posterUrl: "https://image.tmdb.org/t/p/w500/49WJfeN0moxb9IPfGn8AIqMGskD.jpg",
    bannerUrl: "https://image.tmdb.org/t/p/original/56v2KjBlU4XaOv9rVYEQypROD7P.jpg",
    youtubeTrailerId: "b9EkMc79ZSU",
    genre: ["Drama", "Fantasy", "Horror"],
    quality: "4K" as const,
    rating: 8.7,
    year: 2016,
    status: "Completed" as const,
    featured: true,
    pricePerSeason: 350,
    seasons: [
      { seasonNumber: 1, episodes: makeEpisodes(8, 47) },
      { seasonNumber: 2, episodes: makeEpisodes(9, 55) },
      { seasonNumber: 3, episodes: makeEpisodes(8, 51) },
      { seasonNumber: 4, episodes: makeEpisodes(9, 75) },
    ],
  },
  {
    title: "Money Heist",
    description:
      "An unusual group of robbers attempt to carry out the most perfect robbery in Spanish history — stealing 2.4 billion euros from the Royal Mint of Spain.",
    posterUrl: "https://image.tmdb.org/t/p/w500/reEMJA1uzscCbkpeRJeTT2bjqUp.jpg",
    bannerUrl: "https://image.tmdb.org/t/p/original/piuCBRQiKAl6JcEzWuTOgiqRpgP.jpg",
    youtubeTrailerId: "N5k7B02PqXY",
    genre: ["Action", "Crime", "Drama"],
    quality: "1080p" as const,
    rating: 8.2,
    year: 2017,
    status: "Completed" as const,
    featured: true,
    pricePerSeason: 300,
    seasons: [
      { seasonNumber: 1, episodes: makeEpisodes(13, 45) },
      { seasonNumber: 2, episodes: makeEpisodes(9, 48) },
      { seasonNumber: 3, episodes: makeEpisodes(8, 45) },
      { seasonNumber: 4, episodes: makeEpisodes(8, 47) },
      { seasonNumber: 5, episodes: makeEpisodes(10, 50) },
    ],
  },
  {
    title: "The Witcher",
    description:
      "Geralt of Rivia, a solitary monster hunter, struggles to find his place in a world where people often prove more wicked than beasts.",
    posterUrl: "https://image.tmdb.org/t/p/w500/7vjaCdMw15FEbXyLQTVa04URsPm.jpg",
    bannerUrl: "https://image.tmdb.org/t/p/original/cAs9TO7hRVLd21Ki6bYKm1oBVLV.jpg",
    youtubeTrailerId: "ndl7pRROPAY",
    genre: ["Action", "Adventure", "Fantasy"],
    quality: "4K" as const,
    rating: 8.0,
    year: 2019,
    status: "Completed" as const,
    featured: false,
    pricePerSeason: 350,
    seasons: [
      { seasonNumber: 1, episodes: makeEpisodes(8, 60) },
      { seasonNumber: 2, episodes: makeEpisodes(8, 60) },
      { seasonNumber: 3, episodes: makeEpisodes(8, 60) },
    ],
  },
  {
    title: "Squid Game",
    description:
      "Hundreds of cash-strapped players accept a strange invitation to compete in children's games. Inside, a tempting prize awaits — with deadly high stakes.",
    posterUrl: "https://image.tmdb.org/t/p/w500/dDlEmu3EZ0Pgg93K2SVNLCjCSvE.jpg",
    bannerUrl: "https://image.tmdb.org/t/p/original/qw3J9cNeLioOLoR68WX7z79aCdK.jpg",
    youtubeTrailerId: "oqxAJKy0ii4",
    genre: ["Action", "Drama", "Thriller"],
    quality: "4K" as const,
    rating: 8.0,
    year: 2021,
    status: "Ongoing" as const,
    featured: true,
    pricePerSeason: 300,
    seasons: [
      { seasonNumber: 1, episodes: makeEpisodes(9, 55) },
      { seasonNumber: 2, episodes: makeEpisodes(7, 55) },
    ],
  },
  {
    title: "The Last of Us",
    description:
      "After a global catastrophe, a hardened survivor and a teenage girl must traverse a dangerous post-apocalyptic America, where a fungal infection has destroyed civilization.",
    posterUrl: "https://image.tmdb.org/t/p/w500/uKvVjHNqB5VmOrdxqAt2F7J78ED.jpg",
    bannerUrl: "https://image.tmdb.org/t/p/original/uDgy6hyPd82kOHh6I95iBqpH0Kc.jpg",
    youtubeTrailerId: "uLtkt8BonwM",
    genre: ["Adventure", "Drama", "Horror"],
    quality: "4K" as const,
    rating: 8.8,
    year: 2023,
    status: "Ongoing" as const,
    featured: false,
    pricePerSeason: 400,
    seasons: [
      { seasonNumber: 1, episodes: makeEpisodes(9, 60) },
      { seasonNumber: 2, episodes: makeEpisodes(7, 60) },
    ],
  },
  {
    title: "Wednesday",
    description:
      "Follows Wednesday Addams' years as a student at Nevermore Academy, where she attempts to master her emerging psychic ability, thwart a monstrous killing spree and solve the supernatural mystery.",
    posterUrl: "https://image.tmdb.org/t/p/w500/9PFonBhy4cQy7Jz20NpMygczOkv.jpg",
    bannerUrl: "https://image.tmdb.org/t/p/original/iHSwvRVsRyxpX7FE7GbviaDvgGZ.jpg",
    youtubeTrailerId: "Di310WS9mAY",
    genre: ["Comedy", "Fantasy", "Horror"],
    quality: "1080p" as const,
    rating: 8.1,
    year: 2022,
    status: "Ongoing" as const,
    featured: false,
    pricePerSeason: 300,
    seasons: [
      { seasonNumber: 1, episodes: makeEpisodes(8, 45) },
    ],
  },
  {
    title: "House of the Dragon",
    description:
      "An internal succession war within House Targaryen at the height of its power, 200 years before the events of Game of Thrones.",
    posterUrl: "https://image.tmdb.org/t/p/w500/t9UsKuHJ7WMjBPrw0sETCKfDrO4.jpg",
    bannerUrl: "https://image.tmdb.org/t/p/original/etj8E2o0Bud0HkONVQPjyCkIvpv.jpg",
    youtubeTrailerId: "DotnJ7tTA34",
    genre: ["Action", "Adventure", "Drama"],
    quality: "4K" as const,
    rating: 8.4,
    year: 2022,
    status: "Ongoing" as const,
    featured: false,
    pricePerSeason: 400,
    seasons: [
      { seasonNumber: 1, episodes: makeEpisodes(10, 60) },
      { seasonNumber: 2, episodes: makeEpisodes(8, 60) },
    ],
  },
];

// POST /seed — seed sample movies and series (only if collections are empty)
router.post("/", async (req, res) => {
  try {
    const [movieCount, seriesCount] = await Promise.all([
      Movie.countDocuments(),
      Series.countDocuments(),
    ]);

    const ops: Promise<any>[] = [];
    if (movieCount === 0) ops.push(Movie.insertMany(SEED_MOVIES));
    if (seriesCount === 0) ops.push(Series.insertMany(SEED_SERIES));

    await Promise.all(ops);

    return res.json({
      message: movieCount === 0 || seriesCount === 0 ? "Seeded successfully" : "Database already seeded",
      movies: movieCount === 0 ? SEED_MOVIES.length : movieCount,
      series: seriesCount === 0 ? SEED_SERIES.length : seriesCount,
    });
  } catch (err) {
    req.log.error({ err }, "Seed failed");
    return res.status(500).json({ error: "Seed failed" });
  }
});

export default router;
