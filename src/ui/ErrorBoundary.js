import { Component } from "react";
export default class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="empty-state" role="alert">
        <h1>Let’s start the scene again.</h1>
        <p>
          This view could not load. Your saved list is still on this device.
        </p>
        <button
          className="button button-primary"
          onClick={() => window.location.reload()}
        >
          Reload Krispy
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
