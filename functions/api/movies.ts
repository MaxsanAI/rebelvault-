interface Env {
  DB: D1Database;
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
  created_at: string;
}

function json(
  data: Record<string, unknown>,
  status = 200
): Response {
  return Response.json(data, {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}

export const onRequestGet: PagesFunction<Env> = async (
  context
) => {
  try {
    if (!context.env.DB) {
      return json(
        {
          success: false,
          error: 'D1 database binding DB is not configured.',
        },
        500
      );
    }

    const result = await context.env.DB
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

    const movies = result.results.map((movie) => ({
      id: movie.id,
      title: movie.title,
      year: movie.year,
      genre: movie.genre,
      poster: movie.poster,
      backdrop: movie.backdrop,
      description: movie.description,
      embed: movie.embed,
      featured: movie.featured === 1,
      createdAt: movie.created_at,
    }));

    return json({
      success: true,
      count: movies.length,
      movies,
    });
  } catch (error) {
    console.error('REBELVAULT movies API error:', error);

    return json(
      {
        success: false,
        error: 'Unable to load movies.',
      },
      500
    );
  }
};
