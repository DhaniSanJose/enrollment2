const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise"); // Changed to promise-based API
const jwt = require("jsonwebtoken");
require("dotenv").config();

// for email
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");


const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

app.use(bodyParser.json());

// Create a pool instead of a single connection
const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "", // Update if needed
  database: "cmu_mis",
  waitForConnections: true,
  connectionLimit: 10, // Default is 10
  queueLimit: 0, // Unlimited queue
});


// ✅ Nodemailer configuration
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "disanjose@earist.edu.ph", // EARIST Google Workspace
    pass: "kxzy mtyx ctib egzn", // App password
  },
});

// Corrected route with parameter
app.get("/courses/:currId", async (req, res) => {
  const { currId } = req.params;

  const sql = `
    SELECT 
      ctt.course_tagging_table_id,
      ctt.curriculum_id,
      ctt.subject_id,
      ctt.year_level_id,
      ctt.semester_id,
      s.subject_code,
      s.subject_description
    FROM course_tagging_table AS ctt
    INNER JOIN subject_table AS s ON s.subject_id = ctt.subject_id

    WHERE ctt.curriculum_id = ?
    ORDER BY s.subject_id ASC
  `;

  try {
    const [result] = await pool.query(sql, [currId]);
    res.json(result);
  } catch (err) {
    console.error("Error in /courses:", err);
    console.log(currId, "hello world");
    return res.status(500).json({ error: err.message });
  }
});

app.get("/enrolled_courses/:userId/:currId", async (req, res) => {
  const { userId, currId } = req.params;

  try {
    // Step 1: Get the active_school_year_id
    const activeYearSql = `SELECT active_school_year_id FROM active_school_year WHERE astatus = 1 LIMIT 1`;
    const [yearResult] = await pool.query(activeYearSql);

    if (yearResult.length === 0) {
      return res.status(404).json({ error: "No active school year found" });
    }

    const activeSchoolYearId = yearResult[0].active_school_year_id;

    const sql = `
    SELECT 
      es.id,
      es.subject_id,
      s.subject_code,
      s.subject_description,
      st.section_description,
      ds.department_section_id,
      ct.course_code,
      IFNULL(rd.day_description, 'TBA') AS day_description,
      IFNULL(tt.school_time_start, 'TBA') AS school_time_start,
      IFNULL(tt.school_time_end, 'TBA') AS school_time_end,
      IFNULL(rtbl.room_description, 'TBA') AS room_description,
      IFNULL(prof_table.lname, 'TBA') AS lname,

      (
        SELECT COUNT(*) 
        FROM enrolled_subject es2 
        WHERE es2.active_school_year_id = es.active_school_year_id 
          AND es2.department_section_id = es.department_section_id
          AND es2.subject_id = s.subject_id
      ) AS number_of_enrolled

    FROM enrolled_subject AS es
    INNER JOIN subject_table AS s 
      ON s.subject_id = es.subject_id
    INNER JOIN department_section AS ds
      ON ds.department_section_id = es.department_section_id
    INNER JOIN section_table AS st
      ON st.section_id = ds.section_id
    INNER JOIN curriculum AS cr
      ON cr.curriculum_id = ds.curriculum_id
    INNER JOIN course_table AS ct
      ON ct.course_id = cr.course_id
    LEFT JOIN time_table AS tt
      ON tt.school_year_id = es.active_school_year_id 
      AND tt.department_section_id = es.department_section_id 
      AND tt.subject_id = es.subject_id 
    LEFT JOIN room_day AS rd
      ON rd.day_id = tt.room_day
    LEFT JOIN department_room as dr
      ON dr.department_room_id = tt.department_room_id
    LEFT JOIN room_table as rtbl
      ON rtbl.room_id = dr.room_id
    LEFT JOIN prof_table 
      ON prof_table.prof_id = tt.professor_id
    WHERE es.student_number = ? 
      AND es.active_school_year_id = ?
      AND es.curriculum_id = ?
    ORDER BY s.subject_id ASC;
    `;

    const [result] = await pool.query(sql, [userId, activeSchoolYearId, currId]);
    res.json(result);
  } catch (err) {
    console.error("Error in /enrolled_courses:", err);
    return res.status(500).json({ error: err.message });
  }
});

