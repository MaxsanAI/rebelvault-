interface Env {
  ADMIN_PASSWORD: string;
}

const COOKIE_NAME = 'rebelvault_admin';
const COOKIE_VALUE = 'authenticated';

function json(
  data: Record<string, unknown>,
  status = 200,
  headers: Record<string, string> = {}
): Response {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

function cookieOptions() {
  return [
    `${COOKIE_NAME}=${COOKIE_VALUE}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
    'Max-Age=86400',
  ].join('; ');
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    if (!context.env.ADMIN_PASSWORD) {
      return json(
        {
          success: false,
          error: 'ADMIN_PASSWORD secret is not configured.',
        },
        500
      );
    }

    const body = await context.request.json<{
      password?: string;
    }>();

    const password = String(body.password ?? '');

    if (!password) {
      return json(
        {
          success: false,
          error: 'Password is required.',
        },
        400
      );
    }

    if (password !== context.env.ADMIN_PASSWORD) {
      return json(
        {
          success: false,
          error: 'Invalid password.',
        },
        401
      );
    }

    return json(
      {
        success: true,
        message: 'Authentication successful.',
      },
      200,
      {
        'Set-Cookie': cookieOptions(),
      }
    );
  } catch (error) {
    console.error('REBELVAULT login error:', error);

    return json(
      {
        success: false,
        error: 'Unable to authenticate.',
      },
      500
    );
  }
};
