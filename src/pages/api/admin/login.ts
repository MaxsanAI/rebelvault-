import type { APIRoute } from 'astro';
import { createAdminCookie } from '../../../lib/admin-auth';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const password = String(body?.password ?? '');

    const adminPassword = locals.runtime.env.ADMIN_PASSWORD;

    if (!adminPassword || password !== adminPassword) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid password',
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const cookie = await createAdminCookie(adminPassword);

    return new Response(
      JSON.stringify({
        success: true,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': cookie,
        },
      }
    );
  } catch {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Invalid request',
      }),
      {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
};
