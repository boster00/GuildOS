import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h1>404</h1>
      <p>Page not found.</p>
      <Link href="/">Go home</Link>
    </div>
  );
}
