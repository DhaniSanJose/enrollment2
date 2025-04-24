import React, { useEffect, useState } from "react";
import axios from "axios";
import { Box, Button, Typography, Table, TableBody, TableCell, TableHead, TableRow, Paper, TextField } from "@mui/material";

const CourseTagging = () => {
  const [courses, setCourses] = useState([]);
  const [enrolled, setEnrolled] = useState([]);
  const [studentNumber, setStudentNumber] = useState("");
  const [userId, setUserId] = useState(null); // Dynamic userId
  const [currId, setCurr] = useState(null); // Dynamic userId
  const [courseCode, setCourseCode] = useState("");
  const [courseDescription, setCourseDescription] = useState("");

  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (currId) {
      axios
        .get(`http://localhost:5000/courses/${currId}`)
        .then((res) => setCourses(res.data))
        .catch((err) => console.error(err));
    }
  }, [currId]);

  useEffect(() => {
    if (userId && currId) {
      axios
        .get(`http://localhost:5000/enrolled_courses/${userId}/${currId}`)
        .then((res) => setEnrolled(res.data))
        .catch((err) => console.error(err));
    }
  }, [userId, currId]);

  // Fetch department sections when component mounts
  useEffect(() => {
    fetchDepartmentSections();
  }, []);

  const fetchDepartmentSections = async () => {
    try {
      setLoading(true);
      const response = await axios.get("http://localhost:5000/api/department-sections");
      setSections(response.data);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching department sections:", err);
      setError("Failed to load department sections");
      setLoading(false);
    }
  };

  const handleSectionChange = (e) => {
    const sectionId = e.target.value;
    setSelectedSection(sectionId);

    // Find the selected section object from the array
    const selectedSectionObj = sections.find((section) => section.department_section_id.toString() === sectionId);

    // Do something with the selected section if needed
    console.log("Selected section:", selectedSectionObj);
  };

  const isEnrolled = (subject_id) => enrolled.some((item) => item.subject_id === subject_id);

  const addToCart = async (course) => {
    if (!isEnrolled(course.subject_id)) {
      const payload = { subject_id: course.subject_id };
      try {
        await axios.post(`http://localhost:5000/add-to-enrolled-courses/${userId}/${currId}`, payload);

        // Refresh enrolled courses list after adding
        const { data } = await axios.get(`http://localhost:5000/enrolled_courses/${userId}/${currId}`);
        setEnrolled(data);
      } catch (err) {
        console.error("Error adding course or refreshing enrolled list:", err);
      }
    }
  };

  const addAllToCart = async () => {
    const newCourses = courses.filter((c) => !isEnrolled(c.subject_id));
    if (newCourses.length === 0) return;

    try {
      await Promise.all(
        newCourses.map(async (course) => {
          try {
            const res = await axios.post("http://localhost:5000/add-all-to-enrolled-courses", {
              subject_id: course.subject_id,
              user_id: userId,
              curriculumID: currId, // Include curriculum_id
            });
            console.log(`Response for subject ${course.subject_id}:`, res.data.message);
          } catch (err) {
            console.error(`Error enrolling subject ${course.subject_id}:`, err.response?.data?.message || err.message);
          }
        })
      );

      // Refresh enrolled courses list
      const { data } = await axios.get(`http://localhost:5000/enrolled_courses/${userId}/${currId}`);
      setEnrolled(data);
    } catch (err) {
      console.error("Unexpected error during enrollment:", err);
    }
  };

  const deleteFromCart = async (id) => {
    try {
      // Delete the specific course
      await axios.delete(`http://localhost:5000/courses/delete/${id}`);

      // Refresh enrolled courses list
      const { data } = await axios.get(`http://localhost:5000/enrolled_courses/${userId}/${currId}`);
      setEnrolled(data);

      console.log(`Course with ID ${id} deleted and enrolled list updated`);
    } catch (err) {
      console.error("Error deleting course or refreshing enrolled list:", err);
    }
  };

  const deleteAllCart = async () => {
    try {
      // Delete all user courses
      await axios.delete(`http://localhost:5000/courses/user/${userId}`);

      // Refresh enrolled courses list
      const { data } = await axios.get(`http://localhost:5000/enrolled_courses/${userId}/${currId}`);
      setEnrolled(data);

      console.log("Cart cleared and enrolled courses refreshed");
    } catch (err) {
      console.error("Error deleting cart or refreshing enrolled list:", err);
    }
  };

  const handleSearchStudent = async () => {
    if (!studentNumber.trim()) {
      alert("Please fill in the student number");
      return;
    }

    try {
      const response = await axios.post("http://localhost:5000/student-tagging", { studentNumber }, { headers: { "Content-Type": "application/json" } });

      const { token, studentNumber: studentNum, activeCurriculum: active_curriculum, yearLevel, courseCode: course_code, courseDescription: course_desc } = response.data;

      localStorage.setItem("token", token);
      localStorage.setItem("studentNumber", studentNum);
      localStorage.setItem("activeCurriculum", active_curriculum);
      localStorage.setItem("yearLevel", yearLevel);
      localStorage.setItem("courseCode", course_code);
      localStorage.setItem("courseDescription", course_desc);

      setUserId(studentNum); // Set dynamic userId
      setCurr(active_curriculum); // Set Program Code based on curriculum
      setCourseCode(course_code); // Set Program Code
      setCourseDescription(course_desc); // Set Program Description
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
          <Typography variant="h6">
            {courseCode} - {courseDescription}
          </Typography>
          <TextField label="Student Number" fullWidth margin="normal" value={studentNumber} onChange={(e) => setStudentNumber(e.target.value)} />
          <Button variant="contained" color="primary" fullWidth onClick={handleSearchStudent}>
            Search
          </Button>
        </Box>
        <Box display="flex" gap={2} mt={2}>
          <Button variant="contained" color="success" onClick={addAllToCart} disabled={!userId}>
            Enroll All
          </Button>
          <Button variant="contained" color="warning" onClick={deleteAllCart}>
            Unenroll All
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
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            Department Section
          </Typography>

          {loading ? (
            <Typography color="text.secondary">Loading sections...</Typography>
          ) : error ? (
            <Typography color="error">{error}</Typography>
          ) : (
            <TextField
              select
              fullWidth
              value={selectedSection}
              onChange={handleSectionChange}
              SelectProps={{
                native: true,
              }}
              variant="outlined"
            >
              <option value="">Select a department section</option>
              {sections.map((section) => (
                <option key={section.department_section_id} value={section.department_section_id}>
                  {section.course_code}-{section.section_description}
                </option>
              ))}
            </TextField>
          )}
        </Box>

        <Typography variant="h6" gutterBottom>
          Enrolled Courses
        </Typography>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Enrolled Subject ID</TableCell>
              <TableCell>Subject ID</TableCell>
              <TableCell>Subject Code</TableCell>
              <TableCell>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {enrolled.map((e, idx) => (
              <TableRow key={idx}>
                <TableCell>{e.id}</TableCell>
                <TableCell>{e.subject_id}</TableCell>
                <TableCell>{e.subject_code}</TableCell>
                <TableCell>
                  <Button variant="contained" color="error" size="small" onClick={() => deleteFromCart(e.id)}>
                    Unenroll
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </Box>
  );
};

export default CourseTagging;
