/** Explicit, user-run import. Only new, reviewed products; never overwrites old products. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import { classifyItem, normalize, planCategory, validateEntry } from './catalogue_rules.mjs';

const hash = (value) => createHash('sha256').update(value).digest('hex');
const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: path.resolve(backendRoot, '../.env'), quiet: true });
dotenv.config({ path: path.join(backendRoot, '.env'), quiet: true });
const args = process.argv.slice(2);
const arg = (name) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
if (!args.includes('--apply') || !arg('--plan') || !arg('--manifest')) {
  throw new Error('Không ghi dữ liệu. Cần --apply --plan <file> --manifest <file> --confirm-target <host/database> --confirm-plan <sha256>.');
}
const planFile = path.resolve(arg('--plan'));
const manifestFile = path.resolve(arg('--manifest'));
const planText = await fs.readFile(planFile, 'utf8');
const manifestText = await fs.readFile(manifestFile, 'utf8');
const plan = JSON.parse(planText);
const manifest = JSON.parse(manifestText.replace(/^\uFEFF/, ''));
if (hash(planText) !== arg('--confirm-plan') || hash(manifestText) !== plan.manifestSha256) throw new Error('Kế hoạch/manifest đã thay đổi. Lập và kiểm tra lại kế hoạch.');
const host = new URL(process.env.MONGODB_URI).host;
const dbName = process.env.MONGODB_DB_NAME || 'dieu_khac';
const target = `${host}/${dbName}`;
if (arg('--confirm-target') !== target || plan.database !== dbName || plan.host !== host) throw new Error('Sai database/host. Không ghi dữ liệu.');
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) throw new Error('Thiếu cấu hình Cloudinary.');
if (!/^[a-z0-9-]+$/.test(manifest.catalogueId || '')) throw new Error('Mã catalogue không hợp lệ.');
const limit = Number(arg('--limit') || 5);
if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error('Mỗi đợt từ 1 đến 50 mẫu; mặc định 5.');
const pending = plan.decisions.filter((entry) => entry.action === 'CREATE');
const folder = path.dirname(manifestFile);
const receiptDir = path.join(folder, 'receipts');
await fs.mkdir(receiptDir, { recursive: true });
// Exclusive local lock: never remove a stale lock automatically after a crash.
const lockFile = path.join(receiptDir, 'import.lock');
const lock = await fs.open(lockFile, 'wx');
const client = new mongoose.mongo.MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
const receipt = { target, planSha256: hash(planText), startedAt: new Date().toISOString(), results: [] };
const receiptFile = path.join(receiptDir, `${Date.now()}.json`);
const saveReceipt = () => fs.writeFile(receiptFile, JSON.stringify(receipt, null, 2));
const objectId = (key) => new mongoose.mongo.ObjectId(hash(key).slice(0, 24));
cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET, secure: true });
try {
  await client.connect();
  const db = client.db(dbName);
  const products = db.collection('products');
  const categories = db.collection('categories');
  const productImages = db.collection('productimages');
  const media = db.collection('media');
  let imported = 0;
  await saveReceipt();
  for (const proposed of pending) {
    if (imported >= limit) break;
    const entry = manifest.items.find((item) => item.cell === proposed.cell && item.number === proposed.number);
    if (!entry || validateEntry(entry).length || proposed.dimensions !== entry.dimensions) throw new Error('Dữ liệu chưa duyệt hoặc không khớp kế hoạch.');
    let category = await categories.findOne({ _id: new mongoose.mongo.ObjectId(proposed.categoryId), type: 'PRODUCT' });
    const needsCategory = !category;
    if (needsCategory && plan.allowNewCategories && proposed.categoryAction === 'CREATE') {
      const checked = planCategory(entry.categoryName, await categories.find({}).toArray(), {}, true);
      if (checked.action !== 'CREATE' || checked.category._id !== proposed.categoryId
        || checked.category.slug !== proposed.category?.slug) throw new Error('Danh mục đã thay đổi. Lập lại kế hoạch.');
      category = { ...checked.category, _id: new mongoose.mongo.ObjectId(checked.category._id) };
    }
    if (!category) throw new Error('Danh mục đã thay đổi. Lập lại kế hoạch.');
    if (proposed.category && normalize(category.name) !== normalize(proposed.category.name)) throw new Error('Tên danh mục đã thay đổi; cần lập lại kế hoạch.');
    const expectedSlug = `${manifest.catalogueId}-mau-${entry.number}`;
    if (proposed.slug !== expectedSlug) throw new Error('Slug không khớp mã catalogue và STT.');
    const id = objectId(expectedSlug);
    const current = await products.find({}).project({ name: 1, slug: 1, dimensions: 1, categoryId: 1 }).toArray();
    const decision = classifyItem(entry, category, current, proposed.slug);
    const previous = await products.findOne({ _id: id });
    if (previous && (previous.slug !== proposed.slug || previous.catalogueImport?.source !== manifest.sourceSha256)) throw new Error('ID trùng hoặc nội dung nguồn thay đổi; dừng để kiểm tra.');
    if (previous && (String(previous.categoryId) !== String(category._id) || normalize(previous.dimensions) !== normalize(entry.dimensions))) throw new Error('Mẫu nhập trước đã đổi danh mục hoặc kích thước; không tự ghi đè.');
    if (previous?.catalogueImport?.complete) {
      receipt.results.push({ number: entry.number, status: 'SKIPPED_ALREADY_IMPORTED', id: String(id) });
      await saveReceipt();
      continue;
    }
    if (!previous && decision.action !== 'CREATE') {
      receipt.results.push({ number: entry.number, status: 'SKIPPED_NEEDS_REVIEW', reason: decision.action });
      await saveReceipt();
      continue;
    }
    // Check all file bytes BEFORE any upload for this product.
    const files = [];
    for (const image of entry.images) {
      const bytes = await fs.readFile(path.join(folder, image.file));
      if (hash(bytes) !== image.sha256) throw new Error('Ảnh thay đổi sau khi duyệt.');
      files.push({ ...image, bytes });
    }
    const now = new Date();
    if (needsCategory) {
      await categories.updateOne({ _id: category._id }, { $setOnInsert: {
        ...category, description: '', imageUrl: '', imageKey: null, sortOrder: 0,
        isFeatured: false, isVisible: true, createdAt: now, updatedAt: now,
        catalogueImport: { source: manifest.sourceSha256 }
      } }, { upsert: true });
      receipt.results.push({ status: 'CATEGORY_CREATED', id: String(category._id), name: category.name, slug: category.slug });
      await saveReceipt();
    }
    // Deterministic ID reserves this import without publishing a product without images.
    await products.updateOne({ _id: id }, { $setOnInsert: {
      categoryId: category._id, slug: proposed.slug,
      name: `${category.name} ${entry.dimensions} – mẫu ${entry.number}`,
      shortDescription: `${category.name}, quy cách ${entry.dimensions}. Liên hệ xưởng để được tư vấn.`,
      content: '', dimensions: entry.dimensions, material: '', tags: [], isFeatured: false,
      isVisible: false, sortOrder: 0, metaTitle: '', metaDescription: '', createdAt: now, updatedAt: now,
      catalogueImport: { source: manifest.sourceSha256, number: entry.number, complete: false }
    } }, { upsert: true });
    const record = { number: entry.number, id: String(id), slug: proposed.slug, status: 'PENDING', images: [] };
    receipt.results.push(record);
    await saveReceipt();
    for (const [index, file] of files.entries()) {
      // Stable public_id + overwrite:false: retries reuse the same remote image.
      const key = `catalogue/${manifest.catalogueId}/${file.sha256}`;
      const uploaded = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({ public_id: key, resource_type: 'image', overwrite: false },
          (error, result) => error ? reject(new Error('Cloudinary upload failed')) : resolve(result));
        stream.end(file.bytes);
      });
      if (!uploaded?.secure_url || uploaded.public_id !== key) throw new Error('Cloudinary trả về ảnh không hợp lệ.');
      await media.updateOne({ key }, { $setOnInsert: {
        originalName: `${proposed.slug}-${index+1}.webp`, fileName: `${proposed.slug}-${index+1}.webp`,
        mimeType: 'image/webp', size: file.bytes.length, width: file.width, height: file.height,
        url: uploaded.secure_url, key, folder: 'products', altText: proposed.name, provider: 'cloudinary', createdAt: now, updatedAt: now
      } }, { upsert: true });
      await productImages.updateOne({ _id: objectId(`${id}:${file.sha256}`) }, { $setOnInsert: {
        productId: id, url: uploaded.secure_url, key, altText: proposed.name, sortOrder: index,
        isPrimary: index === 0, createdAt: now, updatedAt: now
      } }, { upsert: true });
      record.images.push({ key, url: uploaded.secure_url });
      await saveReceipt();
    }
    await products.updateOne({ _id: id, 'catalogueImport.source': manifest.sourceSha256 }, { $set: {
      isVisible: true, updatedAt: new Date(), 'catalogueImport.complete': true
    } });
    record.status = 'IMPORTED';
    imported += 1;
    await saveReceipt();
    console.log(`Đã nhập mẫu ${entry.number}`);
  }
  receipt.finishedAt = new Date().toISOString();
  await saveReceipt();
  console.log(`Đã nhập ${imported} mẫu. Biên nhận: ${receiptFile}`);
} catch {
  receipt.failed = true;
  await saveReceipt();
  console.error(`Đã dừng. Không xóa dữ liệu cũ. Kiểm tra biên nhận ${receiptFile}; mẫu đang nhập dở vẫn ẩn và có thể chạy lại cùng kế hoạch.`);
  process.exitCode = 1;
} finally {
  await client.close();
  await lock.close();
  await fs.unlink(lockFile);
}
