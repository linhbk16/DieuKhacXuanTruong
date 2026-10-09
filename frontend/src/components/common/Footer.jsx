import { Link } from "react-router-dom";
import { getContactInfo } from "../../utils/contactInfo";

export function Footer({ settings = {}, categories = [] }) {
  const contact = getContactInfo(settings);

  return (
    <footer className="site-footer">
      <div className="container site-footer__grid">
        <div>
          <span className="footer-label">Xưởng chế tác</span>
          {settings.logoUrl ? <img className="footer-logo" src={settings.logoUrl} alt={settings.companyName || "Logo"} loading="lazy" /> : null}
          <h3>{settings.companyName || "Điêu Khắc Xuân Trường"}</h3>
          <p>{settings.tagline || "Chế tác và thi công hoa văn kiến trúc, phù điêu, tượng và bê tông mỹ thuật."}</p>
        </div>

        <div>
          <span className="footer-label">Danh mục nổi bật</span>
          <div className="footer-links">
            {categories.slice(0, 5).map((category) => (
              <Link key={category.id} to={`/san-pham?categoryId=${category.id}`}>
                {category.name}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <span className="footer-label">Liên hệ</span>
          <div className="footer-links">
            {contact.telHref ? <a href={contact.telHref}>{contact.hotline}</a> : null}
            <a href={`mailto:${settings.email || ""}`}>{settings.email || "hello@dieu-khac.vn"}</a>
            <span>{settings.address || "TP. Ho Chi Minh"}</span>
          </div>
        </div>
      </div>
      <div className="site-footer__bottom">
        <div className="container site-footer__bottom-inner">
          <span>© {new Date().getFullYear()} {settings.siteName || "Điêu Khắc Xuân Trường"}</span>
          <nav className="site-footer__bottom-links" aria-label="Liên kết cuối trang">
            <Link to="/gioi-thieu">Giới thiệu</Link>
            <Link to="/lien-he">Liên hệ</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
