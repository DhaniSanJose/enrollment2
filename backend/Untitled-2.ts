// Fetch persons who are not yet assigned a student number
// Use async function to handle top-level async code

// Fetch persons who are not yet assigned a student number
app.get("/api/persons", async (req, res) => {
  const connection = await db.getConnection();
  try {
    const [rows] = await connection.query(`
              SELECT p.* 
              FROM person_table p
              JOIN person_status_table ps ON p.person_id = ps.person_id
              WHERE ps.student_registration_status = 0
          `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  } finally {
    connection.release(); // Release the connection back to the pool
  }
});

// Assign a student number
app.post("/api/assign-student-number", async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { person_id } = req.body;

    if (!person_id) {
      return res.status(400).send("person_id is required");
    }

    // Get active year
    const [yearRows] = await connection.query("SELECT * FROM year_table WHERE status = 1 LIMIT 1");
    if (yearRows.length === 0) {
      return res.status(400).send("No active year found");
    }
    const year = yearRows[0];

    // Get counter
    const [counterRows] = await connection.query("SELECT * FROM student_counter WHERE que_number_id = 1");
    if (counterRows.length === 0) {
      return res.status(400).send("No counter found");
    }
    let que_number = counterRows[0].que_number;

    // Fix: if que_number is 0, still generate '00001'
    que_number = que_number + 1;

    let numberStr = que_number.toString();
    while (numberStr.length < 5) {
      numberStr = "0" + numberStr;
    }
    const student_number = `${year.year_description}${numberStr}`;

    // Check if already assigned
    const [existingRows] = await connection.query("SELECT * FROM student_numbering WHERE person_id = ?", [person_id]);
    if (existingRows.length > 0) {
      return res.status(400).send("Student number already assigned.");
    }

    // Insert into student_numbering
    await connection.query("INSERT INTO student_numbering (student_number, person_id) VALUES (?, ?)", [student_number, person_id]);

    // Update counter
    await connection.query("UPDATE student_counter SET que_number = ?", [que_number]);

    // Update person_status_table
    await connection.query("UPDATE person_status_table SET student_registration_status = 1 WHERE person_id = ?", [person_id]);

    res.json({ student_number });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).send("Server error");
  } finally {
    connection.release(); // Release the connection back to the pool
  }
});