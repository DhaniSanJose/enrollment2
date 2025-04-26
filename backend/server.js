const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const jwt = require("jsonwebtoken");
require("dotenv").config();


const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));







const db = mysql.createConnection({ 
  host: "localhost",
  user: "root",
  password: "",
  database: "cmu_mis", 
});

// Corrected route with parameter
app.get("/courses/:currId", (req, res) => {
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

  db.query(sql, [currId], (err, result) => {
    if (err) {
      console.error("Error in /courses:", err); // 👈 fixed the log label too
      console.log(currId, "hello world");
      return res.status(500).json({ error: err.message });
    }
    res.json(result);
  });
});

app.get("/enrolled_courses/:userId/:currId", (req, res) => {
  const { userId, currId } = req.params;

  // Step 1: Get the active_school_year_id
  const activeYearSql = `SELECT active_school_year_id FROM active_school_year WHERE astatus = 1 LIMIT 1`;

  db.query(activeYearSql, (err, yearResult) => {
    if (err) {
      console.error("Error fetching active school year:", err);
      return res.status(500).json({ error: err.message });
    }

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
      IFNULL(rd.day_description, 'TBA') AS day_description, -- 👈 handle NULL day
       IFNULL(tt.school_time_start, 'TBA') AS school_time_start, -- 👈 handle NULL school_time_start
      IFNULL(tt.school_time_end, 'TBA') AS school_time_end, -- 👈 handle NULL school_time_end
        IFNULL(rtbl.room_description, 'TBA') AS room_description, -- 👈 handle NULL room_description
      IFNULL(prof_table.lname, 'TBA') AS lname, -- 👈 handle NULL lname

          (
      SELECT COUNT(*) 
      FROM enrolled_subject es2 
      WHERE es2.active_school_year_id = es.active_school_year_id 
        AND es2.department_section_id = es.department_section_id
        AND es2.subject_id = s.subject_id
    ) AS number_of_enrolled -- 👈 this is your new field!


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
  

    db.query(sql, [userId, activeSchoolYearId, currId], (err, result) => {
      if (err) {
        console.error("Error in /enrolled_courses:", err);
        return res.status(500).json({ error: err.message });
      }
      res.json(result);
    });
  });
});

app.post("/add-all-to-enrolled-courses", (req, res) => {
  const { subject_id, user_id, curriculumID, departmentSectionID } = req.body;
  console.log("Received request:", { subject_id, user_id, curriculumID, departmentSectionID });

  const activeYearSql = `SELECT active_school_year_id, semester_id FROM active_school_year WHERE astatus = 1 LIMIT 1`;

  db.query(activeYearSql, (err, yearResult) => {
    if (err) {
      console.error("Error fetching active school year:", err);
      return res.status(500).json({ error: err.message });
    }

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

    db.query(checkSql, [subject_id, curriculumID], (checkErr, checkResult) => {
      if (checkErr) {
        console.error("SQL error:", checkErr);
        return res.status(500).json({ error: "Database error", details: checkErr });
      }

      if (!checkResult.length) {
        console.warn(`Subject ${subject_id} not found in tagging table`);
        return res.status(404).json({ message: "Subject not found" });
      }

      const { year_level_id, semester_id, curriculum_id } = checkResult[0];
      console.log("Year level found:", year_level_id);
      console.log("Subject semester:", semester_id);
      console.log("Active semester:", activeSemesterId);
      console.log("Curriculum found:", curriculum_id);

      // ✅ Check if it matches Year 1, active semester, and correct curriculum
      if (year_level_id !== 1 || semester_id !== activeSemesterId || curriculum_id !== curriculumID) {
        console.log(`Skipping subject ${subject_id} (not Year 1, not active semester ${activeSemesterId}, or wrong curriculum)`);
        return res.status(200).json({ message: "Skipped - Not Year 1 / Not Active Semester / Wrong Curriculum" });
      }

      const checkDuplicateSql = `
        SELECT * FROM enrolled_subject 
        WHERE subject_id = ? AND student_number = ? AND active_school_year_id = ?
      `;

      db.query(checkDuplicateSql, [subject_id, user_id, activeSchoolYearId], (dupErr, dupResult) => {
        if (dupErr) {
          console.error("Duplication check error:", dupErr);
          return res.status(500).json({ error: "Duplication check failed", details: dupErr });
        }

        if (dupResult.length > 0) {
          console.log(`Skipping subject ${subject_id}, already enrolled for student ${user_id}`);
          return res.status(200).json({ message: "Skipped - Already Enrolled" });
        }

        const insertSql = `
          INSERT INTO enrolled_subject (subject_id, student_number, active_school_year_id, curriculum_id, department_section_id) 
          VALUES (?, ?, ?, ?,?)
        `;

        db.query(insertSql, [subject_id, user_id, activeSchoolYearId, curriculumID, departmentSectionID], (insertErr) => {
          if (insertErr) {
            console.error("Insert error:", insertErr);
            return res.status(500).json({ error: "Insert failed", details: insertErr });
          }

          console.log(`Student ${user_id} successfully enrolled in subject ${subject_id}`);
          res.status(200).json({ message: "Course enrolled successfully" });
        });
      });
    });
  });
});

