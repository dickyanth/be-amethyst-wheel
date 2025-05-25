const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const { body, validationResult } = require("express-validator");
const { successResponse, errorResponse } = require("../utils/response");
const mysql = require("mysql2/promise");

const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG and GIF are allowed."));
    }
  },
});

const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "amethyst-wheel",
});

const registerValidation = [
  body("email").isEmail().withMessage("Please enter a valid email"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),
  body("firstName").notEmpty().withMessage("First name is required"),
  body("lastName").notEmpty().withMessage("Last name is required"),
];

const loginValidation = [
  body("email").isEmail().withMessage("Please enter a valid email"),
  body("password").notEmpty().withMessage("Password is required"),
];

router.post(
  "/register",
  upload.single("profilePicture"),
  registerValidation,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, errors.array()[0].msg, 400);
      }

      const { email, password, firstName, lastName } = req.body;
      const connection = await pool.getConnection();

      try {
        const [existingUsers] = await connection.query(
          "SELECT id FROM user WHERE email = ?",
          [email]
        );

        if (existingUsers.length > 0) {
          connection.release();
          return errorResponse(res, "Email already exists", 400);
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Include profile picture in the INSERT query if it exists
        const profilePicture = req.file ? req.file.buffer : null;
        const [result] = await connection.query(
          "INSERT INTO user (email, password, firstName, lastName, profilePicture) VALUES (?, ?, ?, ?, ?)",
          [email, hashedPassword, firstName, lastName, profilePicture]
        );

        connection.release();

        const token = jwt.sign({ userId: result.insertId }, "your-jwt-secret", {
          expiresIn: "24h",
        });

        successResponse(
          res,
          {
            token,
            userId: result.insertId,
          },
          "Registration successful"
        );
      } catch (error) {
        connection.release();
        throw error;
      }
    } catch (error) {
      console.error("Registration error:", error);
      errorResponse(res, "Registration failed");
    }
  }
);

// Login route
router.post("/login", loginValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, errors.array()[0].msg, 400);
    }

    const { email, password } = req.body;
    const connection = await pool.getConnection();

    try {
      // Find user by email
      const [users] = await connection.query(
        "SELECT id, email, password FROM user WHERE email = ?",
        [email]
      );

      connection.release();

      if (users.length === 0) {
        return errorResponse(res, "Invalid credentials", 401);
      }

      const user = users[0];

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      console.log("user pw==>", user);
      console.log("valid==>", isValidPassword);
      if (!isValidPassword) {
        return errorResponse(res, "Invalid credentials", 401);
      }

      const token = jwt.sign({ userId: user.id }, "your-jwt-secret", {
        expiresIn: "24h",
      });

      successResponse(res, { token }, "Login successful");
    } catch (error) {
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error("Login error:", error);
    errorResponse(res, "Login failed");
  }
});

router.put(
  "/upload-profile-picture/:userId",
  upload.single("profilePicture"),
  async (req, res) => {
    try {
      if (!req.file) {
        return errorResponse(res, "No file uploaded", 400);
      }

      const { userId } = req.params;
      const connection = await pool.getConnection();

      try {
        await connection.query(
          "UPDATE user SET profilePicture = ? WHERE id = ?",
          [req.file.buffer, userId]
        );

        connection.release();
        successResponse(res, {
          message: "Profile picture updated successfully",
        });
      } catch (error) {
        connection.release();
        throw error;
      }
    } catch (error) {
      console.error("Error uploading profile picture:", error);
      errorResponse(res, error.message || "Failed to upload profile picture");
    }
  }
);

router.get("/user-info", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return errorResponse(res, "No token provided", 401);
    }

    const decoded = jwt.verify(token, "your-jwt-secret");
    const connection = await pool.getConnection();

    try {
      const [users] = await connection.query(
        "SELECT id, email, firstName, lastName, profilePicture FROM user WHERE id = ?",
        [decoded.userId]
      );

      connection.release();

      if (users.length === 0) {
        return errorResponse(res, "User not found", 404);
      }

      const user = users[0];
      // Convert profile picture buffer to base64 if it exists
      if (user.profilePicture) {
        user.profilePicture = `data:image/jpeg;base64,${user.profilePicture.toString(
          "base64"
        )}`;
      }

      successResponse(res, { user });
    } catch (error) {
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error("Error fetching user info:", error);
    errorResponse(res, "Failed to fetch user info");
  }
});

module.exports = router;
