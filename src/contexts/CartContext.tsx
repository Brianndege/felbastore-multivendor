"use client";

import React, { createContext, useContext, useReducer, useEffect } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

interface CartItem {
  id: string;
  userId: string;
  productId: string;
  quantity: number;
  product: {
    id: string;
    name: string;
    price: number;
    images: string;
    vendor: {
      name: string;
      storeName: string;
    };
  };
}

interface CartState {
  items: CartItem[];
  loading: boolean;
  error: string | null;
}

interface CartContextType extends CartState {
  addToCart: (productId: string, quantity?: number) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeFromCart: (itemId: string) => Promise<void>;
  clearCart: () => void;
  getCartTotal: () => number;
  getCartCount: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

type CartAction =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_ITEMS"; payload: CartItem[] }
  | { type: "ADD_ITEM"; payload: CartItem }
  | { type: "UPDATE_ITEM"; payload: { id: string; quantity: number } }
  | { type: "REMOVE_ITEM"; payload: string }
  | { type: "CLEAR_CART" };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    case "SET_ITEMS":
      return { ...state, items: action.payload, loading: false };
    case "ADD_ITEM":
      const existingIndex = state.items.findIndex(item => item.productId === action.payload.productId);
      if (existingIndex > -1) {
        const updatedItems = [...state.items];
        updatedItems[existingIndex] = action.payload;
        return { ...state, items: updatedItems };
      }
      return { ...state, items: [...state.items, action.payload] };
    case "UPDATE_ITEM":
      return {
        ...state,
        items: state.items.map(item =>
          item.id === action.payload.id
            ? { ...item, quantity: action.payload.quantity }
            : item
        ),
      };
    case "REMOVE_ITEM":
      return {
        ...state,
        items: state.items.filter(item => item.id !== action.payload),
      };
    case "CLEAR_CART":
      return { ...state, items: [] };
    default:
      return state;
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [state, dispatch] = useReducer(cartReducer, {
    items: [],
    loading: false,
    error: null,
  });

  // Fetch cart items when user logs in
  useEffect(() => {
    if (session?.user?.role === "user") {
      fetchCartItems();
    } else {
      dispatch({ type: "CLEAR_CART" });
    }
  }, [session]);

  const fetchCartItems = async () => {
    dispatch({ type: "SET_LOADING", payload: true });
    try {
      const response = await fetch("/api/cart");
      if (response.ok) {
        const items = await response.json();
        dispatch({ type: "SET_ITEMS", payload: items });
      }
    } catch (error) {
      dispatch({ type: "SET_ERROR", payload: "Failed to fetch cart items" });
    }
  };

  const addToCart = async (productId: string, quantity = 1) => {
    if (!session?.user || session.user.role !== "user") {
      toast.error("Please log in to add items to cart");
      return;
    }

    try {
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, quantity }),
      });

      if (response.ok) {
        const cartItem = await response.json();
        dispatch({ type: "ADD_ITEM", payload: cartItem });
        toast.success("Item added to cart");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to add item to cart");
      }
    } catch (error) {
      toast.error("Failed to add item to cart");
    }
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    try {
      const response = await fetch(`/api/cart/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity }),
      });

      if (response.ok) {
        dispatch({ type: "UPDATE_ITEM", payload: { id: itemId, quantity } });
      } else {
        toast.error("Failed to update quantity");
      }
    } catch (error) {
      toast.error("Failed to update quantity");
    }
  };

  const removeFromCart = async (itemId: string) => {
    try {
      const response = await fetch(`/api/cart/${itemId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        dispatch({ type: "REMOVE_ITEM", payload: itemId });
        toast.success("Item removed from cart");
      } else {
        toast.error("Failed to remove item");
      }
    } catch (error) {
      toast.error("Failed to remove item");
    }
  };

  const clearCart = () => {
    dispatch({ type: "CLEAR_CART" });
  };

  const getCartTotal = () => {
    return state.items.reduce((total, item) => {
      const price = typeof item.product.price === "number" ? item.product.price : parseFloat(item.product.price.toString());
      return total + (price * item.quantity);
    }, 0);
  };

  const getCartCount = () => {
    return state.items.reduce((count, item) => count + item.quantity, 0);
  };

  return (
    <CartContext.Provider
      value={{
        ...state,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        getCartTotal,
        getCartCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
