const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Email configuration - UPDATE THESE!
const EMAIL_CONFIG = {
    service: 'gmail',
    auth: {
        user: 'yoavshapira@gmail.com', // CHANGE THIS
        pass: 'Z+!9]q$vud+X-p~N'     // CHANGE THIS
    }
};

const RECIPIENT_EMAIL = 'yoavshapira4321@gmail.com'; // Where to send results

// Data file
const dataFile = path.join(__dirname, 'survey-responses.json');

// Ensure data file exists
if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, '[]');
}

// Read survey data
function readSurveyData() {
    try {
        const data = fs.readFileSync(dataFile, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
}

// Save survey data
function saveSurveyData(data) {
    try {
        fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Save error:', error);
        return false;
    }
}

// Send email function
async function sendSurveyEmail(surveyData) {
    try {
        const transporter = nodemailer.createTransporter(EMAIL_CONFIG);
        
        const emailText = `
ATTACHMENT STYLE SURVEY RESULTS

Response ID: ${surveyData.responseId}
Completed: ${new Date(surveyData.timestamp).toLocaleString()}

SCORES:
- Anxious (A): ${surveyData.categoryScores.A}
- Secure (B): ${surveyData.categoryScores.B}  
- Avoidant (C): ${surveyData.categoryScores.C}

Dominant Style: ${surveyData.dominantCategory}

Summary:
- Total Questions: ${surveyData.totalQuestions}
- Yes Answers: ${surveyData.totalYes}
- No Answers: ${surveyData.totalNo}
        `.trim();

        const mailOptions = {
            from: EMAIL_CONFIG.auth.user,
            to: RECIPIENT_EMAIL,
            subject: `Survey Results - ${surveyData.responseId}`,
            text: emailText
        };

        const result = await transporter.sendMail(mailOptions);
        console.log('✅ Email sent:', result.messageId);
        return true;
    } catch (error) {
        console.error('❌ Email failed:', error);
        return false;
    }
}

// Routes
app.post('/api/survey', async (req, res) => {
    try {
        console.log('📝 Received survey submission');
        
        const surveyData = {
            responseId: 'resp_' + Date.now(),
            timestamp: new Date().toISOString(),
            ...req.body
        };

        // 1. Save to JSON file
        const allData = readSurveyData();
        allData.push(surveyData);
        const saved = saveSurveyData(allData);
        
        if (!saved) {
            throw new Error('Failed to save data');
        }

        console.log('💾 Saved to file:', surveyData.responseId);

        // 2. Send email
        const emailSent = await sendSurveyEmail(surveyData);
        
        res.json({
            success: true,
            responseId: surveyData.responseId,
            savedToFile: saved,
            emailSent: emailSent,
            totalResponses: allData.length
        });

    } catch (error) {
        console.error('❌ Server error:', error);
        res.status(500).json({
            success: false,
            error: 'Submission failed'
        });
    }
});

// Get all responses
app.get('/api/responses', (req, res) => {
    try {
        const data = readSurveyData();
        res.json({
            success: true,
            count: data.length,
            data: data
        });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to load data' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        responses: readSurveyData().length 
    });
});

// Start server
app.listen(PORT, () => {
    console.log('🚀 Survey server started on port', PORT);
});