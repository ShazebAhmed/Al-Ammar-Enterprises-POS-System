import Link from "next/link";
import Icon from "./Icon";
import { whatsappPhone } from "@/lib/whatsapp";
export default function Footer({ settings }) {
  return (
    <footer className="site-footer" id="about">
      <div className="container">
        <div className="footer-main">
          <div className="footer-story">
            <div className="eyebrow">A LITTLE ABOUT US</div>
            <h2>
              {settings.storeName || "Al-Ammar"}
              <span className="gold-dot">.</span>
            </h2>
            <p>
              {settings.aboutText ||
                "A considered collection for your everyday. Discover what you need, order with ease, and make yourself at home."}
            </p>
          </div>
          <div>
            <div className="eyebrow">EXPLORE</div>
            <Link href="/">Shop the collection</Link>
            <Link href="/cart">Your basket</Link>
            <Link href="/account">Track your orders</Link>
            <Link href="/policies/shipping">Shipping &amp; delivery</Link>
            <Link href="/policies/returns">Returns &amp; refunds</Link>
            <Link href="/policies/privacy">Privacy policy</Link>
          </div>
          <div>
            <div className="eyebrow">LET’S TALK</div>
            {settings.contactPhone ? (
              <a href={`tel:${settings.contactPhone.replace(/[^+\d]/g, "")}`}>
                {settings.contactPhone}
              </a>
            ) : (
              <p>
                We confirm delivery details by phone after you place an order.
              </p>
            )}
            {settings.whatsapp && (
              <a
                href={`https://wa.me/${whatsappPhone(settings.whatsapp)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Chat on WhatsApp <Icon name="arrow_forward" size={14} />
              </a>
            )}
            <p>Pay on delivery.</p>
          </div>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()}{" "}
            {settings.storeName || "Al-Ammar Enterprises"}
          </span>
          <span>Everyday essentials. Thoughtfully brought together.</span>
        </div>
      </div>
    </footer>
  );
}
