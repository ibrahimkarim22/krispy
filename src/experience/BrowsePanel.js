import { useEffect, useRef } from "react";
import Icon from "../ui/Icon";
import "./BrowsePanel.css";

const focusable =
  "button:not(:disabled), input:not(:disabled), select:not(:disabled)";

export default function BrowsePanel({
  panel,
  onClose,
  children,
  modal = true,
}) {
  const dialogRef = useRef(null);
  const close = (event) => {
    event?.preventDefault();
    event?.stopPropagation();
    onClose?.();
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (modal && typeof dialog.showModal === "function") dialog.showModal();
    else if (!modal && typeof dialog.show === "function") dialog.show();
    else dialog.setAttribute("open", "");
    const field = dialog.querySelector("input, select");
    (field || dialog.querySelector(focusable))?.focus();
    return () => {
      if (dialog.open && typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    };
  }, [modal]);

  function keys(event) {
    if (event.key === "Escape") return close(event);
    if (event.key !== "Tab" || !modal) return;
    const controls = [...dialogRef.current.querySelectorAll(focusable)];
    const first = controls[0];
    const last = controls[controls.length - 1];
    const outside = !dialogRef.current.contains(document.activeElement);
    if (event.shiftKey && (document.activeElement === first || outside)) {
      event.preventDefault();
      last?.focus();
    } else if (
      !event.shiftKey &&
      (document.activeElement === last || outside)
    ) {
      event.preventDefault();
      first?.focus();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="browse-panel"
      aria-label={panel === "search" ? "Search" : "Browse filters"}
      aria-modal={modal ? true : undefined}
      onCancel={close}
      onKeyDown={keys}
    >
      <section className="browse-panel-sheet">
        <header>
          <h1>{panel === "search" ? "Search" : "Filters"}</h1>
          <button
            type="button"
            className="glyph-button"
            aria-label="Close filters"
            onClick={close}
          >
            <Icon name="close" size={28} />
          </button>
        </header>
        {children}
      </section>
    </dialog>
  );
}
