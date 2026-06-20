const COOKIE_NAME = "rock_youth_auth";

function toHex(buffer) {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function authCookieName() {
  return COOKIE_NAME;
}

export async function authToken() {
  const password = process.env.APP_PASSWORD || "";
  const secret = process.env.AUTH_SECRET || password;
  if (!password) return "";

  const data = new TextEncoder().encode(`${password}:${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
}
