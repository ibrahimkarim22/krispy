import React, { useCallback, useEffect, useRef, useState } from "react";
import Icon from "../ui/Icon";
import { useAccount } from "./AccountContext";
import "./account.css";

const emptyFields = () => ({ email: "", password: "", confirmPassword: "" });
const accountFields = [
  {
    name: "email",
    label: "Email",
    help: "Enter your email address.",
  },
  {
    name: "password",
    label: "Password",
    help: "At least 8 characters. Keep spaces exactly as entered.",
  },
  {
    name: "confirmPassword",
    label: "Confirm password",
    help: "Re-enter your password exactly.",
  },
];

export default function AccountControls({
  hideLauncher = false,
  request = null,
  returnFocusRef: externalFocusRef = null,
  onRequestClose,
  modal = true,
  prepareFavoriteDeletion,
}) {
  const { user, signUp, logIn, logOut, deleteAccount } = useAccount();
  const [mode, setMode] = useState(null);
  const [step, setStep] = useState(0);
  const [fields, setFields] = useState(emptyFields);
  const [feedback, setFeedback] = useState(null);
  const [notice, setNotice] = useState(null);
  const [pending, setPending] = useState(false);
  const dialogRef = useRef(null);
  const firstFieldRef = useRef(null);
  const returnFocusRef = useRef(null);
  const primaryButtonRef = useRef(null);
  const deleteButtonRef = useRef(null);
  const returnToDeleteRef = useRef(false);
  const deletingRef = useRef(false);
  const deletionUserRef = useRef(null);
  const openRef = useRef(false);
  const handledRequestRef = useRef(null);
  const isOpen = mode !== null;
  const signingUp = mode === "signup";
  const confirmingDeletion = mode === "delete";
  const totalSteps = signingUp ? 3 : 2;
  const activeField = accountFields[step];
  const finalStep = step === totalSteps - 1;
  const title =
    mode === "account" ? "Account" : confirmingDeletion ? "Delete account" : signingUp ? "Sign up" : "Login";

  const open = useCallback((next, trigger) => {
    openRef.current = true;
    deletionUserRef.current = null;
    returnFocusRef.current = trigger;
    setFields(emptyFields());
    setStep(0);
    setFeedback(null);
    setNotice(null);
    setMode(next);
  }, []);

  useEffect(() => {
    if (!request || request.id === handledRequestRef.current) return;
    handledRequestRef.current = request.id;
    if (pending) {
      onRequestClose?.();
      return;
    }
    open(request.mode, externalFocusRef?.current);
  }, [request, externalFocusRef, open, pending, onRequestClose]);

  useEffect(() => {
    if (hideLauncher && !request) {
      openRef.current = false;
      deletionUserRef.current = null;
      setMode(null);
      setFields(emptyFields());
      setStep(0);
      setFeedback(null);
    }
  }, [hideLauncher, request]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const dialog = dialogRef.current;
    if (modal && typeof dialog?.showModal === "function") dialog.showModal();
    else if (!modal && typeof dialog?.show === "function") dialog.show();
    else dialog?.setAttribute("open", "");
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      if (dialog?.open && typeof dialog.close === "function") dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, modal]);

  useEffect(() => {
    if (mode && openRef.current) {
      const target = mode === "account" && returnToDeleteRef.current
        ? deleteButtonRef.current : firstFieldRef.current;
      returnToDeleteRef.current = false;
      target?.focus();
    }
  }, [mode, step, request?.id]);

  function restoreFocus() {
    window.requestAnimationFrame(() => {
      // A user may choose another control or dialog while authentication finishes.
      // Return focus only when that next focus decision is still unclaimed.
      const active = document.activeElement;
      if (document.querySelector("dialog[open]")) return;
      if (
        active &&
        active !== document.body &&
        active !== document.documentElement &&
        active.isConnected
      )
        return;
      const previous = returnFocusRef.current;
      (previous?.isConnected ? previous : primaryButtonRef.current)?.focus();
    });
  }

  function close() {
    if (deletingRef.current) return;
    openRef.current = false;
    deletionUserRef.current = null;
    setMode(null);
    setFields(emptyFields());
    setStep(0);
    setFeedback(null);
    onRequestClose?.();
    restoreFocus();
  }

  function switchMode(next) {
    setFields((current) => ({
      email: current.email,
      password: "",
      confirmPassword: "",
    }));
    setFeedback(null);
    setStep(0);
    setMode(next);
  }

  function updateField(event) {
    const { name, value } = event.target;
    setFields((current) => ({ ...current, [name]: value }));
    setFeedback(null);
  }

  async function submit(event) {
    event.preventDefault();
    if (pending) return;
    let invalid = null;
    if (
      step === 0 &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())
    )
      invalid = "Enter a valid email address.";
    else if (step === 1 && signingUp && fields.password.length < 8)
      invalid = "Use a password with at least 8 characters.";
    else if (step === 1 && !signingUp && !fields.password)
      invalid = "Enter your password.";
    else if (step === 2 && fields.confirmPassword !== fields.password)
      invalid = "The passwords do not match.";
    if (invalid) {
      setFeedback({ ok: false, message: invalid });
      firstFieldRef.current?.focus();
      return;
    }
    if (!finalStep) {
      setFeedback(null);
      setStep((current) => current + 1);
      return;
    }
    setPending(true);
    setFeedback(null);
    try {
      const credentials = { ...fields, email: fields.email.trim() };
      const result = await (signingUp
        ? signUp(credentials)
        : logIn({ email: credentials.email, password: credentials.password }));
      if (result.ok) {
        setNotice(result);
        if (openRef.current) close();
      } else if (openRef.current) setFeedback(result);
      else setNotice(result);
    } catch (error) {
      const result = {
        ok: false,
        message: error?.message || "Unable to connect to your account. Please try again.",
      };
      if (openRef.current) setFeedback(result);
      else setNotice(result);
    } finally {
      setPending(false);
      if (!openRef.current) restoreFocus();
    }
  }

  async function leaveAccount() {
    if (pending) return;
    setPending(true);
    setFeedback(null);
    try {
      const result = await logOut();
      if (result.ok) {
        setNotice(result);
        if (openRef.current) close();
      } else if (openRef.current) setFeedback(result);
      else setNotice(result);
    } catch (error) {
      const result = { ok: false, message: error?.message || "Unable to log out. Please try again." };
      if (openRef.current) setFeedback(result);
      else setNotice(result);
    } finally {
      setPending(false);
      if (!openRef.current) restoreFocus();
    }
  }

  function startDeletion() {
    if (pending) return;
    deletionUserRef.current = user?.id || null;
    setFields(emptyFields());
    setFeedback(null);
    setMode("delete");
  }

  function cancelDeletion() {
    if (deletingRef.current) return;
    deletionUserRef.current = null;
    returnToDeleteRef.current = true;
    setFields(emptyFields());
    setFeedback(null);
    setMode("account");
  }

  async function confirmDeletion(event) {
    event.preventDefault();
    if (pending || deletingRef.current) return;
    const expectedUserId = deletionUserRef.current;
    if (!expectedUserId || user?.id !== expectedUserId) {
      setFeedback({ ok: false, message: "Your account changed. Open Account and try again." });
      firstFieldRef.current?.focus();
      return;
    }
    if (!fields.password) {
      setFeedback({ ok: false, message: "Enter your current password." });
      firstFieldRef.current?.focus();
      return;
    }
    deletingRef.current = true;
    setPending(true);
    setFeedback(null);
    try {
      const result = await deleteAccount({
        password: fields.password,
        expectedUserId,
        ...(prepareFavoriteDeletion ? { prepareFavoriteDeletion } : {}),
      });
      if (result.ok) {
        setNotice(result);
        deletingRef.current = false;
        if (openRef.current) close();
      } else if (openRef.current) setFeedback(result);
      else setNotice(result);
    } catch (error) {
      const result = { ok: false, message: error?.message || "Unable to delete your account. Please try again." };
      if (openRef.current) setFeedback(result);
      else setNotice(result);
    } finally {
      deletingRef.current = false;
      setPending(false);
      if (!openRef.current) restoreFocus();
    }
  }

  function keepFocusInDialog(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab" || !modal) return;
    const dialog = event.currentTarget;
    const controls = Array.from(
      dialog.querySelectorAll(
        "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex='-1'])",
      ),
    ).filter((element) => !element.closest("[hidden]"));
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (!first) return;
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !dialog.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (
      !event.shiftKey &&
      (active === last || !dialog.contains(active))
    ) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <>
      <div
        className={
          hideLauncher ? undefined : "floating-account account-controls"
        }
      >
        {!hideLauncher &&
          (user ? (
            <button
              ref={primaryButtonRef}
              className="account-link"
              aria-label={`Account for ${user.email || user.username}`}
              aria-haspopup="dialog"
              disabled={pending}
              onClick={(event) => open("account", event.currentTarget)}
            >
              {user.email || user.username}
            </button>
          ) : (
            <>
              <button
                ref={primaryButtonRef}
                className="account-link"
                aria-label="Log in"
                aria-haspopup="dialog"
                disabled={pending}
                onClick={(event) => open("login", event.currentTarget)}
              >
                Login
              </button>
              <button
                className="account-link"
                aria-haspopup="dialog"
                disabled={pending}
                onClick={(event) => open("signup", event.currentTarget)}
              >
                Sign up
              </button>
            </>
          ))}
        {notice && (
          <p
            className={notice.ok && !notice.warning ? "sr-only" : `account-notice${hideLauncher ? " account-notice--standalone" : ""}`}
            role={notice.ok && !notice.warning ? "status" : "alert"}
          >
            {notice.message}
          </p>
        )}
      </div>
      {isOpen && (
        <dialog
          ref={dialogRef}
          className={`account-overlay${confirmingDeletion ? " account-overlay--delete" : ""}`}
          aria-labelledby="account-title"
          aria-modal={modal ? true : undefined}
          onKeyDown={keepFocusInDialog}
          onCancel={(event) => {
            event.preventDefault();
            close();
          }}
        >
          <button
            className="account-close glyph-button"
            aria-label="Close account"
            onClick={close}
            disabled={confirmingDeletion && pending}
          >
            <Icon name="close" />
          </button>
          <section className="account-sheet">
            <header>
              <h1 id="account-title">{title}</h1>
              <p className="account-guidance" id="account-guidance">
                {mode === "account"
                  ? "Signed in"
                  : confirmingDeletion ? "Cannot be undone"
                  : `Step ${step + 1} of ${totalSteps}`}
              </p>
            </header>
            {mode === "account" ? (
              <div className="account-summary" aria-busy={pending}>
                <p className="account-username">{user?.email || user?.username}</p>
                <p className="account-detail">
                  Your favorites sync across devices when you sign in. Viewing progress and history stay in this browser.
                </p>
                {feedback && <p id="account-error" className="account-feedback" role="alert">{feedback.message}</p>}
                <button
                  ref={firstFieldRef}
                  className="account-submit"
                  onClick={leaveAccount}
                  disabled={pending}
                  aria-label={pending ? "Logging out" : "Log out"}
                >
                  {pending ? "Logging out…" : "Log out"} <span aria-hidden="true">↗</span>
                </button>
                <button
                  ref={deleteButtonRef}
                  type="button"
                  className="account-submit account-delete"
                  onClick={startDeletion}
                  disabled={pending}
                >
                  Delete account <span aria-hidden="true">↗</span>
                </button>
              </div>
            ) : confirmingDeletion ? (
              <form className="account-deletion-form" onSubmit={confirmDeletion} noValidate
                aria-busy={pending} aria-describedby="account-delete-detail">
                <p className="account-detail" id="account-delete-detail">
                  This permanently deletes your account and cloud favorites. Saved titles and viewing history in this browser will also be cleared. This cannot be undone.
                </p>
                <fieldset disabled={pending}>
                  <div className="account-field">
                    <label htmlFor="account-delete-password">Password</label>
                    <input
                      ref={firstFieldRef}
                      id="account-delete-password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      aria-invalid={feedback && !feedback.ok ? true : undefined}
                      aria-describedby={`account-delete-help${feedback && !feedback.ok ? " account-error" : ""}`}
                      value={fields.password}
                      onChange={updateField}
                    />
                  </div>
                  <p className="account-detail" id="account-delete-help">Enter your current password to confirm.</p>
                  {feedback && <p id="account-error" className="account-feedback" role="alert">{feedback.message}</p>}
                  <div className="account-actions">
                    <button className="account-back" type="button" onClick={cancelDeletion}>Cancel</button>
                    <button className="account-submit account-delete" type="submit"
                      aria-label={pending ? "Deleting account" : "Delete account"}>
                      {pending ? "Deleting account…" : "Delete account"}
                    </button>
                  </div>
                </fieldset>
              </form>
            ) : (
              <form
                onSubmit={submit}
                noValidate
                aria-busy={pending}
                aria-describedby="account-guidance account-detail"
              >
                <fieldset disabled={pending}>
                  <div className="account-field">
                    <label htmlFor={`account-${activeField.name}`}>
                      {activeField.label}
                    </label>
                    <input
                      key={activeField.name}
                      ref={firstFieldRef}
                      id={`account-${activeField.name}`}
                      name={activeField.name}
                      type={step === 0 ? "email" : "password"}
                      inputMode={step === 0 ? "email" : undefined}
                      autoComplete={
                        step === 0
                          ? "email"
                          : signingUp
                            ? "new-password"
                            : "current-password"
                      }
                      autoCapitalize="none"
                      spellCheck="false"
                      minLength={step === 0 ? undefined : signingUp ? 8 : 1}
                      required
                      aria-invalid={feedback && !feedback.ok ? true : undefined}
                      aria-describedby={`account-detail${feedback && !feedback.ok ? " account-error" : ""}`}
                      value={fields[activeField.name]}
                      onChange={updateField}
                    />
                  </div>
                  <p className="account-detail" id="account-detail">
                    {step === 1 && !signingUp
                      ? "Enter your password. Keep spaces exactly as entered."
                      : activeField.help}
                  </p>
                  {feedback && (
                    <p id="account-error" className="account-feedback" role="alert">
                      {feedback.message}
                    </p>
                  )}
                  <div className="account-actions">
                    <button
                      className="account-back"
                      type="button"
                      disabled={step === 0}
                      onClick={() => {
                        setFeedback(null);
                        setStep((current) => Math.max(0, current - 1));
                      }}
                    >
                      Back
                    </button>
                    <button
                      className="account-submit"
                      type="submit"
                      aria-label={
                        pending
                          ? signingUp
                            ? "Creating account"
                            : "Logging in"
                          : finalStep
                            ? signingUp
                              ? "Sign up"
                              : "Log in"
                            : "Continue"
                      }
                    >
                      {pending
                        ? signingUp
                          ? "Creating account…"
                          : "Logging in…"
                        : finalStep
                          ? title
                          : "Continue"}
                      {!pending && <span aria-hidden="true">↗</span>}
                    </button>
                  </div>
                  <p className="account-switch">
                    {signingUp ? "Have an account? " : "New here? "}
                    <button
                      type="button"
                      onClick={() => switchMode(signingUp ? "login" : "signup")}
                    >
                      {signingUp ? "Use Login" : "Create an account"}
                    </button>
                  </p>
                </fieldset>
              </form>
            )}
          </section>
        </dialog>
      )}
    </>
  );
}
