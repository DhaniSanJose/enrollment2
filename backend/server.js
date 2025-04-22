const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");

const app = express();
app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "cmu_mis",
});

// Get all courses for curriculum_id = 2
app.get("/courses", (req, res) => {
  const sql = `
    SELECT 
      ctt.course_tagging_table_id,
      ctt.curriculum_id,
      ctt.subject_id,
      ctt.year_level_id,
      s.subject_code,
      s.subject_description
    FROM course_tagging_table AS ctt
    INNER JOIN subject_table AS s ON s.subject_id = ctt.subject_id
    WHERE ctt.curriculum_id = 2
    ORDER BY s.subject_id ASC
  `;

  db.query(sql, (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
});

app.get("/enrolled_courses/:userId", (req, res) => {
  const { userId } = req.params;
  const sql = `
    SELECT 
      es.id,
      es.subject_id,
      s.subject_code,
      s.subject_description
    FROM enrolled_subject AS es
    INNER JOIN subject_table AS s ON s.subject_id = es.subject_id
    WHERE es.student_number = ? 
      AND es.active_school_year_id = 2
      AND es.curriculum_id = 2
    ORDER BY s.subject_id ASC
  `;

  db.query(sql, [userId], (err, result) => {
    if (err) {
      console.error("Error in /enrolled_courses:", err); // 👈 log the error to console
      return res.status(500).json({ error: err.message });
    }
    res.json(result);
  });
});





app.post("/add-all-to-enrolled-courses", (req, res) => {
  const { subject_id, user_id } = req.body;
  console.log("Received request:", { subject_id, user_id });

  const checkSql = `
    SELECT year_level_id FROM course_tagging_table 
    WHERE subject_id = ? LIMIT 1
  `;

  db.query(checkSql, [subject_id], (checkErr, checkResult) => {
    if (checkErr) {
      console.error("SQL error:", checkErr);
      return res.status(500).json({ error: "Database error", details: checkErr });
    }

    if (!checkResult.length) {
      console.warn(`Subject ${subject_id} not found in tagging table`);
      return res.status(404).json({ message: "Subject not found" });
    }

    const yearLevelId = checkResult[0].year_level_id;
    console.log("Year level found:", yearLevelId);

    if (yearLevelId !== 1) {
      console.warn(`Subject ${subject_id} is not for Year Level 1`);
      return res.status(400).json({ message: "Subject not for Year Level 1" });
    }

    const checkDuplicateSql = `
      SELECT * FROM enrolled_subject 
      WHERE subject_id = ? AND student_number = ?
    `;

    db.query(checkDuplicateSql, [subject_id, user_id], (dupErr, dupResult) => {
      if (dupErr) {
        console.error("Duplication check error:", dupErr);
        return res.status(500).json({ error: "Duplication check failed", details: dupErr });
      }

      if (dupResult.length > 0) {
        console.log(`Student ${user_id} already enrolled in subject ${subject_id}`);
        return res.status(409).json({ message: "Already enrolled" });
      }

      const insertSql = `
        INSERT INTO enrolled_subject (subject_id, student_number, active_school_year_id, curriculum_id) 
        VALUES (?, ?, 2, 2)
      `;

      db.query(insertSql, [subject_id, user_id], (insertErr, insertResult) => {
        if (insertErr) {
          console.error("Insert error:", insertErr);
          return res.status(500).json({ error: "Insert failed", details: insertErr });
        }

        console.log(`Student ${user_id} enrolled in subject ${subject_id}`);
        res.json({ message: "Course enrolled successfully" });
      });
    });
  });
});















// Add a course to enrolled_subject table (simulate cart)
app.post("/add-to-enrolled-courses", (req, res) => {
  const { subject_id, user_id } = req.body;
  const sql = "INSERT INTO enrolled_subject (subject_id, student_number, active_school_year_id, curriculum_id) VALUES (?, ?, 2,2)";
  db.query(sql, [subject_id, user_id], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Course enrolled successfully" });
  });
});

// Delete course by subject_id
app.delete("/courses/delete/:subjectId/:userId", (req, res) => {
  const { subjectId, userId } = req.params;
  const sql = "DELETE FROM enrolled_subject WHERE subject_id = ? AND student_number = ? AND active_school_year_id = 2";
  db.query(sql, [subjectId, userId], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Course unenrolled successfully" });
  });
});

// Delete all courses for user
app.delete("/courses/user/:userId", (req, res) => {
  const { userId } = req.params;
  const sql = "DELETE FROM enrolled_subject WHERE student_number = ? AND active_school_year_id = 2";
  db.query(sql, [userId], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "All courses unenrolled successfully" });
  });
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});
