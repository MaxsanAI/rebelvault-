import { defineMiddleware } from 'astro:middleware';
import { isAdminAuthenticated } from './lib/admin-auth';

export const onRequest = defineMiddleware(
  async (context, next) => {
    const pathname = new URL(
      context.request.url
    ).pathname;

    const isAdminPage =
      pathname === '/vault-control' ||
      pathname === '/vault-control/';

    const isAdminApi =
      pathname === '/api/admin' ||
      pathname.startsWith('/api/admin/');

    const isLoginApi =
      pathname === '/api/admin/login';

    if (isLoginApi) {
      return next();
    }

    if (!isAdminPage && !isAdminApi) {
      return next();
    }

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
);
