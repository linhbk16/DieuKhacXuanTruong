// Delivery-only conversion: stored media URLs and original assets stay unchanged.
export const toCloudinaryJpg = (value) => {
  if (typeof value !== "string" || !/^https?:\/\/res\.cloudinary\.com\//i.test(value)) {
    return value;
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    return value;
  }

  const match = url.pathname.match(/^(\/[^/]+\/image\/upload\/)(.+)$/);
  if (!match || url.searchParams.has("__cld_token__")) return value;

  const parts = match[2].split("/");
  // Changing a signed delivery URL would invalidate its signature.
  if (/^s--/.test(parts[0])) return value;

  const versionIndex = parts.findIndex((part) => /^v\d+$/.test(part));
  let transformationCount = versionIndex >= 0 ? versionIndex : 0;
  if (versionIndex < 0) {
    while (
      transformationCount < parts.length - 1 &&
      /^(?:a|ar|b|bo|c|co|d|dl|dn|dpr|e|f|fl|g|h|if|l|o|q|r|t|u|w|x|y|z)_/.test(parts[transformationCount])
    ) {
      transformationCount += 1;
    }
  }

  let hasFormat = false;
  for (let index = 0; index < transformationCount; index += 1) {
    parts[index] = parts[index].replace(/(^|,)f_[^,]+/g, (_, separator) => {
      hasFormat = true;
      return `${separator}f_jpg`;
    });
  }
  if (!hasFormat) parts.splice(transformationCount, 0, "f_jpg");

  // A jpg delivery extension also gives Save image as a useful filename.
  const last = parts.length - 1;
  parts[last] = parts[last].replace(/\.(?:avif|gif|heic|heif|jpe?g|jxl|png|svg|tiff?|webp)$/i, "");
  parts[last] += ".jpg";
  url.pathname = match[1] + parts.join("/");
  return url.href;
};

export const normalizeCloudinaryImages = (value) => {
  if (typeof value === "string") return toCloudinaryJpg(value);
  if (Array.isArray(value)) return value.map(normalizeCloudinaryImages);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalizeCloudinaryImages(item)])
    );
  }
  return value;
};
