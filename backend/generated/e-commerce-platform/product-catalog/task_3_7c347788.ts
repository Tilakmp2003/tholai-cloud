import React, { useState, useEffect } from 'react';
import './App.css'; // For basic styling

// --- Mock API Simulation ---
// In a real application, these would be actual API calls using fetch or axios.
const mockCategories = [
  { id: '1', name: 'Electronics' },
  { id: '2', name: 'Books' },
  { id: '3', name: 'Home & Kitchen' },
  { id: '4', name: 'Apparel' },
];

const mockProducts = [
  { id: 'p1', name: 'Laptop', categoryId: '1', price: 1200 },
  { id: 'p2', name: 'Smartphone', categoryId: '1', price: 800 },
  { id: 'p3', name: 'The Great Gatsby', categoryId: '2', price: 15 },
  { id: 'p4', name: 'Sapiens: A Brief History', categoryId: '2', price: 20 },
  { id: 'p5', name: 'Blender', categoryId: '3', price: 75 },
  { id: 'p6', name: 'Coffee Maker', categoryId: '3', price: 100 },
  { id: 'p7', name: 'T-Shirt', categoryId: '4', price: 25 },
  { id: 'p8', name: 'Jeans', categoryId: '4', price: 60 },
  { id: 'p9', name: 'Smart Watch', categoryId: '1', price: 300 },
  { id: 'p10', name: '1984', categoryId: '2', price: 12 },
];

const simulateApiCall = (data, delay = 500) => {
  return new Promise(resolve => setTimeout(() => resolve(data), delay));
};

const fetchCategories = async () => {
  console.log('Fetching categories...');
  return simulateApiCall(mockCategories);
};

const fetchProducts = async (categoryId = null) => {
  console.log(`Fetching products for category: ${categoryId || 'All'}`);
  const filteredProducts = categoryId
    ? mockProducts.filter(product => product.categoryId === categoryId)
    : mockProducts;
  return simulateApiCall(filteredProducts);
};
// --- End Mock API Simulation ---

// --- ProductFilter Component ---
function ProductFilter({ onSelectCategory, activeCategoryId }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const getCategories = async () => {
      try {
        setLoading(true);
        const data = await fetchCategories();
        setCategories(data);
      } catch (err) {
        setError('Failed to load categories.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    getCategories();
  }, []);

  if (loading) return <div className="filter-sidebar">Loading categories...</div>;
  if (error) return <div className="filter-sidebar error">{error}</div>;

  return (
    <div className="filter-sidebar">
      <h2>Categories</h2>
      <ul>
        <li>
          <button
            onClick={() => onSelectCategory(null)}
            className={!activeCategoryId ? 'active' : ''}
          >
            All Products
          </button>
        </li>
        {categories.map(category => (
          <li key={category.id}>
            <button
              onClick={() => onSelectCategory(category.id)}
              className={activeCategoryId === category.id ? 'active' : ''}
            >
              {category.name}
            </button>
          </li>
        ))}
      </ul>
      {activeCategoryId && (
        <button className="clear-filter" onClick={() => onSelectCategory(null)}>
          Clear Filter
        </button>
      )}
    </div>
  );
}

// --- ProductList Component ---
function ProductList({ categoryId }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const getProducts = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchProducts(categoryId);
        setProducts(data);
      } catch (err) {
        setError('Failed to load products.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    getProducts();
  }, [categoryId]); // Re-fetch products whenever categoryId changes

  if (loading) return <div className="product-listing">Loading products...</div>;
  if (error) return <div className="product-listing error">{error}</div>;
  if (products.length === 0) return <div className="product-listing">No products found for this category.</div>;

  return (
    <div className="product-listing">
      {products.map(product => (
        <div key={product.id} className="product-card">
          <h3>{product.name}</h3>
          <p>Price: ${product.price}</p>
        </div>
      ))}
    </div>
  );
}

// --- App Component (Main) ---
function App() {
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);

  const handleSelectCategory = (categoryId) => {
    setSelectedCategoryId(categoryId);
  };

  return (
    <div className="app-container">
      <h1>Product Catalog</h1>
      <div className="main-content">
        <ProductFilter
          onSelectCategory={handleSelectCategory}
          activeCategoryId={selectedCategoryId}
        />
        <ProductList categoryId={selectedCategoryId} />
      </div>
    </div>
  );
}

export default App;

/* src/App.css */

body {
  font-family: Arial, sans-serif;
  margin: 0;
  padding: 0;
  background-color: #f4f4f4;
  color: #333;
}

.app-container {
  max-width: 1200px;
  margin: 20px auto;
  padding: 20px;
  background-color: #fff;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  border-radius: 8px;
}

h1 {
  text-align: center;
  color: #0056b3;
  margin-bottom: 30px;
}

.main-content {
  display: flex;
  gap: 20px;
}

/* ProductFilter Styles */
.filter-sidebar {
  flex: 0 0 250px; /* Fixed width for sidebar */
  padding: 20px;
  border-right: 1px solid #eee;
  background-color: #f9f9f9;
  border-radius: 8px;
  box-shadow: 2px 0 5px rgba(0, 0, 0, 0.05);
}

.filter-sidebar h2 {
  margin-top: 0;
  color: #0056b3;
  font-size: 1.3em;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
  margin-bottom: 15px;
}

.filter-sidebar ul {
  list-style: none;
  padding: 0;
  margin-bottom: 20px;
}

.filter-sidebar li {
  margin-bottom: 8px;
}

.filter-sidebar button {
  display: block; /* Make buttons take full width */
  width: 100%;
  padding: 10px 15px;
  border: 1px solid #ccc;
  border-radius: 5px;
  background-color: #e0e0e0;
  color: #333;
  text-align: left;
  cursor: pointer;
  font-size: 1em;
  transition: background-color 0.2s, border-color 0.2s, color 0.2s;
}

.filter-sidebar button:hover {
  background-color: #d0d0d0;
  border-color: #bbb;
}

.filter-sidebar button.active {
  background-color: #007bff;
  color: #fff;
  border-color: #007bff;
  font-weight: bold;
}

.filter-sidebar button.active:hover {
  background-color: #0056b3;
  border-color: #0056b3;
}

.filter-sidebar .clear-filter {
  background-color: #dc3545;
  color: #fff;
  border-color: #dc3545;
  margin-top: 15px;
  font-weight: normal;
}

.filter-sidebar .clear-filter:hover {
  background-color: #c82333;
  border-color: #bd2130;
}

.filter-sidebar.error {
  color: #dc3545;
  border-color: #dc3545;
  background-color: #ffe3e3;
  padding: 15px;
  border-radius: 5px;
}


/* ProductList Styles */
.product-listing {
  flex: 1; /* Takes up remaining space */
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 20px;
  padding: 10px;
}

.product-card {
  background-color: #fff;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 15px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  text-align: center;
}

.product-card h3 {
  margin-top: 0;
  color: #007bff;
  font-size: 1.2em;
}

.product-card p {
  color: #555;
  font-size: 1em;
}

.product-listing.error {
  color: #dc3545;
  border: 1px solid #dc3545;
  background-color: #ffe3e3;
  padding: 15px;
  border-radius: 5px;
  text-align: center;
}