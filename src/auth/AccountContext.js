import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createFirebaseAccountStore } from "./firebaseAccountStore";

const AccountContext = createContext(null);

export function AccountProvider({ children, store: suppliedStore }) {
  const [store] = useState(() => suppliedStore || createFirebaseAccountStore());
  const [user, setUser] = useState(() => store.getUser());

  useEffect(() => store.subscribe(setUser), [store]);

  const signUp = useCallback(
    async (fields) => {
      const result = await store.signUp(fields);
      setUser(store.getUser());
      return result;
    },
    [store],
  );

  const logIn = useCallback(
    async (fields) => {
      const result = await store.logIn(fields);
      setUser(store.getUser());
      return result;
    },
    [store],
  );

  const logOut = useCallback(async () => {
    const result = await store.logOut();
    setUser(store.getUser());
    return result;
  }, [store]);

  const deleteAccount = useCallback(async (fields) => {
    const result = await store.deleteAccount(fields);
    setUser(store.getUser());
    return result;
  }, [store]);

  const value = useMemo(
    () => ({ user, signUp, logIn, logOut, deleteAccount }),
    [user, signUp, logIn, logOut, deleteAccount],
  );
  return (
    <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
  );
}

export function useAccount() {
  const context = useContext(AccountContext);
  if (!context)
    throw new Error("useAccount must be used inside AccountProvider.");
  return context;
}
