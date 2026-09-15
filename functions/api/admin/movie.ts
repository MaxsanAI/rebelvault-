interface Env {
  DB: D1Database;
}

type MovieInput = {
  title?: string;
  year?: number | string;
  genre?: string;
  poster?: string;
  backdrop?: string;
  embed?: string;
  description?: string;
  featured?: boolean;
};

const ALLOWED_GENRES = [
  'Action',
  'Horror',
  'Sci-Fi',
  'Thriller',
  'Comedy',
  'Drama',
  'Crime',
  'Adventure',
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

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

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    if (!context.env.DB) {
      return json(
        {
          success: false,
          error: 'D1 database binding "DB" is not configured.',
        },
        500
      );
    }

    const body = (await context.request.json()) as MovieInput;

    const title = String(body.title ?? '').trim();
    const genre = String(body.genre ?? '').trim();
    const poster = String(body.poster ?? '').trim();
    const backdrop = String(body.backdrop ?? '').trim();
    const embed = String(body.embed ?? '').trim();
    const description = String(body.description ?? '').trim();

    const year = Number(body.year);

    const featured = body.featured === true;

    if (!title) {
      return json(
        {
          success: false,
          error: 'Movie title is required.',
        },
        400
      );
    }

    if (!Number.isInteger(year) || year < 1888 || year > 2100) {
      return json(
        {
          success: false,
          error: 'A valid movie year is required.',
        },
        400
      );
    }

    if (!ALLOWED_GENRES.includes(genre)) {
      return json(
        {
          success: false,
          error: 'Invalid movie genre.',
        },
        400
      );
    }

    if (!poster) {
      return json(
        {
          success: false,
          error: 'Poster URL is required.',
        },
        400
      );
    }

    if (!backdrop) {
      return json(
        {
          success: false,
          error: 'Backdrop URL is required.',
        },
        400
      );
    }

    if (!embed) {
      return json(
        {
          success: false,
          error: 'YouTube embed URL is required.',
        },
        400
      );
    }

    if (!description) {
      return json(
        {
          success: false,
          error: 'Movie description is required.',
        },
        400
      );
    }

    let embedUrl: URL;

    try {
      embedUrl = new URL(embed);
    } catch {
      return json(
        {
          success: false,
          error: 'Invalid YouTube embed URL.',
        },
        400
      );
    }

    const allowedEmbedHosts = [
      'www.youtube.com',
      'youtube.com',
      'www.youtube-nocookie.com',
      'youtube-nocookie.com',
    ];

    if (!allowedEmbedHosts.includes(embedUrl.hostname)) {
      return json(
        {
          success: false,
          error: 'Only YouTube embed URLs are allowed.',
        },
        400
      );
    }

    if (!embedUrl.pathname.startsWith('/embed/')) {
      return json(
        {
          success: false,
          error: 'The YouTube URL must use the /embed/ format.',
        },
        400
      );
    }

    const baseSlug = slugify(title);

    if (!baseSlug) {
      return json(
        {
          success: false,
          error: 'Movie title cannot be converted into a valid ID.',
        },
        400
      );
    }

    let id = baseSlug;

    const existing = await context.env.DB
      .prepare(
        `SELECT id FROM movies WHERE id = ? LIMIT 1`
      )
      .bind(id)
      .first<{ id: string }>();

    if (existing) {
      id = `${baseSlug}-${year}`;
    }

    const secondExisting = await context.env.DB
      .prepare(
        `SELECT id FROM movies WHERE id = ? LIMIT 1`
      )
      .bind(id)
      .first<{ id: string }>();

    if (secondExisting) {
      id = `${baseSlug}-${year}-${Date.now().toString().slice(-6)}`;
    }

    if (featured) {
      await context.env.DB
        .prepare(
          `UPDATE movies
           SET featured = 0
           WHERE featured = 1`
        )
        .run();
    }

    await context.env.DB
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
          featured,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      )
      .bind(
        id,
        title,
        year,
        genre,
        poster,
        backdrop,
        description,
        embed,
        featured ? 1 : 0
      )
      .run();

    return json(
      {
        success: true,
        message: 'Movie added successfully.',
        movie: {
          id,
          title,
          year,
          genre,
          poster,
          backdrop,
          description,
          embed,
          featured,
        },
      },
      201
    );
  } catch (error) {
    console.error('REBELVAULT add movie error:', error);

    return json(
      {
        success: false,
        error: 'Unable to save movie.',
      },
      500
    );
  }
};
