const fs = require("fs");
const xlsx = require("xlsx");
const path = require("path");

const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const multer = require("multer");

const nodemailer = require("nodemailer");

// Load configuration
const configPath = path.join(__dirname, "config.json");
const config = require(configPath);

const configOrderPath = path.join(__dirname, "orders.json");
const configOrder = require(configOrderPath);

const app = express();
const PORT_NUMBER = process.env.PORT || 8000; // or any other port number

// Middleware to parse POST data
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

app.set("views", path.join(__dirname, "views"));

// Set up sessions
app.use(
  session({
    secret: "enniolssecca", // Replace with a secure key
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Set `secure: true` when using HTTPS
  })
);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let categoryName = req.params.categoryName;
    const dataFolderPath = path.join(__dirname, "Public");

    if (categoryName === "boom-lifts") {
      categoryName = "articulating-boom-lifts";
    }

    if (file.mimetype.startsWith("image")) {
      // Set up separate directories for images and PDFs
      const imageDir = path.join(
        dataFolderPath,
        `./images/categories/${categoryName}_images/`
      );
      fs.mkdirSync(imageDir, { recursive: true });
      cb(null, imageDir);
    } else if (file.mimetype === "application/pdf") {
      const pdfDir = path.join(
        dataFolderPath,
        `./images/categories/${categoryName}_pdf/`
      );
      fs.mkdirSync(pdfDir, { recursive: true });
      cb(null, pdfDir);
    }
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Ensure unique filenames
  },
});

const upload = multer({ storage: storage });

app.set("view engine", "ejs");

app.use(express.static("public"));

app.use(cookieParser());

app.use(bodyParser.urlencoded({ extended: true }));

// Landing Page Route: Only show visible categories
app.get("/", (req, res) => {
  const model = {
    categories: config.categories.map((category) => ({
      name: category.name,
      subcategories: category.subcategories.filter((sub) => sub.visible), // Only include visible subcategories
    })),
    path: "/images/homePage/",
    slide1: "/images/homePage/JLG2.jpg",
    slide2: "/images/homePage/JLG2.jpg",
    slide3: "/images/homePage/JLG2.jpg",
  };
  res.render("homePage", model);
});

app.get("/about", (req, res) => {
  const model = {
    slide1: "images/homePage/JLG2.jpg",
    slide2: "images/homePage/JLG2.jpg",
    slide3: "images/homePage/JLG2.jpg",
  };
  res.render("company-info", model);
});

app.get("/category/:categoryName", (req, res) => {
  const categoryName = req.params.categoryName;
  const dataFolderPath = path.join(__dirname, "Data");

  // Construct the expected filename
  const expectedFileName = `${categoryName}_data.xlsx`;
  const filePath = path.join(dataFolderPath, expectedFileName);

  // Check if the specific Excel file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).render("ErrorcategoryNotFound", {
      message: "Category not found",
      slide1: "/images/homePage/JLG2.jpg",
      slide2: "/images/homePage/JLG2.jpg",
      slide3: "/images/homePage/JLG2.jpg",
      categoryName,
    });
  }

  // Read the specific Excel file
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

  // Filter out items where the status is "Off"
  const items = worksheet
    .filter((row) => row["Status"] === "On") // Only include rows where status is "On"
    .map((row) => {
      const item = {
        name: row["Item Name"],
        imageUrl: "/images/categories/" + row["Image Filename"],
        specSheetUrl: "/images/categories/" + row["PDF Filename"],
      };

      // Adding optional columns if they exist
      const additionalColumns = Object.keys(row).filter(
        (col) =>
          !["Item Name", "Image Filename", "PDF Filename", "Status"].includes(
            col
          )
      );
      additionalColumns.forEach((col) => {
        let value = row[col];
        if (value.includes(":")) {
          [col, value] = value.split(":");
        }
        item[col] = value; // Keep the column names as is for EJS to handle
      });

      return item;
    });

  const model = {
    items: items,
    categoryName: categoryName,
    slide1: "/images/homePage/JLG2.jpg",
    slide2: "/images/homePage/JLG2.jpg",
    slide3: "/images/homePage/JLG2.jpg",
  };

  res.render("category", model);
});

app.get("/rent", (req, res) => {
  const model = {
    path: "images/homePage/",
    slide1: "images/homePage/JLG2.jpg",
    slide2: "images/homePage/JLG2.jpg",
    slide3: "images/homePage/JLG2.jpg",
  };
  res.render("rent", model);
});

app.get("/contact", (req, res) => {
  const model = {
    path: "images/homePage/",
    slide1: "images/homePage/JLG2.jpg",
    slide2: "images/homePage/JLG2.jpg",
    slide3: "images/homePage/JLG2.jpg",
  };
  res.render("contact", model);
});

// Start server to listen for request at some port.
app.listen(PORT_NUMBER, () => {
  console.log(`Server is listening at ${PORT_NUMBER}`);
});
