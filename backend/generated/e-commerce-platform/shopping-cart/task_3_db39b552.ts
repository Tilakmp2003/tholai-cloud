from fastapi import FastAPI, HTTPException, status, Path
from pydantic import BaseModel, Field
from typing import Dict, Optional

# --- Data Models (Pydantic) ---
# Represents an item within the shopping cart
class CartItem(BaseModel):
    product_id: str
    name: str
    quantity: int = Field(..., gt=0)  # Quantity must be > 0 for an item to exist in cart
    price: float

# Represents a product in the catalog with its stock
class Product(BaseModel):
    id: str
    name: str
    price: float
    stock: int = Field(..., ge=0) # Stock cannot be negative

# Request body model for updating a cart item's quantity
class UpdateCartItemRequest(BaseModel):
    quantity: int = Field(..., ge=0, description="The new quantity for the product. Set to 0 to remove the item.")

# --- In-memory "Databases" for demonstration ---
# In a real application, these would be actual databases (SQL, NoSQL, etc.).
# We're using dictionaries to simulate persistent storage.

# Simulate a product catalog with available stock
PRODUCTS_DB: Dict[str, Product] = {
    "prod_101": Product(id="prod_101", name="Wireless Mouse", price=25.00, stock=50),
    "prod_102": Product(id="prod_102", name="Mechanical Keyboard", price=75.00, stock=10),
    "prod_103": Product(id="prod_103", name="Gaming Monitor", price=300.00, stock=5),
    "prod_104": Product(id="prod_104", name="Webcam", price=50.00, stock=0), # Example: out of stock
}

# Simulate a user's shopping cart
# Key is user_id, value is another dict mapping product_id to CartItem
# For simplicity, we'll assume a single user for this endpoint.
# In a real application, user_id would be determined by an authentication system.
CARTS_DB: Dict[str, Dict[str, CartItem]] = {
    "user_abc": {
        "prod_101": CartItem(product_id="prod_101", name="Wireless Mouse", quantity=2, price=25.00),
        "prod_102": CartItem(product_id="prod_102", name="Mechanical Keyboard", quantity=1, price=75.00),
    }
}

# --- FastAPI Application ---
app = FastAPI(
    title="Shopping Cart API",
    description="API for managing shopping cart items.",
    version="1.0.0",
)

# Placeholder for the current authenticated user ID
# In a real application, this would typically come from an authentication middleware
# (e.g., via JWT token in a header).
CURRENT_USER_ID = "user_abc"

@app.put(
    "/api/cart/items/{product_id}",
    response_model=Optional[CartItem], # Response can be an updated item or None (for 204 No Content)
    status_code=status.HTTP_200_OK,    # Default success status
    responses={
        status.HTTP_200_OK: {"description": "Cart item quantity updated successfully.", "model": CartItem},
        status.HTTP_204_NO_CONTENT: {"description": "Cart item removed successfully (quantity was 0)."},
        status.HTTP_400_BAD_REQUEST: {"description": "Invalid quantity or stock exceeded."},
        status.HTTP_404_NOT_FOUND: {"description": "Product not found in cart or product catalog."},
    }
)
async def update_cart_item_quantity(
    product_id: str = Path(..., description="The ID of the product to update in the cart."),
    request_body: UpdateCartItemRequest = ...,
):
    """
    Updates the quantity of a specific product in the current user's shopping cart.

    - **Path Parameter**: `product_id` (string) - The unique identifier of the product.
    - **Request Body**:
        - `quantity` (integer): The new quantity for the product. Must be non-negative (`>= 0`).
          If `0`, the item will be removed from the cart.

    **Behavior**:
    1.  Validates that the `product_id` exists in the user's cart.
    2.  Checks the `product_id` against the available product catalog for stock information.
    3.  If `new_quantity` is `0`:
        -   The item is removed from the cart.
        -   Returns `204 No Content` status.
    4.  If `new_quantity` is greater than `0`:
        -   Validates that the `new_quantity` does not exceed the available stock.
        -   Updates the item's quantity in the cart.
        -   Returns `200 OK` status with the updated `CartItem` object.

    **Error Handling**:
    -   `404 Not Found`: If the cart does not exist for the user, or the `product_id` is not in the cart,
        or the `product_id` is not found in the product catalog.
    -   `400 Bad Request`: If the `new_quantity` exceeds the available stock.
    """
    user_cart_items = CARTS_DB.get(CURRENT_USER_ID)

    if not user_cart_items:
        # If the user has no cart, treat it as not found for this operation.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shopping cart not found for the current user.")

    # 1. Validate productId and ensure item exists in cart
    existing_cart_item = user_cart_items.get(product_id)
    if not existing_cart_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product '{product_id}' not found in the cart.")

    # Get product details from the catalog for stock validation
    product_in_catalog = PRODUCTS_DB.get(product_id)
    if not product_in_catalog:
        # This case indicates an inconsistency (item in cart but not in catalog).
        # Could also be a 500 Internal Server Error in a real system,
        # but 404 is used here if the item itself isn't 'findable' in the main catalog.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product '{product_id}' not found in product catalog.")

    new_quantity = request_body.quantity

    # 2. If the new quantity is 0, remove the item from the cart
    if new_quantity == 0:
        del user_cart_items[product_id]
        # In-memory persistence: CARTS_DB is directly modified as user_cart_items is a mutable reference.
        # Return 204 No Content as the item has been successfully removed and no content is returned.
        return status.HTTP_204_NO_CONTENT
    else:
        # 3. Otherwise, update the item's quantity, ensuring it doesn't exceed available stock
        if new_quantity > product_in_catalog.stock:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Requested quantity ({new_quantity}) for '{product_in_catalog.name}' exceeds available stock ({product_in_catalog.stock})."
            )

        # Update the quantity of the existing cart item
        existing_cart_item.quantity = new_quantity
        # In-memory persistence: CARTS_DB is directly modified as existing_cart_item is a mutable reference.

        # Return the updated cart item with 200 OK status
        return existing_cart_item