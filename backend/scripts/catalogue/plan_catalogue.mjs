/** Read-only MongoDB inventory and import plan. NO upload or write operations. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { normalize, planCategory, classifyItem, validateEntry } from './catalogue_rules.mjs';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: path.resolve(backendRoot, '../.env'), quiet: true });
dotenv.config({ path: path.join(backendRoot, '.env'), quiet: true });
const args = process.argv.slice(2);
const getArg = (name) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
const manifestPath = getArg('--manifest');
if (!manifestPath) throw new Error('Dùng --manifest <manifest-reviewed.json> [--mapping <category-map.json>]');
const manifestFile = path.resolve(manifestPath);
const folder = path.dirname(manifestFile);
const manifestText = await fs.readFile(manifestFile, 'utf8');
const manifest = JSON.parse(manifestText.replace(/^\uFEFF/, ''));
if (manifest.version !== 1 || !Array.isArray(manifest.items) || !/^[a-z0-9-]+$/.test(manifest.catalogueId || '')) throw new Error('Manifest không hợp lệ.');
const mappings = getArg('--mapping') ? JSON.parse(await fs.readFile(path.resolve(getArg('--mapping')), 'utf8')) : {};
const allowNewCategories = args.includes('--allow-new-categories');
if (!process.env.MONGODB_URI) throw new Error('Thiếu cấu hình MONGODB_URI.');
const client = new mongoose.mongo.MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
try {
  await client.connect();
  const database = client.db(process.env.MONGODB_DB_NAME || 'dieu_khac');
  const categories = await database.collection('categories').find({}).toArray();
  const products = await database.collection('products').find({}).project({ name: 1, slug: 1, dimensions: 1, categoryId: 1, isVisible: 1 }).toArray();
  const images = await database.collection('productimages').find({}).project({ productId: 1, url: 1, key: 1 }).toArray();
  const inventory = { database: database.databaseName, categories, products, images };
  // This snapshot is local only; never includes credentials or unrelated collections.
  await fs.writeFile(path.join(folder, 'existing-catalogue.json'), JSON.stringify(inventory, null, 2));
  const numbers = new Map();
  for (const entry of manifest.items) numbers.set(entry.number, (numbers.get(entry.number) || 0) + 1);
  const proposedCategories = [...new Set(manifest.items.map((entry) => entry.categoryName).filter(Boolean))].map((name) => {
    const resolved = planCategory(name, categories, mappings, allowNewCategories);
    return { name, mappingKey: normalize(name), action: resolved.action || 'REVIEW',
      category: resolved.category, error: resolved.error };
  });
  const decisions = [];
  const seenImages = new Map();
  for (const entry of manifest.items) {
    const errors = validateEntry(entry);
    if (numbers.get(entry.number) > 1) errors.push('STT bị trùng trong tài liệu.');
    const { category, error, action: categoryAction } = planCategory(entry.categoryName, categories, mappings, allowNewCategories);
    if (error) errors.push(error);
    for (const image of entry.images || []) {
      if (!/^images\/[a-zA-Z0-9_-]+\.webp$/.test(image.file || '')) continue;
      const bytes = await fs.readFile(path.join(folder, image.file));
      if (createHash('sha256').update(bytes).digest('hex') !== image.sha256) errors.push('Ảnh bị thay đổi kể từ khi trích xuất; phải duyệt lại.');
      const sourceKey = image.sha256;
      if (seenImages.has(sourceKey) && seenImages.get(sourceKey) !== entry.number) errors.push(`Ảnh gốc cũng được dùng ở mẫu ${seenImages.get(sourceKey)}; cần xác nhận.`);
      else seenImages.set(sourceKey, entry.number);
    }
    const slug = `${manifest.catalogueId}-mau-${entry.number}`;
    const decision = errors.length ? { action: 'REVIEW', reasons: errors } : classifyItem(entry, category, products, slug);
    decisions.push({ number: entry.number, cell: entry.cell, categoryName: entry.categoryName,
      categoryId: category ? String(category._id) : null, categoryAction, category,
      name: category ? `${category.name} ${entry.dimensions} – mẫu ${entry.number}` : '',
      dimensions: entry.dimensions, slug, images: entry.images, ...decision });
  }
  const counts = decisions.reduce((sum, entry) => { sum[entry.action] = (sum[entry.action] || 0) + 1; return sum; }, {});
  const report = { mode: 'READ_ONLY', generatedAt: new Date().toISOString(), host: new URL(process.env.MONGODB_URI).host, database: database.databaseName,
    manifestSha256: createHash('sha256').update(manifestText).digest('hex'), sourceSha256: manifest.sourceSha256,
    allowNewCategories, categories: proposedCategories, counts, decisions };
  await fs.writeFile(path.join(folder, 'import-plan.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ mode: report.mode, database: report.database, existingProducts: products.length,
    existingCategories: categories.filter((item) => item.type === 'PRODUCT').length,
    proposedNewCategories: new Set(proposedCategories.filter((item) => item.action === 'CREATE').map((item) => item.category._id)).size,
    decisions: counts, target: `${report.host}/${report.database}`, report: path.join(folder, 'import-plan.json') }, null, 2));
} catch (error) {
  // Do not print driver errors which may contain a connection URI.
  console.error(`Không lập được kế hoạch (${error.name || 'Error'}). Kiểm tra manifest, file ảnh và kết nối MongoDB. Chưa ghi database hoặc upload ảnh.`);
  process.exitCode = 1;
} finally {
  await client.close();
}
