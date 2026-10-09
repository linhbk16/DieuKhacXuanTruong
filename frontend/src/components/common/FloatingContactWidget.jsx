import React, { useState, useEffect } from "react";
import { getContactInfo } from "../../utils/contactInfo";

export function FloatingContactWidget({ settings = {} }) {
  const [showScrollTop, setShowScrollTop] = useState(false);
  const { hotline: formattedPhone, telHref, zaloUrl } = getContactInfo(settings);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 280);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <aside className="senior-floating-contact" aria-label="Tư vấn nhanh và tiện ích">
      {/* Scroll to top button - appears on scroll */}
      {showScrollTop && (
        <button
          type="button"
          onClick={scrollToTop}
          className="floating-btn floating-btn--scroll-top"
          title="Quay lại đầu trang"
          aria-label="Quay lại đầu trang"
        >
          <span className="floating-btn__icon">↑</span>
        </button>
      )}

      {/* Slot for page-specific floating actions (e.g. ProductsPage search & filter FAB) */}
      <div id="floating-page-slot" className="floating-page-slot" />

      {/* Direct Call Button */}
      {telHref ? (
        <a
          href={telHref}
          className="floating-btn floating-btn--phone"
          title={`Gọi điện tư vấn trực tiếp: ${formattedPhone}`}
          aria-label={`Gọi tư vấn: ${formattedPhone}`}
        >
          <span className="floating-btn__icon">📞</span>
          <span className="floating-btn__label">
            <small>TƯ VẤN MIỄN PHÍ</small>
            <strong>{formattedPhone}</strong>
          </span>
        </a>
      ) : null}

      {/* Zalo Chat Button */}
      {zaloUrl ? (
        <a
          href={zaloUrl}
          target="_blank"
          rel="noreferrer"
          className="floating-btn floating-btn--zalo"
          title="Nhắn tin tư vấn qua Zalo"
          aria-label="Chat tư vấn qua Zalo"
        >
          <span className="floating-btn__icon">💬</span>
          <span className="floating-btn__label">
            <small>CHAT TƯ VẤN</small>
            <strong>Nhắn tin qua Zalo</strong>
          </span>
        </a>
      ) : null}
    </aside>
  );
}
