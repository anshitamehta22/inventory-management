import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  summarize,
  filterProducts,
  validateProduct,
  categorySummary,
  isLowStock
} from '../src/inventory.js';

const products = [
  { id: '1', name: 'Laptop', category: 'Electronics', quantity: 10, price: 50000 },
  { id: '2', name: 'Mouse', category: 'Electronics', quantity: 3, price: 500 },
  { id: '3', name: 'Desk', category: 'Furniture', quantity: 5, price: 8000 }
];

test('summarize computes dashboard totals', () => {
  assert.deepEqual(summarize(products), {
    totalProducts: 3,
    totalStockUnits: 18,
    lowStockCount: 2,
    totalInventoryValue: 10 * 50000 + 3 * 500 + 5 * 8000
  });
});

test('summarize handles an empty inventory', () => {
  assert.deepEqual(summarize([]), {
    totalProducts: 0,
    totalStockUnits: 0,
    lowStockCount: 0,
    totalInventoryValue: 0
  });
});

test('quantity of 5 or less counts as low stock', () => {
  assert.equal(isLowStock({ quantity: 5 }), true);
  assert.equal(isLowStock({ quantity: 6 }), false);
});

test('filterProducts matches search, category and status', () => {
  assert.deepEqual(filterProducts(products, { searchTerm: 'lap' }).map(p => p.id), ['1']);
  assert.deepEqual(filterProducts(products, { category: 'Furniture' }).map(p => p.id), ['3']);
  assert.deepEqual(filterProducts(products, { status: 'low' }).map(p => p.id), ['2', '3']);
  assert.deepEqual(filterProducts(products, { status: 'normal' }).map(p => p.id), ['1']);
});

test('validateProduct rejects empty, negative and duplicate entries', () => {
  const valid = { name: 'Chair', category: 'Furniture', quantity: '4', price: '1200' };
  assert.equal(validateProduct(valid, products), '');
  assert.equal(validateProduct({ ...valid, name: ' ' }, products), 'All fields are required.');
  assert.equal(validateProduct({ ...valid, quantity: '-1' }, products), 'Quantity and price cannot be negative.');
  assert.match(validateProduct({ ...valid, name: '  laptop ' }, products), /already exists/);
  assert.equal(validateProduct({ ...valid, name: 'Laptop' }, products, '1'), '');
});

test('categorySummary groups products by category', () => {
  assert.deepEqual(categorySummary(products), [
    { category: 'Electronics', count: 2, totalQty: 13, totalVal: 501500 },
    { category: 'Furniture', count: 1, totalQty: 5, totalVal: 40000 }
  ]);
});
