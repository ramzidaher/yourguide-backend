const axios = require('axios');
require('dotenv').config();

async function testChatGPT() {
    try {
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-3.5-turbo',
                messages: [
                    { role: 'user', content: 'Hello' }
                ],
                max_tokens: 50
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('ChatGPT response:', response.data.choices[0].message.content);
    } catch (error) {
        console.error('Error calling ChatGPT API:',
            error.response?.data || error.message
        );
    }
}

// Run the test
testChatGPT();
