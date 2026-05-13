import Image from "next/image";
import Link from "next/link";
import logoMark from "../src/logo2026_nobackground.png";

type AppFrameProps = {
  active?: "home" | "feed" | "account" | "login" | "signup" | "testing";
  children: React.ReactNode;
};

const navItems: Array<{ href: string; key: NonNullable<AppFrameProps["active"]>; label: string }> = [
  { href: "/", key: "home", label: "Home" },
  { href: "/feed", key: "feed", label: "Feed" },
  { href: "/account", key: "account", label: "Account" },
  { href: "/testing", key: "testing", label: "Testing" }
];

export function AppFrame({ active = "home", children }: AppFrameProps) {
  return (
    <main className="app-shell">
      <header className="site-nav">
        <Link className="site-brand" href="/">
          <Image className="site-logo" src={logoMark} alt="" priority />
          <span>
            <small>Popular Consensus</small>
            <strong>Community signal network</strong>
          </span>
        </Link>
        <nav aria-label="Primary navigation" className="nav-links">
          {navItems.map((item) => (
            <Link key={item.href} className={active === item.key ? "active" : ""} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="nav-actions">
          <Link className={active === "login" ? "active" : ""} href="/login">
            Log in
          </Link>
          <Link className="button-link" href="/signup">
            Create account
          </Link>
        </div>
      </header>
      {children}
    </main>
  );
}
