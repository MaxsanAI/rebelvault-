/// <reference types="astro/client" />

interface Env {
  DB: D1Database;
  ADMIN_PASSWORD: string;
}

declare namespace App {
  interface Locals {
    runtime: {
      env: Env;
      cf: IncomingRequestCfProperties;
      ctx: ExecutionContext;
    };
  }
}