app.post("/add-all-to-enrolled-courses", async (req, res) => {
  const { subject_id, user_id, curriculumID, departmentSectionID } = req.body;
  console.log("Received request:", { subject_id, user_id, curriculumID, departmentSectionID });

  try {
    const activeYearSql = `SELECT active_school_year_id, semester_id FROM active_school_year WHERE astatus = 1 LIMIT 1`;
    const [yearResult] = await pool.query(activeYearSql);

    if (yearResult.length === 0) {
      return res.status(404).json({ error: "No active school year found" });
    }

    const activeSchoolYearId = yearResult[0].active_school_year_id;
    const activeSemesterId = yearResult[0].semester_id;
    console.log("Active semester ID:", activeSemesterId);

    const checkSql = `
      SELECT year_level_id, semester_id, curriculum_id 
      FROM course_tagging_table 
      WHERE subject_id = ? AND curriculum_id = ? 
      LIMIT 1
    `;

    const [checkResult] = await pool.query(checkSql, [subject_id, curriculumID]);

    if (!checkResult.length) {
      console.warn(`Subject ${subject_id} not found in tagging table`);
      return res.status(404).json({ message: "Subject not found" });
    }

    const { year_level_id, semester_id, curriculum_id } = checkResult[0];
    console.log("Year level found:", year_level_id);
    console.log("Subject semester:", semester_id);
    console.log("Active semester:", activeSemesterId);
    console.log("Curriculum found:", curriculum_id);

    if (year_level_id !== 1 || semester_id !== activeSemesterId || curriculum_id !== curriculumID) {
      console.log(`Skipping subject ${subject_id} (not Year 1, not active semester ${activeSemesterId}, or wrong curriculum)`);
      return res.status(200).json({ message: "Skipped - Not Year 1 / Not Active Semester / Wrong Curriculum" });
    }

    const checkDuplicateSql = `
      SELECT * FROM enrolled_subject 
      WHERE subject_id = ? AND student_number = ? AND active_school_year_id = ?
    `;

    const [dupResult] = await pool.query(checkDuplicateSql, [subject_id, user_id, activeSchoolYearId]);

    if (dupResult.length > 0) {
      console.log(`Skipping subject ${subject_id}, already enrolled for student ${user_id}`);
      return res.status(200).json({ message: "Skipped - Already Enrolled" });
    }

    const insertSql = `
      INSERT INTO enrolled_subject (subject_id, student_number, active_school_year_id, curriculum_id, department_section_id) 
      VALUES (?, ?, ?, ?, ?)
    `;

    await pool.query(insertSql, [subject_id, user_id, activeSchoolYearId, curriculumID, departmentSectionID]);
    console.log(`Student ${user_id} successfully enrolled in subject ${subject_id}`);
    res.status(200).json({ message: "Course enrolled successfully" });
  } catch (err) {
    console.error("Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

app.post("/add-to-enrolled-courses/:userId/:currId/", async (req, res) => {
  const { subject_id, department_section_id } = req.body;
  const { userId, currId } = req.params;

  try {
    const activeYearSql = `SELECT active_school_year_id FROM active_school_year WHERE astatus = 1 LIMIT 1`;
    const [yearResult] = await pool.query(activeYearSql);

    if (yearResult.length === 0) {
      return res.status(404).json({ error: "No active school year found" });
    }

    const activeSchoolYearId = yearResult[0].active_school_year_id;

    const sql = "INSERT INTO enrolled_subject (subject_id, student_number, active_school_year_id, curriculum_id, department_section_id) VALUES (?, ?, ?, ?, ?)";
    await pool.query(sql, [subject_id, userId, activeSchoolYearId, currId, department_section_id]);
    res.json({ message: "Course enrolled successfully" });
  } catch (err) {
    return res.status(500).json(err);
  }
});

// Delete course by subject_id
app.delete("/courses/delete/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const sql = "DELETE FROM enrolled_subject WHERE id = ?";
    await pool.query(sql, [id]);
    res.json({ message: "Course unenrolled successfully" });
  } catch (err) {
    return res.status(500).json(err);
  }
});

// Delete all courses for user
app.delete("/courses/user/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const activeYearSql = `SELECT active_school_year_id FROM active_school_year WHERE astatus = 1 LIMIT 1`;
    const [yearResult] = await pool.query(activeYearSql);

    if (yearResult.length === 0) {
      return res.status(404).json({ error: "No active school year found" });
    }

    const activeSchoolYearId = yearResult[0].active_school_year_id;

    const sql = "DELETE FROM enrolled_subject WHERE student_number = ? AND active_school_year_id = ?";
    await pool.query(sql, [userId, activeSchoolYearId]);
    res.json({ message: "All courses unenrolled successfully" });
  } catch (err) {
    return res.status(500).json(err);
  }
});

