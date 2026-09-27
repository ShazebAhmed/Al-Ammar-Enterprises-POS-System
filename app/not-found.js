import Link from "next/link";
export default function NotFound() {
  return (
    <main className="container empty-state">
      <span className="eyebrow">404 · NOT FOUND</span>
      <h1>This shelf is empty.</h1>
      <p>The page or product you’re looking for is no longer here.</p>
      <Link className="stx-btn stx-btn-primary" href="/">
        Explore the collection
      </Link>
    </main>
  );
}
