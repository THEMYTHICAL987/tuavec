const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
	{
		name: { type: String, required: true, trim: true },
		sku: {
			type: String,
			trim: true,
			uppercase: true,
			index: {
				unique: true,
				name: 'sku_unique',
				partialFilterExpression: { sku: { $type: 'string' } }
			}
		},
		title: { type: String, trim: true },
		slug: { type: String, trim: true, lowercase: true, index: true },
		category: { type: String, required: true, trim: true, index: true },
		productType: { type: String, enum: ['physical', 'digital'], default: 'physical', index: true },
		deliveryType: { type: String, enum: ['shipped', 'download', 'license', 'service'], default: 'shipped' },
		brand: { type: String, trim: true },
		size: { type: String, trim: true },
		landedCost: { type: Number, min: 0, select: false },
		priceTHB: { type: Number, min: 0 },
		priceBDT: { type: Number, min: 0 },
		price: { type: Number, required: true, min: 0 },
		originalPrice: { type: Number, min: 0 },
		image: { type: String, default: null },
		imageUrl: { type: String, default: null },
		images: [{ url: String }],
		description: { type: String, default: '' },
		seller: { type: String, default: 'Yow by KSA' },
		featured: { type: Boolean, default: false },
		stock: { type: Number, default: 0, min: 0 },
		inStock: { type: Boolean, default: true },
		consumable: { type: Boolean, default: false },
		warrantyEligible: { type: Boolean, default: false },
		campaignType: { type: String, enum: ['none', 'percentage', 'bogo'], default: 'none' },
		campaignValue: { type: Number, default: 0, min: 0, max: 80 },
		vendorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', default: null },
		vendorCommissionRate: { type: Number, default: 0, min: 0, max: 100 }
	},
	{ timestamps: true }
);

productSchema.pre('validate', function setProductTitle(next) {
	if (!this.title) this.title = this.name;
	next();
});

module.exports = mongoose.model('Product', productSchema);
