import { useEffect, useId, useRef } from "react";
import Icon from "../ui/Icon";
import Wordmark from "../ui/Wordmark";
import "./SideMenu.css";

const PRIMARY_DESTINATIONS = [
  { id: "cinema", label: "Movies", icon: "film" },
  { id: "tv", label: "TV", icon: "tv" },
  { id: "globe", label: "Globe", icon: "globe" },
];

const UTILITIES = [
  { id: "search", label: "Search", icon: "search" },
  { id: "library", label: "My list", icon: "bookmark" },
  { id: "credits", label: "Info", icon: "info" },
];

export default function SideMenu({
  onChoose,
  onHome,
  mode,
  signedIn = false,
  disabled = false,
  activePanel = null,
  menuRef,
  mobile = false,
  mobileOpen = false,
  onMobileOpenChange,
}) {
  const toggleRef = useRef(null);
  const mobileShellRef = useRef(null);
  const drawerId = useId();

  useEffect(() => {
    if (!mobile || !mobileOpen || disabled || mobileShellRef.current?.closest("[inert]")) return;
    toggleRef.current?.focus({ preventScroll: true });
  }, [mobile, mobileOpen, disabled]);

  function closeMobile() {
    onMobileOpenChange?.(false);
    if (!toggleRef.current?.closest("[inert]"))
      toggleRef.current?.focus({ preventScroll: true });
  }

  function choose(id, trigger) {
    if (mobile) onMobileOpenChange?.(false);
    onChoose?.(id, trigger);
  }

  function home(trigger) {
    if (mobile) onMobileOpenChange?.(false);
    if (onHome) onHome(trigger);
    else onChoose?.("cinema", trigger);
  }

  function mobileKeys(event) {
    if (!mobile || !mobileOpen || disabled) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeMobile();
      return;
    }
    if (event.key !== "Tab") return;
    const shell = mobileShellRef.current;
    const controls = Array.from(shell?.querySelectorAll('button:not(:disabled):not([tabindex="-1"])') || []);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && (document.activeElement === first || !shell?.contains(document.activeElement))) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !shell?.contains(document.activeElement))) {
      event.preventDefault();
      first?.focus();
    }
  }

  const accountChoices = signedIn
    ? [
        { id: "account", label: "Account", icon: "user" },
        { id: "logout", label: "Log out", icon: "logout" },
      ]
    : [
        { id: "login", label: "Login", icon: "login" },
        { id: "signup", label: "Sign up", icon: "signup" },
      ];
  const renderChoice = ({ id, label, icon }) => {
    const selected = (activePanel || mode) === id;
    return (
      <button
        key={id}
        type="button"
        className={`side-menu-choice${["cinema", "tv", "globe"].includes(id) ? " side-menu-choice--primary" : ""}${id === "credits" ? " side-menu-choice--icon" : ""}${selected ? " is-active" : ""}`}
        aria-label={label}
        aria-pressed={selected}
        disabled={disabled}
        onClick={(event) => choose(id, event.currentTarget)}
      >
        <span className="side-menu-symbol" aria-hidden="true">
          <Icon name={icon} size={24} />
        </span>
        <span className="side-menu-label">{label}</span>
      </button>
    );
  };

  const brand = (
    <button
      type="button"
      className="side-menu-mark"
      aria-label="Krispy — Movies"
      disabled={disabled}
      onClick={(event) => home(event.currentTarget)}
    >
      <Wordmark aria-hidden="true" />
    </button>
  );
  const choices = <>
    <div className="side-menu-primary" role="group" aria-label="Primary navigation">
      {PRIMARY_DESTINATIONS.map(renderChoice)}
    </div>
    <div className="side-menu-utilities" role="group" aria-label="Utilities">
      {UTILITIES.map(renderChoice)}
    </div>
    <div className="side-menu-account" role="group" aria-label="Account controls">
      {accountChoices.map(renderChoice)}
    </div>
  </>;

  return (
    <nav
      ref={menuRef}
      className={`side-menu${mobile ? " is-mobile" : ""}`}
      aria-label="Krispy menu"
      aria-hidden={disabled ? "true" : undefined}
      inert={disabled ? "" : undefined}
      onKeyDown={mobileKeys}
    >
      {mobile ? (
        <div
          ref={mobileShellRef}
          className="side-menu-mobile-shell"
          role={mobileOpen ? "dialog" : undefined}
          aria-label={mobileOpen ? "Navigation" : undefined}
          aria-modal={mobileOpen ? true : undefined}
        >
          {mobileOpen && <button
            type="button" className="side-menu-backdrop" aria-label="Close navigation"
            tabIndex={-1} disabled={disabled} onClick={closeMobile}
          />}
          <div className="side-menu-mobile-header">
            {brand}
            <button
              ref={toggleRef} type="button" className="side-menu-toggle"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen} aria-controls={drawerId} disabled={disabled}
              onClick={() => mobileOpen ? closeMobile() : onMobileOpenChange?.(true)}
            >
              <Icon name={mobileOpen ? "close" : "menu"} size={24} />
            </button>
          </div>
          {mobileOpen && <div className="side-menu-mobile-choices" id={drawerId}>{choices}</div>}
        </div>
      ) : <>{brand}{choices}</>}
    </nav>
  );
}
