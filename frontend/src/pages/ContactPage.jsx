import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { publicApi } from "../api/publicApi";
import { Seo } from "../components/common/Seo";
import { useSiteSettings } from "../hooks/useSiteData";
import { getContactInfo } from "../utils/contactInfo";

const initialForm = {
  name: "",
  phone: "",
  email: "",
  subject: "",
  message: ""
};

export function ContactPage() {
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("");
  const settingsQuery = useSiteSettings();
  const settings = settingsQuery.data || {};
  const { hotline, telHref, zaloUrl } = getContactInfo(settings);
  const email = settings.email || "hello@dieu-khac.vn";
  const address = settings.address || "Xóm 1, Xã Xuân Trường, Tỉnh Ninh Bình, Việt Nam";

  const mutation = useMutation({
    mutationFn: publicApi.createContact,
    onSuccess: () => {
      setMessage("Yêu cầu đã được gửi thành công. Xưởng sẽ liên hệ lại với quý khách sớm!");
      setForm(initialForm);
    },
    onError: () => {
      setMessage("Không thể gửi liên hệ lúc này. Quý khách vui lòng thử lại hoặc gọi trực tiếp cho xưởng.");
    }
  });

  const handleSubmit = (event) => {
    event.preventDefault();
    setMessage("");
    mutation.mutate(form);
  };

  return (
    <>
      <Seo
        title="Liên hệ tư vấn và báo giá"
        description="Gửi thông tin liên hệ để nhận tư vấn sản phẩm, công trình và giải pháp thi công phù hợp từ Xưởng Điêu Khắc Xuân Trường."
      />

      <section className="section contact-page-section">
        <div className="container contact-grid">
          {/* Cột trái: Thông tin kết nối với xưởng */}
          <div className="contact-info-panel">
            <span className="section-title__eyebrow">Thông tin liên hệ</span>
            <h2>Kết nối với xưởng điêu khắc</h2>
            <p className="contact-info-lead">
              Quý khách có thể gửi mô tả công trình, kích thước, bản vẽ hoặc danh sách hạng mục cần thực hiện để chúng tôi khảo sát và tư vấn chi tiết.
            </p>

            <div className="contact-info-cards">
              {/* Hotline */}
              {telHref ? (
                <a href={telHref} className="contact-detail-item">
                  <div className="contact-detail-item__icon">
                    📞
                  </div>
                  <div className="contact-detail-item__content">
                    <span className="contact-detail-item__label">Điện thoại tư vấn</span>
                    <strong className="contact-detail-item__value contact-detail-item__value--highlight">
                      {hotline}
                    </strong>
                  </div>
                </a>
              ) : null}

              {/* Zalo */}
              {zaloUrl ? (
                <a href={zaloUrl} target="_blank" rel="noreferrer" className="contact-detail-item">
                  <div className="contact-detail-item__icon contact-detail-item__icon--zalo">
                    💬
                  </div>
                  <div className="contact-detail-item__content">
                    <span className="contact-detail-item__label">Chat tư vấn qua Zalo</span>
                    <strong className="contact-detail-item__value">
                      Nhắn tin qua Zalo
                    </strong>
                  </div>
                </a>
              ) : null}

              {/* Email */}
              <a href={`mailto:${email}`} className="contact-detail-item">
                <div className="contact-detail-item__icon">
                  ✉️
                </div>
                <div className="contact-detail-item__content">
                  <span className="contact-detail-item__label">Email gửi bản vẽ & báo giá</span>
                  <strong className="contact-detail-item__value">
                    {email}
                  </strong>
                </div>
              </a>

              {/* Address */}
              <div className="contact-detail-item">
                <div className="contact-detail-item__icon">
                  📍
                </div>
                <div className="contact-detail-item__content">
                  <span className="contact-detail-item__label">Địa chỉ xưởng sản xuất</span>
                  <strong className="contact-detail-item__value">
                    {address}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* Cột phải: Form gửi yêu cầu tư vấn */}
          <div className="contact-form-panel">
            <span className="section-title__eyebrow">Gửi yêu cầu</span>
            <h2>Tư vấn và báo giá</h2>
            <p className="contact-form-lead">
              Điền thông tin hạng mục cần thi công bên dưới, xưởng sẽ phản hồi và gửi báo giá trong thời gian sớm nhất.
            </p>

            <form className="contact-form" onSubmit={handleSubmit}>
              <div className="contact-form__row">
                <div className="contact-form__field">
                  <label htmlFor="contact-name">
                    Họ và tên <span className="req">*</span>
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    placeholder="VD: Nguyễn Văn A"
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    required
                  />
                </div>
                <div className="contact-form__field">
                  <label htmlFor="contact-phone">
                    Số điện thoại <span className="req">*</span>
                  </label>
                  <input
                    id="contact-phone"
                    type="tel"
                    placeholder="VD: 0912 220 918"
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="contact-form__row">
                <div className="contact-form__field">
                  <label htmlFor="contact-email">Email (nếu có)</label>
                  <input
                    id="contact-email"
                    type="email"
                    placeholder="VD: contact@gmail.com"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                  />
                </div>
                <div className="contact-form__field">
                  <label htmlFor="contact-subject">Hạng mục quan tâm</label>
                  <input
                    id="contact-subject"
                    type="text"
                    placeholder="VD: Đấu cột, phào chỉ, phù điêu..."
                    value={form.subject}
                    onChange={(event) => setForm({ ...form, subject: event.target.value })}
                  />
                </div>
              </div>

              <div className="contact-form__field">
                <label htmlFor="contact-message">
                  Mô tả chi tiết / Kích thước yêu cầu <span className="req">*</span>
                </label>
                <textarea
                  id="contact-message"
                  rows="4"
                  placeholder="Ghi rõ kích thước, quy cách, số lượng hoặc vị trí thi công..."
                  value={form.message}
                  onChange={(event) => setForm({ ...form, message: event.target.value })}
                  required
                />
              </div>

              <button
                className="button button--primary contact-submit-btn"
                type="submit"
                disabled={mutation.isPending}
              >
                {mutation.isPending ? "Đang gửi yêu cầu..." : "Gửi yêu cầu tư vấn ngay →"}
              </button>

              {message ? (
                <div
                  className={`contact-form-alert ${mutation.isError ? "contact-form-alert--error" : "contact-form-alert--success"}`}
                >
                  {message}
                </div>
              ) : null}
            </form>
          </div>
        </div>
      </section>
    </>
  );
}
