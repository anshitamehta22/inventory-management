import { useState, useEffect } from 'react';
import './App.css';
import {
  formatINR,
  summarize,
  filterProducts,
  validateProduct,
  categorySummary as summarizeByCategory
} from './inventory';

// Jenkins passes its build number as a Docker build arg, so each deployment is identifiable
const APP_VERSION = import.meta.env.VITE_APP_VERSION || 'dev';

function App() {
  // Load initial state from localStorage, or default to an empty array
  const [products, setProducts] = useState(() => {
    const saved = localStorage.getItem('inventory_products');
    return saved ? JSON.parse(saved) : [];
  });
  
  // Navigation state
  const [view, setView] = useState('dashboard');
  
  // Filter and search state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  
  // Form state
  const [formData, setFormData] = useState({ name: '', category: '', quantity: '', price: '' });
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  // Save to localStorage whenever products change
  useEffect(() => {
    localStorage.setItem('inventory_products', JSON.stringify(products));
  }, [products]);

  // Derived calculations for Dashboard and Reports
  const { totalProducts, totalStockUnits, lowStockCount, totalInventoryValue } = summarize(products);

  // Get unique categories for filtering
  const categories = ['all', ...new Set(products.map(p => p.category))];

  // Filter logic for the inventory table
  const filteredProducts = filterProducts(products, {
    searchTerm,
    category: filterCategory,
    status: filterStatus
  });

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(''); // Clear errors when user types
  };

  // Handle form submission (Add or Update)
  const handleSubmit = (e) => {
    e.preventDefault();
    const { name, category, quantity, price } = formData;

    // Validation: empty fields, negative values and duplicate names
    const validationError = validateProduct(formData, products, editingId);
    if (validationError) {
      setError(validationError);
      return;
    }

    const qty = Number(quantity);
    const prc = Number(price);

    if (editingId) {
      // Update existing product
      setProducts(prev => prev.map(p => 
        p.id === editingId ? { ...p, name: name.trim(), category: category.trim(), quantity: qty, price: prc } : p
      ));
      setEditingId(null);
    } else {
      // Add new product
      const newProduct = {
        id: Date.now().toString(),
        name: name.trim(),
        category: category.trim(),
        quantity: qty,
        price: prc
      };
      setProducts(prev => [...prev, newProduct]);
    }

    // Reset form after successful submission
    setFormData({ name: '', category: '', quantity: '', price: '' });
  };

  // Populate form for editing
  const handleEdit = (product) => {
    setFormData({
      name: product.name,
      category: product.category,
      quantity: product.quantity,
      price: product.price
    });
    setEditingId(product.id);
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Delete product with confirmation
  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      setProducts(prev => prev.filter(p => p.id !== id));
      // If we delete the product currently being edited, reset the form
      if (editingId === id) {
        setEditingId(null);
        setFormData({ name: '', category: '', quantity: '', price: '' });
      }
    }
  };

  // Cancel editing mode
  const handleCancelEdit = () => {
    setEditingId(null);
    setFormData({ name: '', category: '', quantity: '', price: '' });
    setError('');
  };

  // --- VIEW: Dashboard ---
  const renderDashboard = () => (
    <div className="dashboard-view">
      <h2>Dashboard Overview</h2>
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Unique Products</h3>
          <p className="stat-value">{totalProducts}</p>
        </div>
        <div className="stat-card">
          <h3>Total Stock Units</h3>
          <p className="stat-value">{totalStockUnits}</p>
        </div>
        <div className="stat-card warning">
          <h3>Low Stock Products</h3>
          <p className="stat-value">{lowStockCount}</p>
        </div>
        <div className="stat-card">
          <h3>Total Inventory Value</h3>
          <p className="stat-value">{formatINR(totalInventoryValue)}</p>
        </div>
      </div>
      
      <div className="recent-inventory">
        <h3>Recent Inventory</h3>
        {products.length === 0 ? (
          <p className="empty-message">No products in inventory yet. Add some in the Inventory tab!</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Product Name</th>
                <th>Category</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Total Value</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {products.slice(-5).reverse().map(product => (
                <tr key={product.id}>
                  <td>{product.name}</td>
                  <td>{product.category}</td>
                  <td>{product.quantity}</td>
                  <td>{formatINR(product.price)}</td>
                  <td>{formatINR(product.quantity * product.price)}</td>
                  <td>
                    <span className={`badge ${Number(product.quantity) <= 5 ? 'badge-low' : 'badge-normal'}`}>
                      {Number(product.quantity) <= 5 ? 'Low Stock' : 'In Stock'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  // --- VIEW: Inventory ---
  const renderInventory = () => (
    <div className="inventory-view">
      <h2>Inventory Management</h2>
      
      <div className="form-card">
        <h3>{editingId ? 'Edit Product' : 'Add New Product'}</h3>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit} className="product-form">
          <div className="form-group">
            <label>Product Name</label>
            <input 
              type="text" 
              name="name" 
              value={formData.name} 
              onChange={handleInputChange} 
              placeholder="e.g., Laptop"
            />
          </div>
          <div className="form-group">
            <label>Category</label>
            <input 
              type="text" 
              name="category" 
              value={formData.category} 
              onChange={handleInputChange} 
              placeholder="e.g., Electronics"
            />
          </div>
          <div className="form-group">
            <label>Quantity</label>
            <input 
              type="number" 
              name="quantity" 
              value={formData.quantity} 
              onChange={handleInputChange} 
              placeholder="0"
              min="0"
            />
          </div>
          <div className="form-group">
            <label>Unit Price (₹)</label>
            <input 
              type="number" 
              name="price" 
              value={formData.price} 
              onChange={handleInputChange} 
              placeholder="0.00"
              min="0"
              step="0.01"
            />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              {editingId ? 'Update Product' : 'Add Product'}
            </button>
            {editingId && (
              <button type="button" className="btn btn-secondary" onClick={handleCancelEdit}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="filters-bar">
        <input 
          type="text" 
          placeholder="Search by product name..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="filter-select">
          <option value="all">All Categories</option>
          {categories.filter(c => c !== 'all').map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="filter-select">
          <option value="all">All Stock Status</option>
          <option value="normal">In Stock (&gt;5)</option>
          <option value="low">Low Stock (≤5)</option>
        </select>
      </div>

      <div className="table-container">
        {filteredProducts.length === 0 ? (
          <p className="empty-message">No products match your criteria.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Product Name</th>
                <th>Category</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Total Value</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(product => (
                <tr key={product.id}>
                  <td>{product.name}</td>
                  <td>{product.category}</td>
                  <td>{product.quantity}</td>
                  <td>{formatINR(product.price)}</td>
                  <td>{formatINR(product.quantity * product.price)}</td>
                  <td>
                    <span className={`badge ${Number(product.quantity) <= 5 ? 'badge-low' : 'badge-normal'}`}>
                      {Number(product.quantity) <= 5 ? 'Low Stock' : 'In Stock'}
                    </span>
                  </td>
                  <td className="actions-cell">
                    <button className="btn btn-sm btn-edit" onClick={() => handleEdit(product)}>Edit</button>
                    <button className="btn btn-sm btn-delete" onClick={() => handleDelete(product.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  // --- VIEW: Reports ---
  const renderReports = () => {
    const categorySummary = summarizeByCategory(products);

    return (
      <div className="reports-view">
        <h2>Inventory Reports</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Total Inventory Value</h3>
            <p className="stat-value">{formatINR(totalInventoryValue)}</p>
          </div>
          <div className="stat-card">
            <h3>Total Products</h3>
            <p className="stat-value">{totalProducts}</p>
          </div>
          <div className="stat-card warning">
            <h3>Low Stock Products</h3>
            <p className="stat-value">{lowStockCount}</p>
          </div>
        </div>

        <div className="report-section">
          <h3>Category-wise Inventory Summary</h3>
          {categorySummary.length === 0 ? (
            <p className="empty-message">No data available to generate reports.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Unique Products</th>
                  <th>Total Units</th>
                  <th>Total Value</th>
                </tr>
              </thead>
              <tbody>
                {categorySummary.map((item, index) => (
                  <tr key={index}>
                    <td>{item.category}</td>
                    <td>{item.count}</td>
                    <td>{item.totalQty}</td>
                    <td>{formatINR(item.totalVal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  };

  // --- Main Layout ---
  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>Inventory MS</h1>
          <p className="app-version">Build {APP_VERSION}</p>
        </div>
        <nav className="sidebar-nav">
          <button 
            className={`nav-btn ${view === 'dashboard' ? 'active' : ''}`} 
            onClick={() => setView('dashboard')}
          >
            Dashboard
          </button>
          <button 
            className={`nav-btn ${view === 'inventory' ? 'active' : ''}`} 
            onClick={() => setView('inventory')}
          >
            Inventory
          </button>
          <button 
            className={`nav-btn ${view === 'reports' ? 'active' : ''}`} 
            onClick={() => setView('reports')}
          >
            Reports
          </button>
        </nav>
      </aside>
      
      <main className="main-content">
        <header className="top-header">
          <h2>Basic Inventory Management System</h2>
          <div className="user-profile">Admin</div>
        </header>
        
        <div className="content-area">
          {view === 'dashboard' && renderDashboard()}
          {view === 'inventory' && renderInventory()}
          {view === 'reports' && renderReports()}
        </div>
      </main>
    </div>
  );
}

export default App;
