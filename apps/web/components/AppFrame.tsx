"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FlaskConical, Home, LogIn, LogOut, Menu, Rss, UserPlus, UserRound, X, type LucideIcon } from "lucide-react";
import logoMark from "../src/logo2026_nobackground.png";
import { siteCopy } from "./copy";
import { IconLabel, IconOnly } from "./IconLabel";

type AppFrameProps = {
  active?: "home" | "feed" | "account" | "login" | "signup" | "testing";
  children: ReactNode;
};

type NavItem = {
  href: string;
  icon: LucideIcon;
  key: NonNullable<AppFrameProps["active"]>;
  label: string;
};

const publicNavItems: NavItem[] = [
  { href: "/", icon: Home, key: "home", label: siteCopy.nav.home },
  { href: "/feed", icon: Rss, key: "feed", label: siteCopy.nav.feed },
  { href: "/testing", icon: FlaskConical, key: "testing", label: siteCopy.nav.testing },
];

const accountNavItem: NavItem = { href: "/account", icon: UserRound, key: "account", label: siteCopy.nav.account };
const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:4000";

function hasLocalSession() {
  if (typeof window === "undefined") return false;
  return Boolean(window.localStorage.getItem("pc.activeUserId"));
}

export function AppFrame({ active = "home", children }: AppFrameProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const navItems = isSignedIn ? [...publicNavItems, accountNavItem] : publicNavItems;

  useEffect(() => {
    const syncAuthState = () => setIsSignedIn(hasLocalSession());
    syncAuthState();
    window.addEventListener("storage", syncAuthState);
    window.addEventListener("pc-auth-changed", syncAuthState);
    return () => {
      window.removeEventListener("storage", syncAuthState);
      window.removeEventListener("pc-auth-changed", syncAuthState);
    };
  }, []);

  function logOut() {
    void fetch(`${apiBase}/auth/logout`, { method: "POST", credentials: "include" }).catch(() => undefined);
    window.localStorage.removeItem("pc.authToken");
    window.localStorage.removeItem("pc.activeUserId");
    window.localStorage.removeItem("pc.smartAccountAddress");
    window.dispatchEvent(new Event("pc-auth-changed"));
    setIsSignedIn(false);
    setIsMenuOpen(false);
    if (pathname?.startsWith("/account")) router.push("/feed");
  }

  return (
    <main className="app-shell">
      <header className={`site-nav${isMenuOpen ? " menu-open" : ""}`}>
        <Link className="site-brand" href="/">
          <Image className="site-logo" src={logoMark} alt="" priority />
          <span>
            <small>Popular Consensus</small>
          </span>
        </Link>
        <button
          aria-controls="primary-nav-menu"
          aria-expanded={isMenuOpen}
          aria-label={isMenuOpen ? "Close navigation" : "Open navigation"}
          className="nav-toggle"
          type="button"
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          <IconOnly icon={isMenuOpen ? X : Menu} />
        </button>
        <div className="nav-menu" id="primary-nav-menu">
          <nav aria-label="Primary navigation" className="nav-links">
            {navItems.map((item) => (
              <Link
                key={item.href}
                className={active === item.key ? "active" : ""}
                href={item.href}
                onClick={() => setIsMenuOpen(false)}
              >
                <IconLabel icon={item.icon}>{item.label}</IconLabel>
              </Link>
            ))}
          </nav>
          <div className="nav-actions">
            {isSignedIn ? (
              <button className="nav-button" type="button" onClick={logOut}>
                <IconLabel icon={LogOut}>Log out</IconLabel>
              </button>
            ) : (
              <>
                <Link className={active === "login" ? "active" : ""} href="/login" onClick={() => setIsMenuOpen(false)}>
                  <IconLabel icon={LogIn}>Log in</IconLabel>
                </Link>
                <Link className="button-link" href="/signup" onClick={() => setIsMenuOpen(false)}>
                  <IconLabel icon={UserPlus}>{siteCopy.actions.joinCrowd}</IconLabel>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      {children}
    </main>
  );
}
