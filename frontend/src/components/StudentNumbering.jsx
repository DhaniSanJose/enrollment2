// import React, { useState, useEffect } from "react";
// import axios from "axios";

// const StudentNumbering = () => {
//   const [persons, setPersons] = useState([]);
//   const [selectedPerson, setSelectedPerson] = useState(null);
//   const [assignedNumber, setAssignedNumber] = useState("");
//   const [error, setError] = useState("");
//   const [curriculums, setCurriculums] = useState([]);
//   const [selectedCode, setSelectedCode] = useState("");

//   useEffect(() => {
//     fetchPersons();
//   }, []);

//   const fetchPersons = async () => {
//     try {
//       const res = await axios.get("http://localhost:5000/api/persons");
//       setPersons(res.data);
//     } catch (err) {
//       console.error(err);
//     }
//   };

//   const handlePersonClick = (person) => {
//     setSelectedPerson(person);
//     setAssignedNumber("");
//     setError("");
//   };

//   const handleAssignNumber = async () => {
//     if (!selectedPerson || !selectedCode) return; // make sure both are selected
//     try {
//       const res = await axios.post("http://localhost:5000/api/assign-student-number", {
//         person_id: selectedPerson.person_id,
//         curriculum_id: selectedCode, // include curriculum_id
//       });
//       setAssignedNumber(res.data.student_number);
//       setError("");
//       await fetchPersons(); // Reload the person list
//       setSelectedPerson(null); // Clear selection
//     } catch (err) {
//       if (err.response && err.response.data) {
//         setError(err.response.data);
//       } else {
//         setError("An error occurred.");
//       }
//     }
//   };

//   useEffect(() => {
//     // Fetch curriculum data from your API
//     axios
//       .get("http://localhost:5000/api/curriculum") // <-- Change to your actual endpoint
//       .then((response) => {
//         setCurriculums(response.data);
//       })
//       .catch((error) => {
//         console.error("Error fetching curriculum data:", error);
//       });
//   }, []);

//   const handleChange = (e) => {
//     setSelectedCode(e.target.value);
//     console.log("Selected curriculum_code:", e.target.value);
//   };

//   return (
//     <div style={{ padding: "20px" }}>
//       <div>
//         <label htmlFor="curriculum-select">Select Curriculum:</label>
//         <select id="curriculum-select" value={selectedCode} onChange={handleChange}>
//           <option value="">-- Select --</option>
//           {curriculums.map((item, index) => (
//             <option key={index} value={item.curriculum_id}>
//               {item.year_description}-{item.course_code}
//             </option>
//           ))}
//         </select>
//       </div>
//       <h1>Assign Student Number</h1>
//       <div style={{ display: "flex", gap: "20px" }}>
//         <div style={{ flex: 1 }}>
//           <h2 className="">Person List</h2>
//           {persons.length === 0 && <p>No available persons.</p>}
//           <ul className="">
//             {persons.map((person, index) => (
//               <li key={person.person_id} className="p-2 border-[2px] mt-2 w-[20rem] cursor-pointer text-maroon-500 rounded border-maroon-500">
//                 <button onClick={() => handlePersonClick(person)}>
//                   {index + 1}. {person.first_name} {person.middle_name} {person.last_name}
//                 </button>
//                 <p>{person.email}</p>
//               </li>
//             ))}
//           </ul>
//         </div>
//         <div style={{ flex: 1 }}>
//           <h2>Selected Person</h2>
//           {selectedPerson ? (
//             <div>
//               <p>
//                 <strong>Name:</strong> {selectedPerson.first_name} {selectedPerson.middle_name} {selectedPerson.last_name}
//               </p>
//               <button onClick={handleAssignNumber} className="p-2 px-4 border-[2px] mt-2 rounded border-maroon-500 text-maroon-500" disabled={!selectedCode}>
//                 Assign Student Number
//               </button>
//             </div>
//           ) : (
//             <p>No person selected.</p>
//           )}
//           {assignedNumber && (
//             <p>
//               <strong>Assigned Student Number:</strong> {assignedNumber}
//             </p>
//           )}
//           {error && <p style={{ color: "red" }}>{error}</p>}
//         </div>
//       </div>
//     </div>
//   );
// };

