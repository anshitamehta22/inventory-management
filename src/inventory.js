// Pure inventory helpers shared by the UI and the unit tests

export const LOW_STOCK_THRESHOLD = 5;

// Helper function to format numbers as Indian Rupees (INR)
export const formatINR = (value) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(value);
};

export const isLowStock = (product) => Number(product.quantity) <= LOW_STOCK_THRESHOLD;

export const productValue = (product) => Number(product.quantity) * Number(product.price);

// Totals shown on the Dashboard and Reports views
export const summarize = (products) => ({
  totalProducts: products.length,
  totalStockUnits: products.reduce((sum, p) => sum + Number(p.quantity), 0),
  lowStockCount: products.filter(isLowStock).length,
  totalInventoryValue: products.reduce((sum, p) => sum + productValue(p), 0)
});

// Filter logic for the inventory table
export const filterProducts = (products, { searchTerm = '', category = 'all', status = 'all' } = {}) => {
  return products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = category === 'all' || p.category === category;
    const matchesStatus = status === 'all' ||
      (status === 'low' && isLowStock(p)) ||
      (status === 'normal' && !isLowStock(p));
    return matchesSearch && matchesCategory && matchesStatus;
  });
};

// Returns an error message for invalid form data, or '' when it is valid
export const validateProduct = ({ name, category, quantity, price }, products, editingId = null) => {
  if (!name.trim() || !category.trim() || quantity === '' || price === '') {
    return 'All fields are required.';
  }
  if (Number(quantity) < 0 || Number(price) < 0) {
    return 'Quantity and price cannot be negative.';
  }
  // Duplicate check: case-insensitive and ignoring extra spaces
  const normalizedName = name.trim().toLowerCase();
  const existingProduct = products.find(p => p.name.trim().toLowerCase() === normalizedName);
  if (existingProduct && !editingId) {
    return `Product "${name}" already exists. Please edit the existing product to update its stock.`;
  }
  return '';
};

// Category-wise summary for the Reports view
export const categorySummary = (products) => {
  const categories = [...new Set(products.map(p => p.category))];
  return categories.map(cat => {
    const catProducts = products.filter(p => p.category === cat);
    return {
      category: cat,
      count: catProducts.length,
      totalQty: catProducts.reduce((sum, p) => sum + Number(p.quantity), 0),
      totalVal: catProducts.reduce((sum, p) => sum + productValue(p), 0)
    };
  });
};
