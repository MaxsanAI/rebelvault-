export interface Movie {
  id: string;
  title: string;
  year: number;
  genre: string;
  poster: string;
  backdrop: string;
  description: string;
  embed: string;
  featured: boolean;
  createdAt?: string;
}

interface MovieRow {
  id: string;
  title: string;
  year: number;
  genre: string;
  poster: string;
  backdrop: string;
  description: string;
  embed: string;
  featured: number;
  created_at?: string;
}

export interface DatabaseEnv {
  DB: D1Database;
}

function mapMovie(row: MovieRow): Movie {
  return {
    id: row.id,
    title: row.title,
    year: row.year,
    genre: row.genre,
    poster: row.poster,
    backdrop: row.backdrop,
    description: row.description,
    embed: row.embed,
    featured: row.featured === 1,
    createdAt: row.created_at,
  };
}

export async function getMovies(
  db: D1Database
): Promise<Movie[]> {
  const result = await db
    .prepare(
      `SELECT
        id,
        title,
        year,
        genre,
        poster,
        backdrop,
        description,
        embed,
        featured,
        created_at
       FROM movies
       ORDER BY featured DESC, created_at DESC`
    )
    .all<MovieRow>();

  return result.results.map(mapMovie);
}

export async function getMovieById(
  db: D1Database,
  id: string
): Promise<Movie | null> {
  const result = await db
    .prepare(
      `SELECT
        id,
        title,
        year,
        genre,
        poster,
        backdrop,
        description,
        embed,
        featured,
        created_at
       FROM movies
       WHERE id = ?
       LIMIT 1`
    )
    .bind(id)
    .first<MovieRow>();

  return result ? mapMovie(result) : null;
}

export async function getFeaturedMovie(
  db: D1Database
): Promise<Movie | null> {
  const result = await db
    .prepare(
      `SELECT
        id,
        title,
        year,
        genre,
        poster,
        backdrop,
        description,
        embed,
        featured,
        created_at
       FROM movies
       WHERE featured = 1
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .first<MovieRow>();

  return result ? mapMovie(result) : null;
}

export async function getMoviesByGenre(
  db: D1Database,
  genre: string
): Promise<Movie[]> {
  const result = await db
    .prepare(
      `SELECT
        id,
        title,
        year,
        genre,
        poster,
        backdrop,
        description,
        embed,
        featured,
        created_at
       FROM movies
       WHERE LOWER(genre) = LOWER(?)
       ORDER BY featured DESC, created_at DESC`
    )
    .bind(genre)
    .all<MovieRow>();

  return result.results.map(mapMovie);
}

export async function getGenres(
  db: D1Database
): Promise<string[]> {
  const result = await db
    .prepare(
      `SELECT DISTINCT genre
       FROM movies
       WHERE genre IS NOT NULL
         AND genre != ''
       ORDER BY genre ASC`
    )
    .all<{ genre: string }>();

  return result.results.map((row) => row.genre);
}
