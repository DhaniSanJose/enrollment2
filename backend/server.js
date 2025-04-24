const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

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

    // Step 2: Use the active_school_year_id in the enrolled courses query
    const sql = `
      SELECT 
        es.id,
        es.subject_id,
        s.subject_code,
        s.subject_description
      FROM enrolled_subject AS es
      INNER JOIN subject_table AS s ON s.subject_id = es.subject_id
      WHERE es.student_number = ? 
        AND es.active_school_year_id = ?
        AND es.curriculum_id = ?
      ORDER BY s.subject_id ASC
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
  const { subject_id, user_id, curriculumID } = req.body;
  console.log("Received request:", { subject_id, user_id, curriculumID });

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
          INSERT INTO enrolled_subject (subject_id, student_number, active_school_year_id, curriculum_id) 
          VALUES (?, ?, ?, ?)
        `;

        db.query(insertSql, [subject_id, user_id, activeSchoolYearId, curriculumID], (insertErr) => {
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

app.post("/add-to-enrolled-courses/:userId/:currId", (req, res) => {
  const { subject_id } = req.body;
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

    const sql = "INSERT INTO enrolled_subject (subject_id, student_number, active_school_year_id, curriculum_id) VALUES (?, ?, ?, ?)";
    db.query(sql, [subject_id, userId, activeSchoolYearId, currId], (err, result) => {
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
  WHERE student_number = ?`;
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
    });

    res.json({
      message: "Search successful",
      token,
      studentNumber: student.student_number,
      activeCurriculum: student.active_curriculum,
      yearLevel: student.year_level_id,
      courseCode: student.course_code,
      courseDescription: student.course_description,
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

// API endpoint (add this to your backend routes)
app.get("/api/department-sections", (req, res) => {
  const { departmentId } = req.query;

  const query = `
    SELECT * 
    FROM department_table as dt
    INNER JOIN department_curriculum as dc
      ON dc.department_id = dt.department_id 

    INNER JOIN curriculum as c
      ON c.curriculum_id = dc.curriculum_id

    INNER JOIN department_section as ds
      ON ds.curriculum_id = c.curriculum_id

    INNER JOIN course_table as ct
      ON c.course_id = ct.course_id

    INNER JOIN section_table as st
      ON st.section_id = ds.section_id

    WHERE dt.department_id = 1
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

app.listen(5000, () => {
  console.log("Server running on port 5000");
});
