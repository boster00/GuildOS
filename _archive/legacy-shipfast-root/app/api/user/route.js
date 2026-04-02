import { createClient } from "@/libs/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req) {
// TEST 2: Old Supabase library + await fix
const supabase = await createClient();
const { data: { user }, error } = await supabase.auth.getUser();
if (error) {
  return NextResponse.json({ error: "Authentication error" }, { status: 401 });
}

if (user) {
    const body = await req.json();

    if (!body.email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    try {
      // This call will fail if you haven't created a table named "users" in your database
      const { data } = await supabase
        .from("users")
        .insert({ email: body.email })
        .select();

      return NextResponse.json({ data }, { status: 200 });
    } catch (e) {
      return NextResponse.json(
        { error: "Something went wrong" },
        { status: 500 }
      );
    }
  } else {
    // Not Signed in
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
}
