import { Link } from "react-router-dom";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { Logo } from "@/components/auth/Logo";
import { useAuthStore } from "@/store/authStore";

export default function NotFoundPage() {
  const authenticated = useAuthStore((s) => s.isAuthenticated);
  return (
    <main className="gb-page-state" id="main-content" tabIndex={-1}>
      <Link to="/" aria-label="GullyBid home">
        <Logo />
      </Link>
      <p className="gb-page-state__eyebrow">404 / OUTSIDE THE BOUNDARY</p>
      <h1>
        This one’s gone
        <br />
        <em>over the rope.</em>
      </h1>
      <p>
        We couldn’t find that page. The link may have changed, or the address
        may not be quite right. Let’s get you back to the game.
      </p>
      <div className="gb-page-state__actions">
        <Link
          className="gb-button gb-button--ink"
          to={authenticated ? "/dashboard" : "/"}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          {authenticated ? "Back to dashboard" : "Back to home"}
        </Link>
        <Link className="gb-button gb-button--outline" to="/help">
          Find some help
          <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </main>
  );
}
