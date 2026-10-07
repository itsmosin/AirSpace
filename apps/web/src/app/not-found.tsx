import { Button } from "@/components/ui/Button";
import { OrbitArcs } from "@/components/ui/OrbitArcs";

export default function NotFound() {
  return (
    <div className="relative isolate overflow-hidden">
      <OrbitArcs variant="section" className="-z-10" />
      <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-4 text-center">
        <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-[13px] font-medium text-fg shadow-card">
          <span className="size-2 rounded-full bg-red" /> 404
        </p>
        <h1 className="display mt-6 text-[40px] font-semibold leading-[1.05] text-fg sm:text-[48px]">Nothing in this airspace.</h1>
        <p className="mt-4 text-[17px] text-fg-muted">The page you are looking for does not exist. BBLs are 10-digit borough-block-lot codes.</p>
        <Button href="/explore" className="mt-8">Back to explore</Button>
      </div>
    </div>
  );
}