app.post("/add-to-enrolled-courses/:userId/:currId/", (req, res) => {
  const { subject_id, department_section_id } = req.body;
  const { userId, currId } = req.params;

  const activeYearSql = `SELECT active_school_year_id FROM active_school_year WHERE astatus = 1 LIMIT 1`;

  db.query(activeYearSql, (err, yearResult) => {
    if (err) {
      console.error("Error fetching active school year:", err);
      return res.status(500).json({ error: err.message });
    }

    if (yearResult.length === 0) {
      return res.status(404).json({ error: "No active school year found" });
    }

    const activeSchoolYearId = yearResult[0].active_school_year_id;

    const sql = "INSERT INTO enrolled_subject (subject_id, student_number, active_school_year_id, curriculum_id, department_section_id) VALUES (?, ?, ?, ?, ?)";
    db.query(sql, [subject_id, userId, activeSchoolYearId, currId, department_section_id], (err, result) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Course enrolled successfully" });
    });
  });
});

// Delete course by subject_id
app.delete("/courses/delete/:id", (req, res) => {
  const { id } = req.params;
  const sql = "DELETE FROM enrolled_subject WHERE id = ?";
  db.query(sql, [id], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Course unenrolled successfully" });
  });
});

// Delete all courses for user
app.delete("/courses/user/:userId", (req, res) => {
  const { userId } = req.params;
  const activeYearSql = `SELECT active_school_year_id, semester_id FROM active_school_year WHERE astatus = 1 LIMIT 1`;

  db.query(activeYearSql, (err, yearResult) => {
    if (err) {
      console.error("Error fetching active school year:", err);
      return res.status(500).json({ error: err.message });
    }

    if (yearResult.length === 0) {
      return res.status(404).json({ error: "No active school year found" });
    }

    const activeSchoolYearId = yearResult[0].active_school_year_id;

    const sql = "DELETE FROM enrolled_subject WHERE student_number = ? AND active_school_year_id = ?";
    db.query(sql, [userId, activeSchoolYearId], (err, result) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "All courses unenrolled successfully" });
    });
  });
});

// Login User
app.post("/student-tagging", (req, res) => {
  const { studentNumber } = req.body;

  if (!studentNumber) {
    return res.status(400).json({ message: "All fields are required" });
  }

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
  db.query(sql, [studentNumber], async (err, results) => {
    if (err) {
      console.error("SQL error:", err);
      return res.status(500).json({ message: "Database error" });
    }

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
  });
});

let lastSeenId = 0;

