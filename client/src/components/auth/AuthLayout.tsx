import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Gavel, Radio, Users } from "lucide-react";
import { Logo } from "@/components/auth/Logo";
import { ResilientImage } from "@/components/ui/ResilientImage";

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: AuthLayoutProps) {
  return (
    <div className="gb-auth">
      <a className="gb-skip-link" href="#main-content">
        Skip to form
      </a>
      <aside className="gb-auth__story" aria-label="About GullyBid">
        <ResilientImage
          className="gb-auth__image"
          src="/images/stadium-960.webp"
          srcSet="/images/stadium-640.webp 640w, /images/stadium-960.webp 960w, /images/stadium-1312.webp 1312w"
          sizes="(min-width: 1200px) 45vw, 40vw"
          width={1312}
          height={816}
          alt=""
          loading="lazy"
          fetchPriority="low"
        />
        <Link to="/" aria-label="GullyBid home">
          <Logo tone="dark" />
        </Link>
        <div className="gb-auth__story-copy">
          <p className="gb-eyebrow">
            <span /> THE GAME STARTS WITH YOU
          </p>
          <h2>
            Behind every
            <br />
            great squad,
            <br />
            <em>a bold bid.</em>
          </h2>
          <p>
            From the local ground to your next big tournament. Bring the people,
            the passion, and the auction together.
          </p>
          <ul>
            <li>
              <Radio size={17} aria-hidden="true" /> Real-time rooms. Shared
              excitement.
            </li>
            <li>
              <Gavel size={17} aria-hidden="true" /> Clear rounds, rules & lot
              decisions.
            </li>
            <li>
              <Users size={17} aria-hidden="true" /> A place for every role in
              the game.
            </li>
          </ul>
        </div>
        <div className="gb-auth__credit">
          <span>DRAFT. BID. BUILD LEGENDS.</span>
          <Link to="/creator">
            Crafted by <strong>VENKAT SAI ↗</strong>
          </Link>
        </div>
      </aside>
      <main className="gb-auth__main" id="main-content" tabIndex={-1}>
        <div className="gb-auth__top">
          <Link to="/" aria-label="GullyBid home" className="gb-brand-link">
            <Logo />
          </Link>
          <Link className="gb-auth__back" to="/">
            <ArrowLeft size={14} aria-hidden="true" />
            Back to home
          </Link>
        </div>
        <div className="gb-auth__form">
          <div className="gb-auth__heading">
            <p className="gb-eyebrow">YOUR NEXT CHAPTER IN CRICKET</p>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          {children}
          {footer && <div className="gb-auth__footer">{footer}</div>}
        </div>
        <nav className="gb-auth__legal" aria-label="Account resources">
          <Link to="/help">Need a hand?</Link>
          <Link to="/privacy">Privacy policy</Link>
          <Link to="/terms">Terms of service</Link>
        </nav>
      </main>
    </div>
  );
}
