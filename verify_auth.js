const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:5001/api/auth';

async function testAuth() {
    try {
        const timestamp = Date.now();
        const username = `testuser_${timestamp}`;
        const email = `test_${timestamp}@example.com`;
        const phoneNumber = `+1555${timestamp.toString().slice(-7)}`;
        const password = 'password123';

        // 1. Register a new user with phone number
        console.log('Testing Registration with Phone Number...');
        const registerRes = await fetch(`${BASE_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username,
                email,
                password,
                phoneNumber
            })
        });

        const registerText = await registerRes.text();
        let registerData;
        try {
            registerData = JSON.parse(registerText);
        } catch (e) {
            console.error('Failed to parse JSON. Raw response:', registerText);
            return;
        }
        console.log('Registration Response:', registerRes.status, registerData);

        if (registerRes.status !== 201) {
            console.error('Registration failed');
            return;
        }

        // 2. Login with Email
        console.log('\nTesting Login with Email...');
        const loginEmailRes = await fetch(`${BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                password
            })
        });
        const loginEmailData = await loginEmailRes.json();
        console.log('Login (Email) Response:', loginEmailRes.status, loginEmailData);

        if (loginEmailRes.status !== 200) {
            console.error('Login with Email failed');
        }

        // 3. Login with Phone Number
        console.log('\nTesting Login with Phone Number...');
        const loginPhoneRes = await fetch(`${BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phoneNumber,
                password
            })
        });
        const loginPhoneData = await loginPhoneRes.json();
        console.log('Login (Phone) Response:', loginPhoneRes.status, loginPhoneData);

        if (loginPhoneRes.status === 200 && loginPhoneData.token) {
            console.log('\nSUCCESS: Authentication flow with Phone Number verified!');
        } else {
            console.error('\nFAILURE: Login with Phone Number failed');
        }

    } catch (error) {
        console.error('Test failed:', error);
    }
}

testAuth();
