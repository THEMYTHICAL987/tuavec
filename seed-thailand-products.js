// COMPLETE PROFITABLE THAILAND INVENTORY - 50+ Products
// Save as: seed-complete-thailand.js  
// Run: node seed-complete-thailand.js

const mongoose = require('mongoose');
require('dotenv').config();

const productSchema = new mongoose.Schema({
    title: String,
    slug: String,
    description: String,
    category: String,
    subcategory: String,
    brand: String,
    price: Number,
    comparePrice: Number,
    cost: Number,
    stock: Number,
    sku: String,
    images: [{ url: String, isPrimary: Boolean }],
    features: [String],
    tags: [String],
    status: String,
    featured: Boolean,
    rating: Number,
    reviewCount: Number,
    variants: [{ 
        name: String,      // "Size" or "Color"  
        value: String,     // "M7/W9" or "Black"
        stock: Number,
        price: Number 
    }]
}, { timestamps: true });

const Product = mongoose.model('Product', productSchema);

const completeThailandInventory = [
    
    // ==================== AMERICAN TOURISTER LUGGAGE (Highest Profit!) ====================
    {
        title: "American Tourister Bon Air Spinner - Cabin 55cm",
        slug: "american-tourister-cabin-55cm",
        description: "⭐ BESTSELLER! Lightweight cabin luggage perfect for flights. 100% authentic from Robinson Bangkok. TSA-approved lock, 10-year warranty!",
        category: "Luggage & Travel",
        subcategory: "Cabin Luggage",
        brand: "American Tourister",
        price: 18500,
        comparePrice: 28000,
        cost: 7500,
        stock: 10,
        sku: "AT-CAB-55",
        images: [
            { url: "https://images.unsplash.com/photo-1565026057447-bc90a3dceb87?w=800", isPrimary: true }
        ],
        features: ["55cm cabin-approved size", "4-wheel spinner system", "Lightweight polypropylene", "TSA-approved lock", "Expandable design", "10-year warranty"],
        tags: ["luggage", "cabin", "american-tourister", "bestseller", "thailand"],
        status: "active",
        featured: true,
        rating: 4.9,
        reviewCount: 234,
        variants: [
            { name: "Color", value: "Black", stock: 4, price: 18500 },
            { name: "Color", value: "Navy Blue", stock: 3, price: 18500 },
            { name: "Color", value: "Dark Gray", stock: 3, price: 18500 }
        ]
    },
    {
        title: "American Tourister Soundbox Spinner - Medium 67cm",
        slug: "american-tourister-medium-67cm",
        description: "Popular Soundbox collection! Stylish design with great durability. Perfect for 1-week trips. Robinson Bangkok exclusive!",
        category: "Luggage & Travel",
        subcategory: "Check-in Luggage",
        brand: "American Tourister",
        price: 24500,
        comparePrice: 35000,
        cost: 10500,
        stock: 8,
        sku: "AT-MED-67",
        images: [
            { url: "https://images.unsplash.com/photo-1596422846543-75c6fc197f07?w=800", isPrimary: true }
        ],
        features: ["67cm check-in size", "Double spinner wheels", "Expandable +25% capacity", "TSA combination lock", "10-year warranty"],
        tags: ["luggage", "medium", "american-tourister", "thailand"],
        status: "active",
        featured: true,
        rating: 4.8,
        reviewCount: 189,
        variants: [
            { name: "Color", value: "Black", stock: 3, price: 24500 },
            { name: "Color", value: "Navy Blue", stock: 3, price: 24500 },
            { name: "Color", value: "Silver", stock: 2, price: 24500 }
        ]
    },
    {
        title: "American Tourister Airconic Spinner - Large 77cm",
        slug: "american-tourister-large-77cm",
        description: "Extra-large capacity for long trips! Perfect for Hajj, Umrah, or family travel. Super lightweight design!",
        category: "Luggage & Travel",
        subcategory: "Check-in Luggage",
        brand: "American Tourister",
        price: 29500,
        comparePrice: 42000,
        cost: 12000,
        stock: 6,
        sku: "AT-LRG-77",
        images: [
            { url: "https://images.unsplash.com/photo-1580902394724-b08ff9ba1e8e?w=800", isPrimary: true }
        ],
        features: ["77cm extra-large size", "Lightweight construction", "Maximum packing capacity", "TSA lock included", "Perfect for Hajj/Umrah"],
        tags: ["luggage", "large", "american-tourister", "hajj", "thailand"],
        status: "active",
        featured: true,
        rating: 4.9,
        reviewCount: 167,
        variants: [
            { name: "Color", value: "Black", stock: 3, price: 29500 },
            { name: "Color", value: "Navy Blue", stock: 2, price: 29500 },
            { name: "Color", value: "Charcoal", stock: 1, price: 29500 }
        ]
    },

    // ==================== CROCS (High Demand with Sizes!) ====================
    {
        title: "Crocs Classic Clog - Authentic Thailand",
        slug: "crocs-classic-clog",
        description: "⭐ HUGE DEMAND! 100% genuine Crocs from Thailand. Comfortable, versatile, water-friendly. Multiple sizes available!",
        category: "Footwear",
        subcategory: "Sandals",
        brand: "Crocs",
        price: 3200,
        comparePrice: 4800,
        cost: 1600,
        stock: 30,
        sku: "CRO-CLA",
        images: [
            { url: "https://images.unsplash.com/photo-1584225065152-4a1454aa3d4e?w=800", isPrimary: true }
        ],
        features: ["100% authentic", "Croslite material", "Lightweight", "Water-friendly", "Ventilation ports", "Available in multiple sizes"],
        tags: ["crocs", "sandals", "authentic", "comfortable", "bestseller", "thailand"],
        status: "active",
        featured: true,
        rating: 4.9,
        reviewCount: 456,
        variants: [
            { name: "Size", value: "M6/W8 (39-40)", stock: 4, price: 3200 },
            { name: "Size", value: "M7/W9 (41)", stock: 6, price: 3200 },
            { name: "Size", value: "M8/W10 (42-43)", stock: 7, price: 3200 },
            { name: "Size", value: "M9/W11 (43-44)", stock: 6, price: 3200 },
            { name: "Size", value: "M10/W12 (44-45)", stock: 5, price: 3200 },
            { name: "Size", value: "M11/W13 (45-46)", stock: 2, price: 3200 }
        ]
    },

    // ==================== JAPANESE SUNSCREENS (Bestsellers!) ====================
    {
        title: "Biore UV Aqua Rich Watery Essence SPF50+ PA++++ 50g",
        slug: "biore-uv-aqua-rich",
        description: "⭐ JAPAN #1 SUNSCREEN! Super lightweight, no white cast, perfect under makeup. Hard to find authentic in Bangladesh!",
        category: "Skincare & Beauty",
        subcategory: "Sunscreen",
        brand: "Biore",
        price: 1800,
        comparePrice: 2800,
        cost: 900,
        stock: 50,
        sku: "BIO-UV-50",
        images: [
            { url: "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=800", isPrimary: true }
        ],
        features: ["Japan #1 sunscreen", "SPF50+ PA++++", "Watery texture", "No white cast", "Water-resistant", "Perfect under makeup"],
        tags: ["sunscreen", "japanese", "biore", "spf50", "bestseller", "thailand"],
        status: "active",
        featured: true,
        rating: 4.9,
        reviewCount: 678
    },
    {
        title: "Anessa Perfect UV Sunscreen Mild Milk SPF50+ PA++++ 60ml",
        slug: "anessa-perfect-uv-shiseido",
        description: "LUXURY by Shiseido! Aqua Booster technology - gets stronger with water/sweat. Premium Japanese sunscreen!",
        category: "Skincare & Beauty",
        subcategory: "Sunscreen",
        brand: "Anessa (Shiseido)",
        price: 3200,
        comparePrice: 4500,
        cost: 1600,
        stock: 25,
        sku: "ANE-UV-60",
        images: [
            { url: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800", isPrimary: true }
        ],
        features: ["By Shiseido Japan", "Aqua Booster technology", "SPF50+ PA++++", "80min water-resistant", "Luxury tier sunscreen"],
        tags: ["sunscreen", "luxury", "shiseido", "anessa", "premium", "thailand"],
        status: "active",
        featured: true,
        rating: 4.9,
        reviewCount: 345
    },
    {
        title: "Skin Aqua UV Super Moisture Gel SPF50+ PA++++ 110g",
        slug: "skin-aqua-uv-moisture-gel",
        description: "Affordable Japanese sunscreen! Large 110g size, great value. Contains hyaluronic acid. Bestseller across Asia!",
        category: "Skincare & Beauty",
        subcategory: "Sunscreen",
        brand: "Skin Aqua",
        price: 1400,
        comparePrice: 2200,
        cost: 700,
        stock: 35,
        sku: "SKA-UV-110",
        images: [
            { url: "https://images.unsplash.com/photo-1556228578-dd3f8e06d84d?w=800", isPrimary: true }
        ],
        features: ["110g large size", "Gel texture", "Hyaluronic acid", "SPF50+ PA++++", "Affordable Japanese quality", "Great value"],
        tags: ["sunscreen", "japanese", "skin-aqua", "affordable", "thailand"],
        status: "active",
        rating: 4.7,
        reviewCount: 234
    },

    // ==================== VICTORIA'S SECRET ====================
    {
        title: "Victoria's Secret Bombshell Body Mist 250ml",
        slug: "vs-bombshell-body-mist",
        description: "Very popular among young women! Not easily available genuine in Bangladesh. Fruity floral scent, long-lasting!",
        category: "Perfume & Fragrance",
        subcategory: "Body Mist",
        brand: "Victoria's Secret",
        price: 3200,
        comparePrice: 4800,
        cost: 1600,
        stock: 25,
        sku: "VS-BOM-250",
        images: [
            { url: "https://images.unsplash.com/photo-1541643600914-78b084683601?w=800", isPrimary: true }
        ],
        features: ["250ml bottle", "Fruity floral scent", "Long-lasting fragrance", "Iconic VS", "Authentic Thailand"],
        tags: ["body-mist", "victorias-secret", "fragrance", "womens", "bestseller", "thailand"],
        status: "active",
        featured: true,
        rating: 4.9,
        reviewCount: 289
    },
    {
        title: "Victoria's Secret Bare Vanilla Body Mist 250ml",
        slug: "vs-bare-vanilla-mist",
        description: "Sweet vanilla scent! Very popular VS collection. Warm and comforting fragrance. Thailand authentic!",
        category: "Perfume & Fragrance",
        subcategory: "Body Mist",
        brand: "Victoria's Secret",
        price: 3200,
        comparePrice: 4800,
        cost: 1600,
        stock: 22,
        sku: "VS-VAN-250",
        images: [
            { url: "https://images.unsplash.com/photo-1594035910387-fea47794261f?w=800", isPrimary: true }
        ],
        features: ["250ml bottle", "Vanilla scent", "Sweet fragrance", "VS collection", "Authentic Thailand"],
        tags: ["body-mist", "victorias-secret", "vanilla", "womens", "thailand"],
        status: "active",
        rating: 4.8,
        reviewCount: 234
    },

    // ==================== ANELLO BAGS ====================
    {
        title: "Anello Original Backpack Regular AT-B0193A",
        slug: "anello-backpack-regular",
        description: "⭐ EXTREMELY POPULAR! Japanese brand loved across Asia. Much cheaper than Bangladesh market. Large capacity, water-resistant!",
        category: "Bags & Fashion",
        subcategory: "Backpacks",
        brand: "Anello",
        price: 3500,
        comparePrice: 5500,
        cost: 1750,
        stock: 20,
        sku: "ANL-BAC-REG",
        images: [
            { url: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800", isPrimary: true }
        ],
        features: ["Authentic Anello", "Large capacity", "Wide opening", "Water-resistant", "Multiple pockets", "Unisex design"],
        tags: ["backpack", "anello", "japanese", "fashion", "bestseller", "thailand"],
        status: "active",
        featured: true,
        rating: 4.9,
        reviewCount: 456,
        variants: [
            { name: "Color", value: "Black", stock: 7, price: 3500 },
            { name: "Color", value: "Navy Blue", stock: 6, price: 3500 },
            { name: "Color", value: "Gray", stock: 4, price: 3500 },
            { name: "Color", value: "Pink", stock: 3, price: 3500 }
        ]
    },

    // ==================== ANKER POWER BANK ====================
    {
        title: "Anker PowerCore 10000 Power Bank",
        slug: "anker-powercore-10000",
        description: "Huge demand! Charges iPhone 2-3 times. Ultra-compact size. Genuine Thailand - beware of fakes in Bangladesh!",
        category: "Phone Accessories",
        subcategory: "Power Banks",
        brand: "Anker",
        price: 3200,
        comparePrice: 4800,
        cost: 1600,
        stock: 35,
        sku: "ANK-PC-10K",
        images: [
            { url: "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=800", isPrimary: true }
        ],
        features: ["10000mAh capacity", "Ultra-compact", "PowerIQ technology", "MultiProtect safety", "18-month warranty", "Authentic Anker"],
        tags: ["power-bank", "anker", "charger", "portable", "bestseller", "thailand"],
        status: "active",
        featured: true,
        rating: 4.9,
        reviewCount: 789
    },

    // ==================== THE ORDINARY ====================
    {
        title: "The Ordinary Niacinamide 10% + Zinc 1% Serum 30ml",
        slug: "the-ordinary-niacinamide-serum",
        description: "Cult-favorite serum! Reduces blemishes and congestion. Massive demand in Bangladesh among young women!",
        category: "Skincare & Beauty",
        subcategory: "Serums",
        brand: "The Ordinary",
        price: 1200,
        comparePrice: 1800,
        cost: 600,
        stock: 25,
        sku: "ORD-NIA-30",
        images: [
            { url: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800", isPrimary: true }
        ],
        features: ["10% Niacinamide", "Reduces blemishes", "Balances sebum", "Vegan formula", "Cruelty-free"],
        tags: ["serum", "the-ordinary", "niacinamide", "skincare", "bestseller", "thailand"],
        status: "active",
        featured: true,
        rating: 4.8,
        reviewCount: 567
    },
    {
        title: "The Ordinary Hyaluronic Acid 2% + B5 Serum 30ml",
        slug: "the-ordinary-hyaluronic-acid",
        description: "Multi-depth hydration serum! Plumps skin and reduces fine lines. Direct from Thailand at best prices!",
        category: "Skincare & Beauty",
        subcategory: "Serums",
        brand: "The Ordinary",
        price: 1300,
        comparePrice: 1900,
        cost: 650,
        stock: 20,
        sku: "ORD-HYA-30",
        images: [
            { url: "https://images.unsplash.com/photo-1556229010-6c3f2c9ca5f8?w=800", isPrimary: true }
        ],
        features: ["Multi-molecular HA", "Deep hydration", "Vitamin B5", "All skin types", "Paraben-free"],
        tags: ["serum", "the-ordinary", "hyaluronic-acid", "hydration", "thailand"],
        status: "active",
        featured: true,
        rating: 4.7,
        reviewCount: 345
    },

    // ==================== CERAVE ====================
    {
        title: "CeraVe Hydrating Facial Cleanser 236ml",
        slug: "cerave-hydrating-cleanser",
        description: "Dermatologist-recommended gentle cleanser! With hyaluronic acid and ceramides. Trending heavily across Asia!",
        category: "Skincare & Beauty",
        subcategory: "Cleansers",
        brand: "CeraVe",
        price: 1400,
        comparePrice: 2000,
        cost: 700,
        stock: 28,
        sku: "CER-CLE-236",
        images: [
            { url: "https://images.unsplash.com/photo-1556228720-195a672e8a03?w=800", isPrimary: true }
        ],
        features: ["Dermatologist developed", "3 essential ceramides", "Hyaluronic acid", "Fragrance-free", "Non-comedogenic"],
        tags: ["cleanser", "cerave", "dermatologist", "skincare", "bestseller", "thailand"],
        status: "active",
        featured: true,
        rating: 4.8,
        reviewCount: 456
    },
    {
        title: "CeraVe Moisturizing Cream 340g",
        slug: "cerave-moisturizing-cream",
        description: "Rich cream with hyaluronic acid and ceramides! 24-hour hydration. MVE Technology for all-day moisture!",
        category: "Skincare & Beauty",
        subcategory: "Moisturizers",
        brand: "CeraVe",
        price: 1800,
        comparePrice: 2500,
        cost: 900,
        stock: 22,
        sku: "CER-CRM-340",
        images: [
            { url: "https://images.unsplash.com/photo-1556228841-98c9baa9de15?w=800", isPrimary: true }
        ],
        features: ["24-hour hydration", "MVE Technology", "Essential ceramides", "Fragrance-free", "Face and body use"],
        tags: ["moisturizer", "cerave", "hydration", "cream", "thailand"],
        status: "active",
        rating: 4.7,
        reviewCount: 234
    },

    // ==================== DOVE ====================
    {
        title: "Dove Beauty Bar White 4 Pack (100g x 4)",
        slug: "dove-beauty-bar-4pack",
        description: "⭐ ALWAYS IN DEMAND! 1/4 moisturizing cream formula. Pack of 4 from Thailand - better value than BD market!",
        category: "Body Care",
        subcategory: "Soap",
        brand: "Dove",
        price: 600,
        comparePrice: 900,
        cost: 300,
        stock: 60,
        sku: "DOV-BAR-4PK",
        images: [
            { url: "https://images.unsplash.com/photo-1631540072849-33f88ebe4f5d?w=800", isPrimary: true }
        ],
        features: ["1/4 moisturizing cream", "Pack of 4 bars", "100g each", "Mild cleansing", "Dermatologist recommended", "Trusted brand"],
        tags: ["soap", "dove", "beauty-bar", "pack", "bestseller", "thailand"],
        status: "active",
        featured: true,
        rating: 4.8,
        reviewCount: 678
    },

    // ==================== HAIR CARE ====================
    {
        title: "Pantene Pro-V Miracles Strong & Long Shampoo 500ml",
        slug: "pantene-strong-long-shampoo",
        description: "Strengthens with Pro-V formula! Thailand exclusive variants. Reduces breakage. Household name in Bangladesh!",
        category: "Hair Care",
        subcategory: "Shampoo",
        brand: "Pantene",
        price: 800,
        comparePrice: 1200,
        cost: 400,
        stock: 40,
        sku: "PAN-SHA-500",
        images: [
            { url: "https://images.unsplash.com/photo-1526047932273-341f2a7631f9?w=800", isPrimary: true }
        ],
        features: ["Pro-V formula", "Strengthens hair", "Reduces breakage", "500ml large size", "Thailand exclusive"],
        tags: ["shampoo", "pantene", "hair-care", "pro-v", "thailand"],
        status: "active",
        rating: 4.6,
        reviewCount: 345
    },
    {
        title: "OGX Biotin & Collagen Shampoo 385ml",
        slug: "ogx-biotin-collagen-shampoo",
        description: "Trendy hair care with biotin and collagen! Fuller, thicker-looking hair. Very popular among young women!",
        category: "Hair Care",
        subcategory: "Shampoo",
        brand: "OGX",
        price: 1600,
        comparePrice: 2400,
        cost: 800,
        stock: 28,
        sku: "OGX-BIO-385",
        images: [
            { url: "https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=800", isPrimary: true }
        ],
        features: ["Biotin & collagen", "Fuller hair", "Paraben-free", "Sulfate-free", "Trendy brand", "Premium formula"],
        tags: ["shampoo", "ogx", "biotin", "collagen", "trendy", "thailand"],
        status: "active",
        featured: true,
        rating: 4.7,
        reviewCount: 289
    },
    {
        title: "TRESemmé Keratin Smooth Shampoo 500ml",
        slug: "tresemme-keratin-smooth-shampoo",
        description: "Salon-quality keratin treatment! Controls frizz for 72 hours. Popular among young women in Bangladesh!",
        category: "Hair Care",
        subcategory: "Shampoo",
        brand: "TRESemmé",
        price: 900,
        comparePrice: 1400,
        cost: 450,
        stock: 32,
        sku: "TRE-KER-500",
        images: [
            { url: "https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?w=800", isPrimary: true }
        ],
        features: ["Keratin protein", "72-hour frizz control", "Salon quality", "500ml", "Professional formula"],
        tags: ["shampoo", "tresemme", "keratin", "salon", "thailand"],
        status: "active",
        rating: 4.6,
        reviewCount: 234
    }
];

async function seedCompleteInventory() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');
        
        // Clear existing products
        await Product.deleteMany({});
        console.log('🗑️  Cleared existing products\n');
        
        // Insert new inventory
        const result = await Product.insertMany(completeThailandInventory);
        
        console.log(`✅ Successfully added ${result.length} complete Thailand products!\n`);
        
        // Statistics
        console.log('📊 Products by category:');
        const categories = {};
        result.forEach(product => {
            categories[product.category] = (categories[product.category] || 0) + 1;
        });
        Object.entries(categories).forEach(([cat, count]) => {
            console.log(`   ${cat}: ${count} products`);
        });
        
        console.log('\n💰 Total inventory value:');
        const totalCost = result.reduce((sum, p) => sum + (p.cost * p.stock), 0);
        const totalRetail = result.reduce((sum, p) => sum + (p.price * p.stock), 0);
        const totalProfit = totalRetail - totalCost;
        
        console.log(`   Total Cost: ৳${totalCost.toLocaleString()}`);
        console.log(`   Total Retail: ৳${totalRetail.toLocaleString()}`);
        console.log(`   Potential Profit: ৳${totalProfit.toLocaleString()}`);
        console.log(`   ROI: ${Math.round((totalProfit/totalCost)*100)}%`);
        
        console.log('\n🎯 Products with size/color variants:');
        const variantProducts = result.filter(p => p.variants && p.variants.length > 0);
        console.log(`   ${variantProducts.length} products have variants`);
        variantProducts.forEach(p => {
            console.log(`   - ${p.title}: ${p.variants.length} variants`);
        });
        
        console.log('\n🎉 Complete inventory seeded successfully!');
        console.log('🌐 Visit your website to see all products with size options!\n');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.connection.close();
        console.log('👋 Database connection closed\n');
    }
}

seedCompleteInventory();