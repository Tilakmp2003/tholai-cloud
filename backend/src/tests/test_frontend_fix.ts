
import axios from 'axios';

const API_URL = 'http://localhost:4000';

async function testProjectCreation() {
  console.log('Testing Project Creation API with patched payload...');
  
  const payload = {
    name: `test-project-${Date.now()}`,
    description: 'A test project to verify the API fix',
    clientName: 'Internal' // This is the field we added
  };

  try {
    const response = await axios.post(`${API_URL}/api/projects`, payload);
    console.log('✅ Success! Status:', response.status);
    console.log('Response:', response.data);
  } catch (error: any) {
    console.error('❌ Failed!');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
    process.exit(1);
  }
}

testProjectCreation();
