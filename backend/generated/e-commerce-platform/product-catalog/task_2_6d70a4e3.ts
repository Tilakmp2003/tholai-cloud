<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Product Listing Page</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            background-color: #f4f4f4;
            color: #333;
        }
        h1 {
            color: #0056b3;
            text-align: center;
            margin-bottom: 30px;
        }
        .search-container {
            display: flex;
            justify-content: center;
            margin-bottom: 30px;
            gap: 10px;
        }
        .search-container input[type="text"] {
            padding: 10px 15px;
            width: 400px;
            max-width: 80%;
            border: 1px solid #ccc;
            border-radius: 5px;
            font-size: 16px;
        }
        .search-container button {
            padding: 10px 20px;
            background-color: #007bff;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
            transition: background-color 0.2s ease;
        }
        .search-container button:hover {
            background-color: #0056b3;
        }
        .product-list {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 25px;
            padding: 0 20px;
            max-width: 1200px;
            margin: 0 auto;
        }
        .product-card {
            background-color: white;
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            transition: transform 0.2s ease;
        }
        .product-card:hover {
            transform: translateY(-5px);
        }
        .product-card h3 {
            margin-top: 0;
            color: #333;
            font-size: 1.3em;
            margin-bottom: 10px;
        }
        .product-card p {
            margin: 5px 0;
            color: #666;
            line-height: 1.5;
        }
        .product-card strong {
            color: #007bff;
            font-size: 1.1em;
        }
        .empty-results {
            text-align: center;
            color: #888;
            margin-top: 50px;
            font-size: 1.2em;
            grid-column: 1 / -1; /* Span across all columns in grid */
        }
    </style>
</head>
<body>
    <h1>Product Listing</h1>

    <div class="search-container">
        <input type="text" id="searchInput" placeholder="Search products by name or description..." />
        <button id="searchButton">Search</button>
    </div>

    <div id="productList" class="product-list">
        <!-- Products will be loaded here dynamically -->
        <div class="empty-results">Loading products...</div>
    </div>

    <script>
        const searchInput = document.getElementById('searchInput');
        const searchButton = document.getElementById('searchButton');
        const productListDiv = document.getElementById('productList');

        /**
         * Fetches products from the API based on a search query.
         * @param {string} query - The search term.
         * @returns {Promise<Array>} A promise that resolves to an array of product objects.
         */
        async function fetchProducts(query = '') {
            try {
                // Construct the API URL, ensuring the query is properly URL-encoded.
                const apiUrl = `/api/products?search=${encodeURIComponent(query)}`;
                console.log(`Making API call to: ${apiUrl}`); // For debugging purposes

                const response = await fetch(apiUrl);

                if (!response.ok) {
                    // If the response is not OK (e.g., 404, 500), throw an error.
                    // This allows error handling to catch non-2xx responses.
                    const errorData = await response.text(); // Try to get error message from body
                    throw new Error(`HTTP error! Status: ${response.status}. Message: ${errorData || response.statusText}`);
                }

                const data = await response.json();
                return data;
            } catch (error) {
                console.error('Error fetching products:', error);
                // Display a user-friendly error message on the page.
                productListDiv.innerHTML = '<div class="empty-results">Failed to load products. Please check your connection or try again later.</div>';
                return []; // Return an empty array to prevent further rendering errors.
            }
        }

        /**
         * Renders the given array of products into the product list container.
         * Handles cases where no products are found.
         * @param {Array} products - An array of product objects to display.
         */
        function renderProducts(products) {
            productListDiv.innerHTML = ''; // Clear any previously displayed products or messages

            if (!products || products.length === 0) {
                // Display a message if no products are found.
                productListDiv.innerHTML = '<div class="empty-results">No products found matching your search. Try a different term!</div>';
                return;
            }

            // Iterate over the products and create HTML for each.
            products.forEach(product => {
                const productCard = document.createElement('div');
                productCard.classList.add('product-card');
                productCard.innerHTML = `
                    <h3>${product.name || 'Untitled Product'}</h3>
                    <p>${product.description || 'No description available.'}</p>
                    <p><strong>Price: $${(product.price !== undefined && !isNaN(product.price)) ? product.price.toFixed(2) : 'N/A'}</strong></p>
                `;
                productListDiv.appendChild(productCard);
            });
        }

        /**
         * Initiates a product search based on the current input field value
         * and updates the display with the results.
         */
        async function performSearch() {
            const searchTerm = searchInput.value.trim();
            productListDiv.innerHTML = '<div class="empty-results">Searching...</div>'; // Show loading indicator
            const products = await fetchProducts(searchTerm);
            renderProducts(products);
        }

        // Event listener for the search button click.
        searchButton.addEventListener('click', performSearch);

        // Event listener for the 'Enter' key press in the search input field.
        searchInput.addEventListener('keyup', (event) => {
            if (event.key === 'Enter') {
                performSearch();
            }
        });

        // Initial load: fetch and display all products when the page finishes loading.
        document.addEventListener('DOMContentLoaded', () => {
            performSearch(); // Calls fetchProducts with an empty query to get all products initially.
        });
    </script>
</body>
</html>