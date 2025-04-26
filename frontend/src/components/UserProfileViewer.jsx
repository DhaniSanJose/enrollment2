// src/components/UserProfileViewer.jsx
import React, { useState } from 'react';
import { TextField, Button, Grid, Typography, Box } from '@mui/material';
import axios from 'axios';

const UserProfileViewer = () => {
  const [personId, setPersonId] = useState('');
  const [profilePicture, setProfilePicture] = useState(null);
  const [error, setError] = useState('');

  const handleSearch = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/user/${personId}`);
      if (res.data && res.data.profile_picture) {
        setProfilePicture(`http://localhost:5000/uploads/${res.data.profile_picture}`);
        setError('');
      } else {
        setProfilePicture(null);
        setError('Profile picture not found.');
      }
    } catch (err) {
      console.error(err);
      setProfilePicture(null);
      setError('User not found.');
    }
  };

  return (
    <Grid container spacing={2} justifyContent="center" mt={4}>
      <Grid item xs={12} md={6}>
        <Typography variant="h4" mb={2}>View User Profile Picture</Typography>
        <TextField
          label="Person ID"
          value={personId}
          onChange={(e) => setPersonId(e.target.value)}
          fullWidth
          margin="normal"
        />
        <Button
          variant="contained"
          color="primary"
          onClick={handleSearch}
          fullWidth
          sx={{ mt: 2 }}
        >
          Search
        </Button>

        {error && (
          <Typography color="error" mt={2}>
            {error}
          </Typography>
        )}

        {profilePicture && (
          <Box
            mt={4}
            display="flex"
            justifyContent="center"
            alignItems="center"
          >
            <img
              src={profilePicture}
              alt="Profile"
              style={{ width: 300, height: 300, objectFit: 'cover', borderRadius: '8px', border: '2px solid #ccc' }}
            />
          </Box>
        )}
      </Grid>
    </Grid>
  );
};

export default UserProfileViewer;
