interface Env {
  ADMIN_PASSWORD: string;
}

const COOKIE_NAME = 'rebelvault_admin';
const COOKIE_VALUE = 'authenticated';

function isAuthenticated(request: Request): boolean {
  const cookieHeader = request.headers.get('Cookie') || '';

  return cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .some((cookie) => cookie === `${COOKIE_NAME}=${COOKIE_VALUE}`);
}

function unauthorizedResponse(request: Request): Response {
  const url = new URL(request.url);

  if (url.pathname.startsWith('/api/admin/')) {
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

  const loginUrl = new URL('/vault-control/login', request.url);

  return Response.redirect(loginUrl.toString(), 302);
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const pathname = url.pathname;

  const isAdminPage =
    pathname === '/vault-control' ||
    pathname === '/vault-control/';

  const isAdminApi =
    pathname === '/api/admin' ||
    pathname.startsWith('/api/admin/');

  if (!isAdminPage && !isAdminApi) {
    return context.next();
  }

  if (isAuthenticated(context.request)) {
    return context.next();
  }

  return unauthorizedResponse(context.request);
};
