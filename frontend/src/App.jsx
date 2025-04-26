// App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import CourseTagging from './components/CourseTagging';
import UserRegistrationForm from './components/UserRegistrationForm';
import UserProfileViewer from './components/UserProfileViewer';
const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<UserRegistrationForm />} />
        <Route path="/user" element={<UserProfileViewer />} />
        <Route path="/course-tagging" element={<CourseTagging />} />
      </Routes>
    </Router>
  );
};

export default App;
