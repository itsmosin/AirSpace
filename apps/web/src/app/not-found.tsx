import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-4 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-fg-faint">404</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Nothing in this airspace.</h1>
      <p className="mt-2 text-sm text-fg-muted">The page you are looking for does not exist. BBLs are 10-digit borough-block-lot codes.</p>
      <Button href="/explore" className="mt-6">Back to explore</Button>
    </div>
  );
}