// Login User
app.post("/student-tagging", async (req, res) => {
  const { studentNumber } = req.body;

  if (!studentNumber) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const sql = `SELECT * FROM student_status as ss
    INNER JOIN curriculum as c
    ON c.curriculum_id = ss.active_curriculum
    INNER JOIN course_table as ct
    ON c.course_id = ct.course_id

    INNER JOIN student_numbering as sn
    ON sn.student_number = ss.student_number

    INNER JOIN person_table as ptbl
    ON ptbl.person_id = sn.person_id

    WHERE ss.student_number = ?`;

    const [results] = await pool.query(sql, [studentNumber]);
    console.log("Query Results:", results);

    if (results.length === 0) {
      return res.status(400).json({ message: "Invalid Student Number" });
    }

    const student = results[0];
    const token = jwt.sign(
      {
        id: student.student_status_id,
        studentNumber: student.student_number,
        activeCurriculum: student.active_curriculum,
        yearLevel: student.year_level_id,
        courseCode: student.course_code,
        courseDescription: student.course_description,
        firstName: student.first_name,
        middleName: student.middle_name,
        lastName: student.last_name,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    console.log("Search response:", {
      token,
      studentNumber: student.student_number,
      activeCurriculum: student.active_curriculum,
      yearLevel: student.year_level_id,
      courseCode: student.course_code,
      courseDescription: student.course_description,
      firstName: student.first_name,
      middleName: student.middle_name,
      lastName: student.last_name,
    });

    res.json({
      message: "Search successful",
      token,
      studentNumber: student.student_number,
      activeCurriculum: student.active_curriculum,
      yearLevel: student.year_level_id,
      courseCode: student.course_code,
      courseDescription: student.course_description,
      firstName: student.first_name,
      middleName: student.middle_name,
      lastName: student.last_name,
    });
  } catch (err) {
    console.error("SQL error:", err);
    return res.status(500).json({ message: "Database error" });
  }
});

let lastSeenId = 0;

app.get("/check-new", async (req, res) => {
  try {
    const [results] = await pool.query("SELECT * FROM enrolled_subject ORDER BY id DESC LIMIT 1");

    if (results.length > 0) {
      const latest = results[0];
      const isNew = latest.id > lastSeenId;
      if (isNew) {
        lastSeenId = latest.id;
      }
      res.json({ newData: isNew, data: latest });
    } else {
      res.json({ newData: false });
    }
  } catch (err) {
    return res.status(500).json({ error: err });
  }
});

app.get("/api/department-sections", async (req, res) => {
  const { departmentId } = req.query;

  const query = `
    SELECT * 
    FROM department_table as dt
    INNER JOIN department_curriculum as dc ON dc.department_id = dt.department_id 
    INNER JOIN curriculum as c ON c.curriculum_id = dc.curriculum_id
    INNER JOIN department_section as ds ON ds.curriculum_id = c.curriculum_id
    INNER JOIN course_table as ct ON c.course_id = ct.course_id
    INNER JOIN section_table as st ON st.section_id = ds.section_id
    WHERE dt.department_id = ?
    ORDER BY ds.department_section_id
  `;

  try {
    const [results] = await pool.query(query, [departmentId]);
    res.status(200).json(results);
  } catch (err) {
    console.error("Error fetching department sections:", err);
    return res.status(500).json({ error: "Database error", details: err.message });
  }
});

// Express route
app.get("/departments", async (req, res) => {
  const sql = "SELECT department_id, department_code FROM department_table";

  try {
    const [result] = await pool.query(sql);
    res.json(result);
  } catch (err) {
    console.error("Error fetching departments:", err);
    return res.status(500).json({ error: err.message });
  }
});

// 📌 Count how many students enrolled per subject for a selected section
app.get("/subject-enrollment-count", async (req, res) => {
  const { sectionId } = req.query; // department_section_id

  try {
    const activeYearSql = `SELECT active_school_year_id FROM active_school_year WHERE astatus = 1 LIMIT 1`;
    const [yearResult] = await pool.query(activeYearSql);

    if (yearResult.length === 0) {
      return res.status(404).json({ error: "No active school year found" });
    }

    const activeSchoolYearId = yearResult[0].active_school_year_id;

    const sql = `
      SELECT 
        es.subject_id,
        COUNT(*) AS enrolled_count
      FROM enrolled_subject AS es
      WHERE es.active_school_year_id = ?
        AND es.department_section_id = ?
      GROUP BY es.subject_id
    `;

    const [result] = await pool.query(sql, [activeSchoolYearId, sectionId]);
    res.json(result); // [{ subject_id: 1, enrolled_count: 25 }, { subject_id: 2, enrolled_count: 30 }]
  } catch (err) {
    console.error("Error fetching enrolled counts:", err);
    return res.status(500).json({ error: err.message });
  }
});

//-----------------------------------------------------------------------------------------------------------------------------------

// Create uploads folder if it doesn't exist
const uploadPath = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const randomName = Date.now() + "-" + Math.round(Math.random() * 1e9) + ext;
    cb(null, randomName);
  },
});

