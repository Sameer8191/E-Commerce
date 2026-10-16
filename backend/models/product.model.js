
import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      maxlength: 150,
    },

    description: {
      type: String,
      required: [true, "Product description is required"],
      trim: true,
    },

    price: {
      type: Number,
      required: [true, "Product price is required"],
      min: 0,
      validate: {
        validator: (value) => Number.isFinite(value) && Math.abs(value * 100 - Math.round(value * 100)) < 1e-8,
        message: "Price must have no more than two decimal places",
      },
    },

    compareAtPrice: {
      type: Number,
      min: 0,
      default: null,
      validate: [
        {
          validator: (value) => value == null || (Number.isFinite(value) && Math.abs(value * 100 - Math.round(value * 100)) < 1e-8),
          message: "Compare-at price must have no more than two decimal places",
        },
        {
          validator: function (value) { return value == null || value >= this.price; },
          message: "Compare-at price must be greater than or equal to price",
        },
      ],
    },

    images: {
      type: [String],
      default: [],
    },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },

    brand: {
      type: String,
      trim: true,
      default: "",
    },

    stock: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Stock must be an integer",
      },
    },

    sku: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },

    ratingsAverage: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    ratingsCount: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: "Ratings count must be an integer",
      },
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const Product = mongoose.model("Product", productSchema);

export default Product;
