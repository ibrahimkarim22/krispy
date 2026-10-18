const { expect } = require("@playwright/test");

// These tests exercise the real Firebase client against intercepted API
// responses. No requests reach Firebase and no real accounts are created or deleted.
const PASSWORD = "Browser fixture 123!";
const VIEWERS = [
  { uid: "sdk-viewer-one", email: "viewer.one@example.test", password: PASSWORD },
  { uid: "sdk-viewer-two", email: "viewer.two@example.test", password: PASSWORD },
];
function tokenFor(user) {
  const now = Math.floor(Date.now() / 1000);
  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "RS256", typ: "JWT", kid: "browser-fixture" })}.${encode({
    iss: "https://securetoken.google.com/krispy22",
    aud: "krispy22",
    auth_time: now,
    user_id: user.uid,
    sub: user.uid,
    iat: now,
    exp: now + 3600,
    email: user.email,
    email_verified: false,
    firebase: { identities: { email: [user.email] }, sign_in_provider: "password" },
  })}.browser-fixture-signature`;
}
function tokenUser(token) {
  try {
    const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    return VIEWERS.find(user => user.uid === claims.sub);
  } catch {
    return undefined;
  }
}
async function interceptFirebase(page) {
  const state = { calls: [], unexpected: [], errors: [], deleted: new Set() };
  page.on("pageerror", error => state.errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) return route.continue();
    if (!["identitytoolkit.googleapis.com", "securetoken.googleapis.com"].includes(url.hostname))
      return route.abort("blockedbyclient");
    const headers = {
      "access-control-allow-origin": request.headers().origin || "http://127.0.0.1:3000",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": request.headers()["access-control-request-headers"] || "content-type,x-client-version,x-firebase-gmpid,x-firebase-client,x-goog-api-client",
      "access-control-allow-credentials": "true",
      "cache-control": "no-store",
    };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    const endpoint = url.pathname.split("/").at(-1);
    let body = {};
    try { body = request.postDataJSON() || {}; } catch { /* STS uses form encoding. */ }
    state.calls.push({ endpoint, client: request.headers()["x-client-version"], email: body.email });
    const reply = (json, status = 200) => route.fulfill({ status, headers, json });
    const failure = message => reply({ error: { code: 400, message, errors: [{ message, domain: "global", reason: "invalid" }] } }, 400);
    if (endpoint === "accounts:signUp" || endpoint === "accounts:signInWithPassword") {
      const user = VIEWERS.find(value => value.email === body.email && value.password === body.password && !state.deleted.has(value.uid));
      state.calls.at(-1).accepted = Boolean(user);
      if (!user) return failure("INVALID_LOGIN_CREDENTIALS");
      return reply({ localId: user.uid, email: user.email, idToken: tokenFor(user),
        refreshToken: `refresh-${user.uid}`, expiresIn: "3600", registered: true });
    }
    if (endpoint === "accounts:lookup") {
      const user = tokenUser(body.idToken);
      if (!user) return failure("INVALID_ID_TOKEN");
      if (state.deleted.has(user.uid)) return failure("USER_NOT_FOUND");
      return reply({ users: [{ localId: user.uid, email: user.email, emailVerified: false,
        providerUserInfo: [{ providerId: "password", email: user.email, federatedId: user.email, rawId: user.email }],
        createdAt: "1760000000000", lastLoginAt: String(Date.now()), validSince: "1760000000" }] });
    }
    if (endpoint === "accounts:delete") {
      const user = tokenUser(body.idToken);
      if (!user) return failure("INVALID_ID_TOKEN");
      if (state.deleted.has(user.uid)) return failure("USER_NOT_FOUND");
      state.deleted.add(user.uid);
      return reply({});
    }
    if (url.hostname === "securetoken.googleapis.com" && endpoint === "token") {
      const data = new URLSearchParams(request.postData());
      const user = VIEWERS.find(value => data.get("refresh_token") === `refresh-${value.uid}`);
      if (!user) return failure("INVALID_REFRESH_TOKEN");
      if (state.deleted.has(user.uid)) return failure("USER_NOT_FOUND");
      return reply({ access_token: tokenFor(user), id_token: tokenFor(user), expires_in: "3600",
        token_type: "Bearer", refresh_token: `refresh-${user.uid}`, user_id: user.uid, project_id: "krispy22" });
    }
    if (endpoint === "projects" && request.method() === "GET")
      return reply({ projectId: "krispy22", authorizedDomains: ["localhost", "127.0.0.1"] });
    state.unexpected.push(endpoint);
    return reply({ error: { code: 500, message: "UNEXPECTED_BROWSER_FIXTURE_ENDPOINT" } }, 500);
  });
  return state;
}
const menu = page => page.getByRole("navigation", { name: "Krispy menu", exact: true });
async function choose(page, name) {
  await expect(menu(page)).toBeVisible();
  const toggle = menu(page).getByRole("button", { name: "Open menu", exact: true });
  if (await toggle.isVisible()) await toggle.click();
  await menu(page).getByRole("button", { name, exact: true }).click();
}
async function openAccount(page, name) {
  await choose(page, name);
  const dialog = page.getByRole("dialog", { name, exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}
async function completeEmail(dialog, email) {
  await dialog.getByLabel("Email", { exact: true }).fill(email);
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
}
async function login(page, user) {
  const dialog = await openAccount(page, "Login");
  await completeEmail(dialog, user.email);
  await dialog.getByLabel("Password", { exact: true }).fill(user.password);
  await dialog.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const toggle = menu(page).getByRole("button", { name: "Open menu", exact: true });
  if (await toggle.isVisible()) await expect(toggle).toBeFocused();
  else await expect(menu(page).getByRole("button", { name: "Account", exact: true })).toBeVisible();
}
async function redError(dialog, field, message) {
  const error = dialog.getByRole("alert");
  await expect(error).toHaveText(message);
  await expect(error).toHaveCSS("color", "rgb(255, 102, 121)");
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await expect(field).toHaveAttribute("aria-describedby", /account-error/);
  await expect(field).toHaveCSS("border-bottom-color", "rgb(255, 102, 121)");
}


module.exports = { PASSWORD, VIEWERS, interceptFirebase, choose, menu, openAccount, completeEmail, login, redError };
