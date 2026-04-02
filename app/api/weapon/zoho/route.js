/**
 * Zoho Books API route — legacy OAuth handlers archived under `_archive/app-api-weapon-zoho/`.
 * Use `libs/weapon/zoho` (`getAccessToken`, `getList`) from server code; restore handlers from archive when wiring OAuth again.
 */
export async function POST() {
  return Response.json(
    {
      error: "Zoho weapon route handlers are archived. See _archive/app-api-weapon-zoho/",
    },
    { status: 501 }
  );
}

export async function GET(request) {
  const action = request.nextUrl.searchParams.get("action");
  return Response.json(
    {
      error: "Zoho weapon route handlers are archived. See _archive/app-api-weapon-zoho/",
      requestedAction: action,
    },
    { status: 501 }
  );
}
