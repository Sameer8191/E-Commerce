
import mongoose from "mongoose";

const isValidObjectId = (id) => {
  return (
    typeof id === "string" &&
    mongoose.isObjectIdOrHexString(id)
  );
};

export default isValidObjectId;
