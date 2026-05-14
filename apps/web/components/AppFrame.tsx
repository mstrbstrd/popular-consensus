import Image from "next/image";
import Link from "next/link";
import logoMark from "../src/logo2026_nobackground.png";
import { siteCopy } from "./copy";

type AppFrameProps = {
  active?: "home" | "feed" | "account" | "login" | "signup" | "testing";
  children: React.ReactNode;
};

const navItems: Array<{
  href: string;
  key: NonNullable<AppFrameProps["active"]>;
  label: string;
}> = [
  { href: "/", key: "home", label: siteCopy.nav.home },
  { href: "/feed", key: "feed", label: siteCopy.nav.feed },
  { href: "/account", key: "account", label: siteCopy.nav.account },
  { href: "/testing", key: "testing", label: siteCopy.nav.testing },
];

export function AppFrame({ active = "home", children }: AppFrameProps) {
  return (
    <main className="app-shell">
      <header className="site-nav">
        <Link className="site-brand" href="/">
          <Image className="site-logo" src={logoMark} alt="" priority />
          <span>
            <small>Popular Consensus</small>
          </span>
        </Link>
        <nav aria-label="Primary navigation" className="nav-links">
          {navItems.map((item) => (
            <Link
              key={item.href}
              className={active === item.key ? "active" : ""}
              href={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="nav-actions">
          <Link className={active === "login" ? "active" : ""} href="/login">
            Log in
          </Link>
          <Link className="button-link" href="/signup">
            {siteCopy.actions.joinCrowd}
          </Link>
        </div>
      </header>
      {children}
    </main>
  );
}
