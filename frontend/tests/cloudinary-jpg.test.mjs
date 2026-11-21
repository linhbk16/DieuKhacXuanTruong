import test from "node:test";
import assert from "node:assert/strict";
import { toCloudinaryJpg, normalizeCloudinaryImages } from "../src/utils/cloudinaryImages.js";

test("requests JPEG with a jpg filename for an original Cloudinary image", () => {
  assert.equal(
    toCloudinaryJpg("https://res.cloudinary.com/demo/image/upload/v123/products/item.webp"),
    "https://res.cloudinary.com/demo/image/upload/f_jpg/v123/products/item.jpg"
  );
});

test("replaces automatic format while preserving resize and quality", () => {
  assert.equal(
    toCloudinaryJpg("https://res.cloudinary.com/demo/image/upload/c_limit,w_800/f_auto,q_auto/v123/item.png"),
    "https://res.cloudinary.com/demo/image/upload/c_limit,w_800/f_jpg,q_auto/v123/item.jpg"
  );
});

test("leaves local, external, video and signed URLs untouched", () => {
  for (const url of [
    "/images/logo.webp",
    "https://example.com/image/upload/item.webp",
    "https://res.cloudinary.com.evil.example/demo/image/upload/item.webp",
    "https://res.cloudinary.com/demo/video/upload/movie.mp4",
    "https://res.cloudinary.com/demo/image/upload/s--signature--/v123/item.webp",
    null,
    ""
  ]) {
    assert.equal(toCloudinaryJpg(url), url);
  }
});

test("normalizes nested image URLs without changing source data or text", () => {
  const input = {
    items: [{ name: "Hoa văn", images: [{ url: "https://res.cloudinary.com/demo/image/upload/v123/item.webp" }] }],
    count: 1,
    next: null
  };
  const output = normalizeCloudinaryImages(input);
  assert.equal(output.items[0].images[0].url, "https://res.cloudinary.com/demo/image/upload/f_jpg/v123/item.jpg");
  assert.equal(input.items[0].images[0].url, "https://res.cloudinary.com/demo/image/upload/v123/item.webp");
  assert.equal(output.items[0].name, "Hoa văn");
  assert.equal(output.count, 1);
  assert.equal(output.next, null);
});

test("normalizing twice does not add transformations repeatedly", () => {
  const url = "https://res.cloudinary.com/demo/image/upload/f_jpg/v123/item.jpg";
  assert.equal(toCloudinaryJpg(url), url);
});

test("handles unversioned images and preserves query parameters", () => {
  assert.equal(
    toCloudinaryJpg("https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/products/item.webp?download=1"),
    "https://res.cloudinary.com/demo/image/upload/f_jpg,q_auto/products/item.jpg?download=1"
  );
  assert.equal(
    toCloudinaryJpg("https://res.cloudinary.com/demo/image/upload/products/item"),
    "https://res.cloudinary.com/demo/image/upload/f_jpg/products/item.jpg"
  );
});

test("does not rewrite token-protected URLs", () => {
  const url = "https://res.cloudinary.com/demo/image/upload/v123/item.webp?__cld_token__=token";
  assert.equal(toCloudinaryJpg(url), url);
});
