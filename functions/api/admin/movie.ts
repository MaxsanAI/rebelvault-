interface Env {
  DB: D1Database;
}

const COOKIE_NAME = 'rebelvault_admin';
const COOKIE_VALUE = 'authenticated';

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

function isAuthenticated(request: Request): boolean {
  const cookieHeader = request.headers.get('Cookie') || '';

  return cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .some(
      (cookie) =>
        cookie === `${COOKIE_NAME}=${COOKIE_VALUE}`
    );
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

export const onRequestPost: PagesFunction<Env> = async (
  context
) => {
  try {
    if (!isAuthenticated(context.request)) {
      return json(
        {
          success: false,
          error: 'Authentication required.',
        },
        401
      );
    }

    if (!context.env.DB) {
      return json(
        {
          success: false,
          error: 'D1 database binding DB is not configured.',
        },
        500
      );
    }

    const body = await context.request.json<{
      title?: string;
      year?: number | string;
      genre?: string;
      poster?: string;
      backdrop?: string;
      description?: string;
      embed?: string;
      featured?: boolean;
    }>();

    const title = String(body.title ?? '').trim();
    const genre = String(body.genre ?? '').trim();
    const poster = String(body.poster ?? '').trim();
    const backdrop = String(body.backdrop ?? '').trim();
    const description = String(body.description ?? '').trim();
    const embed = String(body.embed ?? '').trim();

    const year = Number(body.year);
    const featured = Boolean(body.featured);

    if (!title) {
      return json(
        {
          success: false,
          error: 'Movie title is required.',
        },
        400
      );
    }

    if (
      !Number.isInteger(year) ||
      year < 1888 ||
      year > 2100
    ) {
      return json(
        {
          success: false,
          error: 'Enter a valid movie year.',
        },
        400
      );
    }

    if (!genre) {
      return json(
        {
          success: false,
          error: 'Genre is required.',
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

    if (!description) {
      return json(
        {
          success: false,
          error: 'Description is required.',
        },
        400
      );
    }

    if (!embed || !isValidYouTubeEmbed(embed)) {
      return json(
        {
          success: false,
          error:
            'Enter a valid YouTube or YouTube NoCookie embed URL.',
        },
        400
      );
    }

    const baseId = slugify(title);

    if (!baseId) {
      return json(
        {
          success: false,
          error: 'Movie title cannot be converted into a valid ID.',
        },
        400
      );
    }

    let id = baseId;

    const existing = await context.env.DB
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
          featured
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
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

    return json({
      success: true,
      message: 'Movie published successfully.',
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
