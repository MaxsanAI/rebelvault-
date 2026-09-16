import type { APIRoute } from 'astro';

function json(
  data: Record<string, unknown>,
  status = 200
): Response {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function isValidYouTubeEmbed(value: string): boolean {
  try {
    const url = new URL(value);

    const allowedHosts = [
      'youtube.com',
      'www.youtube.com',
      'youtube-nocookie.com',
      'www.youtube-nocookie.com',
    ];

    if (!allowedHosts.includes(url.hostname.toLowerCase())) {
      return false;
    }

    return url.pathname.startsWith('/embed/');
  } catch {
    return false;
  }
}

type MoviePayload = {
  id?: string;
  title?: string;
  year?: number | string;
  genre?: string;
  poster?: string;
  backdrop?: string;
  description?: string;
  embed?: string;
  featured?: boolean;
};

function validateMoviePayload(body: MoviePayload) {
  const title = String(body.title ?? '').trim();
  const genre = String(body.genre ?? '').trim();
  const poster = String(body.poster ?? '').trim();
  const backdrop = String(body.backdrop ?? '').trim();
  const description = String(body.description ?? '').trim();
  const embed = String(body.embed ?? '').trim();
  const year = Number(body.year);
  const featured = Boolean(body.featured);

  if (!title) {
    return {
      error: 'Movie title is required.',
    };
  }

  if (!Number.isInteger(year) || year < 1888 || year > 2100) {
    return {
      error: 'Enter a valid movie year.',
    };
  }

  if (!genre) {
    return {
      error: 'Genre is required.',
    };
  }

  if (!poster) {
    return {
      error: 'Poster URL is required.',
    };
  }

  if (!backdrop) {
    return {
      error: 'Backdrop URL is required.',
    };
  }

  if (!description) {
    return {
      error: 'Description is required.',
    };
  }

  if (!embed || !isValidYouTubeEmbed(embed)) {
    return {
      error:
        'Enter a valid YouTube or YouTube NoCookie embed URL.',
    };
  }

  return {
    movie: {
      title,
      year,
      genre,
      poster,
      backdrop,
      description,
      embed,
      featured,
    },
  };
}

export const GET: APIRoute = async ({ locals }) => {
  try {
    const db = locals.runtime.env.DB;

    if (!db) {
      return json(
        {
          success: false,
          error: 'D1 database binding DB is not configured.',
        },
        500
      );
    }

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
        ORDER BY created_at DESC`
      )
      .all();

    return json({
      success: true,
      movies: result.results ?? [],
      count: result.results?.length ?? 0,
    });
  } catch (error) {
    console.error(
      'REBELVAULT movie management GET error:',
      error
    );

    return json(
      {
        success: false,
        error: 'Unable to load movies.',
      },
      500
    );
  }
};

export const POST: APIRoute = async ({
  request,
  locals,
}) => {
  try {
    const db = locals.runtime.env.DB;

    if (!db) {
      return json(
        {
          success: false,
          error: 'D1 database binding DB is not configured.',
        },
        500
      );
    }

    const body = await request.json<MoviePayload>();

    const validation = validateMoviePayload(body);

    if (validation.error) {
      return json(
        {
          success: false,
          error: validation.error,
        },
        400
      );
    }

    const movie = validation.movie!;

    const baseId = slugify(movie.title);

    if (!baseId) {
      return json(
        {
          success: false,
          error:
            'Movie title cannot be converted into a valid ID.',
        },
        400
      );
    }

    let id = baseId;

    const existing = await db
      .prepare(
        `SELECT id
         FROM movies
         WHERE id = ?
         LIMIT 1`
      )
      .bind(id)
      .first<{ id: string }>();

    if (existing) {
      id = `${baseId}-${Date.now().toString(36)}`;
    }

    if (movie.featured) {
      await db
        .prepare(
          `UPDATE movies
           SET featured = 0
           WHERE featured = 1`
        )
        .run();
    }

    await db
      .prepare(
        `INSERT INTO movies (
          id,
          title,
          year,
          genre,
          poster,
          backdrop,
          description,
          embed,
          featured
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        movie.title,
        movie.year,
        movie.genre,
        movie.poster,
        movie.backdrop,
        movie.description,
        movie.embed,
        movie.featured ? 1 : 0
      )
      .run();

    return json({
      success: true,
      message: 'Movie published successfully.',
      movie: {
        id,
        ...movie,
      },
    });
  } catch (error) {
    console.error(
      'REBELVAULT movie creation error:',
      error
    );

    return json(
      {
        success: false,
        error: 'Unable to publish movie.',
      },
      500
    );
  }
};

export const PUT: APIRoute = async ({
  request,
  locals,
}) => {
  try {
    const db = locals.runtime.env.DB;

    if (!db) {
      return json(
        {
          success: false,
          error: 'D1 database binding DB is not configured.',
        },
        500
      );
    }

    const body = await request.json<MoviePayload>();

    const id = String(body.id ?? '').trim();

    if (!id) {
      return json(
        {
          success: false,
          error: 'Movie ID is required.',
        },
        400
      );
    }

    const validation = validateMoviePayload(body);

    if (validation.error) {
      return json(
        {
          success: false,
          error: validation.error,
        },
        400
      );
    }

    const movie = validation.movie!;

    const existing = await db
      .prepare(
        `SELECT id
         FROM movies
         WHERE id = ?
         LIMIT 1`
      )
      .bind(id)
      .first<{ id: string }>();

    if (!existing) {
      return json(
        {
          success: false,
          error: 'Movie not found.',
        },
        404
      );
    }

    if (movie.featured) {
      await db
        .prepare(
          `UPDATE movies
           SET featured = 0
           WHERE featured = 1
           AND id != ?`
        )
        .bind(id)
        .run();
    }

    await db
      .prepare(
        `UPDATE movies
         SET
           title = ?,
           year = ?,
           genre = ?,
           poster = ?,
           backdrop = ?,
           description = ?,
           embed = ?,
           featured = ?
         WHERE id = ?`
      )
      .bind(
        movie.title,
        movie.year,
        movie.genre,
        movie.poster,
        movie.backdrop,
        movie.description,
        movie.embed,
        movie.featured ? 1 : 0,
        id
      )
      .run();

    return json({
      success: true,
      message: 'Movie updated successfully.',
      movie: {
        id,
        ...movie,
      },
    });
  } catch (error) {
    console.error(
      'REBELVAULT movie update error:',
      error
    );

    return json(
      {
        success: false,
        error: 'Unable to update movie.',
      },
      500
    );
  }
};

export const DELETE: APIRoute = async ({
  request,
  locals,
}) => {
  try {
    const db = locals.runtime.env.DB;

    if (!db) {
      return json(
        {
          success: false,
          error: 'D1 database binding DB is not configured.',
        },
        500
      );
    }

    let id = '';

    try {
      const body = await request.json<{ id?: string }>();
      id = String(body.id ?? '').trim();
    } catch {
      id = '';
    }

    if (!id) {
      const url = new URL(request.url);
      id = String(url.searchParams.get('id') ?? '').trim();
    }

    if (!id) {
      return json(
        {
          success: false,
          error: 'Movie ID is required.',
        },
        400
      );
    }

    const existing = await db
      .prepare(
        `SELECT id, title
         FROM movies
         WHERE id = ?
         LIMIT 1`
      )
      .bind(id)
      .first<{
        id: string;
        title: string;
      }>();

    if (!existing) {
      return json(
        {
          success: false,
          error: 'Movie not found.',
        },
        404
      );
    }

    await db
      .prepare(
        `DELETE FROM movies
         WHERE id = ?`
      )
      .bind(id)
      .run();

    return json({
      success: true,
      message: 'Movie deleted successfully.',
      movie: {
        id: existing.id,
        title: existing.title,
      },
    });
  } catch (error) {
    console.error(
      'REBELVAULT movie deletion error:',
      error
    );

    return json(
      {
        success: false,
        error: 'Unable to delete movie.',
      },
      500
    );
  }
};
