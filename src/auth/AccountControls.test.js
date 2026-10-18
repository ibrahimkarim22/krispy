import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AccountProvider } from "./AccountContext";
import AccountControls from "./AccountControls";

const EMAIL = "viewer.one@example.com";
const PASSWORD = " exact-password ";
const firebaseUser = (email = EMAIL) => ({ id: "firebase:test-viewer", email, username: email });

function createStore(initialUser = null) {
  let currentUser = initialUser;
  const listeners = new Set();
  const store = {
    getUser: () => currentUser,
    subscribe: jest.fn((listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
    publish(user) {
      currentUser = user;
      listeners.forEach((listener) => listener(user));
    },
    signUp: jest.fn(async ({ email }) => {
      store.publish(firebaseUser(email));
      return { ok: true, message: "Account created." };
    }),
    logIn: jest.fn(async ({ email }) => {
      store.publish(firebaseUser(email));
      return { ok: true, message: "Logged in." };
    }),
    logOut: jest.fn(async () => {
      store.publish(null);
      return { ok: true, message: "Logged out." };
    }),
    deleteAccount: jest.fn(async () => {
      store.publish(null);
      return { ok: true, message: "Account deleted." };
    }),
  };
  return store;
}

function renderControls(store = createStore(), children = null, controlsProps = {}) {
  return render(<AccountProvider store={store}><AccountControls {...controlsProps} />{children}</AccountProvider>);
}

function deferredOperation() {
  let resolve;
  let reject;
  const promise = new Promise((release, fail) => { resolve = release; reject = fail; });
  return { promise, resolve, reject };
}

async function nextFrame() {
  await act(async () => {
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
  });
}

// Keep async authentication updates inside this project's React event wrapper.
async function click(element) {
  // eslint-disable-next-line testing-library/no-unnecessary-act
  await act(async () => { fireEvent.click(element); });
}

function change(element, value) {
  fireEvent.change(element, { target: { value } });
}

async function fillWizard(dialog, mode, { email = EMAIL, password = PASSWORD, confirmPassword = password } = {}) {
  change(within(dialog).getByLabelText("Email"), email);
  await click(within(dialog).getByRole("button", { name: "Continue" }));
  change(within(dialog).getByLabelText("Password"), password);
  if (mode === "signup") {
    await click(within(dialog).getByRole("button", { name: "Continue" }));
    change(within(dialog).getByLabelText("Confirm password"), confirmPassword);
  }
}

async function openDeletion() {
  await click(screen.getByRole("button", { name: `Account for ${EMAIL}` }));
  const dialog = screen.getByRole("dialog", { name: "Account" });
  await click(within(dialog).getByRole("button", { name: "Delete account" }));
  return screen.getByRole("dialog", { name: "Delete account" });
}

beforeAll(() => {
  // jsdom lacks the native dialog lifecycle; browser tests verify the real API.
  HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
  HTMLDialogElement.prototype.show = function show() { this.open = true; };
  HTMLDialogElement.prototype.close = function close() { this.open = false; };
});

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

test("hidden account launchers leave the resting wall without account controls", () => {
  renderControls(createStore(), null, { hideLauncher: true });
  expect(screen.queryByRole("button", { name: "Log in" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Sign up" })).toBeNull();
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("external requests open the email wizard and Escape restores the menu trigger", async () => {
  const triggerRef = React.createRef();
  const closed = jest.fn();
  renderControls(createStore(), <button ref={triggerRef} aria-label="Open menu">Menu</button>, {
    hideLauncher: true, request: { mode: "signup", id: 1 }, returnFocusRef: triggerRef, onRequestClose: closed,
  });
  const dialog = screen.getByRole("dialog", { name: "Sign up" });
  const email = within(dialog).getByLabelText("Email");
  expect(email).toHaveFocus();
  expect(email).toHaveAttribute("type", "email");
  expect(email).toHaveAttribute("inputmode", "email");
  expect(email).toHaveAttribute("autocomplete", "email");
  expect(email).not.toHaveAttribute("maxlength");
  expect(email).not.toHaveAttribute("minlength");
  expect(within(dialog).queryByLabelText("Username")).toBeNull();
  change(email, EMAIL);
  await click(within(dialog).getByRole("button", { name: "Continue" }));
  expect(within(dialog).getByLabelText("Password")).toHaveFocus();
  fireEvent.keyDown(dialog, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(closed).toHaveBeenCalledTimes(1);
  await waitFor(() => expect(triggerRef.current).toHaveFocus());
});

test("new external request IDs reset credentials while the same request preserves the wizard", async () => {
  const store = createStore();
  const controls = (request) => <AccountProvider store={store}><AccountControls hideLauncher request={request} /></AccountProvider>;
  const view = render(controls({ mode: "login", id: 1 }));
  let dialog = screen.getByRole("dialog", { name: "Login" });
  await fillWizard(dialog, "login");
  view.rerender(controls({ mode: "login", id: 1 }));
  expect(within(dialog).getByLabelText("Password")).toHaveValue(PASSWORD);
  view.rerender(controls({ mode: "signup", id: 2 }));
  dialog = screen.getByRole("dialog", { name: "Sign up" });
  expect(within(dialog).getByLabelText("Email")).toHaveValue("");
  expect(within(dialog).getByLabelText("Email")).toHaveFocus();
  change(within(dialog).getByLabelText("Email"), "other@example.com");
  within(dialog).getByRole("button", { name: "Close account" }).focus();
  view.rerender(controls({ mode: "signup", id: 3 }));
  expect(within(dialog).getByLabelText("Email")).toHaveValue("");
  expect(within(dialog).getByLabelText("Email")).toHaveFocus();
});

test("external requests cannot reopen a closed wizard while signup is pending", async () => {
  const store = createStore();
  const operation = deferredOperation();
  store.signUp.mockReturnValue(operation.promise);
  const closed = jest.fn();
  const controls = (request) => <AccountProvider store={store}>
    <AccountControls hideLauncher request={request} onRequestClose={closed} />
    <input aria-label="Search everything" />
  </AccountProvider>;
  const view = render(controls({ mode: "signup", id: 1 }));
  const dialog = screen.getByRole("dialog", { name: "Sign up" });
  await fillWizard(dialog, "signup");
  await click(within(dialog).getByRole("button", { name: "Sign up" }));
  expect(within(dialog).getByRole("button", { name: "Creating account" })).toBeDisabled();
  await click(within(dialog).getByRole("button", { name: "Close account" }));
  view.rerender(controls({ mode: "login", id: 2 }));
  expect(screen.queryByRole("dialog")).toBeNull();
  const search = screen.getByLabelText("Search everything");
  search.focus();
  change(search, "sunset film");
  await act(async () => { operation.resolve({ ok: false, message: "Connection failed." }); });
  expect(await screen.findByRole("alert")).toHaveClass("account-notice--standalone");
  expect(screen.getByRole("alert")).toBeVisible();
  await nextFrame();
  expect(search).toHaveFocus();
  expect(search).toHaveValue("sunset film");
  expect(closed).toHaveBeenCalledTimes(2);
});

test("external signup and asynchronous logout dismiss the request and focus the menu", async () => {
  const store = createStore();
  const closed = jest.fn();
  const triggerRef = React.createRef();
  function RequestedControls() {
    const [request, setRequest] = React.useState({ mode: "signup", id: 1 });
    return <>
      <AccountControls hideLauncher request={request} returnFocusRef={triggerRef} onRequestClose={() => { closed(); setRequest(null); }} />
      <button ref={triggerRef} aria-label="Open menu" onClick={() => setRequest({ mode: "account", id: 2 })}>Menu</button>
    </>;
  }
  render(<AccountProvider store={store}><RequestedControls /></AccountProvider>);
  let dialog = screen.getByRole("dialog", { name: "Sign up" });
  await fillWizard(dialog, "signup");
  await click(within(dialog).getByRole("button", { name: "Sign up" }));
  expect(store.signUp).toHaveBeenCalledWith({ email: EMAIL, password: PASSWORD, confirmPassword: PASSWORD });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(screen.getByRole("status")).toHaveClass("sr-only");
  expect(screen.queryByRole("button", { name: `Account for ${EMAIL}` })).toBeNull();
  await waitFor(() => expect(triggerRef.current).toHaveFocus());
  await click(triggerRef.current);
  dialog = screen.getByRole("dialog", { name: "Account" });
  expect(within(dialog).getByText(EMAIL)).toBeInTheDocument();
  expect(within(dialog).getByText("Signed in")).toBeInTheDocument();
  expect(within(dialog).getByText(/list.*stays in this browser/i)).toBeInTheDocument();
  await click(within(dialog).getByRole("button", { name: "Log out" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(store.logOut).toHaveBeenCalledTimes(1);
  expect(closed).toHaveBeenCalledTimes(2);
  await waitFor(() => expect(triggerRef.current).toHaveFocus());
});

test("native cancellation and the Escape fallback restore the launcher focus", async () => {
  const view = renderControls();
  let trigger = screen.getByRole("button", { name: "Log in" });
  await click(trigger);
  fireEvent(screen.getByRole("dialog", { name: "Login" }), new Event("cancel", { cancelable: true }));
  await waitFor(() => expect(trigger).toHaveFocus());
  view.unmount();
  const nativeShowModal = HTMLDialogElement.prototype.showModal;
  HTMLDialogElement.prototype.showModal = undefined;
  try {
    renderControls();
    trigger = screen.getByRole("button", { name: "Log in" });
    await click(trigger);
    fireEvent.keyDown(screen.getByRole("dialog", { name: "Login" }), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(trigger).toHaveFocus());
  } finally {
    HTMLDialogElement.prototype.showModal = nativeShowModal;
  }
});

test("modal focus wraps between enabled controls while nonmodal dialogs allow navigation", async () => {
  const view = renderControls();
  await click(screen.getByRole("button", { name: "Sign up" }));
  let dialog = screen.getByRole("dialog", { name: "Sign up" });
  const first = within(dialog).getByRole("button", { name: "Close account" });
  const last = within(dialog).getByRole("button", { name: "Use Login" });
  last.focus();
  fireEvent.keyDown(last, { key: "Tab" });
  expect(first).toHaveFocus();
  fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
  expect(last).toHaveFocus();
  expect(dialog).toHaveAttribute("aria-modal", "true");
  view.unmount();
  renderControls(createStore(), null, { modal: false });
  await click(screen.getByRole("button", { name: "Log in" }));
  dialog = screen.getByRole("dialog", { name: "Login" });
  expect(dialog).not.toHaveAttribute("aria-modal");
  const switchButton = within(dialog).getByRole("button", { name: "Create an account" });
  switchButton.focus();
  expect(fireEvent.keyDown(switchButton, { key: "Tab" })).toBe(true);
  expect(switchButton).toHaveFocus();
});

test.each(["", "not-an-email", "viewer@example"])("invalid email %p stays on the first step with an associated error", async (email) => {
  const store = createStore();
  renderControls(store);
  await click(screen.getByRole("button", { name: "Sign up" }));
  const dialog = screen.getByRole("dialog", { name: "Sign up" });
  const field = within(dialog).getByLabelText("Email");
  change(field, email);
  await click(within(dialog).getByRole("button", { name: "Continue" }));
  const error = within(dialog).getByRole("alert");
  expect(error).toHaveTextContent("Enter a valid email address.");
  expect(error).toHaveClass("account-feedback");
  expect(field).toHaveAttribute("aria-invalid", "true");
  expect(field.getAttribute("aria-describedby").split(" ")).toContain(error.id);
  expect(field).toHaveFocus();
  expect(store.signUp).not.toHaveBeenCalled();
  change(field, EMAIL);
  expect(field).not.toHaveAttribute("aria-invalid");
  expect(within(dialog).queryByRole("alert")).toBeNull();
});

test("signup validates length and matching passwords, and Back retains exact values", async () => {
  const store = createStore();
  renderControls(store);
  await click(screen.getByRole("button", { name: "Sign up" }));
  const dialog = screen.getByRole("dialog", { name: "Sign up" });
  expect(within(dialog).getByRole("button", { name: "Back" })).toBeDisabled();
  expect(within(dialog).getByText("Step 1 of 3")).toBeInTheDocument();
  change(within(dialog).getByLabelText("Email"), EMAIL);
  await click(within(dialog).getByRole("button", { name: "Continue" }));
  const password = within(dialog).getByLabelText("Password");
  expect(password).toHaveFocus();
  expect(password).toHaveAttribute("autocomplete", "new-password");
  change(password, "short");
  await click(within(dialog).getByRole("button", { name: "Continue" }));
  expect(within(dialog).getByRole("alert")).toHaveTextContent(/at least 8/i);
  expect(password).toHaveAttribute("aria-invalid", "true");
  change(password, PASSWORD);
  await click(within(dialog).getByRole("button", { name: "Continue" }));
  const confirm = within(dialog).getByLabelText("Confirm password");
  expect(confirm).toHaveFocus();
  change(confirm, "different-password");
  await click(within(dialog).getByRole("button", { name: "Sign up" }));
  expect(within(dialog).getByRole("alert")).toHaveTextContent(/do not match/i);
  expect(confirm).toHaveAttribute("aria-invalid", "true");
  expect(store.signUp).not.toHaveBeenCalled();
  await click(within(dialog).getByRole("button", { name: "Back" }));
  expect(within(dialog).getByLabelText("Password")).toHaveValue(PASSWORD);
  await click(within(dialog).getByRole("button", { name: "Back" }));
  expect(within(dialog).getByLabelText("Email")).toHaveValue(EMAIL);
});

test("signup, restored Firebase state, logout, failed login, and login success use the injected store", async () => {
  const store = createStore();
  let view = renderControls(store);
  await click(screen.getByRole("button", { name: "Sign up" }));
  let dialog = screen.getByRole("dialog", { name: "Sign up" });
  await fillWizard(dialog, "signup", { email: ` ${EMAIL} ` });
  await click(within(dialog).getByRole("button", { name: "Sign up" }));
  expect(await screen.findByRole("button", { name: `Account for ${EMAIL}` })).toBeInTheDocument();
  expect(store.signUp).toHaveBeenCalledWith({ email: EMAIL, password: PASSWORD, confirmPassword: PASSWORD });
  await waitFor(() => expect(screen.getByRole("button", { name: `Account for ${EMAIL}` })).toHaveFocus());
  view.unmount();
  view = renderControls(store);
  await click(screen.getByRole("button", { name: `Account for ${EMAIL}` }));
  await click(within(screen.getByRole("dialog", { name: "Account" })).getByRole("button", { name: "Log out" }));
  await click(screen.getByRole("button", { name: "Log in" }));
  dialog = screen.getByRole("dialog", { name: "Login" });
  store.logIn.mockResolvedValueOnce({ ok: false, message: "Email or password is incorrect." });
  await fillWizard(dialog, "login", { password: "wrong-password" });
  await click(within(dialog).getByRole("button", { name: "Log in" }));
  expect(within(dialog).getByRole("alert")).toHaveTextContent(/incorrect/i);
  expect(within(dialog).getByLabelText("Password")).toHaveAttribute("aria-invalid", "true");
  change(within(dialog).getByLabelText("Password"), PASSWORD);
  await click(within(dialog).getByRole("button", { name: "Log in" }));
  expect(await screen.findByRole("button", { name: `Account for ${EMAIL}` })).toBeInTheDocument();
  expect(store.logIn).toHaveBeenLastCalledWith({ email: EMAIL, password: PASSWORD });
  view.unmount();
});

test("login accepts an existing six-character password and rejects only an empty password", async () => {
  const store = createStore();
  renderControls(store);
  await click(screen.getByRole("button", { name: "Log in" }));
  const dialog = screen.getByRole("dialog", { name: "Login" });
  change(within(dialog).getByLabelText("Email"), EMAIL);
  await click(within(dialog).getByRole("button", { name: "Continue" }));
  const password = within(dialog).getByLabelText("Password");
  expect(password).toHaveAttribute("autocomplete", "current-password");
  await click(within(dialog).getByRole("button", { name: "Log in" }));
  expect(within(dialog).getByRole("alert")).toHaveTextContent("Enter your password.");
  expect(store.logIn).not.toHaveBeenCalled();
  change(password, "sixsix");
  await click(within(dialog).getByRole("button", { name: "Log in" }));
  expect(store.logIn).toHaveBeenCalledWith({ email: EMAIL, password: "sixsix" });
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("switching Login and Sign up retains email and clears passwords", async () => {
  renderControls();
  await click(screen.getByRole("button", { name: "Log in" }));
  let dialog = screen.getByRole("dialog", { name: "Login" });
  await fillWizard(dialog, "login");
  await click(within(dialog).getByRole("button", { name: "Create an account" }));
  dialog = screen.getByRole("dialog", { name: "Sign up" });
  expect(within(dialog).getByLabelText("Email")).toHaveValue(EMAIL);
  await click(within(dialog).getByRole("button", { name: "Continue" }));
  expect(within(dialog).getByLabelText("Password")).toHaveValue("");
  expect(within(dialog).queryByLabelText("Confirm password")).toBeNull();
  await click(within(dialog).getByRole("button", { name: "Use Login" }));
  dialog = screen.getByRole("dialog", { name: "Login" });
  expect(within(dialog).getByLabelText("Email")).toHaveValue(EMAIL);
  await click(within(dialog).getByRole("button", { name: "Continue" }));
  expect(within(dialog).getByLabelText("Password")).toHaveValue("");
});

test.each(["signup", "login"])("a rejected %s promise becomes visible feedback without closing the wizard", async (mode) => {
  const store = createStore();
  store[mode === "signup" ? "signUp" : "logIn"].mockRejectedValue(new Error("Network unavailable. Try again."));
  renderControls(store);
  await click(screen.getByRole("button", { name: mode === "signup" ? "Sign up" : "Log in" }));
  const dialog = screen.getByRole("dialog", { name: mode === "signup" ? "Sign up" : "Login" });
  await fillWizard(dialog, mode);
  await click(within(dialog).getByRole("button", { name: mode === "signup" ? "Sign up" : "Log in" }));
  const error = within(dialog).getByRole("alert");
  expect(error).toHaveTextContent("Network unavailable. Try again.");
  expect(error).toHaveClass("account-feedback");
  const field = within(dialog).getByLabelText(mode === "signup" ? "Confirm password" : "Password");
  expect(field).toHaveAttribute("aria-invalid", "true");
  expect(field.getAttribute("aria-describedby").split(" ")).toContain(error.id);
  expect(field).toBeEnabled();
});

test.each([false, true])("logout failure remains visible and retryable (rejected promise: %s)", async (rejects) => {
  const store = createStore(firebaseUser());
  if (rejects) store.logOut.mockRejectedValueOnce(new Error("Unable to log out. Try again."));
  else store.logOut.mockResolvedValueOnce({ ok: false, message: "Unable to log out. Try again." });
  renderControls(store);
  await click(screen.getByRole("button", { name: `Account for ${EMAIL}` }));
  const dialog = screen.getByRole("dialog", { name: "Account" });
  await click(within(dialog).getByRole("button", { name: "Log out" }));
  expect(within(dialog).getByRole("alert")).toHaveTextContent("Unable to log out. Try again.");
  expect(within(dialog).getByRole("button", { name: "Log out" })).toBeEnabled();
  expect(screen.getByRole("button", { name: `Account for ${EMAIL}` })).toBeInTheDocument();
  await click(within(dialog).getByRole("button", { name: "Log out" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByRole("button", { name: "Log in" })).toBeInTheDocument();
});

test("pending logout prevents duplicate requests and waits before closing", async () => {
  const store = createStore(firebaseUser());
  const operation = deferredOperation();
  store.logOut.mockReturnValueOnce(operation.promise);
  renderControls(store);
  await click(screen.getByRole("button", { name: `Account for ${EMAIL}` }));
  const dialog = screen.getByRole("dialog", { name: "Account" });
  await click(within(dialog).getByRole("button", { name: "Log out" }));
  const pending = within(dialog).getByRole("button", { name: "Logging out" });
  expect(pending).toBeDisabled();
  fireEvent.click(pending);
  expect(store.logOut).toHaveBeenCalledTimes(1);
  expect(dialog).toBeInTheDocument();
  await act(async () => { store.publish(null); operation.resolve({ ok: true, message: "Logged out." }); });
  expect(screen.queryByRole("dialog")).toBeNull();
});

test.each([["signup", true], ["signup", false], ["login", true], ["login", false]])(
  "a closed pending %s result (success: %s) preserves external search focus and typing", async (mode, success) => {
    const store = createStore();
    const operation = deferredOperation();
    store[mode === "signup" ? "signUp" : "logIn"].mockReturnValue(operation.promise);
    renderControls(store, <input aria-label="Search everything" />);
    await click(screen.getByRole("button", { name: mode === "signup" ? "Sign up" : "Log in" }));
    const dialog = screen.getByRole("dialog", { name: mode === "signup" ? "Sign up" : "Login" });
    await fillWizard(dialog, mode);
    await click(within(dialog).getByRole("button", { name: mode === "signup" ? "Sign up" : "Log in" }));
    await click(within(dialog).getByRole("button", { name: "Close account" }));
    const search = screen.getByLabelText("Search everything");
    search.focus();
    change(search, "sunset film");
    await act(async () => {
      if (success) { store.publish(firebaseUser()); operation.resolve({ ok: true, message: "Signed in." }); }
      else operation.reject(new Error("Connection failed."));
    });
    const result = success
      ? screen.getByRole("button", { name: `Account for ${EMAIL}` })
      : screen.getByRole("alert");
    expect(result).toHaveTextContent(success ? EMAIL : "Connection failed.");
    await nextFrame();
    expect(search).toHaveFocus();
    expect(search).toHaveValue("sunset film");
  },
);

test("a closed pending signup failure stays visible and restores its launcher focus", async () => {
  const store = createStore();
  const operation = deferredOperation();
  store.signUp.mockReturnValue(operation.promise);
  renderControls(store);
  const trigger = screen.getByRole("button", { name: "Sign up" });
  await click(trigger);
  const dialog = screen.getByRole("dialog", { name: "Sign up" });
  await fillWizard(dialog, "signup");
  await click(within(dialog).getByRole("button", { name: "Sign up" }));
  await click(within(dialog).getByRole("button", { name: "Close account" }));
  expect(document.body.style.overflow).not.toBe("hidden");
  await act(async () => { operation.reject(new Error("Connection failed.")); });
  expect(screen.getByRole("alert")).toBeVisible();
  expect(screen.getByRole("alert")).toHaveClass("account-notice");
  await waitFor(() => expect(trigger).toHaveFocus());
});

test("pending account completion leaves a different open dialog in charge of focus", async () => {
  const store = createStore();
  const operation = deferredOperation();
  store.signUp.mockReturnValue(operation.promise);
  const searchDialog = React.createRef();
  renderControls(store, <dialog ref={searchDialog} aria-label="Search"><input aria-label="Search everything" /></dialog>);
  await click(screen.getByRole("button", { name: "Sign up" }));
  const dialog = screen.getByRole("dialog", { name: "Sign up" });
  await fillWizard(dialog, "signup");
  await click(within(dialog).getByRole("button", { name: "Sign up" }));
  await click(within(dialog).getByRole("button", { name: "Close account" }));
  searchDialog.current.showModal();
  expect(document.body).toHaveFocus();
  await act(async () => { operation.reject(new Error("Connection failed.")); });
  expect(screen.getByRole("alert")).toHaveTextContent("Connection failed.");
  await nextFrame();
  expect(document.body).toHaveFocus();
  expect(screen.getByRole("dialog", { name: "Search" })).toBeInTheDocument();
});

test("Delete account opens an inline confirmation and Cancel returns focus without deleting", async () => {
  const store = createStore(firebaseUser());
  renderControls(store);
  await click(screen.getByRole("button", { name: `Account for ${EMAIL}` }));
  const dialog = screen.getByRole("dialog", { name: "Account" });
  await click(within(dialog).getByRole("button", { name: "Delete account" }));
  expect(screen.getByRole("dialog", { name: "Delete account" })).toBe(dialog);
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  expect(within(dialog).getByText(/permanently deletes your account/i)).toBeInTheDocument();
  expect(within(dialog).getByText(/saved titles and viewing history on this browser/i)).toBeInTheDocument();
  const password = within(dialog).getByLabelText("Password");
  expect(password).toHaveAttribute("type", "password");
  expect(password).toHaveAttribute("autocomplete", "current-password");
  expect(password).toHaveFocus();
  change(password, PASSWORD);
  expect(store.deleteAccount).not.toHaveBeenCalled();
  await click(within(dialog).getByRole("button", { name: "Cancel" }));
  expect(screen.getByRole("dialog", { name: "Account" })).toBe(dialog);
  expect(within(dialog).getByRole("button", { name: "Delete account" })).toHaveFocus();
  expect(store.deleteAccount).not.toHaveBeenCalled();
  await click(within(dialog).getByRole("button", { name: "Delete account" }));
  expect(within(dialog).getByLabelText("Password")).toHaveValue("");
});

test.each(["button", "Escape", "cancel event"])("closing deletion confirmation with %s does not delete", async (action) => {
  const store = createStore(firebaseUser());
  renderControls(store);
  const dialog = await openDeletion();
  change(within(dialog).getByLabelText("Password"), PASSWORD);
  if (action === "button") await click(within(dialog).getByRole("button", { name: "Close account" }));
  else if (action === "Escape") fireEvent.keyDown(dialog, { key: "Escape" });
  else fireEvent(dialog, new Event("cancel", { cancelable: true }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(store.deleteAccount).not.toHaveBeenCalled();
  expect(store.getUser()).toEqual(firebaseUser());
  await waitFor(() => expect(screen.getByRole("button", { name: `Account for ${EMAIL}` })).toHaveFocus());
});

test("deletion requires a current password and associates its error with the field", async () => {
  const store = createStore(firebaseUser());
  renderControls(store);
  const dialog = await openDeletion();
  await click(within(dialog).getByRole("button", { name: "Delete account" }));
  const password = within(dialog).getByLabelText("Password");
  const error = within(dialog).getByRole("alert");
  expect(error).toHaveTextContent("Enter your current password.");
  expect(error).toHaveClass("account-feedback");
  expect(password).toHaveAttribute("aria-invalid", "true");
  expect(password.getAttribute("aria-describedby").split(" ")).toContain(error.id);
  expect(password).toHaveFocus();
  expect(store.deleteAccount).not.toHaveBeenCalled();
  change(password, "sixsix");
  expect(within(dialog).queryByRole("alert")).toBeNull();
  expect(password).not.toHaveAttribute("aria-invalid");
});

test("a wrong deletion password leaves the account intact and a retry can succeed", async () => {
  const store = createStore(firebaseUser());
  store.deleteAccount.mockResolvedValueOnce({ ok: false, message: "Your password is incorrect." });
  localStorage.setItem("untouched-library", "saved titles");
  renderControls(store);
  const dialog = await openDeletion();
  change(within(dialog).getByLabelText("Password"), "wrong");
  await click(within(dialog).getByRole("button", { name: "Delete account" }));
  expect(store.deleteAccount).toHaveBeenCalledWith({ password: "wrong", expectedUserId: "firebase:test-viewer" });
  expect(within(dialog).getByRole("alert")).toHaveTextContent("Your password is incorrect.");
  expect(within(dialog).getByLabelText("Password")).toHaveAttribute("aria-invalid", "true");
  expect(store.getUser()).toEqual(firebaseUser());
  expect(localStorage.getItem("untouched-library")).toBe("saved titles");
  change(within(dialog).getByLabelText("Password"), PASSWORD);
  await click(within(dialog).getByRole("button", { name: "Delete account" }));
  expect(store.deleteAccount).toHaveBeenLastCalledWith({ password: PASSWORD, expectedUserId: "firebase:test-viewer" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(store.getUser()).toBeNull();
  await waitFor(() => expect(screen.getByRole("button", { name: "Log in" })).toHaveFocus());
});

test("pending confirmed deletion disables close, Cancel, password and duplicate deletion", async () => {
  const store = createStore(firebaseUser());
  const operation = deferredOperation();
  store.deleteAccount.mockReturnValueOnce(operation.promise);
  renderControls(store);
  const dialog = await openDeletion();
  change(within(dialog).getByLabelText("Password"), PASSWORD);
  await click(within(dialog).getByRole("button", { name: "Delete account" }));
  const submit = within(dialog).getByRole("button", { name: "Deleting account" });
  const cancel = within(dialog).getByRole("button", { name: "Cancel" });
  const close = within(dialog).getByRole("button", { name: "Close account" });
  expect(submit).toBeDisabled();
  expect(cancel).toBeDisabled();
  expect(close).toBeDisabled();
  expect(within(dialog).getByLabelText("Password")).toBeDisabled();
  fireEvent.click(submit);
  fireEvent.click(cancel);
  fireEvent.click(close);
  fireEvent.keyDown(dialog, { key: "Escape" });
  fireEvent(dialog, new Event("cancel", { cancelable: true }));
  expect(screen.getByRole("dialog", { name: "Delete account" })).toBe(dialog);
  expect(store.deleteAccount).toHaveBeenCalledTimes(1);
  await act(async () => { store.publish(null); operation.resolve({ ok: true, message: "Account deleted." }); });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByRole("status")).toHaveTextContent("Account deleted.");
  await waitFor(() => expect(screen.getByRole("button", { name: "Log in" })).toHaveFocus());
});

test("a rejected deletion becomes retryable feedback and restores Cancel and close", async () => {
  const store = createStore(firebaseUser());
  store.deleteAccount.mockRejectedValueOnce(new Error("Deletion failed. Please try again."));
  renderControls(store);
  const dialog = await openDeletion();
  change(within(dialog).getByLabelText("Password"), PASSWORD);
  await click(within(dialog).getByRole("button", { name: "Delete account" }));
  expect(within(dialog).getByRole("alert")).toHaveTextContent("Deletion failed. Please try again.");
  expect(within(dialog).getByRole("button", { name: "Delete account" })).toBeEnabled();
  expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeEnabled();
  expect(within(dialog).getByRole("button", { name: "Close account" })).toBeEnabled();
  expect(store.getUser()).toEqual(firebaseUser());
  await click(within(dialog).getByRole("button", { name: "Cancel" }));
  expect(screen.getByRole("dialog", { name: "Account" })).toBeInTheDocument();
  expect(within(dialog).getByRole("button", { name: "Delete account" })).toHaveFocus();
});

test("a successful deletion with a browser cleanup warning closes and shows a visible alert", async () => {
  const store = createStore(firebaseUser());
  const message = "Your account was deleted, but this browser could not remove its saved data. Clear this site's browser data to remove it.";
  store.deleteAccount.mockImplementationOnce(async () => {
    store.publish(null);
    return { ok: true, warning: true, message };
  });
  renderControls(store);
  const dialog = await openDeletion();
  change(within(dialog).getByLabelText("Password"), PASSWORD);
  await click(within(dialog).getByRole("button", { name: "Delete account" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  const notice = screen.getByRole("alert");
  expect(notice).toBeVisible();
  expect(notice).toHaveClass("account-notice");
  expect(notice).not.toHaveClass("sr-only");
  expect(notice).toHaveTextContent(message);
  expect(store.deleteAccount).toHaveBeenCalledTimes(1);
  expect(store.getUser()).toBeNull();
});

test("an account switch during confirmation prevents deleting the newly signed-in account", async () => {
  const store = createStore(firebaseUser());
  renderControls(store);
  const dialog = await openDeletion();
  change(within(dialog).getByLabelText("Password"), PASSWORD);
  const otherUser = { ...firebaseUser("other@example.com"), id: "firebase:other-viewer" };
  act(() => { store.publish(otherUser); });
  await click(within(dialog).getByRole("button", { name: "Delete account" }));
  expect(within(dialog).getByRole("alert")).toHaveTextContent("Your account changed. Open Account and try again.");
  expect(within(dialog).getByLabelText("Password")).toHaveAttribute("aria-invalid", "true");
  expect(store.deleteAccount).not.toHaveBeenCalled();
  expect(store.getUser()).toEqual(otherUser);
});
