const axios = require('axios');
const jwt = require('jsonwebtoken');

async function test() {
  const token = jwt.sign(
    { userId: 3, role: 'Mechanic' },
    'supersecret_development_key_123',
    { expiresIn: '24h' }
  );

  try {
    const res = await axios.post('http://localhost:5000/api/mechanic/live/go-online', 
      { availabilityState: 'ONLINE_IDLE' },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log('Success:', res.status, res.data);
  } catch (error) {
    console.error('Error:', error.response ? { status: error.response.status, data: error.response.data } : error.message);
  }
}
test();
