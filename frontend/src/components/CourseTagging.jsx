import React, { useEffect, useState } from "react";
import axios from "axios";
import { Box, Button, Typography, Table, TableBody, TableCell, TableHead, TableRow, Paper } from "@mui/material";

const userId = 20170071;

const CourseTagging = () => {
  const [courses, setCourses] = useState([]);
  const [enrolled, setEnrolled] = useState([]);

  useEffect(() => {
    axios
      .get("http://localhost:5000/courses")
      .then((res) => setCourses(res.data))
      .catch((err) => console.error(err));

    axios
      .get(`http://localhost:5000/enrolled_courses/${userId}`)
      .then((res) => setEnrolled(res.data))
      .catch((err) => console.error(err));
  }, []);

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
              subject_code: course.subject_code, // include subject_code
            },
          ])
        )
        .catch((err) => console.error(err));
    }
  };
  
  
  const addAllToCart = async () => {
    const newCourses = courses.filter((c) => !isEnrolled(c.subject_id) && c.year_level_id === 1);

    console.log("Courses to enroll:", newCourses); // 👈 Check this

    if (newCourses.length === 0) {
      console.warn("No eligible courses to enroll.");
      return;
    }

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

  return (
    <Box p={4} display="grid" gridTemplateColumns="1fr 1fr" gap={4}>
      {/* Course List */}

      <Box component={Paper} p={2}>
        <Box mt={2}>
          <Button variant="contained" color="success" onClick={addAllToCart}>
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
              {/* <TableCell>Course Name</TableCell> */}
              <TableCell>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {courses.map((c) => (
              <TableRow key={c.course_tagging_table_id}>
                <TableCell>{c.subject_code}</TableCell>
                <TableCell>{c.subject_id}</TableCell>
                {/* <TableCell>{c.subject_description}</TableCell> */}
                <TableCell>
                  {!isEnrolled(c.subject_id) ? (
                    <Button variant="contained" size="small" onClick={() => addToCart(c)}>
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
