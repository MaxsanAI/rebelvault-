import { getGenres, getMovies } from '../lib/movies';
import { getJournalArticles } from '../lib/journal';

const SITE_URL = 'https://rebelvault.pages.dev';

export const prerender = false;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function normalizeLastmod(value?: string): string | undefined {
  if (!value) return undefined;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;

  return date.toISOString();
}

function urlEntry(path: string, lastmod?: string): string {
  const location = `${SITE_URL}${path}`;
  const lastmodTag = lastmod
    ? `\n    <lastmod>${escapeXml(lastmod)}</lastmod>`
    : '';

  return `  <url>
    <loc>${escapeXml(location)}</loc>${lastmodTag}
  </url>`;
}

export async function GET({
  locals,
}: {
  locals: App.Locals;
}): Promise<Response> {
  const db = locals.runtime?.env?.DB;

  const entries: string[] = [
    urlEntry('/'),
    urlEntry('/movies'),
    urlEntry('/trending'),
    urlEntry('/random'),
    urlEntry('/genres'),
    urlEntry('/journal'),
    urlEntry('/privacy'),
    urlEntry('/terms'),
    urlEntry('/cookies'),
    urlEntry('/disclaimer'),
    urlEntry('/dmca'),
  ];

  if (db) {
    const [movies, genres, journalArticles] = await Promise.all([
      getMovies(db),
      getGenres(db),
      getJournalArticles(db, true),
    ]);

    for (const genre of genres) {
      const encodedGenre = encodeURIComponent(genre);
      if (encodedGenre) entries.push(urlEntry(`/genres/${encodedGenre}`));
    }

    for (const movie of movies) {
      entries.push(
        urlEntry(
          `/movie/${encodeURIComponent(movie.id)}`,
          normalizeLastmod(movie.createdAt)
        )
      );
    }

    for (const article of journalArticles) {
      entries.push(
        urlEntry(
          `/journal/${encodeURIComponent(article.slug)}`,
          normalizeLastmod(article.updatedAt || article.createdAt)
        )
      );
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>
`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
