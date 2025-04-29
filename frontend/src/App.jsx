// App.jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import CourseTagging from "./components/CourseTagging";
import UserRegistrationForm from "./components/UserRegistrationForm";
import UserProfileViewer from "./components/UserProfileViewer";
import StudentNumbering from "./components/StudentNumbering";
import COR from "./components/COR";
const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<UserRegistrationForm />} />
        <Route path="/cor" element={<COR />} />
        <Route path="/user" element={<UserProfileViewer />} />
        <Route path="/student-numbering" element={<StudentNumbering />} />
        <Route path="/course-tagging" element={<CourseTagging />} />
      </Routes>
    </Router>
  );
};

export default App;
