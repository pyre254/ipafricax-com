import { Link } from "@tanstack/react-router";
import { Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HomeLink() {
  return (
    <Button asChild variant="ghost" size="icon" className="shrink-0 text-navy">
      <Link to="/" aria-label="Go to homepage" title="Go to homepage">
        <Home aria-hidden="true" />
      </Link>
    </Button>
  );
}