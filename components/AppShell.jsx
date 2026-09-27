"use client";
import { usePathname } from "next/navigation";
import Header from "./Header";
import Footer from "./Footer";
export default function AppShell({ settings, children }) {
  const admin = usePathname().startsWith("/admin");
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {!admin && <Header settings={settings} />}
      <div id="main-content" tabIndex={-1}>
        {children}
      </div>
      {!admin && <Footer settings={settings} />}
    </>
  );
}
