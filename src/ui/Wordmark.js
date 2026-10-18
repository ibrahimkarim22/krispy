import "./Wordmark.css";

export default function Wordmark({ className = "", ...props }) {
  return (
    <span className={`wordmark${className ? ` ${className}` : ""}`} {...props}>
      <span className="wordmark-part wordmark-prefix">kr</span><span className="wordmark-part wordmark-i">i</span><span className="wordmark-part wordmark-suffix">spy</span>
    </span>
  );
}
