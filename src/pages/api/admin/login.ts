import type { APIRoute } from 'astro';
import { createAdminCookie } from '../../../../lib/admin-auth';

function json(
  data: Record<string, unknown>,
  status = 200,
  headers: Record<string, string> = {}
): Response {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control':
        'no-store, no-cache, must-revalidate',
      ...headers,
    },
  });
}

export const POST: APIRoute = async ({
  request,
  locals,
}) => {
  try {
    const adminPassword =
      locals.runtime.env.ADMIN_PASSWORD;

    if (!adminPassword) {
      return json(
        {
          success: false,
          error:
            'ADMIN_PASSWORD secret is not configured.',
        },
        500
      );
    }

    let body: {
      password?: string;
    };

    try {
      body =
        await request.json<{
          password?: string;
        }>();
    } catch {
      return json(
        {
          success: false,
          error: 'Invalid request.',
        },
        400
      );
    }

    const password = String(
      body.password ?? ''
    );

    if (!password) {
      return json(
        {
          success: false,
          error: 'Password is required.',
        },
        400
      );
    }

    if (password !== adminPassword) {
      return json(
        {
          success: false,
          error: 'Invalid password.',
        },
        401
      );
    }

    const cookie =
      await createAdminCookie(
        adminPassword
      );

    return json(
      {
        success: true,
        message:
          'Authentication successful.',
      },
      200,
      {
        'Set-Cookie': cookie,
      }
    );
  } catch (error) {
    console.error(
      'REBELVAULT login error:',
      error
    );

    return json(
      {
        success: false,
        error: 'Unable to authenticate.',
      },
      500
    );
  }
};
