import { useRef, useState, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronDown,
  ClipboardList,
  Gavel,
  Globe2,
  Layers3,
  Radio,
  ShieldCheck,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import { BrandMark, Logo } from "@/components/auth/Logo";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { ResilientImage } from "@/components/ui/ResilientImage";
import { useAuthStore } from "@/store/authStore";

const ROLES = [
  {
    id: "organizer",
    registrationRole: "ORGANIZER",
    label: "Organizers",
    eyebrow: "YOU SET THE STAGE",
    title: "Less admin.\nMore auction.",
    description:
      "Bring the moving parts together. Set up your tournament, approve the player pool, and run the room with the controls in your hands.",
    features: [
      "Configure rounds, purses & bid increments",
      "Approve players and franchise registrations",
      "Settle lots, manage unsold passes & review history",
    ],
    icon: ClipboardList,
    panel: "Tournament control",
    rows: ["Player registrations", "Franchise approvals", "Auction rounds"],
    values: ["Review your pool", "Build the lineup", "Set your order"],
    action: "Create your tournament",
  },
  {
    id: "franchise",
    registrationRole: "FRANCHISE_OWNER",
    label: "Franchise owners",
    eyebrow: "BUILD WITH INTENTION",
    title: "Your purse.\nYour game plan.",
    description:
      "Find the right players, follow the room, and make your move. Keep your remaining purse and growing squad in view as the auction unfolds.",
    features: [
      "Bid for your approved tournament team",
      "Track available, reserved & spent budget",
      "Follow your squad and review completed sales",
    ],
    icon: Wallet,
    panel: "Franchise workspace",
    rows: ["Team purse", "Live bidding", "Squad building"],
    values: ["Know your balance", "Choose your moment", "See every signing"],
    action: "Build your franchise",
  },
  {
    id: "community",
    registrationRole: "PLAYER",
    label: "Players & fans",
    eyebrow: "EVERYONE HAS A PLACE",
    title: "Your name.\nYour next chapter.",
    description:
      "Players can create a profile and register for tournaments. Fans can follow a shared public auction link, without creating an account just to watch.",
    features: [
      "Create a player profile with your CricHeroes link",
      "Apply to tournaments and follow your progress",
      "Watch shared public auction rooms as a read-only guest",
    ],
    icon: Users,
    panel: "Player & spectator view",
    rows: ["Player profile", "Tournament entry", "Public auction links"],
    values: [
      "Show your cricket",
      "Join the player pool",
      "Watch without signing in",
    ],
    action: "Create your player profile",
  },
];

const FAQS = [
  {
    question: "Who is GullyBid built for?",
    answer:
      "Tournament organizers, franchise owners, cricket players, and the fans following them. Organizers configure and run auctions, approved franchise owners bid for their teams, and players register to enter tournament pools.",
  },
  {
    question: "Can I watch an auction without an account?",
    answer:
      "Yes. Open the public auction link shared by an organizer to follow the live room, player outcomes, and results. Guest access is read-only. Bidding requires signing in as the owner of an approved tournament team.",
  },
  {
    question: "Does GullyBid process real-money payments?",
    answer:
      "Team purses are virtual tournament budgets used to manage bidding and squad building. GullyBid is not a payment processor or an escrow service. Any real-world payments are handled separately by the tournament organizer.",
  },
  {
    question: "What do I need to get started?",
    answer:
      "Create an account and choose your role. Organizers can create a tournament and configure registrations and auction rounds. Players and franchise owners can create their profiles and apply to tournaments. The help center walks through the rules and workflow.",
  },
];

function RoleExplorer({ authenticated }: { authenticated: boolean }) {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const role = ROLES[active];
  const onKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let next: number;
    if (event.key === "ArrowRight") next = (index + 1) % ROLES.length;
    else if (event.key === "ArrowLeft")
      next = (index - 1 + ROLES.length) % ROLES.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = ROLES.length - 1;
    else return;
    event.preventDefault();
    setActive(next);
    tabs.current[next]?.focus();
  };
  return (
    <section
      className="gb-roles gb-container"
      id="platform"
      aria-labelledby="roles-heading"
    >
      <div className="gb-section-heading">
        <div>
          <p className="gb-eyebrow">
            <span /> A SEAT FOR EVERY ROLE
          </p>
          <h2 id="roles-heading">
            One room.
            <br />
            <span>Every perspective.</span>
          </h2>
        </div>
        <p>
          A connected experience for the people
          <br className="gb-desktop-break" /> who make your tournament happen.
        </p>
      </div>
      <div
        className="gb-role-tabs"
        role="tablist"
        aria-label="Explore GullyBid by role"
      >
        {ROLES.map((item, index) => (
          <button
            key={item.id}
            ref={(element) => {
              tabs.current[index] = element;
            }}
            id={`role-tab-${item.id}`}
            role="tab"
            type="button"
            aria-selected={active === index}
            aria-controls={`role-panel-${item.id}`}
            tabIndex={active === index ? 0 : -1}
            onClick={() => setActive(index)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            <item.icon size={17} aria-hidden="true" />
            {item.label}
          </button>
        ))}
      </div>
      {ROLES.map((item, index) => (
        <div
          key={item.id}
          id={`role-panel-${item.id}`}
          role="tabpanel"
          aria-labelledby={`role-tab-${item.id}`}
          hidden={active !== index}
          tabIndex={0}
        >
          {active === index && (
            <div className="gb-role-content">
              <div className="gb-role-copy">
                <p className="gb-eyebrow">{role.eyebrow}</p>
                <h3>
                  {role.title.split("\n").map((line) => (
                    <span key={line}>
                      {line}
                      <br />
                    </span>
                  ))}
                </h3>
                <p>{role.description}</p>
                <ul>
                  {role.features.map((feature) => (
                    <li key={feature}>
                      <Check size={16} aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  className="gb-text-link"
                  to={
                    authenticated
                      ? "/dashboard"
                      : `/register?role=${role.registrationRole}`
                  }
                >
                  {authenticated ? "Go to your dashboard" : role.action}
                  <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
              </div>
              <div
                className="gb-workspace-preview"
                aria-label={`${role.panel} feature overview`}
              >
                <div className="gb-workspace-preview__top">
                  <BrandMark />
                  <span>{role.panel}</span>
                  <span className="gb-preview-label">OVERVIEW</span>
                </div>
                <div className="gb-workspace-preview__body">
                  <p>ALL THE RIGHT TOOLS.</p>
                  <h4>
                    Ready for your
                    <br />
                    next big season.
                  </h4>
                  {role.rows.map((row, i) => (
                    <div className="gb-workspace-row" key={row}>
                      <span className="gb-workspace-row__icon">
                        {i === 0 ? (
                          <Users size={17} />
                        ) : i === 1 ? (
                          <ShieldCheck size={17} />
                        ) : (
                          <Trophy size={17} />
                        )}
                      </span>
                      <div>
                        <strong>{row}</strong>
                        <span>{role.values[i]}</span>
                      </div>
                      <ArrowUpRight size={16} aria-hidden="true" />
                    </div>
                  ))}
                </div>
                <div className="gb-workspace-preview__bottom">
                  <Layers3 size={14} aria-hidden="true" /> Purpose-built. From
                  setup to sold.
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

export default function LandingPage() {
  const authenticated = useAuthStore((s) => s.isAuthenticated);
  const start = authenticated ? "/dashboard" : "/register?role=ORGANIZER";
  return (
    <div className="gb-site">
      <PublicHeader />
      <main id="main-content" tabIndex={-1}>
        <section
          className="gb-hero gb-container"
          aria-labelledby="hero-heading"
        >
          <div className="gb-hero__copy">
            <p className="gb-eyebrow">
              <span /> FROM YOUR GULLY. TO THE BIG STAGE.
            </p>
            <h1 id="hero-heading">
              Great squads
              <br />
              start with
              <br />
              <em>a bold bid.</em>
            </h1>
            <p className="gb-hero__description">
              The thrill of the auction. The clarity of one platform. Bring your
              players, franchises, and next cricket season together with
              GullyBid.
            </p>
            <div className="gb-hero__actions">
              <Link className="gb-button gb-button--gold" to={start}>
                {authenticated
                  ? "Open your dashboard"
                  : "Build your tournament"}
                <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
              <a className="gb-button gb-button--outline" href="#how-it-works">
                Explore the platform
                <ArrowDown size={16} aria-hidden="true" />
              </a>
            </div>
            <p className="gb-hero__note">
              <ShieldCheck size={15} aria-hidden="true" /> Clear rules. Shared
              excitement. Your game.
            </p>
            <div className="gb-hero__signature">
              <span className="gb-signature-line" />
              <span>Made for the love of cricket.</span>
              <span className="gb-signature-ball" aria-hidden="true">
                ◒
              </span>
            </div>
          </div>
          <div
            className="gb-arena"
            aria-label="Illustrative GullyBid auction preview, not live auction data"
          >
            <ResilientImage
              className="gb-arena__stadium"
              src="/images/stadium-960.webp"
              srcSet="/images/stadium-640.webp 640w, /images/stadium-960.webp 960w, /images/stadium-1312.webp 1312w"
              sizes="(min-width: 1200px) 600px, (min-width: 900px) 48vw, (min-width: 600px) 85vw, 100vw"
              width={1312}
              height={816}
              alt=""
              loading="eager"
              fetchPriority="high"
            />
            <div className="gb-arena__top">
              <span>
                <span className="gb-dot" /> THE AUCTION EXPERIENCE
              </span>
              <span>EST. FOR THE GAME</span>
            </div>
            <div className="gb-arena__brand">
              <ResilientImage
                className="gb-arena__crest"
                src="/images/gullybid-crest-256.webp"
                srcSet="/images/gullybid-crest-256.webp 256w, /images/gullybid-crest-512.webp 512w"
                sizes="(max-width: 600px) 144px, 180px"
                width={512}
                height={512}
                alt="GullyBid — Draft. Bid. Build legends."
                loading="eager"
                fetchPriority="low"
                fallback={
                  <div className="gb-crest-fallback">
                    <BrandMark />
                    <span>GULLYBID</span>
                    <small>DRAFT. BID. BUILD LEGENDS.</small>
                  </div>
                }
              />
            </div>
            <div className="gb-auction-preview">
              <div className="gb-auction-preview__header">
                <span>
                  <Radio size={13} aria-hidden="true" /> AUCTION ROOM
                </span>
                <span className="gb-demo-badge">ILLUSTRATIVE PREVIEW</span>
              </div>
              <div className="gb-demo-player">
                <span className="gb-demo-player__avatar">AR</span>
                <div>
                  <span>ALL-ROUNDER · RIGHT-HAND BAT</span>
                  <strong>Arjun Rao</strong>
                  <small>
                    Base price <b>₹20,000</b>
                  </small>
                </div>
                <span className="gb-demo-player__number">01</span>
              </div>
              <div className="gb-demo-bid">
                <div>
                  <span>CURRENT BID</span>
                  <strong>
                    ₹80,000<span>INR</span>
                  </strong>
                </div>
                <div className="gb-demo-franchise">
                  <span>CK</span>
                  <div>
                    <small>LEADING FRANCHISE</small>
                    <strong>Coastal Kings</strong>
                  </div>
                </div>
              </div>
              <div className="gb-demo-progress">
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
              <div className="gb-auction-preview__footer">
                <span>Every bid. A new possibility.</span>
                <Gavel size={16} aria-hidden="true" />
              </div>
            </div>
            <div className="gb-arena__caption">
              <span>YOUR NEXT SEASON STARTS HERE</span>
              <ArrowUpRight size={17} aria-hidden="true" />
            </div>
          </div>
        </section>
        <div
          className="gb-capabilities gb-container"
          aria-label="Platform capabilities"
        >
          {[
            {
              icon: Radio,
              name: "Real-time auctions",
              sub: "Stay with the room",
            },
            {
              icon: Wallet,
              name: "Purse & squad clarity",
              sub: "Know your next move",
            },
            {
              icon: Globe2,
              name: "Public spectator rooms",
              sub: "Bring your community",
            },
            {
              icon: Layers3,
              name: "Standard & 3D views",
              sub: "Choose your perspective",
            },
          ].map(({ icon: Icon, name, sub }) => (
            <div key={name}>
              <Icon size={21} strokeWidth={1.5} aria-hidden="true" />
              <span>
                <strong>{name}</strong>
                <small>{sub}</small>
              </span>
            </div>
          ))}
        </div>
        <div className="gb-light-section" id="how-it-works">
          <section
            className="gb-how gb-container"
            aria-labelledby="how-heading"
          >
            <div className="gb-section-heading">
              <div>
                <p className="gb-eyebrow">
                  <span /> A BETTER WAY TO RUN THE GAME
                </p>
                <h2 id="how-heading">
                  From first registration
                  <br />
                  to the <em>final hammer.</em>
                </h2>
              </div>
              <p>
                All the moving parts.
                <br />
                One considered workflow.
              </p>
            </div>
            <div className="gb-step-grid">
              {[
                {
                  number: "01",
                  icon: ClipboardList,
                  title: "Set your stage.",
                  text: "Create your tournament. Define your rules, open registrations, and get your player pool and franchises ready.",
                  tag: "PLAN & PREPARE",
                },
                {
                  number: "02",
                  icon: Gavel,
                  title: "Make every bid count.",
                  text: "Open the room, call your players, and follow the bidding. Keep control of the timer, the rounds, and every lot decision.",
                  tag: "RUN THE ROOM",
                },
                {
                  number: "03",
                  icon: Trophy,
                  title: "Build something great.",
                  text: "Turn winning bids into squads. Review the history, track team budgets, and take your final lineups into the season.",
                  tag: "FROM SOLD TO SQUAD",
                },
              ].map(({ number, icon: Icon, title, text, tag }) => (
                <article className="gb-step" key={number}>
                  <div className="gb-step__top">
                    <span>{number}</span>
                    <Icon size={24} strokeWidth={1.4} aria-hidden="true" />
                  </div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                  <span className="gb-step__tag">
                    {tag}
                    <ArrowUpRight size={14} aria-hidden="true" />
                  </span>
                </article>
              ))}
            </div>
            <Link className="gb-text-link" to="/help/auctions">
              Get to know the auction workflow
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </section>
        </div>
        <RoleExplorer authenticated={authenticated} />
        <section
          className="gb-faq gb-container"
          id="questions"
          aria-labelledby="faq-heading"
        >
          <div>
            <p className="gb-eyebrow">
              <span /> GOOD TO KNOW
            </p>
            <h2 id="faq-heading">
              Before the
              <br />
              <em>first bid.</em>
            </h2>
            <p>A little clarity goes a long way.</p>
            <Link className="gb-text-link" to="/help">
              Visit the help center
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <div className="gb-faq__items">
            {FAQS.map(({ question, answer }) => (
              <details key={question}>
                <summary>
                  {question}
                  <ChevronDown size={19} aria-hidden="true" />
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
        <section
          className="gb-final-cta gb-container"
          aria-labelledby="cta-heading"
        >
          <div className="gb-final-cta__pattern" aria-hidden="true" />
          <span className="gb-eyebrow">DRAFT. BID. BUILD LEGENDS.</span>
          <h2 id="cta-heading">
            Your next great squad
            <br />
            is one auction away.
          </h2>
          <Link className="gb-button gb-button--ink" to={start}>
            {authenticated
              ? "Go to your dashboard"
              : "Let’s get your season started"}
            <ArrowUpRight size={18} aria-hidden="true" />
          </Link>
          <p>
            <CheckCheck size={15} aria-hidden="true" /> Built for organizers.
            Owners. Players. Cricket.
          </p>
        </section>
      </main>
      <footer className="gb-footer gb-container">
        <div className="gb-footer__main">
          <div>
            <Link to="/" aria-label="GullyBid home">
              <Logo tone="dark" />
            </Link>
            <p>
              Big-stage energy.
              <br />
              Grassroots heart.
            </p>
          </div>
          <nav aria-label="Footer platform links">
            <span>THE PLATFORM</span>
            <Link to="/#how-it-works">How it works</Link>
            <Link to="/help">Help center</Link>
            <Link to="/faq">Frequently asked questions</Link>
          </nav>
          <nav aria-label="Footer company links">
            <span>BEHIND THE GAME</span>
            <Link to="/creator">
              Meet the creator
              <ArrowUpRight size={13} aria-hidden="true" />
            </Link>
            <Link to="/contact">Get in touch</Link>
            <Link to="/privacy">Privacy policy</Link>
            <Link to="/terms">Terms of service</Link>
          </nav>
        </div>
        <div className="gb-footer__bottom">
          <span>
            © {new Date().getFullYear()} GullyBid. Made for the game.
          </span>
          <Link to="/creator">
            Crafted by <strong>VENKAT SAI</strong>
            <span className="gb-footer__alias"> / The HitMan</span>
            <ArrowUpRight size={13} aria-hidden="true" />
          </Link>
          <a href="#main-content">Back to top ↑</a>
        </div>
      </footer>
    </div>
  );
}
