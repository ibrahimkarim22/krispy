import { AccountProvider, useAccount } from "./auth/AccountContext";
import { LibraryProvider } from "./context/LibraryContext";
import ErrorBoundary from "./ui/ErrorBoundary";
import Experience from "./experience/Experience";

function AccountLibrary() {
  const { user } = useAccount();
  return (
    <LibraryProvider user={user}>
      <ErrorBoundary>
        <Experience />
      </ErrorBoundary>
    </LibraryProvider>
  );
}

export default function App() {
  return (
    <AccountProvider>
      <AccountLibrary />
    </AccountProvider>
  );
}
