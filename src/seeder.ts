import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

import Product from './models/Product';
import Category from './models/Category';
import User from './models/User';
import Review from './models/Review';
import connectDB from './config/db';

/** Category name (or slug) -> used to map products to categories */
const CATEGORY_IDS: Record<string, string> = {
  tshirts: 'T-Shirts',
  shirts: 'Shirts',
  hoodies: 'Hoodies',
  jackets: 'Jackets',
  jeans: 'Jeans',
  accessories: 'Accessories',
};

const categoriesData = [
  { name: "T-Shirts", image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=500&fit=crop" },
  { name: "Shirts", image: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400&h=500&fit=crop" },
  { name: "Hoodies", image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400&h=500&fit=crop" },
  { name: "Jackets", image: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&h=500&fit=crop" },
  { name: "Jeans", image: "https://images.unsplash.com/photo-1542272604-787c3835535d?w=400&h=500&fit=crop" },
  { name: "Accessories", image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=500&fit=crop" },
];

const productsData = [
  {
    name: "Classic Cotton Crew Neck T-Shirt",
    price: 799,
    originalPrice: 1299,
    image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=500&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800&h=1000&fit=crop",
      "https://images.unsplash.com/photo-1622445275463-afa2ab738c34?w=800&h=1000&fit=crop",
      "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800&h=1000&fit=crop",
    ],
    categoryId: "tshirts",
    sizes: ["S", "M", "L", "XL", "XXL"],
    colors: [
      { name: "White", hex: "#FFFFFF" },
      { name: "Black", hex: "#000000" },
      { name: "Navy", hex: "#1e3a5f" },
    ],
    rating: 4.5,
    reviewCount: 234,
    description: "Premium quality 100% cotton t-shirt with a comfortable crew neck design. Perfect for everyday wear.",
    fabric: "100% Cotton, 180 GSM",
    isNewItem: true,
  },
  {
    name: "Slim Fit Oxford Shirt",
    price: 1499,
    originalPrice: 2199,
    image: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400&h=500&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800&h=1000&fit=crop",
      "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=800&h=1000&fit=crop",
    ],
    categoryId: "shirts",
    sizes: ["S", "M", "L", "XL"],
    colors: [
      { name: "Light Blue", hex: "#87CEEB" },
      { name: "White", hex: "#FFFFFF" },
      { name: "Pink", hex: "#FFB6C1" },
    ],
    rating: 4.7,
    reviewCount: 189,
    description: "Elegant slim fit oxford shirt perfect for both office and casual outings.",
    fabric: "100% Premium Cotton Oxford",
    isTrending: true,
  },
  {
    name: "Premium Fleece Hoodie",
    price: 1999,
    originalPrice: 2999,
    image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400&h=500&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800&h=1000&fit=crop",
      "https://images.unsplash.com/photo-1509942774463-acf339cf87d5?w=800&h=1000&fit=crop",
    ],
    categoryId: "hoodies",
    sizes: ["S", "M", "L", "XL", "XXL"],
    colors: [
      { name: "Black", hex: "#000000" },
      { name: "Grey", hex: "#808080" },
      { name: "Maroon", hex: "#800000" },
    ],
    rating: 4.8,
    reviewCount: 312,
    description: "Warm and cozy fleece hoodie with a kangaroo pocket and adjustable hood.",
    fabric: "80% Cotton, 20% Polyester Fleece",
    isNewItem: true,
    isTrending: true,
  },
  {
    name: "Classic Denim Jacket",
    price: 2499,
    originalPrice: 3499,
    image: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&h=500&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&h=1000&fit=crop",
      "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=800&h=1000&fit=crop",
    ],
    categoryId: "jackets",
    sizes: ["S", "M", "L", "XL"],
    colors: [
      { name: "Blue", hex: "#1e3a5f" },
      { name: "Black", hex: "#000000" },
    ],
    rating: 4.6,
    reviewCount: 156,
    description: "Timeless denim jacket with a classic fit. Features button closure and multiple pockets.",
    fabric: "100% Cotton Denim",
    isTrending: true,
  },
  {
    name: "Slim Fit Stretch Jeans",
    price: 1799,
    originalPrice: 2499,
    image: "https://images.unsplash.com/photo-1542272604-787c3835535d?w=400&h=500&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1542272604-787c3835535d?w=800&h=1000&fit=crop",
      "https://images.unsplash.com/photo-1582552938357-32b906df40cb?w=800&h=1000&fit=crop",
    ],
    categoryId: "jeans",
    sizes: ["28", "30", "32", "34", "36"],
    colors: [
      { name: "Dark Blue", hex: "#1a1a2e" },
      { name: "Light Blue", hex: "#6b8e9f" },
      { name: "Black", hex: "#000000" },
    ],
    rating: 4.4,
    reviewCount: 278,
    description: "Comfortable slim fit jeans with stretch fabric for all-day comfort.",
    fabric: "98% Cotton, 2% Elastane",
    isNewItem: true,
  },
  {
    name: "Printed Graphic T-Shirt",
    price: 899,
    originalPrice: 1199,
    image: "https://images.unsplash.com/photo-1503341455253-b2e723bb3dbb?w=400&h=500&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1503341455253-b2e723bb3dbb?w=800&h=1000&fit=crop",
    ],
    categoryId: "tshirts",
    sizes: ["S", "M", "L", "XL"],
    colors: [
      { name: "White", hex: "#FFFFFF" },
      { name: "Black", hex: "#000000" },
    ],
    rating: 4.3,
    reviewCount: 145,
    description: "Trendy graphic t-shirt with unique printed designs.",
    fabric: "100% Cotton, 160 GSM",
    isTrending: true,
  },
  {
    name: "Leather Belt",
    price: 699,
    originalPrice: 999,
    image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=500&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&h=1000&fit=crop",
    ],
    categoryId: "accessories",
    sizes: ["S", "M", "L"],
    colors: [
      { name: "Brown", hex: "#8B4513" },
      { name: "Black", hex: "#000000" },
    ],
    rating: 4.6,
    reviewCount: 89,
    description: "Genuine leather belt with classic buckle design.",
    fabric: "100% Genuine Leather",
  },
  {
    name: "Casual Check Shirt",
    price: 1299,
    originalPrice: 1799,
    image: "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=400&h=500&fit=crop",
    images: [
      "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=800&h=1000&fit=crop",
    ],
    categoryId: "shirts",
    sizes: ["S", "M", "L", "XL"],
    colors: [
      { name: "Red Check", hex: "#DC2626" },
      { name: "Blue Check", hex: "#1e3a5f" },
    ],
    rating: 4.5,
    reviewCount: 167,
    description: "Comfortable casual check shirt for everyday wear.",
    fabric: "100% Cotton",
    isNewItem: true,
  },
];

