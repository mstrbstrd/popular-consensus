import Image from "next/image";
import Link from "next/link";
import { FlaskConical, Rss, UserPlus } from "lucide-react";
import { AppFrame } from "../components/AppFrame";
import { IconLabel } from "../components/IconLabel";
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
              <IconLabel icon={Rss}>Open feed</IconLabel>
            </Link>
            <Link className="button-link secondary" href="/signup">
              <IconLabel icon={UserPlus}>Create account</IconLabel>
            </Link>
          </div>
        </div>
      </section>
      <section className="home-grid">
        <Link className="home-tile" href="/feed">
          <span>01</span>
          <strong>
            <IconLabel icon={Rss}>Questions</IconLabel>
          </strong>
          <small>
            See what communities are asking and vote when it is your turn
          </small>
        </Link>
        <Link className="home-tile" href="/signup">
          <span>02</span>
          <strong>
            <IconLabel icon={UserPlus}>Create account</IconLabel>
          </strong>
          <small>Join with a passkey or wallet so your vote stays private</small>
        </Link>
        <Link className="home-tile" href="/testing">
          <span>03</span>
          <strong>
            <IconLabel icon={FlaskConical}>Try demo</IconLabel>
          </strong>
          <small>Walk through asking, voting, counting, and publishing a result</small>
        </Link>
      </section>
    </AppFrame>
  );
}
