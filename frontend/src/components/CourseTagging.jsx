import React, { useEffect, useState } from "react";
import axios from "axios";
import { Box, Button, Typography, Table, TableBody, TableCell, TableHead, TableRow, Paper, TextField } from "@mui/material";

const CourseTagging = () => {
  const [courses, setCourses] = useState([]);
  const [enrolled, setEnrolled] = useState([]);
  const [studentNumber, setStudentNumber] = useState("");
  const [userId, setUserId] = useState(null); // Dynamic userId

  useEffect(() => {
    axios
      .get("http://localhost:5000/courses")
      .then((res) => setCourses(res.data))
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    if (userId) {
      axios
        .get(`http://localhost:5000/enrolled_courses/${userId}`)
        .then((res) => setEnrolled(res.data))
        .catch((err) => console.error(err));
    }
  }, [userId]);

  const isEnrolled = (subject_id) => enrolled.some((item) => item.subject_id === subject_id);

  const addToCart = (course) => {
    if (!isEnrolled(course.subject_id)) {
      const payload = { subject_id: course.subject_id, user_id: userId };
      axios
        .post("http://localhost:5000/add-to-enrolled-courses", payload)
        .then(() =>
          setEnrolled((prev) => [
            ...prev,
            {
              subject_id: course.subject_id,
              subject_code: course.subject_code,
            },
          ])
        )
        .catch((err) => console.error(err));
    }
  };

  const addAllToCart = async () => {
    const newCourses = courses.filter((c) => !isEnrolled(c.subject_id) && c.year_level_id === 1);
    if (newCourses.length === 0) return;

    try {
      await Promise.all(
        newCourses.map((course) =>
          axios.post("http://localhost:5000/add-all-to-enrolled-courses", {
            subject_id: course.subject_id,
            user_id: userId,
          })
        )
      );
      const { data } = await axios.get(`http://localhost:5000/enrolled_courses/${userId}`);
      setEnrolled(data);
    } catch (err) {
      console.error("Error enrolling all courses:", err);
    }
  };

  const deleteFromCart = (subject_id) => {
    axios
      .delete(`http://localhost:5000/courses/delete/${subject_id}/${userId}`)
      .then(() => setEnrolled((prev) => prev.filter((item) => item.subject_id !== subject_id)))
      .catch((err) => console.error(err));
  };

  const deleteAllCart = () => {
    axios
      .delete(`http://localhost:5000/courses/user/${userId}`)
      .then(() => setEnrolled([]))
      .catch((err) => console.error(err));
  };

  const handleSearchStudent = async () => {
    if (!studentNumber) {
      alert("Please fill in all fields");
      return;
    }

    try {
      const response = await axios.post("http://localhost:5000/student-tagging", { studentNumber }, { headers: { "Content-Type": "application/json" } });

      const { token, studentNumber: studentNum, activeCurriculum, yearLevel } = response.data;

      localStorage.setItem("token", token);
      localStorage.setItem("studentNumber", studentNum);
      localStorage.setItem("activeCurriculum", activeCurriculum);
      localStorage.setItem("yearLevel", yearLevel);

      setUserId(studentNum); // Set as dynamic userId
      alert("Student found and authenticated!");
    } catch (error) {
      alert(error.response?.data?.message || "Student not found");
    }
  };

  return (
    <Box p={4} display="grid" gridTemplateColumns="1fr 1fr" gap={4}>
      {/* Available Courses */}
      <Box component={Paper} p={2}>
        {/* Search Student */}
        <Box>
          <Typography variant="h4">Search Student</Typography>
          <TextField label="Student Number" fullWidth margin="normal" value={studentNumber} onChange={(e) => setStudentNumber(e.target.value)} />
          <Button variant="contained" color="primary" fullWidth onClick={handleSearchStudent}>
            Search
          </Button>
        </Box>
        <Box mt={2}>
          <Button variant="contained" color="success" onClick={addAllToCart} disabled={!userId}>
            Enroll All
          </Button>
        </Box>

        <Typography variant="h6" gutterBottom>
          Available Courses
        </Typography>

        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Course Code</TableCell>
              <TableCell>Subject ID</TableCell>
              <TableCell>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {courses.map((c) => (
              <TableRow key={c.course_tagging_table_id}>
                <TableCell>{c.subject_code}</TableCell>
                <TableCell>{c.subject_id}</TableCell>
                <TableCell>
                  {!isEnrolled(c.subject_id) ? (
                    <Button variant="contained" size="small" onClick={() => addToCart(c)} disabled={!userId}>
                      Enroll
                    </Button>
                  ) : (
                    <Typography color="textSecondary">Enrolled</Typography>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>

      {/* Enrolled Courses */}
      <Box component={Paper} p={2}>
        <Typography variant="h6" gutterBottom>
          Enrolled Courses
        </Typography>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Subject ID</TableCell>
              <TableCell>Subject Code</TableCell>
              <TableCell>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {enrolled.map((e, idx) => (
              <TableRow key={idx}>
                <TableCell>{e.subject_id}</TableCell>
                <TableCell>{e.subject_code}</TableCell>
                <TableCell>
                  <Button variant="contained" color="error" size="small" onClick={() => deleteFromCart(e.subject_id)}>
                    Unenroll
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Box mt={2}>
          <Button variant="contained" color="warning" onClick={deleteAllCart}>
            Unenroll All
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default CourseTagging;
