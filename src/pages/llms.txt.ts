import { getGenres, getMovies } from '../lib/movies';
import { getJournalArticles } from '../lib/journal';

const SITE_URL = 'https://rebelvault.pages.dev';

export const prerender = false;

function cleanText(value: unknown): string {
  if (typeof value !== 'string') return '';

  return value
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function absoluteUrl(path: string): string {
  return `${SITE_URL}${path}`;
}

export async function GET({
  locals,
}: {
  locals: App.Locals;
}): Promise<Response> {
  const db = locals.runtime?.env?.DB;

  const lines: string[] = [
    '# REBELVAULT',
    '',
    '> REBELVAULT is a movie discovery and streaming website featuring movies, genres, trending titles, random movie discovery, and editorial Journal articles.',
    '',
    '## Main Pages',
    '',
    `- [Home](${absoluteUrl('/')})`,
    `- [Movies](${absoluteUrl('/movies')})`,
    `- [Trending](${absoluteUrl('/trending')})`,
    `- [Random](${absoluteUrl('/random')})`,
    `- [Genres](${absoluteUrl('/genres')})`,
    `- [Journal](${absoluteUrl('/journal')})`,
    '',
  ];

  if (db) {
    const [movies, genres, journalArticles] = await Promise.all([
      getMovies(db),
      getGenres(db),
      getJournalArticles(db, true),
    ]);

    lines.push('## Movies', '');

    for (const movie of movies) {
      const title = cleanText(movie.title) || movie.id;
      const url = absoluteUrl(`/movie/${encodeURIComponent(movie.id)}`);

      lines.push(`- [${title}](${url})`);
    }

    lines.push('');

    if (genres.length > 0) {
      lines.push('## Genres', '');

      for (const genre of genres) {
        const name = cleanText(genre);
        if (!name) continue;

        const url = absoluteUrl(`/genres/${encodeURIComponent(genre)}`);

        lines.push(`- [${name}](${url})`);
      }

      lines.push('');
    }

    if (journalArticles.length > 0) {
      lines.push('## Journal', '');

      for (const article of journalArticles) {
        const title = cleanText(article.title) || article.slug;
        const url = absoluteUrl(
          `/journal/${encodeURIComponent(article.slug)}`
        );

        lines.push(`- [${title}](${url})`);
      }

      lines.push('');
    }
  }

  lines.push(
    '## Legal & Information',
    '',
    `- [Privacy](${absoluteUrl('/privacy')})`,
    `- [Terms](${absoluteUrl('/terms')})`,
    `- [Cookies](${absoluteUrl('/cookies')})`,
    `- [Disclaimer](${absoluteUrl('/disclaimer')})`,
    `- [DMCA](${absoluteUrl('/dmca')})`,
    ''
  );

  const content = `${lines.join('\n')}\n`;

  return new Response(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
