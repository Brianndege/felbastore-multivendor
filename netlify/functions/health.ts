import type { Handler } from "@netlify/functions";
import { assertFunctionEnv } from "./_lib/env";

export const handler: Handler = async () => {
  try {
    assertFunctionEnv();

    return {
      statusCode: 200,
      headers: {
        "cache-control": "no-store",
        "content-type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        ok: true,
        service: "felbastore-netlify-function",
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Environment validation failed";

    return {
      statusCode: 500,
      headers: {
        "cache-control": "no-store",
        "content-type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        ok: false,
        error: message,
      }),
    };
  }
};
