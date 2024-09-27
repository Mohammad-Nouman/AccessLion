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

// Middleware to check if user is logged in
function isAuthenticated(req, res, next) {
  if (req.session.isAdmin) {
    return next();
  } else {
    res.redirect("/admin/login");
  }
}

// Admin Route to Toggle Visibility
app.post("/admin/toggle-category", (req, res) => {
  const { categoryName, subcategoryName } = req.body;
  let checkvisible;

  // Find and toggle visibility of the specific subcategory
  config.categories = config.categories.map((category) => {
    if (category.name === categoryName) {
      return {
        ...category,
        subcategories: category.subcategories.map((sub) => {
          if (sub.name === subcategoryName) {
            checkvisible = !sub.visible;
            return { ...sub, visible: !sub.visible };
          }
          return sub;
        }),
      };
    }
    return category;
  });

  // Update the config file
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  // Send JSON response indicating success and new visibility status
  res.json({ success: true, visible: checkvisible });
});

// Route for Admin Login Page
app.get("/admin/login", (req, res) => {
  res.render("admin-login", { error: "" });
});

// Admin Login POST Route
app.post("/admin/login", (req, res) => {
  const { username, password } = req.body;

  // Dummy login logic (replace with actual auth logic)
  if (username === config.username && password === config.password) {
    req.session.isAdmin = true; // Set the admin session
    req.session.username = "admin";
    res.redirect("/admin/dashboard");
  } else {
    res.render("admin-login", { error: "Invalid login credentials" });
  }
});

// Admin Dashboard Route
app.get("/admin/dashboard", isAuthenticated, (req, res) => {
  res.render("admin-dashboard", { orders: configOrder.orders });
});

// Admin Dashboard Route (Protected)
app.get("/admin/dashboard/categories", isAuthenticated, (req, res) => {
  res.render("partials/adminCategory", { categories: config.categories });
});

// Admin Logout Route
app.get("/admin/logout", isAuthenticated, (req, res) => {
  req.session.destroy(); // Destroy the session to log out
  res.redirect("/admin/login");
});

app.get("/admin/category/:categoryName", isAuthenticated, (req, res) => {
  const categoryName = req.params.categoryName;
  const dataFolderPath = path.join(__dirname, "Data");

  // Construct the expected filename
  const expectedFileName = `${categoryName}_data.xlsx`;
  const filePath = path.join(dataFolderPath, expectedFileName);

  // Check if the specific Excel file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).render("ErrorcategoryNotFound", {
      message: "Category not found",
      categoryName,
    });
  }

  // Read the Excel file
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

  // Extract unique companies and their statuses
  const companyStatusMap = {};
  worksheet.forEach((row) => {
    if (!companyStatusMap[row["company"]]) {
      companyStatusMap[row["company"]] = row["Status"] || "On";
    }
  });

  // Pass the data to the view
  res.render("admin-companies", {
    categoryName,
    companies: Object.entries(companyStatusMap), // Sends an array of [company, status]
  });
});

// Handler for toggling the company status
app.post("/admin/category/:categoryName", isAuthenticated, (req, res) => {
  const categoryName = req.params.categoryName;
  const { companyName, action } = req.body;
  const dataFolderPath = path.join(__dirname, "Data");
  const expectedFileName = `${categoryName}_data.xlsx`;
  const filePath = path.join(dataFolderPath, expectedFileName);

  // Check if the file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: "File not found" });
  }

  // Load the workbook and worksheet
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

  // Update the status of rows matching the selected company
  let newStatus = null;
  worksheet.forEach((row) => {
    if (row["company"] === companyName) {
      newStatus = action === "Hide" ? "Off" : "On";
      row["Status"] = newStatus;
    }
  });

  // Check if the company was found and updated
  if (!newStatus) {
    return res.status(404).json({ success: false, error: "Company not found" });
  }

  // Convert the updated worksheet back to sheet format
  const updatedSheet = xlsx.utils.json_to_sheet(worksheet);
  workbook.Sheets[sheetName] = updatedSheet;

  // Write the updated workbook back to the Excel file
  xlsx.writeFile(workbook, filePath);

  // Send JSON response indicating success and the new status
  res.json({ success: true, newStatus });
});

// Handler to load and display all items for a specific category
app.get("/admin/category/search/:categoryName", (req, res) => {
  const categoryName = req.params.categoryName;
  const dataFolderPath = path.join(__dirname, "Data");
  const expectedFileName = `${categoryName}_data.xlsx`;
  const filePath = path.join(dataFolderPath, expectedFileName);

  // Check if the file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: "File not found" });
  }

  // Load the workbook and worksheet
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

  // Format data for response
  const companies = worksheet.map((row) => ({
    itemName: row["Item Name"],
    company: row["company"],
    status: row["Status"],
  }));

  // Render the partial view with companies data
  res.render("partials/searchItem", {
    categoryName: categoryName,
    companies: companies,
  });
});

