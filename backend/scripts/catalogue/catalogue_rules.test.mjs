import test from 'node:test';
import assert from 'node:assert/strict';
import { normalize, resolveCategory, planCategory, classifyItem, validateEntry } from './catalogue_rules.mjs';

const categories = [{ _id: 'cat-a', type: 'PRODUCT', name: 'Chân tròn' }];
const entry = { number: 31, categoryName: 'Chân tròn', dimensions: '16 × 22', approved: true,
  images: [{ file: 'images/a.webp', sha256: 'a'.repeat(64), sourceSha256: 'b'.repeat(64) }] };

test('separate category is proposed only with explicit creation enabled', () => {
  assert.equal(planCategory('Cột tròn', categories, {}, false).category, undefined);
  const result = planCategory('Cột tròn', categories, {}, true);
  assert.equal(result.action, 'CREATE');
  assert.equal(result.category.name, 'Cột tròn');
  assert.equal(result.category.slug, 'cot-tron');
});

test('an existing name is reused and an invalid explicit mapping is blocked', () => {
  assert.equal(planCategory('CHÂN TRÒN', categories, {}, true).category._id, 'cat-a');
  assert.equal(planCategory('Cột tròn', categories, { 'cot tron': 'missing' }, true).category, undefined);
});

test('abbreviated and damaged names cannot become categories automatically', () => {
  for (const name of ['Ph. Đại', 'B¸t l¸ to', 'Ph răng ngựa', 'Cột 350.000', '']) {
    assert.equal(planCategory(name, categories, {}, true).category, undefined);
  }
});

test('category slug collision is blocked including PROJECT categories', () => {
  assert.equal(planCategory('Cột tròn', [{ type: 'PROJECT', name: 'Khác', slug: 'cot-tron' }], {}, true).category, undefined);
});

test('numbered legacy product is detected across categories despite empty dimensions', () => {
  const old = [{ _id: 'old', categoryId: 'legacy', name: '031 - Chân tròn 16 x 22', dimensions: '' }];
  assert.equal(classifyItem(entry, categories[0], old, 'fixed-slug').action, 'REVIEW_DUPLICATE');
});

test('same source number with conflicting dimensions requires review', () => {
  const old = [{ _id: 'old', categoryId: 'legacy', name: '31 - Chân tròn 20 x 30', dimensions: '' }];
  assert.equal(classifyItem(entry, categories[0], old, 'fixed-slug').action, 'REVIEW_DUPLICATE');
});

test('accents, spacing and multiplication sign do not create different identities', () => {
  assert.equal(normalize('  Chân tròn 16 × 22 '), 'chan tron 16x22');
});
test('missing category is blocked, never implicitly created', () => {
  assert.equal(resolveCategory('Đầu cột', categories, {}).category, undefined);
});
test('explicit mapping must point to a PRODUCT category', () => {
  assert.equal(resolveCategory('Đầu cột', [{ _id: 'x', type: 'PROJECT', name: 'Đầu cột' }], { 'dau cot': 'x' }).category, undefined);
});
test('same category and size requires review instead of creating duplicate', () => {
  const decision = classifyItem(entry, categories[0], [{ _id: 'old', categoryId: 'cat-a', name: 'Chân tròn 16x22', dimensions: '16x22' }], 'fixed-slug');
  assert.equal(decision.action, 'REVIEW_DUPLICATE');
  assert.deepEqual(decision.candidateIds, ['old']);
});
test('different dimensions under same category remain separate products', () => {
  const decision = classifyItem(entry, categories[0], [{ _id: 'old', categoryId: 'cat-a', name: 'Chân tròn 18x22', dimensions: '18x22' }], 'fixed-slug');
  assert.equal(decision.action, 'CREATE');
});

test('a dimension already in a multi-size product requires review', () => {
  const products = [{ _id: 'old', categoryId: 'cat-a', dimensions: '18x22; 16x22' }];
  assert.equal(classifyItem(entry, categories[0], products, 'fixed-slug').action, 'REVIEW_DUPLICATE');
});
test('existing import slug is not enough if its dimensions disagree', () => {
  assert.equal(classifyItem(entry, categories[0], [{ _id: 'old', slug: 'fixed-slug', categoryId: 'cat-a', dimensions: '18x22' }], 'fixed-slug').action, 'REVIEW_CONFLICT');
});
test('price, unreviewed row and absent images cannot be imported', () => {
  assert.ok(validateEntry({ ...entry, dimensions: '16x22 350.000' }).length);
  assert.ok(validateEntry({ ...entry, approved: false }).length);
  assert.ok(validateEntry({ ...entry, images: [] }).length);
  assert.deepEqual(validateEntry(entry), []);
});
test('matching an explicit existing product in another category is blocked', () => {
  assert.equal(classifyItem({ ...entry, existingProductId: 'old' }, categories[0], [{ _id: 'old', categoryId: 'other', dimensions: '16x22' }], 'fixed-slug').action, 'REVIEW_CONFLICT');
});
