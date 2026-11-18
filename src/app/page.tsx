import type { Metadata } from "next";

export const metadata: Metadata = { title: "Home" };

/** Intentionally blank: stands in for Coy's existing experience. */
export default function HomePage() {
  return <h1 className="sr-only">Home</h1>;
}