app.post("/admin/category/search/:categoryName", (req, res) => {
  const categoryName = req.params.categoryName;
  const { itemName, action } = req.body;

  // Validate inputs
  if (!itemName || !action) {
    return res
      .status(400)
      .json({ success: false, error: "Item name and action are required" });
  }

  const dataFolderPath = path.join(__dirname, "Data");
  const expectedFileName = `${categoryName}_data.xlsx`;
  const filePath = path.join(dataFolderPath, expectedFileName);

  // Check if the file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: "File not found" });
  }

  // Load the workbook and worksheet
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

  // Update the status of rows matching the selected item name
  let updated = false;
  worksheet.forEach((row) => {
    if (row["Item Name"] === itemName) {
      row["Status"] = action === "Hide" ? "Off" : "On";
      updated = true;
    }
  });

  // Check if the item was found and updated
  if (!updated) {
    return res.status(404).json({ success: false, error: "Item not found" });
  }

  // Convert the updated worksheet back to sheet format
  const updatedSheet = xlsx.utils.json_to_sheet(worksheet);
  workbook.Sheets[sheetName] = updatedSheet;

  // Write the updated workbook back to the Excel file
  xlsx.writeFile(workbook, filePath);

  // Send JSON response indicating success and the new status
  res.json({ success: true, newStatus: action === "Hide" ? "Off" : "On" });
});

app.get("/admin/category/item/:categoryName", (req, res) => {
  const categoryName = req.params.categoryName;
  const dataFolderPath = path.join(__dirname, "Data");
  const expectedFileName = `${categoryName}_data.xlsx`;
  const filePath = path.join(dataFolderPath, expectedFileName);

  // Check if the file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: "File not found" });
  }

  // Load the workbook and get the column names
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
  });

  // Get the first row, which contains the column names
  let columnNames = worksheet[0];

  // Filter out specific columns you don't want to show in the form
  columnNames = columnNames.filter(
    (col) =>
      col !== "Item Name" &&
      col !== "Image Filename" &&
      col !== "PDF Filename" &&
      col !== "Status"
  );

  // Render the partial view with the filtered column names
  res.render("partials/addItem", {
    categoryName: categoryName,
    columnNames: columnNames,
  });
});

app.post(
  "/admin/category/item/:categoryName",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "pdf", maxCount: 1 },
  ]),
  (req, res) => {
    const categoryName = req.params.categoryName;
    const dataFolderPath = path.join(__dirname, "Data");
    const expectedFileName = `${categoryName}_data.xlsx`;
    const filePath = path.join(dataFolderPath, expectedFileName);

    // Check if the file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: "File not found" });
    }

    console.log(req.body);
    // Load the workbook and worksheet
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    // Extract form data
    const { itemName, status, ...dynamicFields } = req.body;
    const newRow = {
      "Item Name": itemName,
      Status: status, // Save the status in the sheet
      ...dynamicFields,
    };

    // Handle image upload
    if (req.files && req.files.image) {
      const image = req.files.image[0]; // multer stores in an array, even with one file
      newRow["Image Filename"] = `${categoryName}_images/` + image.filename; // Save the uploaded image filename
    }

    // Handle PDF upload
    if (req.files && req.files.pdf) {
      const pdf = req.files.pdf[0];
      newRow["PDF Filename"] = `${categoryName}_images/` + pdf.filename; // Save the uploaded PDF filename
    }

    // Append the new row to the worksheet data
    worksheet.push(newRow);

    // Convert worksheet back to Excel format and write the updated data
    const newSheet = xlsx.utils.json_to_sheet(worksheet);
    workbook.Sheets[sheetName] = newSheet;
    xlsx.writeFile(workbook, filePath);

    // Respond with success
    res.json({ success: true });
  }
);

app.get("/admin/orders", isAuthenticated, function (req, res) {
  res.render("partials/orders", { orders: configOrder.orders });
});

// Route to delete an order
app.delete("/admin/order/:id", function (req, res) {
  const orderId = parseInt(req.params.id, 10); // Ensure ID is an integer
  const index = configOrder.orders.findIndex((o) => o.id === orderId);

  if (index > -1) {
    configOrder.orders.splice(index, 1);
    fs.writeFileSync(configOrderPath, JSON.stringify(configOrder, null, 2));
    res.status(200).send("Order deleted");
  } else {
    res.status(404).send("Order not found");
  }
});

app.get("/admin/dashboard/password", isAuthenticated, function (req, res) {
  res.render("partials/changePassword");
});

// Password Change Handler
app.post("/admin/dashboard/password", isAuthenticated, (req, res) => {
  const { old_password, new_password } = req.body;
  // Check if the old password is correct and if username matches
  const username = req.session.username;
  if (config.username === username && config.password === old_password) {
    config.password = new_password;

    // Save the updated config to the file
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    res.json({ success: true });
  } else {
    res.json({
      success: false,
      error: "Old password is incorrect or user is not authorized.",
    });
  }
});

// Nodemailer setup (Replace with your SMTP credentials)
const transporter = nodemailer.createTransport({
  service: "gmail", // or your email service provider
  auth: {
    user: "noumanashiq58@gmail.com",
    pass: "xtkl dqoy rbms djin",
  },
});

// Handle form submission
app.post("/send-email", (req, res) => {
  const { name, phone, email, business, message } = req.body;

  // Create a new order object
  const newOrder = {
    id: configOrder.orders.length
      ? configOrder.orders[configOrder.orders.length - 1].id + 1
      : 1,
    Name: name,
    phone: phone,
    Email: email,
    Business: business,
    Message: message,
  };

  // Add the new order to the orders array
  configOrder.orders.push(newOrder);

  // Write the updated orders array back to the JSON file
  fs.writeFile(configOrderPath, JSON.stringify(configOrder, null, 2), (err) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Failed to save order.");
    }
    res.status(200).send("Order successfully saved!");
  });
});

// Start server to listen for request at some port.
app.listen(PORT_NUMBER, () => {
  console.log(`Server is listening at ${PORT_NUMBER}`);
});
