import Icon from "../ui/Icon";
import "./GuestListPrompt.css";

export default function GuestListPrompt({ onChoose, inactive = false }) {
  return (
    <div className="guest-list-prompt">
      <Icon name="bookmark" size={36} />
      <h1>My list</h1>
      <p>Log in or sign up to save your favorites.</p>
      <div className="guest-list-actions">
        <button
          type="button"
          className="guest-list-login"
          aria-haspopup="dialog"
          disabled={inactive}
          onClick={(event) => onChoose("login", event.currentTarget)}
        >
          Log in
        </button>
        <button
          type="button"
          aria-haspopup="dialog"
          disabled={inactive}
          onClick={(event) => onChoose("signup", event.currentTarget)}
        >
          Sign up
        </button>
      </div>
    </div>
  );
}
