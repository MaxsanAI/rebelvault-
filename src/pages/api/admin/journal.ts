import type { APIRoute } from 'astro';
import {
  ensureJournalTable,
  slugify,
} from '../../../lib/journal';

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

const CATEGORIES = [
  'MOVIE STORIES',
  'DIRECTORS',
  'HIDDEN GEMS',
  'GENRE GUIDES',
  'WESTERN',
  'DOCUMENTARY',
  'CULT MOVIES',
  'LISTS',
];

type JournalPayload = {
  id?: string;
  title?: string;
  slug?: string;
  category?: string;
  excerpt?: string;
  coverImage?: string;
  content?: string;
  published?: boolean;
};

function validHttpUrl(value: string): boolean {
  if (!value) {
    return true;
  }

  try {
    const url = new URL(value);

    return (
      url.protocol === 'https:' ||
      url.protocol === 'http:'
    );
  } catch {
    return false;
  }
}

function validatePayload(body: JournalPayload) {
  const title = String(body.title ?? '').trim();
  const category = String(
    body.category ?? 'MOVIE STORIES'
  ).trim();
  const excerpt = String(body.excerpt ?? '').trim();
  const coverImage = String(
    body.coverImage ?? ''
  ).trim();
  const content = String(body.content ?? '').trim();

  let slug = String(body.slug ?? '').trim();

  if (!title) {
    return {
      error: 'Article title is required.',
    };
  }

  if (!content) {
    return {
      error: 'Article content is required.',
    };
  }

  if (!CATEGORIES.includes(category)) {
    return {
      error: 'Invalid article category.',
    };
  }

  if (!validHttpUrl(coverImage)) {
    return {
      error: 'Cover image must be a valid HTTP or HTTPS URL.',
    };
  }

  if (!slug) {
    slug = slugify(title);
  } else {
    slug = slugify(slug);
  }

  if (!slug) {
    return {
      error: 'Article title cannot create a valid slug.',
    };
  }

  return {
    article: {
      title,
      slug,
      category,
      excerpt,
      coverImage,
      content,
      published: Boolean(body.published),
    },
  };
}

async function uniqueSlug(
  db: D1Database,
  baseSlug: string,
  currentId?: string
): Promise<string> {
  let slug = baseSlug;

  const existing = await db
    .prepare(
      `SELECT id
       FROM journal_articles
       WHERE slug = ?
       LIMIT 1`
    )
    .bind(slug)
    .first<{ id: string }>();

  if (!existing || existing.id === currentId) {
    return slug;
  }

  slug = `${baseSlug}-${Date.now().toString(36)}`;

  return slug;
}

export const GET: APIRoute = async ({ locals }) => {
  try {
    const db = locals.runtime.env.DB;

    if (!db) {
      return json(
        {
          success: false,
          error:
            'D1 database binding DB is not configured.',
        },
        500
      );
    }

    await ensureJournalTable(db);

    const result = await db
      .prepare(
        `SELECT
          id,
          title,
          slug,
          category,
          excerpt,
          cover_image,
          content,
          published,
          created_at,
          updated_at
         FROM journal_articles
         ORDER BY created_at DESC`
      )
      .all();

    return json({
      success: true,
      articles: result.results ?? [],
    });
  } catch (error) {
    console.error(
      'REBELVAULT journal GET error:',
      error
    );

    return json(
      {
        success: false,
        error: 'Unable to load journal articles.',
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
          error:
            'D1 database binding DB is not configured.',
        },
        500
      );
    }

    await ensureJournalTable(db);

    const body = await request.json<JournalPayload>();

    const validation = validatePayload(body);

    if (validation.error) {
      return json(
        {
          success: false,
          error: validation.error,
        },
        400
      );
    }

    const article = validation.article!;

    const slug = await uniqueSlug(
      db,
      article.slug
    );

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    await db
      .prepare(
        `INSERT INTO journal_articles (
          id,
          title,
          slug,
          category,
          excerpt,
          cover_image,
          content,
          published,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id,
        article.title,
        slug,
        article.category,
        article.excerpt,
        article.coverImage,
        article.content,
        article.published ? 1 : 0,
        now,
        now
      )
      .run();

    return json({
      success: true,
      message: article.published
        ? 'Article published successfully.'
        : 'Article saved as draft.',
      article: {
        id,
        ...article,
        slug,
        createdAt: now,
        updatedAt: now,
      },
    });
  } catch (error) {
    console.error(
      'REBELVAULT journal creation error:',
      error
    );

    return json(
      {
        success: false,
        error: 'Unable to save article.',
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
          error:
            'D1 database binding DB is not configured.',
        },
        500
      );
    }

    await ensureJournalTable(db);

    const body = await request.json<JournalPayload>();

    const id = String(body.id ?? '').trim();

    if (!id) {
      return json(
        {
          success: false,
          error: 'Article ID is required.',
        },
        400
      );
    }

    const validation = validatePayload(body);

    if (validation.error) {
      return json(
        {
          success: false,
          error: validation.error,
        },
        400
      );
    }

    const article = validation.article!;

    const existing = await db
      .prepare(
        `SELECT id
         FROM journal_articles
         WHERE id = ?
         LIMIT 1`
      )
      .bind(id)
      .first<{ id: string }>();

    if (!existing) {
      return json(
        {
          success: false,
          error: 'Article not found.',
        },
        404
      );
    }

    const slug = await uniqueSlug(
      db,
      article.slug,
      id
    );

    const now = new Date().toISOString();

    await db
      .prepare(
        `UPDATE journal_articles
         SET
           title = ?,
           slug = ?,
           category = ?,
           excerpt = ?,
           cover_image = ?,
           content = ?,
           published = ?,
           updated_at = ?
         WHERE id = ?`
      )
      .bind(
        article.title,
        slug,
        article.category,
        article.excerpt,
        article.coverImage,
        article.content,
        article.published ? 1 : 0,
        now,
        id
      )
      .run();

    return json({
      success: true,
      message: article.published
        ? 'Article updated successfully.'
        : 'Draft updated successfully.',
      article: {
        id,
        ...article,
        slug,
        updatedAt: now,
      },
    });
  } catch (error) {
    console.error(
      'REBELVAULT journal update error:',
      error
    );

    return json(
      {
        success: false,
        error: 'Unable to update article.',
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
          error:
            'D1 database binding DB is not configured.',
        },
        500
      );
    }

    await ensureJournalTable(db);

    let id = '';

    try {
      const body = await request.json<{
        id?: string;
      }>();

      id = String(body.id ?? '').trim();
    } catch {
      id = '';
    }

    if (!id) {
      const url = new URL(request.url);

      id = String(
        url.searchParams.get('id') ?? ''
      ).trim();
    }

    if (!id) {
      return json(
        {
          success: false,
          error: 'Article ID is required.',
        },
        400
      );
    }

    const existing = await db
      .prepare(
        `SELECT id, title
         FROM journal_articles
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
          error: 'Article not found.',
        },
        404
      );
    }

    await db
      .prepare(
        `DELETE FROM journal_articles
         WHERE id = ?`
      )
      .bind(id)
      .run();

    return json({
      success: true,
      message: 'Article deleted successfully.',
      article: existing,
    });
  } catch (error) {
    console.error(
      'REBELVAULT journal deletion error:',
      error
    );

    return json(
      {
        success: false,
        error: 'Unable to delete article.',
      },
      500
    );
  }
};
