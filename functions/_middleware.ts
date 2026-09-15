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
    .some(
      (cookie) =>
        cookie === `${COOKIE_NAME}=${COOKIE_VALUE}`
    );
}

function unauthorizedResponse(request: Request): Response {
  const url = new URL(request.url);

  if (
    url.pathname === '/api/admin' ||
    url.pathname.startsWith('/api/admin/')
  ) {
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

  const loginUrl = new URL(
    '/vault-control/login',
    request.url
  );

  return Response.redirect(loginUrl.toString(), 302);
}

export const onRequest: PagesFunction<Env> = async (
  context
) => {
  const url = new URL(context.request.url);
  const pathname = url.pathname;

  const isAdminPage =
    pathname === '/vault-control' ||
    pathname === '/vault-control/';

  const isAdminApi =
    pathname === '/api/admin' ||
    pathname.startsWith('/api/admin/');

  const isLoginApi =
    pathname === '/api/admin/login';

  /*
   * Login endpoint must remain publicly accessible.
   * Otherwise the middleware would block the password
   * request before login.ts can authenticate it.
   */
  if (isLoginApi) {
    return context.next();
  }

  /*
   * Everything unrelated to the private admin area
   * passes through normally.
   */
  if (!isAdminPage && !isAdminApi) {
    return context.next();
  }

  /*
   * Already authenticated.
   */
  if (isAuthenticated(context.request)) {
    return context.next();
  }

  /*
   * Admin page/API without a valid authentication cookie.
   */
  return unauthorizedResponse(context.request);
};
