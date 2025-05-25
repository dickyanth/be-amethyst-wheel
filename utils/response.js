const successResponse = (res, data, message = "Success") => {
  res.json({
    success: true,
    message,
    data,
  });
};

const errorResponse = (res, message = "Error occurred", statusCode = 500) => {
  res.status(statusCode).json({
    success: false,
    message,
  });
};

module.exports = {
  successResponse,
  errorResponse,
};