const importData = async () => {
  try {
    await connectDB();

    await Review.deleteMany();
    await Product.deleteMany();
    await Category.deleteMany();

    const createdCategories = await Category.insertMany(categoriesData);
    const nameToId = new Map(createdCategories.map((c) => [c.name.toLowerCase(), c._id]));

    const productsMap = productsData.map((product) => {
      const categoryName = CATEGORY_IDS[product.categoryId] || product.categoryId;
      const categoryId = nameToId.get(categoryName.toLowerCase()) ?? createdCategories[0]._id;
      const { categoryId: _catId, ...productInfo } = product;
      return {
        ...productInfo,
        category: categoryId,
      };
    });

    await Product.insertMany(productsMap);

    // Demo admin user (create if not exists)
    const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@example.com';
    const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'admin123';
    const existingAdmin = await User.findOne({ email: adminEmail });
    if (!existingAdmin) {
      await User.create({
        firstName: 'Admin',
        lastName: 'User',
        email: adminEmail,
        password: adminPassword,
        isAdmin: true,
      });
      console.log(`Demo admin created: ${adminEmail} / ${adminPassword}`);
    } else {
      console.log(`Admin user already exists: ${adminEmail}`);
    }

    console.log('Data imported successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

const destroyData = async () => {
  try {
    await connectDB();

    await Review.deleteMany();
    await Product.deleteMany();
    await Category.deleteMany();

    console.log('Categories, products, and reviews destroyed.');
    process.exit(0);
  } catch (error) {
    console.error('Destroy error:', error);
    process.exit(1);
  }
};

const usage = () => {
  console.log('Usage: npm run seed        — seed categories, products, and demo admin');
  console.log('       npm run seed:destroy — remove categories, products, and reviews');
};

const arg = process.argv[2];
if (arg === '-d' || arg === '--destroy') {
  destroyData();
} else if (arg === '-h' || arg === '--help') {
  usage();
  process.exit(0);
} else {
  importData();
}
