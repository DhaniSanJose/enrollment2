// src/components/UserRegistrationForm.jsx
import React, { useState } from 'react';
import { TextField, Button, Grid, Typography } from '@mui/material';
import axios from 'axios';

const UserRegistrationForm = () => {
  const [formData, setFormData] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    profile_picture: null, // This will hold the file
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      profile_picture: e.target.files[0],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // First, create the user without the profile picture
      const res = await axios.post('http://localhost:5000/api/register', {
        first_name: formData.first_name,
        middle_name: formData.middle_name,
        last_name: formData.last_name,
      });
  
      const { person_id } = res.data; // Get the person_id from backend response
  
      if (formData.profile_picture) {
        const pictureData = new FormData();
        pictureData.append('profile_picture', formData.profile_picture); // Profile picture file
        pictureData.append('person_id', person_id); // Send person_id
  
        // Now upload the picture
        await axios.post('http://localhost:5000/api/upload-profile-picture', pictureData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
  
      alert('User registered successfully!');
      setFormData({
        first_name: '',
        middle_name: '',
        last_name: '',
        profile_picture: null,
      });
    } catch (error) {
      console.error(error);
      alert('Registration failed.');
    }
  };
  
  return (
    <Grid container spacing={2} justifyContent="center" mt={4}>
      <Grid item xs={12} md={6}>
        <Typography variant="h4" mb={2}>User Registration</Typography>
        <form onSubmit={handleSubmit} encType="multipart/form-data">
          <TextField
            label="First Name"
            name="first_name"
            value={formData.first_name}
            onChange={handleChange}
            fullWidth
            margin="normal"
            required
          />
          <TextField
            label="Middle Name"
            name="middle_name"
            value={formData.middle_name}
            onChange={handleChange}
            fullWidth
            margin="normal"
          />
          <TextField
            label="Last Name"
            name="last_name"
            value={formData.last_name}
            onChange={handleChange}
            fullWidth
            margin="normal"
            required
          />
          <Button
            variant="contained"
            component="label"
            sx={{ mt: 2 }}
          >
            Upload Profile Picture
            <input
              type="file"
              hidden
              accept="image/*"
              onChange={handleFileChange}
            />
          </Button>
          {formData.profile_picture && (
            <Typography variant="body2" mt={1}>
              {formData.profile_picture.name}
            </Typography>
          )}
          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            sx={{ mt: 3 }}
          >
            Register
          </Button>
        </form>
      </Grid>
    </Grid>
  );
};

export default UserRegistrationForm;
