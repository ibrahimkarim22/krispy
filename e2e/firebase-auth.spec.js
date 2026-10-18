const { test, expect } = require("@playwright/test");
const { PASSWORD, VIEWERS, interceptFirebase, choose, menu, openAccount, completeEmail, login, redError } = require("./helpers/firebase");

test("Firebase SDK signup, refresh, logout and login keep favorite libraries separate", async ({ page }) => {
  const api = await interceptFirebase(page);
  await page.goto("/movies", { waitUntil: "domcontentloaded" });
  await choose(page, "My list");
  await expect(page).toHaveURL(/\/favorites$/);
  await page.locator(".guest-list-prompt").getByRole("button", { name: "Sign up", exact: true }).click();
  const signup = page.getByRole("dialog", { name: "Sign up", exact: true });
  await expect(signup).toBeVisible();
  await completeEmail(signup, VIEWERS[0].email);
  await signup.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await signup.getByRole("button", { name: "Continue", exact: true }).click();
  await signup.getByLabel("Confirm password", { exact: true }).fill(PASSWORD);
  await signup.getByRole("button", { name: "Sign up", exact: true }).click();
  await expect(signup).toHaveCount(0);
  await expect(menu(page).getByRole("button", { name: "Account", exact: true })).toBeFocused();
  await page.goto("/movie/film-sintel?watch=1", { waitUntil: "domcontentloaded" });
  await expect(menu(page).getByRole("button", { name: "Account", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Add Sintel to My list", exact: true }).click();
  await expect(page.getByRole("button", { name: "Remove Sintel from My list", exact: true })).toBeVisible();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(menu(page).getByRole("button", { name: "Account", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove Sintel from My list", exact: true })).toBeVisible();
  await choose(page, "Log out");
  await expect(menu(page).getByRole("button", { name: "Login", exact: true })).toBeVisible();
  await login(page, VIEWERS[1]);
  await choose(page, "My list");
  await expect(page.getByRole("button", { name: "Select Sintel", exact: true })).toHaveCount(0);
  await choose(page, "Log out");
  await login(page, VIEWERS[0]);
  await choose(page, "My list");
  await expect(page.getByRole("button", { name: "Select Sintel", exact: true })).toBeVisible();
  expect(api.calls.filter(call => call.endpoint === "accounts:signUp")).toHaveLength(1);
  expect(api.calls.filter(call => call.endpoint === "accounts:signInWithPassword")).toHaveLength(2);
  expect(api.calls.some(call => /JsCore\//.test(call.client || ""))).toBe(true);
  expect(api.unexpected).toEqual([]);
  expect(api.errors).toEqual([]);
});

test("desktop and phone email/password validation uses associated red feedback before Firebase calls", async ({ page }) => {
  const api = await interceptFirebase(page);
  for (const [width, height] of [[1440, 900], [320, 740]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/movies", { waitUntil: "domcontentloaded" });
    const dialog = await openAccount(page, "Sign up");
    const email = dialog.getByLabel("Email", { exact: true });
    await expect(email).toBeFocused();
    await expect(email).toHaveAttribute("type", "email");
    await expect(email).toHaveAttribute("inputmode", "email");
    await expect(email).toHaveAttribute("autocomplete", "email");
    await email.fill("not-an-email");
    await dialog.getByRole("button", { name: "Continue", exact: true }).click();
    await redError(dialog, email, "Enter a valid email address.");
    await expect(email).toBeFocused();
    await completeEmail(dialog, VIEWERS[0].email);
    const password = dialog.getByLabel("Password", { exact: true });
    await expect(password).toHaveAttribute("autocomplete", "new-password");
    await password.fill("short");
    await dialog.getByRole("button", { name: "Continue", exact: true }).click();
    await redError(dialog, password, "Use a password with at least 8 characters.");
    await expect(password).toBeFocused();
    await password.fill(PASSWORD);
    await dialog.getByRole("button", { name: "Continue", exact: true }).click();
    const confirm = dialog.getByLabel("Confirm password", { exact: true });
    await confirm.fill("Does not match 123!");
    await dialog.getByRole("button", { name: "Sign up", exact: true }).click();
    await redError(dialog, confirm, "The passwords do not match.");
    await expect(confirm).toBeFocused();
    await expect(confirm).toBeInViewport();
    await page.screenshot({ path: `test-results/firebase-auth/signup-error-${width}x${height}.png` });
  }
  expect(api.calls).toEqual([]);
  expect(api.unexpected).toEqual([]);
  expect(api.errors).toEqual([]);
});

test("Firebase invalid credentials stay generic and red on desktop and phone", async ({ page }) => {
  const api = await interceptFirebase(page);
  for (const [width, height] of [[1440, 900], [320, 740]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/movies", { waitUntil: "domcontentloaded" });
    const dialog = await openAccount(page, "Login");
    await completeEmail(dialog, "unknown.viewer@example.test");
    const password = dialog.getByLabel("Password", { exact: true });
    await expect(password).toHaveAttribute("autocomplete", "current-password");
    await password.fill("Incorrect fixture password");
    await dialog.getByRole("button", { name: "Log in", exact: true }).click();
    await redError(dialog, password, /email.*password.*(?:incorrect|invalid|match)/i);
    await expect(dialog.getByRole("alert")).not.toHaveText(/no account|not found|does not exist/i);
    await expect(dialog).toBeVisible();
    await page.screenshot({ path: `test-results/firebase-auth/login-error-${width}x${height}.png` });
    await dialog.getByRole("button", { name: "Close account", exact: true }).click();
    await expect(menu(page).getByRole("button", { name: width < 1000 ? "Open menu" : "Login", exact: true })).toBeFocused();
  }
  expect(api.calls.filter(call => call.endpoint === "accounts:signInWithPassword")).toHaveLength(2);
  expect(api.unexpected).toEqual([]);
  expect(api.errors).toEqual([]);
});

async function completeDeleteFocusRing(page, control) {
  await page.keyboard.press("Tab");
  await control.focus();
  await expect(control).toBeFocused();
  const clipped = await control.evaluate(element => {
    const style = getComputedStyle(element);
    const bounds = element.getBoundingClientRect();
    const extent = Math.max(0, parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset));
    const ring = { left: bounds.left - extent, top: bounds.top - extent, right: bounds.right + extent, bottom: bounds.bottom + extent };
    const clips = [{ name: "viewport", x: true, y: true, left: 0, top: 0, right: innerWidth, bottom: innerHeight }];
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      const computed = getComputedStyle(parent);
      const x = /^(auto|scroll|hidden|clip)$/.test(computed.overflowX);
      const y = /^(auto|scroll|hidden|clip)$/.test(computed.overflowY);
      if (!x && !y) continue;
      const rect = parent.getBoundingClientRect();
      const left = rect.left + parent.clientLeft;
      const top = rect.top + parent.clientTop;
      clips.push({ name: parent.className || parent.tagName, x, y, left, top, right: left + parent.clientWidth, bottom: top + parent.clientHeight });
    }
    return { focusVisible: element.matches(":focus-visible"), width: parseFloat(style.outlineWidth),
      failures: clips.filter(clip => (clip.x && (ring.left < clip.left - 0.5 || ring.right > clip.right + 0.5))
        || (clip.y && (ring.top < clip.top - 0.5 || ring.bottom > clip.bottom + 0.5))).map(clip => ({ ring, clip })) };
  });
  expect(clipped.focusVisible).toBe(true);
  expect(clipped.width).toBeGreaterThan(0);
  expect(clipped.failures).toEqual([]);
}

for (const [width, height] of [[1440, 900], [320, 740]]) {
  test(`Firebase SDK account deletion reauthenticates and removes only its local library at ${width}px`, async ({ page }, testInfo) => {
    const api = await interceptFirebase(page);
    await page.setViewportSize({ width, height });
    await page.goto("/movies", { waitUntil: "domcontentloaded" });
    await login(page, VIEWERS[0]);
    await page.goto("/movie/film-sintel?watch=1", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Add Sintel to My list", exact: true }).click();
    await expect(page.getByRole("button", { name: "Remove Sintel from My list", exact: true })).toBeVisible();
    const ownKey = `krispy.library.v1.firebase.${VIEWERS[0].uid}`;
    const preserved = {
      [`krispy.library.v1.firebase.${VIEWERS[1].uid}`]: JSON.stringify({ version: 1, saved: ["film-sintel"], progress: {}, recent: [] }),
      "krispy.library.v1.guest": JSON.stringify({ version: 1, saved: [], progress: {}, recent: ["film-sintel"] }),
      "krispy.accounts.v1": "preserved-legacy-account-records",
      "focus-test-unrelated": "preserved-unrelated-setting",
    };
    const ownBefore = await page.evaluate(({ ownKey, preserved }) => {
      Object.entries(preserved).forEach(([key, value]) => localStorage.setItem(key, value));
      return localStorage.getItem(ownKey);
    }, { ownKey, preserved });
    expect(JSON.parse(ownBefore).saved).toContain("film-sintel");

    const account = await openAccount(page, "Account");
    const beforeConfirmation = api.calls.length;
    await account.getByRole("button", { name: "Delete account", exact: true }).click();
    let confirmation = page.getByRole("dialog", { name: "Delete account", exact: true });
    await expect(confirmation).toBeVisible();
    await expect(confirmation.getByLabel("Password", { exact: true })).toBeFocused();
    expect(api.calls).toHaveLength(beforeConfirmation);
    await confirmation.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Account", exact: true })).toBeVisible();
    expect(api.calls).toHaveLength(beforeConfirmation);
    expect(await page.evaluate(key => localStorage.getItem(key), ownKey)).toBe(ownBefore);

    await page.getByRole("dialog", { name: "Account", exact: true }).getByRole("button", { name: "Delete account", exact: true }).click();
    confirmation = page.getByRole("dialog", { name: "Delete account", exact: true });
    const password = confirmation.getByLabel("Password", { exact: true });
    const remove = confirmation.getByRole("button", { name: "Delete account", exact: true });
    await expect(password).toHaveAttribute("autocomplete", "current-password");
    await remove.click();
    await redError(confirmation, password, /enter.*password/i);
    expect(api.calls).toHaveLength(beforeConfirmation);
    await password.fill("Incorrect fixture password");
    await remove.click();
    await redError(confirmation, password, /password.*(?:incorrect|invalid|match)/i);
    await expect(confirmation).toBeVisible();
    expect(api.calls.filter(call => call.endpoint === "accounts:delete")).toHaveLength(0);
    expect(await page.evaluate(key => localStorage.getItem(key), ownKey)).toBe(ownBefore);
    await page.screenshot({ path: testInfo.outputPath(`delete-error-${width}x${height}.png`) });

    await password.fill(PASSWORD);
    await completeDeleteFocusRing(page, confirmation.getByRole("button", { name: "Cancel", exact: true }));
    await completeDeleteFocusRing(page, remove);
    await page.screenshot({ path: testInfo.outputPath(`delete-confirm-${width}x${height}.png`) });
    await remove.click();
    await expect(confirmation).toHaveCount(0);
    await expect(menu(page).getByRole("button", { name: width < 1000 ? "Open menu" : "Login", exact: true })).toBeFocused();
    expect(api.deleted.has(VIEWERS[0].uid)).toBe(true);
    expect(api.calls.filter(call => call.endpoint === "accounts:delete")).toHaveLength(1);
    const removedAt = api.calls.findIndex(call => call.endpoint === "accounts:delete");
    const reauthentication = api.calls.slice(beforeConfirmation, removedAt).filter(call => call.endpoint === "accounts:signInWithPassword");
    expect(reauthentication.map(call => call.accepted)).toEqual([false, true]);
    expect(reauthentication.at(-1).email).toBe(VIEWERS[0].email);
    expect(api.calls.filter(call => call.endpoint === "accounts:signInWithPassword")).toHaveLength(3);
    expect(await page.evaluate(key => localStorage.getItem(key), ownKey)).toBeNull();
    const preservedAfter = await page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), Object.keys(preserved));
    expect(preservedAfter).toEqual(preserved);

    await page.goto("/movies", { waitUntil: "domcontentloaded" });
    await page.reload({ waitUntil: "domcontentloaded" });
    const loginDialog = await openAccount(page, "Login");
    await completeEmail(loginDialog, VIEWERS[0].email);
    const loginPassword = loginDialog.getByLabel("Password", { exact: true });
    await loginPassword.fill(PASSWORD);
    await loginDialog.getByRole("button", { name: "Log in", exact: true }).click();
    await redError(loginDialog, loginPassword, /email.*password.*(?:incorrect|invalid|match)/i);
    expect(await page.evaluate(key => localStorage.getItem(key), ownKey)).toBeNull();
    expect(api.unexpected).toEqual([]);
    expect(api.errors).toEqual([]);
  });
}
