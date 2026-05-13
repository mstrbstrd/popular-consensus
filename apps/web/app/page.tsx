import Image from "next/image";
import Link from "next/link";
import { AppFrame } from "../components/AppFrame";
import logoMark from "../src/logo2026_nobackground.png";

export default function Page() {
  return (
    <AppFrame active="home">
      <section className="home-hero">
        <div className="home-brand-signal">
          <Image src={logoMark} alt="" priority />
        </div>
        <div className="home-copy">
          <p className="eyebrow">Popular Consensus</p>
          <h1>Public opinion infrastructure for real communities.</h1>
          <p>
            A social feed for scoped civic questions, private ballots, challengeable results, and community-governed data
            products.
          </p>
          <div className="button-row">
            <Link className="button-link" href="/feed">
              Open feed
            </Link>
            <Link className="button-link secondary" href="/signup">
              Create account
            </Link>
          </div>
        </div>
      </section>
      <section className="home-grid">
        <Link className="home-tile" href="/feed">
          <span>01</span>
          <strong>Feed</strong>
          <small>Community posts, follows, topics, and thread notes</small>
        </Link>
        <Link className="home-tile" href="/account">
          <span>02</span>
          <strong>Account</strong>
          <small>Profile, memberships, stewardship, and communities</small>
        </Link>
        <Link className="home-tile" href="/testing">
          <span>03</span>
          <strong>Testing Hub</strong>
          <small>Full protocol controls for local verification</small>
        </Link>
      </section>
    </AppFrame>
  );
}
