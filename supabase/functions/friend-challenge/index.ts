// Retired client-score protocol. Legacy rows remain archived, never authoritative.
Deno.serve(
  (req: Request) =>
    new Response(
      req.method === "OPTIONS"
        ? null
        : JSON.stringify({
            error:
              "This game version is retired. Reload the app to play a server-verified match. Browser score uploads are disabled.",
          }),
      {
        status: req.method === "OPTIONS" ? 204 : 410,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers":
            "authorization, apikey, content-type, x-client-info",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      },
    ),
);
