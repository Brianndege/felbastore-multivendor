export type CategoryDefinition = {
  id: string;
  name: string;
  icon: string;
  description: string;
  image: string;
};

export const DEFAULT_CATEGORIES: CategoryDefinition[] = [
  {
    id: "electronics",
    name: "Electronics",
    icon: "📱",
    description: "Smartphones, laptops, headphones, and tech gadgets",
    image: "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=500&auto=format&fit=crop&q=60",
  },
  {
    id: "fashion",
    name: "Fashion",
    icon: "👕",
    description: "Clothing, shoes, accessories, and style essentials",
    image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=500&auto=format&fit=crop&q=60",
  },
  {
    id: "home-garden",
    name: "Home & Garden",
    icon: "🏡",
    description: "Furniture, decor, gardening tools, and home essentials",
    image: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=500&auto=format&fit=crop&q=60",
  },
  {
    id: "beauty-health",
    name: "Beauty & Health",
    icon: "💄",
    description: "Skincare, makeup, wellness, and health products",
    image: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=500&auto=format&fit=crop&q=60",
  },
  {
    id: "toys-games",
    name: "Toys & Games",
    icon: "🎮",
    description: "Kids toys, board games, and entertainment",
    image: "https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=500&auto=format&fit=crop&q=60",
  },
  {
    id: "sports",
    name: "Sports",
    icon: "⚽",
    description: "Athletic gear, fitness equipment, and outdoor sports",
    image: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=500&auto=format&fit=crop&q=60",
  },
  {
    id: "food-beverage",
    name: "Food & Beverage",
    icon: "🍽️",
    description: "Gourmet foods, beverages, and culinary delights",
    image: "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=500&auto=format&fit=crop&q=60",
  },
  {
    id: "art-collectibles",
    name: "Art & Collectibles",
    icon: "🎨",
    description: "Artwork, antiques, and unique collectible items",
    image: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=500&auto=format&fit=crop&q=60",
  },
  {
    id: "handmade",
    name: "Handmade",
    icon: "✋",
    description: "Unique handcrafted items and artisan products",
    image: "https://images.unsplash.com/photo-1452860606245-08befc0ff44b?w=500&auto=format&fit=crop&q=60",
  },
  {
    id: "books-media",
    name: "Books & Media",
    icon: "📚",
    description: "Books, e-books, music, and digital media",
    image: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=500&auto=format&fit=crop&q=60",
  },
  {
    id: "automotive",
    name: "Automotive",
    icon: "🚗",
    description: "Car accessories, tools, and automotive parts",
    image: "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=500&auto=format&fit=crop&q=60",
  },
  {
    id: "pet-supplies",
    name: "Pet Supplies",
    icon: "🐕",
    description: "Pet food, toys, accessories, and care products",
    image: "https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=500&auto=format&fit=crop&q=60",
  },
];

export const slugifyCategory = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const categoryBySlug = new Map(DEFAULT_CATEGORIES.map((category) => [category.id, category]));

export const getCategoryMetaBySlug = (slug: string): CategoryDefinition | null => {
  return categoryBySlug.get(slug) ?? null;
};

export const toCategorySlug = (value: string): string => slugifyCategory(value);

export const normalizeCategoryName = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const category = categoryBySlug.get(slugifyCategory(trimmed));
  return category?.name ?? trimmed;
};

export const humanizeCategorySlug = (slug: string): string => {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
};