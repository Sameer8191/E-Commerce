
import mongoose from "mongoose";

const wishlistSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    products: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
  },
  {
    timestamps: true,
  }
);

wishlistSchema.path("products").validate(
  (products) => {
    const ids = products.map((product) => product.toString());
    return ids.length === new Set(ids).size;
  },
  "A product can appear only once in the wishlist"
);

const Wishlist = mongoose.model("Wishlist", wishlistSchema);

export default Wishlist;
