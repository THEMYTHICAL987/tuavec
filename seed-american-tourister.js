// ADD AMERICAN TOURISTER LUGGAGE TO YOUR DATABASE
// Run this: node seed-american-tourister.js

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
    images: Array,
    features: Array,
    tags: Array,
    status: String,
    featured: Boolean,
    rating: Number,
    reviewCount: Number
}, { timestamps: true });

const Product = mongoose.model('Product', productSchema);

// American Tourister Products from Robinson Sukhumvit Bangkok
const americanTouristerProducts = [
    {
        title: "American Tourister Bon Air Spinner 55cm (Cabin Size)",
        slug: "american-tourister-bon-air-spinner-55cm",
        description: "⭐ BESTSELLER! Lightweight polypropylene cabin luggage. Perfect for short trips and flights. 100% authentic from Robinson Bangkok at HUGE discount!",
        category: "Luggage & Travel",
        subcategory: "Cabin Luggage",
        brand: "American Tourister",
        price: 18500,
        comparePrice: 28000,
        cost: 7500,  // ฿2,500 × 3 = ৳7,500
        stock: 8,
        sku: "AT-BON-55-001",
        images: [{
            url: "https://images.unsplash.com/photo-1565026057447-bc90a3dceb87?w=500",
            isPrimary: true
        }],
        features: [
            "55cm cabin-approved size",
            "4-wheel spinner system",
            "Lightweight polypropylene shell",
            "TSA-approved lock",
            "Expandable design",
            "10-year warranty from American Tourister",
            "Authentic from Robinson Bangkok"
        ],
        tags: ["luggage", "american-tourister", "cabin", "spinner", "travel", "thailand", "authentic", "bestseller"],
        status: "active",
        featured: true,
        rating: 4.9,
        reviewCount: 0
    },
    {
        title: "American Tourister Soundbox Spinner 67cm (Medium)",
        slug: "american-tourister-soundbox-spinner-67cm",
        description: "Popular Soundbox collection! Stylish design with great durability. Perfect for 1-week trips. Robinson Bangkok exclusive discount!",
        category: "Luggage & Travel",
        subcategory: "Check-in Luggage",
        brand: "American Tourister",
        price: 24500,
        comparePrice: 35000,
        cost: 10500,  // ฿3,500 × 3 = ৳10,500
        stock: 6,
        sku: "AT-SND-67-001",
        images: [{
            url: "https://images.unsplash.com/photo-1596422846543-75c6fc197f07?w=500",
            isPrimary: true
        }],
        features: [
            "67cm check-in size",
            "Double spinner wheels",
            "Polypropylene shell - ultra durable",
            "Expandable +25% capacity",
            "TSA combination lock",
            "Multiple color options",
            "10-year warranty",
            "Sourced from Robinson Bangkok sale"
        ],
        tags: ["luggage", "american-tourister", "soundbox", "medium", "travel", "thailand", "authentic"],
        status: "active",
        featured: true,
        rating: 4.8,
        reviewCount: 0
    },
    {
        title: "American Tourister Airconic Spinner 77cm (Large)",
        slug: "american-tourister-airconic-spinner-77cm",
        description: "Extra-large capacity for long trips or family travel. Super lightweight design. Perfect for Hajj, Umrah, or international trips!",
        category: "Luggage & Travel",
        subcategory: "Check-in Luggage",
        brand: "American Tourister",
        price: 29500,
        comparePrice: 42000,
        cost: 12000,  // ฿4,000 × 3 = ৳12,000
        stock: 5,
        sku: "AT-AIR-77-001",
        images: [{
            url: "https://images.unsplash.com/photo-1580902394724-b08ff9ba1e8e?w=500",
            isPrimary: true
        }],
        features: [
            "77cm extra-large size",
            "Lightweight construction",
            "Maximum packing capacity",
            "4 double spinner wheels",
            "Cross-ribbon straps inside",
            "TSA lock included",
            "Perfect for Hajj/Umrah",
            "10-year warranty",
            "Robinson Bangkok authentic"
        ],
        tags: ["luggage", "american-tourister", "large", "family", "hajj", "umrah", "travel", "thailand"],
        status: "active",
        featured: true,
        rating: 4.9,
        reviewCount: 0
    },
    {
        title: "American Tourister Bon Air 3-Piece Spinner Set",
        slug: "american-tourister-bon-air-3piece-set",
        description: "🔥 PREMIUM SET! Complete travel solution - Cabin + Medium + Large. Save ৳25,000 buying as set! Limited stock from Robinson Bangkok mega sale!",
        category: "Luggage & Travel",
        subcategory: "Luggage Sets",
        brand: "American Tourister",
        price: 55000,
        comparePrice: 85000,
        cost: 21000,  // ฿7,000 × 3 = ৳21,000
        stock: 3,
        sku: "AT-BON-SET-001",
        images: [{
            url: "https://images.unsplash.com/photo-1565026057447-bc90a3dceb87?w=500",
            isPrimary: true
        }],
        features: [
            "3-piece complete set (55cm + 67cm + 77cm)",
            "Matching design and color",
            "Save ৳25,000 vs buying separate",
            "Perfect for families",
            "Lightweight polypropylene",
            "All with TSA locks",
            "10-year warranty on all pieces",
            "Extremely limited stock",
            "Robinson Bangkok exclusive deal"
        ],
        tags: ["luggage", "american-tourister", "set", "family", "premium", "bestseller", "thailand", "limited"],
        status: "active",
        featured: true,
        rating: 5.0,
        reviewCount: 0
    },
    {
        title: "American Tourister Modern Dream Spinner 55cm (Cabin)",
        slug: "american-tourister-modern-dream-55cm",
        description: "Stylish modern design with premium features. Lightweight and durable. Perfect for business travelers and frequent flyers.",
        category: "Luggage & Travel",
        subcategory: "Cabin Luggage",
        brand: "American Tourister",
        price: 19500,
        comparePrice: 30000,
        cost: 8100,  // ฿2,700 × 3 = ৳8,100
        stock: 7,
        sku: "AT-MD-55-001",
        images: [{
            url: "https://images.unsplash.com/photo-1591214769942-e45f5a3e2a77?w=500",
            isPrimary: true
        }],
        features: [
            "55cm cabin size",
            "Modern sleek design",
            "Ultra-lightweight ABS+PC",
            "Multi-directional spinner wheels",
            "TSA-approved lock",
            "Laptop compartment inside",
            "Business travel optimized",
            "Robinson Bangkok authentic"
        ],
        tags: ["luggage", "american-tourister", "modern", "business", "cabin", "thailand", "authentic"],
        status: "active",
        featured: true,
        rating: 4.8,
        reviewCount: 0
    },
    {
        title: "American Tourister Curio Spinner 80cm (Extra Large)",
        slug: "american-tourister-curio-spinner-80cm",
        description: "Maximum capacity luggage for extended trips. Perfect for students, expats, or bulk packing. Robinson Bangkok clearance price!",
        category: "Luggage & Travel",
        subcategory: "Check-in Luggage",
        brand: "American Tourister",
        price: 32000,
        comparePrice: 48000,
        cost: 13500,  // ฿4,500 × 3 = ৳13,500
        stock: 4,
        sku: "AT-CUR-80-001",
        images: [{
            url: "https://images.unsplash.com/photo-1565026057447-bc90a3dceb87?w=500",
            isPrimary: true
        }],
        features: [
            "80cm extra-large capacity",
            "Perfect for students/expats",
            "Durable hard shell",
            "Expandable design",
            "TSA lock system",
            "Cross straps and divider",
            "Smooth-rolling wheels",
            "10-year warranty",
            "Robinson Bangkok sale price"
        ],
        tags: ["luggage", "american-tourister", "extra-large", "student", "expat", "thailand"],
        status: "active",
        featured: false,
        rating: 4.7,
        reviewCount: 0
    }
];

async function seedAmericanTourister() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');
        
        const result = await Product.insertMany(americanTouristerProducts);
        
        console.log(`✅ Added ${result.length} American Tourister products!\n`);
        
        console.log('💰 Profit Analysis:');
        const totalCost = result.reduce((sum, p) => sum + (p.cost * p.stock), 0);
        const totalRetail = result.reduce((sum, p) => sum + (p.price * p.stock), 0);
        const totalProfit = totalRetail - totalCost;
        
        console.log(`   Investment: ৳${totalCost.toLocaleString()}`);
        console.log(`   Retail Value: ৳${totalRetail.toLocaleString()}`);
        console.log(`   Potential Profit: ৳${totalProfit.toLocaleString()}`);
        console.log(`   ROI: ${Math.round((totalProfit/totalCost)*100)}%\n`);
        
        console.log('🎒 Products added:');
        result.forEach(p => {
            const margin = Math.round(((p.price - p.cost) / p.cost) * 100);
            console.log(`   ${p.title.substring(0, 50)}... - ৳${p.price.toLocaleString()} (${margin}% margin)`);
        });
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n👋 Done!');
    }
}

seedAmericanTourister();
