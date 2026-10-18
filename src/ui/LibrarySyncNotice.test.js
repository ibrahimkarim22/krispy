import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { LibraryProvider, useLibrary } from "../context/LibraryContext";
import LibrarySyncNotice from "./LibrarySyncNotice";

function Save() {
  const { toggleSaved } = useLibrary();
  return <button onClick={() => toggleSaved("film-sintel")}>Save</button>;
}

test("a failed cloud save gives visible feedback and retry can confirm the saved list", async () => {
  let denied = true;
  let publish;
  const store = {
    subscribe(uid, next) {
      publish = next;
      next({ saved: [], fromCache: false, hasPendingWrites: false });
      return () => {};
    },
    async setSaved() {
      if (denied) throw Object.assign(new Error("Permission denied"), { code: "permission-denied" });
      publish({ saved: ["film-sintel"], fromCache: false, hasPendingWrites: false });
    },
  };
  render(<LibraryProvider user={{ id: "firebase:viewer", uid: "viewer" }} storage={null} favoritesStore={store}>
    <Save /><LibrarySyncNotice showStatus />
  </LibraryProvider>);
  fireEvent.click(screen.getByText("Save"));
  await act(async () => { await Promise.resolve(); });
  expect(screen.getByRole("alert")).toHaveTextContent(/could not sync|cloud sync is unavailable/i);
  denied = false;
  fireEvent.click(screen.getByRole("button", { name: "Retry sync" }));
  await act(async () => { await Promise.resolve(); });
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent(/synced/i);
});