const upload = multer({ storage });

// Routes

// Register new user
app.post("/api/register", async (req, res) => {
  const { first_name, middle_name, last_name } = req.body;

  if (!first_name || !last_name) {
    return res.status(400).send("First name and last name are required");
  }

  try {
    const sql = "INSERT INTO person_table (first_name, middle_name, last_name) VALUES (?, ?, ?)";
    const [result] = await pool.query(sql, [first_name, middle_name, last_name]);
    const person_id = result.insertId;
    res.json({ person_id });
  } catch (err) {
    console.error("Database error:", err);
    return res.status(500).send("Error registering user");
  }
});

// Upload profile picture
app.post("/api/upload-profile-picture", upload.single("profile_picture"), async (req, res) => {
  if (!req.file) {
    return res.status(400).send("No file uploaded");
  }

  const { person_id } = req.body;
  if (!person_id) {
    return res.status(400).send("Missing person_id");
  }

  const oldPath = req.file.path;
  const ext = path.extname(req.file.originalname).toLowerCase();
  const newFilename = `${person_id}_profile_picture${ext}`;
  const newPath = path.join(uploadPath, newFilename);

  try {
    // Rename the uploaded file
    await fs.promises.rename(oldPath, newPath);

    const sql = "UPDATE person_table SET profile_picture = ? WHERE person_id = ?";
    await pool.query(sql, [newFilename, person_id]);
    res.send("Profile picture uploaded successfully");
  } catch (err) {
    console.error("Error processing file:", err);
    return res.status(500).send("Error processing profile picture");
  }
});

// Serve uploaded images statically
app.use("/uploads", express.static(uploadPath));

//------------------------------------------------------------------------------------------------------------------------------------------------------------

// Get user by person_id
app.get("/api/user/:person_id", async (req, res) => {
  const { person_id } = req.params;

  try {
    const sql = "SELECT profile_picture FROM person_table WHERE person_id = ?";
    const [results] = await pool.query(sql, [person_id]);

    if (results.length === 0) {
      return res.status(404).send("User not found");
    }

    res.json(results[0]);
  } catch (err) {
    console.error("Database error:", err);
    return res.status(500).send("Database error");
  }
});

// ------------------------------------------------------------------------------------------------------------ STUDENT NUMBER

