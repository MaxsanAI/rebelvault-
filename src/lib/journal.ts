export interface JournalArticle {
  id: string;
  title: string;
  slug: string;
  category: string;
  excerpt: string;
  coverImage: string;
  content: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

type JournalRow = {
  id: string;
  title: string;
  slug: string;
  category: string;
  excerpt: string;
  cover_image: string;
  content: string;
  published: number;
  created_at: string;
  updated_at: string;
};

export async function ensureJournalTable(
  db: D1Database
): Promise<void> {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS journal_articles (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL DEFAULT 'MOVIE STORIES',
        excerpt TEXT NOT NULL DEFAULT '',
        cover_image TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL DEFAULT '',
        published INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`
    )
    .run();

  await db
    .prepare(
      `CREATE INDEX IF NOT EXISTS idx_journal_articles_published
       ON journal_articles(published, created_at)`
    )
    .run();
}

function mapArticle(row: JournalRow): JournalArticle {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    category: row.category,
    excerpt: row.excerpt,
    coverImage: row.cover_image,
    content: row.content,
    published: Boolean(row.published),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

export async function getJournalArticles(
  db: D1Database,
  publishedOnly = false
): Promise<JournalArticle[]> {
  await ensureJournalTable(db);

  const result = publishedOnly
    ? await db
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
           WHERE published = 1
           ORDER BY created_at DESC`
        )
        .all<JournalRow>()
    : await db
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
        .all<JournalRow>();

  return (result.results ?? []).map(mapArticle);
}

export async function getJournalArticleBySlug(
  db: D1Database,
  slug: string,
  publishedOnly = true
): Promise<JournalArticle | null> {
  await ensureJournalTable(db);

  const result = publishedOnly
    ? await db
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
           WHERE slug = ?
           AND published = 1
           LIMIT 1`
        )
        .bind(slug)
        .first<JournalRow>()
    : await db
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
           WHERE slug = ?
           LIMIT 1`
        )
        .bind(slug)
        .first<JournalRow>();

  return result ? mapArticle(result) : null;
}

export async function getJournalArticleById(
  db: D1Database,
  id: string
): Promise<JournalArticle | null> {
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
       WHERE id = ?
       LIMIT 1`
    )
    .bind(id)
    .first<JournalRow>();

  return result ? mapArticle(result) : null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function safeUrl(value: string): string | null {
  try {
    const url = new URL(value);

    if (
      url.protocol !== 'https:' &&
      url.protocol !== 'http:'
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function renderInline(value: string): string {
  let output = escapeHtml(value);

  output = output.replace(
    /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/gi,
    (_, alt: string, url: string) => {
      const safe = safeUrl(url);

      if (!safe) {
        return '';
      }

      return `<img src="${escapeHtml(
        safe
      )}" alt="${escapeHtml(alt)}" loading="lazy" />`;
    }
  );

  output = output.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi,
    (_, text: string, url: string) => {
      const safe = safeUrl(url);

      if (!safe) {
        return escapeHtml(text);
      }

      return `<a href="${escapeHtml(
        safe
      )}" target="_blank" rel="noopener noreferrer">${escapeHtml(
        text
      )}</a>`;
    }
  );

  output = output.replace(
    /\*\*(.+?)\*\*/g,
    '<strong>$1</strong>'
  );

  output = output.replace(
    /\*(.+?)\*/g,
    '<em>$1</em>'
  );

  return output;
}

export function renderJournalContent(
  content: string
): string {
  const lines = content.replace(/\r\n/g, '\n').split('\n');

  const html: string[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) {
      return;
    }

    const text = paragraph.join(' ').trim();

    if (text) {
      html.push(`<p>${renderInline(text)}</p>`);
    }

    paragraph = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      continue;
    }

    if (line.startsWith('### ')) {
      flushParagraph();

      html.push(
        `<h3>${renderInline(line.slice(4))}</h3>`
      );

      continue;
    }

    if (line.startsWith('## ')) {
      flushParagraph();

      html.push(
        `<h2>${renderInline(line.slice(3))}</h2>`
      );

      continue;
    }

    if (line.startsWith('# ')) {
      flushParagraph();

      html.push(
        `<h2>${renderInline(line.slice(2))}</h2>`
      );

      continue;
    }

    if (/^!\[[^\]]*\]\(https?:\/\/[^\s)]+\)$/i.test(line)) {
      flushParagraph();

      html.push(renderInline(line));

      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();

  return html.join('\n');
}
