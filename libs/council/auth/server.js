import { database } from "@/libs/council/database";

export async function getCurrentUser() {
  const db = await database.init("server");
  const {
    data: { user },
    error,
  } = await db.auth.getUser();

  if (error) return null;
  return user || null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}

export async function signInWithOtp(email, emailRedirectTo) {
  const db = await database.init("server");
  return db.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo,
    },
  });
}
