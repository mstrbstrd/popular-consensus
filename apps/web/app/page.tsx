import Image from "next/image";
import Link from "next/link";
import { AppFrame } from "../components/AppFrame";
import { siteCopy } from "../components/copy";
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
          <h1>Seek the Wisdom of the Crowd.</h1>
          <p>Shape the questions that shape our world.</p>
          <div className="button-row">
            <Link className="button-link" href="/feed">
              {siteCopy.actions.seeQuestions}
            </Link>
            <Link className="button-link secondary" href="/signup">
              {siteCopy.actions.joinCrowd}
            </Link>
          </div>
        </div>
      </section>
      <section className="home-grid">
        <Link className="home-tile" href="/feed">
          <span>01</span>
          <strong>Feed</strong>
          <small>
            See what communities are asking and vote when you are eligible
          </small>
        </Link>
        <Link className="home-tile" href="/account">
          <span>02</span>
          <strong>My Account</strong>
          <small>Manage your profile and communities</small>
        </Link>
        <Link className="home-tile" href="/testing">
          <span>03</span>
          <strong>Testing Lab</strong>
          <small>Try the local vote and result flow</small>
        </Link>
      </section>
    </AppFrame>
  );
}
