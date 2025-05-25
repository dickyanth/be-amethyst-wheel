const express = require("express");
const router = express.Router();
const mysql = require("mysql2/promise");
const { successResponse, errorResponse } = require("../utils/response");

// Database connection configuration
const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "amethyst-wheel",
});

router.get("/", async (req, res) => {
  try {
    const { bicycleType } = req.query;
    const connection = await pool.getConnection();

    try {
      let query = `
        SELECT b.*, bt.name as typeName 
        FROM bicycle b 
        LEFT JOIN bicycletype bt ON b.bicycleType = bt.id
      `;
      const queryParams = [];

      if (bicycleType) {
        query += " WHERE b.bicycleType = ?";
        queryParams.push(bicycleType);
      }

      const [bicycles] = await connection.query(query, queryParams);
      connection.release();

      const formattedBicycles = bicycles.map((bike) => ({
        id: bike.id,
        name: bike.name,
        description: bike.description,
        type: {
          id: bike.bicycleType,
          name: bike.typeName,
        },
        isDiscount: Boolean(bike.isDiscount),
        normalPrice: bike.normalPrice,
        discountPrice: bike.discountPrice,
        picture: bike.picture ? bike.picture.toString("base64") : null,
      }));

      successResponse(
        res,
        formattedBicycles,
        "Bicycles retrieved successfully"
      );
    } catch (error) {
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error("Error fetching bicycles:", error);
    errorResponse(res, "Failed to fetch bicycles");
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await pool.getConnection();

    try {
      const [bicycles] = await connection.query(
        `SELECT b.*, bt.name as typeName 
         FROM bicycle b 
         LEFT JOIN bicycletype bt ON b.bicycleType = bt.id 
         WHERE b.id = ?`,
        [id]
      );
      connection.release();

      if (bicycles.length === 0) {
        return errorResponse(res, "Bicycle not found", 404);
      }

      const bike = bicycles[0];
      const formattedBike = {
        id: bike.id,
        name: bike.name,
        description: bike.description,
        type: {
          id: bike.bicycleType,
          name: bike.typeName,
        },
        isDiscount: Boolean(bike.isDiscount),
        normalPrice: bike.normalPrice,
        discountPrice: bike.discountPrice,
        picture: bike.picture ? bike.picture.toString("base64") : null,
      };

      successResponse(
        res,
        formattedBike,
        "Bicycle details retrieved successfully"
      );
    } catch (error) {
      connection.release();
      throw error;
    }
  } catch (error) {
    console.error("Error fetching bicycle details:", error);
    errorResponse(res, "Failed to fetch bicycle details");
  }
});

module.exports = router;
