"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logout } from "@/app/login/actions";

const links = [
  ["Scorecard", "/"],
  ["Sessions", "/sessions"],
  ["Ledger", "/ledger"],
  ["Reports", "/reports"],
  ["Youth", "/attendees"],
  ["Rewards", "/rewards"],
  ["Point Rules", "/point-rules"],
  ["Users", "/users"]
];

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href) => href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      <header className="topbar">
        <Link className="brand" href="/" onClick={() => setOpen(false)}>
          <span className="brandMark" aria-hidden="true" />
          <span>
            <strong>Rock Youth</strong>
            <small>Rewards Tracker</small>
          </span>
        </Link>

        <button
          aria-controls="section-drawer"
          aria-expanded={open}
          aria-label="Open section navigation"
          className="menuButton"
          onClick={() => setOpen(true)}
          type="button"
        >
          <span />
          <span />
          <span />
        </button>
      </header>

      <div className={open ? "drawerOverlay open" : "drawerOverlay"} onClick={() => setOpen(false)} />

      <aside
        aria-label="Section navigation"
        className={open ? "navDrawer open" : "navDrawer"}
        id="section-drawer"
      >
        <div className="drawerHeader">
          <div>
            <strong>Sections</strong>
            <span>Rock Youth Rewards</span>
          </div>
          <button aria-label="Close section navigation" className="drawerClose" onClick={() => setOpen(false)} type="button">
            <span />
            <span />
          </button>
        </div>

        <nav className="drawerLinks">
          {links.map(([label, href]) => (
            <Link
              className={isActive(href) ? "active" : ""}
              href={href}
              key={href}
              onClick={() => setOpen(false)}
            >
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        <form action={logout} className="drawerLogout">
          <button type="submit">Log out</button>
        </form>
      </aside>
    </>
  );
}
