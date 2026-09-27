"use client";
export default function ErrorPage({ reset }) {
  return (
    <main className="container empty-state">
      <h1>Something didn’t load.</h1>
      <p>Please try again. Your saved basket has not been changed.</p>
      <button className="stx-btn stx-btn-primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
