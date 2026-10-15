
const handleError = (res, error, message) => {
  console.error(message, error);

  if (error.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "Category name or slug already exists",
    });
  }

  if (
    error.name === "ValidationError" ||
    error.name === "CastError"
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid data",
    });
  }

  return res.status(500).json({
    success: false,
    message,
  });
};

export default handleError;