app.get("/check-new", (req, res) => {
  db.query("SELECT * FROM enrolled_subject ORDER BY id DESC LIMIT 1", (err, results) => {
    if (err) return res.status(500).json({ error: err });

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
  });
});


app.get("/api/department-sections", (req, res) => {
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

  db.query(query, [departmentId], (err, results) => {
    if (err) {
      console.error("Error fetching department sections:", err);
      return res.status(500).json({ error: "Database error", details: err.message });
    }

    res.status(200).json(results);
  });
});





// Express route
app.get("/departments", (req, res) => {
  const sql = "SELECT department_id, department_code FROM department_table";

  db.query(sql, (err, result) => {
    if (err) {
      console.error("Error fetching departments:", err);
      return res.status(500).json({ error: err.message });
    }
    res.json(result);
  });
});







// 📌 Count how many students enrolled per subject for a selected section
app.get("/subject-enrollment-count", (req, res) => {
  const { sectionId } = req.query; // department_section_id

  const activeYearSql = `SELECT active_school_year_id FROM active_school_year WHERE astatus = 1 LIMIT 1`;

  db.query(activeYearSql, (err, yearResult) => {
    if (err) {
      console.error("Error fetching active school year:", err);
      return res.status(500).json({ error: err.message });
    }

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

    db.query(sql, [activeSchoolYearId, sectionId], (err, result) => {
      if (err) {
        console.error("Error fetching enrolled counts:", err);
        return res.status(500).json({ error: err.message });
      }
      res.json(result); // [{ subject_id: 1, enrolled_count: 25 }, { subject_id: 2, enrolled_count: 30 }]
    });
  });
});

//-----------------------------------------------------------------------------------------------------------------------------------




// Create uploads folder if it doesn't exist
const uploadPath = path.join(__dirname, 'uploads');
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
    const randomName = Date.now() + '-' + Math.round(Math.random() * 1E9) + ext;
    cb(null, randomName);
  },
});

const upload = multer({ storage });

// Routes

// Register new user
app.post('/api/register', (req, res) => {
  const { first_name, middle_name, last_name } = req.body;

  if (!first_name || !last_name) {
    return res.status(400).send('First name and last name are required');
  }

  const sql = 'INSERT INTO person_table (first_name, middle_name, last_name) VALUES (?, ?, ?)';
  db.query(sql, [first_name, middle_name, last_name], (err, result) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).send('Error registering user');
    }

    const person_id = result.insertId;
    res.json({ person_id });
  });
});

// Upload profile picture
app.post('/api/upload-profile-picture', upload.single('profile_picture'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded');
  }

  const { person_id } = req.body;
  if (!person_id) {
    return res.status(400).send('Missing person_id');
  }

  const oldPath = req.file.path;
  const ext = path.extname(req.file.originalname).toLowerCase();
  const newFilename = `${person_id}_profile_picture${ext}`;
  const newPath = path.join(uploadPath, newFilename);

  // Rename the uploaded file
  fs.rename(oldPath, newPath, (err) => {
    if (err) {
      console.error('Error renaming file:', err);
      return res.status(500).send('Error processing profile picture');
    }

    const sql = 'UPDATE person_table SET profile_picture = ? WHERE person_id = ?';
    db.query(sql, [newFilename, person_id], (err) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).send('Error saving profile picture');
      }
      res.send('Profile picture uploaded successfully');
    });
  });
});

// Serve uploaded images statically
app.use('/uploads', express.static(uploadPath));



//------------------------------------------------------------------------------------------------------------------------------------------------------------



// Get user by person_id
app.get('/api/user/:person_id', (req, res) => {
  const { person_id } = req.params;

  const sql = 'SELECT profile_picture FROM person_table WHERE person_id = ?';
  db.query(sql, [person_id], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).send('Database error');
    }

    if (results.length === 0) {
      return res.status(404).send('User not found');
    }

    res.json(results[0]);
  });
});





app.listen(5000, () => {
  console.log("Server running on port 5000");
});
