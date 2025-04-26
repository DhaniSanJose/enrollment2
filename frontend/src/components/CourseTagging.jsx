import React, { useEffect, useState } from "react";
import axios from "axios";
import { Box, Button, Grid, Typography, Table, TableBody, TableCell, TableHead, TableRow, Paper, TextField, MenuItem  } from "@mui/material";
import LinearWithValueLabel from './LinearWithValueLabel';
const CourseTagging = () => {
  const [courses, setCourses] = useState([]);
  const [enrolled, setEnrolled] = useState([]);
  const [studentNumber, setStudentNumber] = useState("");
  const [userId, setUserId] = useState(null); // Dynamic userId
  const [first_name, setUserFirstName] = useState(null); // Dynamic userId
  const [middle_name, setUserMiddleName] = useState(null); // Dynamic userId
  const [last_name, setUserLastName] = useState(null); // Dynamic userId
  const [currId, setCurr] = useState(null); // Dynamic userId
  const [courseCode, setCourseCode] = useState("");
  const [courseDescription, setCourseDescription] = useState("");

  const [sections, setSections] = useState([]);
  const [selectedSection, setSelectedSection] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState(null);






  const [subjectCounts, setSubjectCounts] = useState({});

  useEffect(() => {
    if (selectedSection) {
      fetchSubjectCounts(selectedSection);
    }
  }, [selectedSection]);
  
  const fetchSubjectCounts = async (sectionId) => {
    try {
      const response = await axios.get("http://localhost:5000/subject-enrollment-count", {
        params: { sectionId },
      });
  
      // Transform into object for easy lookup: { subject_id: enrolled_count }
      const counts = {};
      response.data.forEach((item) => {
        counts[item.subject_id] = item.enrolled_count;
      });
  
      setSubjectCounts(counts);
    } catch (err) {
      console.error("Failed to fetch subject counts", err);
    }
  };
  




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

 
  // Fetch sections whenever selectedDepartment changes
  useEffect(() => {
    if (selectedDepartment) {
      fetchDepartmentSections();
    }
  }, [selectedDepartment]);

  // Fetch department sections based on selected department
const fetchDepartmentSections = async () => {
  try {
    setLoading(true);
    const response = await axios.get("http://localhost:5000/api/department-sections", {
      params: { departmentId: selectedDepartment },
    });
    // Artificial delay
    setTimeout(() => {
      setSections(response.data);
      setLoading(false);
    }, 700); // 3 seconds delay
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
    if (!selectedSection) {
      alert("Please select a department section before adding the course.");
      return;
    }



    if (!isEnrolled(course.subject_id)) {
      const payload = { subject_id: course.subject_id, department_section_id: selectedSection };
      try {
        await axios.post(`http://localhost:5000/add-to-enrolled-courses/${userId}/${currId}/`, payload);

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
    if (!selectedSection) {
      alert("Please select a department section before adding the course.");
      return;
    }

    if (newCourses.length === 0) return;

    try {
      await Promise.all(
        newCourses.map(async (course) => {
          try {
            const res = await axios.post("http://localhost:5000/add-all-to-enrolled-courses", {
              subject_id: course.subject_id,
              user_id: userId,
              curriculumID: currId, // Include curriculum_id
              departmentSectionID: selectedSection, // Include selected section
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

      const { token, studentNumber: studentNum, activeCurriculum: active_curriculum, yearLevel, courseCode: course_code, courseDescription: course_desc,  firstName: first_name,
        middleName: middle_name, lastName: last_name, } = response.data;

      localStorage.setItem("token", token);
      localStorage.setItem("studentNumber", studentNum);
      localStorage.setItem("activeCurriculum", active_curriculum);
      localStorage.setItem("yearLevel", yearLevel);
      localStorage.setItem("courseCode", course_code);
      localStorage.setItem("courseDescription", course_desc);
      localStorage.setItem("firstName", first_name);
      localStorage.setItem("middleName", middle_name);
      localStorage.setItem("lastName", last_name);

      setUserId(studentNum); // Set dynamic userId
      setUserFirstName(first_name); // Set dynamic userId
      setUserMiddleName(middle_name); // Set dynamic userId
      setUserLastName(last_name); // Set dynamic userId
      setCurr(active_curriculum); // Set Program Code based on curriculum
      setCourseCode(course_code); // Set Program Code
      setCourseDescription(course_desc); // Set Program Description
      alert("Student found and authenticated!");
    } catch (error) {
      alert(error.response?.data?.message || "Student not found");
    }
  };



  // Fetch all departments when component mounts
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const res = await axios.get("http://localhost:5000/departments");
        setDepartments(res.data);
      } catch (err) {
        console.error("Error fetching departments:", err);
      }
    };

    fetchDepartments();
  }, []);

  const handleSelect = (departmentId) => {
    setSelectedDepartment(departmentId);
  };

  return (
    <>
          <Grid container spacing={2} justifyContent="center" textAlign="center">
      {departments.map((dept, index) => (
        <Grid  key={dept.department_id}>
          <Button
            fullWidth
            variant={selectedDepartment === dept.department_id ? "contained" : "outlined"}
            color={selectedDepartment === dept.department_id ? "primary" : "inherit"}
            value={dept.department_id}
            onClick={() => handleSelect(dept.department_id)}
          >
            {dept.department_code}
          </Button>
        </Grid>
      ))}
    </Grid>
    <Box p={4} display="grid" gridTemplateColumns="1fr 1fr" gap={4}>
      {/* Available Courses */}
      <Box component={Paper} p={2}>
        {/* Search Student */}
        <Box>
          <Typography variant="h6">
          {first_name} {middle_name} {last_name}
            <br/>
            {courseCode} - {courseDescription}
          </Typography>
          <TextField
  label="Student Number"
  fullWidth
  margin="normal"
  value={studentNumber}
  onChange={(e) => setStudentNumber(e.target.value)}
  onKeyDown={(e) => {
    if (e.key === "Enter") {
      handleSearchStudent();
    }
  }}
/>

<Button
  variant="contained"
  color="primary"
  fullWidth
  onClick={handleSearchStudent}
>
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
              <TableCell>Enrolled Students</TableCell>
              <TableCell>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody> 
            {courses.map((c) => (
              <TableRow key={c.course_tagging_table_id}>
                <TableCell>{c.subject_code}</TableCell>
                <TableCell>{c.subject_description}</TableCell>
                <TableCell>
                {subjectCounts[c.subject_id] || 0}
              </TableCell>
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

{/* Department Sections Dropdown */}
{loading ? (
  <Box sx={{ width: '100%', mt: 2 }}>
    <LinearWithValueLabel />
  </Box>
) : error ? (
  <Typography color="error">{error}</Typography>
) : (
  <TextField
    select
    fullWidth
    value={selectedSection}
    onChange={handleSectionChange}
    variant="outlined"
    margin="normal"
    label="Select a department section"
  >
    <MenuItem value="">
      <em>Select a department section</em>
    </MenuItem>
    {sections.map((section) => (
      <MenuItem key={section.department_section_id} value={section.department_section_id}>
        {section.course_code} - {section.section_description}
      </MenuItem>
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
              <TableCell style={{ display: "none" }}>Enrolled Subject ID</TableCell>
              <TableCell style={{ display: "none" }}>Subject ID</TableCell>
              <TableCell style={{ textAlign: "center" }}>SECTION</TableCell>
              <TableCell style={{ textAlign: "center" }}>SUBJECT CODE</TableCell>
              <TableCell style={{ textAlign: "center" }}>DAY</TableCell>
              <TableCell style={{ textAlign: "center" }}>TIME</TableCell>
              <TableCell style={{ textAlign: "center" }}>ROOM</TableCell>
              <TableCell style={{ textAlign: "center" }}>PROFESSOR</TableCell>
              <TableCell style={{ textAlign: "center" }}>ENROLLED STUDENTS</TableCell>
              <TableCell style={{ textAlign: "center" }}>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody >
            {enrolled.map((e, idx) => (
              <TableRow key={idx} >
                <TableCell style={{ display: "none" }}>{e.id}</TableCell>
                <TableCell style={{ display: "none" }}>{e.subject_id}</TableCell>
                <TableCell style={{ textAlign: "center" }}>
                  {e.course_code}-{e.section_description}
                </TableCell>
                <TableCell style={{ textAlign: "center" }}>
  {e.subject_code} 
</TableCell>
                <TableCell style={{ textAlign: "center" }}>{e.day_description}</TableCell>
                <TableCell style={{ textAlign: "center" }}>{e.school_time_start}-{e.school_time_end}</TableCell>
                <TableCell style={{ textAlign: "center" }}>{e.room_description}</TableCell>
                <TableCell style={{ textAlign: "center" }}>Prof. {e.lname}</TableCell>
                <TableCell style={{ textAlign: "center" }}> ({e.number_of_enrolled})</TableCell>
                <TableCell style={{ textAlign: "center" }}>
                  <Button style={{ textAlign: "center" }} variant="contained" color="error" size="small" onClick={() => deleteFromCart(e.id)}>
                    Unenroll
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </Box>
    </>
  );
};

export default CourseTagging;
