// Contact info always comes from the admin site settings (DB), never hard-coded.
export const getContactInfo = (settings = {}) => {
  const hotline = (settings.hotline || "").trim();
  const phoneDigits = hotline.replace(/[^\d+]/g, "");
  const zaloUrl = (settings.zaloUrl || "").trim() || (phoneDigits ? `https://zalo.me/${phoneDigits.replace(/^\+84/, "0")}` : "");

  return {
    hotline,
    telHref: phoneDigits ? `tel:${phoneDigits}` : "",
    zaloUrl,
  };
};
