import { defineMiddleware } from 'astro:middleware';
import { isAdminAuthenticated } from './lib/admin-auth';

// AI crawlers explicitly allowed to discover/access REBELVAULT.
const ALLOWED_CRAWLERS = [
  // OpenAI
  'OAI-SearchBot',
  'ChatGPT-User',

  // Anthropic — search only
  'Claude-SearchBot',
];

// Search engines, AI training crawlers, AI user crawlers,
// SEO crawlers and data-collection bots to block.
const BLOCKED_CRAWLERS = [
  // Google
  'Googlebot',
  'Google-InspectionTool',
  'Google-Extended',

  // Microsoft / Bing
  'bingbot',
  'BingPreview',

  // OpenAI training
  'GPTBot',

  // Anthropic — non-search
  'ClaudeBot',
  'Claude-Web',
  'Claude-User',
  'anthropic-ai',

  // Perplexity
  'PerplexityBot',

  // Amazon
  'Amazonbot',

  // ByteDance
  'Bytespider',

  // Meta
  'FacebookBot',
  'Meta-ExternalAgent',

  // Common Crawl
  'CCBot',

  // Apple
  'Applebot',
  'Applebot-Extended',

  // Cohere
  'cohere-ai',

  // Diffbot
  'Diffbot',

  // Omgili
  'Omgilibot',
  'Omgili',

  // You.com
  'YouBot',

  // AI2
  'AI2Bot',

  // Pipl
  'PiplBot',

  // Timpibot
  'Timpibot',

  // SEO / data crawlers
  'SemrushBot',
  'SemrushBot-BA',
  'DataForSeoBot',
  'Baiduspider',
  'YandexBot',
  'PetalBot',
  'MJ12bot',
  'DotBot',
  'AhrefsBot',
];

export const onRequest = defineMiddleware(
  async (context, next) => {
    const pathname = new URL(
      context.request.url
    ).pathname;

    const userAgent =
      context.request.headers.get('user-agent') || '';

    const ua = userAgent.toLowerCase();

    const isAdminPage =
      pathname === '/vault-control' ||
      pathname === '/vault-control/' ||
      pathname.startsWith('/vault-control/');

    const isAdminApi =
      pathname === '/api/admin' ||
      pathname.startsWith('/api/admin/');

    const isLoginPage =
      pathname === '/vault-control/login' ||
      pathname === '/vault-control/login/';

    const isLoginApi =
      pathname === '/api/admin/login';

    /*
     * Keep Vault Control and admin authentication completely
     * independent from crawler handling.
     *
     * Admin login remains accessible.
     * All other Vault Control/admin API requests continue
     * through the existing authentication logic below.
     */
    if (isLoginPage || isLoginApi) {
      return next();
    }

    /*
     * Never expose admin routes to crawlers.
     *
     * The existing authentication system remains responsible
     * for protecting these routes.
     */
    if (isAdminPage || isAdminApi) {
      const env =
        context.locals.runtime.env;

      const authenticated =
        await isAdminAuthenticated(
          context.request,
          env.ADMIN_PASSWORD
        );

      if (authenticated) {
        return next();
      }

      if (isAdminApi) {
        return Response.json(
          {
            success: false,
            error: 'Authentication required.',
          },
          {
            status: 401,
            headers: {
              'Cache-Control': 'no-store',
            },
          }
        );
      }

      return Response.redirect(
        new URL(
          '/vault-control/login',
          context.request.url
        ),
        302
      );
    }

    /*
     * Public site:
     *
     * Allow OpenAI Search, ChatGPT direct user requests,
     * and Claude Search.
     */
    if (
      ALLOWED_CRAWLERS.some((crawler) =>
        ua.includes(crawler.toLowerCase())
      )
    ) {
      return next();
    }

    /*
     * Block known search engines, AI training crawlers,
     * non-search AI crawlers, SEO crawlers and data bots.
     */
    if (
      BLOCKED_CRAWLERS.some((crawler) =>
        ua.includes(crawler.toLowerCase())
      )
    ) {
      return new Response('Forbidden', {
        status: 403,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Robots-Tag':
            'noindex, nofollow, noarchive',
        },
      });
    }

    // Normal visitors and unknown clients remain accessible.
    return next();
  }
);

