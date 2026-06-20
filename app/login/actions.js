"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authCookieName, authToken } from "@/lib/auth-token";

export async function login(formData) {
  const password = String(formData.get("password") || "");
  const nextPath = String(formData.get("next") || "/");

  if (!process.env.APP_PASSWORD || password !== process.env.APP_PASSWORD) {
    redirect(`/login?error=1&next=${encodeURIComponent(nextPath)}`);
  }

  const cookieStore = await cookies();
  cookieStore.set(authCookieName(), await authToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });

  redirect(nextPath.startsWith("/") ? nextPath : "/");
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(authCookieName());
  redirect("/login");
}