// export default StudentNumbering;

import React, { useState, useEffect } from "react";
import axios from "axios";

const StudentNumbering = () => {
  const [persons, setPersons] = useState([]);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [assignedNumber, setAssignedNumber] = useState("");
  const [error, setError] = useState("");
  const [curriculums, setCurriculums] = useState([]);
  const [selectedCode, setSelectedCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchPersons();
  }, []);

  const fetchPersons = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/persons");
      setPersons(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePersonClick = (person) => {
    setSelectedPerson(person);
    setAssignedNumber("");
    setError("");
  };

  const handleAssignNumber = async () => {
    if (!selectedPerson || !selectedCode) return;

    setIsLoading(true);
    setError("");
    setAssignedNumber("");

    try {
      const res = await axios.post("http://localhost:5000/api/assign-student-number", {
        person_id: selectedPerson.person_id,
        curriculum_id: selectedCode,
      });

      setAssignedNumber(res.data.student_number);
      await fetchPersons();
      setSelectedPerson(null);
    } catch (err) {
      if (err.response && err.response.data) {
        setError(err.response.data);
      } else {
        setError("An error occurred.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    axios
      .get("http://localhost:5000/api/curriculum")
      .then((response) => {
        setCurriculums(response.data);
      })
      .catch((error) => {
        console.error("Error fetching curriculum data:", error);
      });
  }, []);

  const handleChange = (e) => {
    setSelectedCode(e.target.value);
  };

  return (
    <div style={{ padding: "20px" }}>
      <div>
        <label htmlFor="curriculum-select">Select Curriculum:</label>
        <select id="curriculum-select" value={selectedCode} onChange={handleChange} disabled={isLoading}>
          <option value="">-- Select --</option>
          {curriculums.map((item, index) => (
            <option key={index} value={item.curriculum_id}>
              {item.year_description}-{item.course_code}
            </option>
          ))}
        </select>
      </div>

      <h1>Assign Student Number</h1>

      <div style={{ display: "flex", gap: "20px" }}>
        <div style={{ flex: 1 }}>
          <h2>Person List</h2>
          {persons.length === 0 && <p>No available persons.</p>}
          <ul>
            {persons.map((person, index) => (
              <li key={person.person_id} onClick={() => handlePersonClick(person)} className={`p-2 border-[2px] mt-2 w-[20rem] cursor-pointer rounded ${selectedPerson?.person_id === person.person_id ? "bg-maroon-100 border-maroon-700 text-maroon-700" : "text-maroon-500 border-maroon-500"}`}>
                <strong>
                  {index + 1}. {person.first_name} {person.middle_name} {person.last_name}
                </strong>
                <p>{person.email}</p>
              </li>
            ))}
          </ul>
        </div>

        <div style={{ flex: 1 }}>
          <h2>Selected Person</h2>
          {selectedPerson ? (
            <div>
              <p>
                <strong>Name:</strong> {selectedPerson.first_name} {selectedPerson.middle_name} {selectedPerson.last_name}
              </p>
              <button onClick={handleAssignNumber} className="p-2 px-4 border-[2px] mt-2 rounded border-maroon-500 text-maroon-500" disabled={!selectedCode || isLoading}>
                {isLoading ? "Assigning..." : "Assign Student Number"}
              </button>
            </div>
          ) : (
            <p>No person selected.</p>
          )}

          {assignedNumber && (
            <p style={{ color: "green", marginTop: "10px" }}>
              <strong>✅ Assigned Student Number:</strong> {assignedNumber}
            </p>
          )}
          {error && <p style={{ color: "red", marginTop: "10px" }}>{error}</p>}
        </div>
      </div>
    </div>
  );
};

export default StudentNumbering;