// Fetch persons who are not yet assigned a student number
app.get("/api/persons", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.* 
      FROM person_table p
      JOIN person_status_table ps ON p.person_id = ps.person_id
      WHERE ps.student_registration_status = 0
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// // Assign a student number
// app.post("/api/assign-student-number", async (req, res) => {
//   const connection = await pool.getConnection();

//   try {
//     const { person_id, curriculum_id } = req.body;

//     if (!person_id) {
//       return res.status(400).send("person_id is required");
//     }

//     await connection.beginTransaction();

//     // Get active year
//     const [yearRows] = await connection.query("SELECT * FROM year_table WHERE status = 1 LIMIT 1");
//     if (yearRows.length === 0) {
//       await connection.rollback();
//       return res.status(400).send("No active year found");
//     }
//     const year = yearRows[0];

//     // Get counter
//     const [counterRows] = await connection.query("SELECT * FROM student_counter WHERE que_number_id = 1");
//     if (counterRows.length === 0) {
//       await connection.rollback();
//       return res.status(400).send("No counter found");
//     }
//     let que_number = counterRows[0].que_number;

//     // Fix: if que_number is 0, still generate '00001'
//     que_number = que_number + 1;

//     let numberStr = que_number.toString();
//     while (numberStr.length < 5) {
//       numberStr = "0" + numberStr;
//     }
//     const student_number = `${year.year_description}${numberStr}`;

//     // Check if already assigned
//     const [existingRows] = await connection.query("SELECT * FROM student_numbering WHERE person_id = ?", [person_id]);
//     if (existingRows.length > 0) {
//       await connection.rollback();
//       return res.status(400).send("Student number already assigned.");
//     }

//       // Step 1: Get the active_school_year_id
//       const activeYearSql = `SELECT active_school_year_id FROM active_school_year WHERE astatus = 1 LIMIT 1`;
//       const [yearResult] = await pool.query(activeYearSql);

//       if (yearResult.length === 0) {
//         return res.status(404).json({ error: "No active school year found" });
//       }

//       const activeSchoolYearId = yearResult[0].active_school_year_id;

//     // Insert into student_numbering
//     await connection.query("INSERT INTO student_numbering (student_number, person_id) VALUES (?, ?)", [student_number, person_id]);

//     // Insert into student_status
//     await connection.query("INSERT INTO student_status (student_number, active_curriculum, active_school_year_id) VALUES (?, ?, ?)", [student_number, curriculum_id, activeSchoolYearId]);

//     // Update counter
//     await connection.query("UPDATE student_counter SET que_number = ?", [que_number]);

//     // Update person_status_table
//     await connection.query("UPDATE person_status_table SET student_registration_status = 1 WHERE person_id = ?", [person_id]);

//     await connection.commit();
//     res.json({ student_number });
//   } catch (err) {
//     await connection.rollback();
//     console.error("Server error:", err);
//     res.status(500).send("Server error");
//   } finally {
//     connection.release(); // Release the connection back to the pool
//   }
// });


// VERSION 2

// app.post("/api/assign-student-number", async (req, res) => {
//   const connection = await pool.getConnection();

//   try {
//     const { person_id, curriculum_id } = req.body;

//     if (!person_id) return res.status(400).json({ error: "person_id is required" });
//     if (!curriculum_id) return res.status(400).json({ error: "curriculum_id is required" });

//     await connection.beginTransaction();

//     // Get active year
//     const [yearRows] = await connection.query("SELECT * FROM year_table WHERE status = 1 LIMIT 1");
//     if (yearRows.length === 0) {
//       await connection.rollback();
//       return res.status(400).json({ error: "No active year found" });
//     }
//     const year = yearRows[0];

//     // Get counter
//     const [counterRows] = await connection.query("SELECT * FROM student_counter WHERE que_number_id = 1");
//     if (counterRows.length === 0) {
//       await connection.rollback();
//       return res.status(400).json({ error: "No counter found" });
//     }
//     let que_number = counterRows[0].que_number + 1;

//     // Generate padded student number
//     let numberStr = que_number.toString().padStart(5, "0");
//     const student_number = `${year.year_description}${numberStr}`;

//     // Check if already assigned
//     const [existingRows] = await connection.query("SELECT * FROM student_numbering WHERE person_id = ?", [person_id]);
//     if (existingRows.length > 0) {
//       await connection.rollback();
//       return res.status(400).json({ error: "Student number already assigned." });
//     }

//     // Get active school year
//     const [yearResult] = await connection.query("SELECT active_school_year_id FROM active_school_year WHERE astatus = 1 LIMIT 1");
//     if (yearResult.length === 0) {
//       await connection.rollback();
//       return res.status(400).json({ error: "No active school year found" });
//     }
//     const activeSchoolYearId = yearResult[0].active_school_year_id;

//     // Insert student number
//     await connection.query("INSERT INTO student_numbering (student_number, person_id) VALUES (?, ?)", [student_number, person_id]);

//     // Insert student status
//     await connection.query("INSERT INTO student_status (student_number, active_curriculum, active_school_year_id, enrolled_status, year_level_id) VALUES (?, ?, ?, 0, 1)", [student_number, curriculum_id, activeSchoolYearId]);

//     // Update counter
//     await connection.query("UPDATE student_counter SET que_number = ?", [que_number]);

//     // Update person status
//     await connection.query("UPDATE person_status_table SET student_registration_status = 1 WHERE person_id = ?", [person_id]);

//     await connection.commit();
//     res.json({ student_number });
//   } catch (err) {
//     await connection.rollback();
//     console.error("Server error:", err);
//     res.status(500).json({ error: "Server error" });
//   } finally {
//     connection.release();
//   }
// });

//VERSION 3


// ✅ Assign Student Number with Email Notification
app.post("/api/assign-student-number", async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { person_id, curriculum_id } = req.body;

    if (!person_id || !curriculum_id) {
      return res.status(400).json({ error: "person_id and curriculum_id are required" });
    }

    await connection.beginTransaction();

    // 🔸 Get active year
    const [yearRows] = await connection.query("SELECT * FROM year_table WHERE status = 1 LIMIT 1");
    if (yearRows.length === 0) {
      await connection.rollback();
      return res.status(400).json({ error: "No active year found" });
    }
    const year = yearRows[0];

    // 🔸 Get counter
    const [counterRows] = await connection.query("SELECT * FROM student_counter WHERE que_number_id = 1");
    if (counterRows.length === 0) {
      await connection.rollback();
      return res.status(400).json({ error: "No counter found" });
    }
    let que_number = counterRows[0].que_number + 1;
    let numberStr = que_number.toString().padStart(5, "0");
    const student_number = `${year.year_description}${numberStr}`;

    // 🔸 Check if already assigned
    const [existingRows] = await connection.query("SELECT * FROM student_numbering WHERE person_id = ?", [person_id]);
    if (existingRows.length > 0) {
      await connection.rollback();
      return res.status(400).json({ error: "Student number already assigned." });
    }

    // 🔸 Get active school year
    const [yearResult] = await connection.query("SELECT active_school_year_id FROM active_school_year WHERE astatus = 1 LIMIT 1");
    if (yearResult.length === 0) {
      await connection.rollback();
      return res.status(400).json({ error: "No active school year found" });
    }
    const activeSchoolYearId = yearResult[0].active_school_year_id;

    // 🔸 Insert student_number & status
    await connection.query("INSERT INTO student_numbering (student_number, person_id) VALUES (?, ?)", [student_number, person_id]);
    await connection.query("INSERT INTO student_status (student_number, active_curriculum, active_school_year_id, enrolled_status, year_level_id) VALUES (?, ?, ?, 0, 1)", [student_number, curriculum_id, activeSchoolYearId]);

    // 🔸 Update counter
    await connection.query("UPDATE student_counter SET que_number = ?", [que_number]);

    // 🔸 Update person status
    await connection.query("UPDATE person_status_table SET student_registration_status = 1 WHERE person_id = ?", [person_id]);

    // 🔸 Get person info (name & email)
    const [personRows] = await connection.query("SELECT first_name, middle_name, last_name, email FROM person_table WHERE person_id = ?", [person_id]);
    const person = personRows[0];

    // 🔸 Get curriculum info
    const [curriculumRows] = await connection.query(`
      SELECT c.*, ct.*, yt.*
      FROM curriculum as c
      LEFT JOIN course_table as ct
      ON ct.course_id = c.course_id
      LEFT JOIN year_table as yt
      ON yt.year_id = c.year_id
      
      WHERE curriculum_id = ?`, [curriculum_id]);
    const program = curriculumRows[0]?.course_description || "your chosen program";

    // 🔸 Compose email
    const fullName = `${person.first_name} ${person.middle_name} ${person.last_name}`;
    const mailOptions = {
      from: '"EARIST Admissions Office" <disanjose@earist.edu.ph>',
      to: person.email,
      subject: "Congratulations! Your EARIST Application",
      html: `
        <p>Dear ${fullName},</p>
        <p>We are pleased to inform you that your application to EARIST has been successful! Congratulations!</p>
        <p><strong>Your student number is:</strong> ${student_number}</p>
        <p>You have been approved to enroll in the <strong>${program}</strong> program.</p>
        <p>We look forward to welcoming you to EARIST! Further instructions regarding enrollment will follow soon.</p>
        <p>Sincerely,<br>The EARIST Admissions Team</p>
      `,
    };

    // 🔸 Send email
    await transporter.sendMail(mailOptions);

    await connection.commit();
    res.json({ student_number });
  } catch (err) {
    await connection.rollback();
    console.error("Server error:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    connection.release();
  }
});



app.get("/api/curriculum", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT c.*, ct.*, yt.*
      FROM curriculum as c
      LEFT JOIN course_table as ct
      ON ct.course_id = c.course_id
      LEFT JOIN year_table as yt
      ON yt.year_id = c.year_id
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});
