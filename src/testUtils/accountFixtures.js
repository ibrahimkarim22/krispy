export async function createAccountFixture({
  username = "FixtureViewer",
  email = `${username.toLowerCase()}@example.com`,
  uid = `fixture-${username.toLowerCase()}`,
  password = "FixturePassword#2026",
} = {}) {
  return {
    user: { id: `firebase:${uid}`, uid, email, username: email },
    email,
    password,
  };
}
