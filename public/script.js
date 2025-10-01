const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('.')); // Serve from root directory

// Data file path
const dataDir = path.join(__dirname, 'data');
const dataFile = path.join(dataDir, 'survey-responses.json');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize data file if it doesn't exist
if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify([], null, 2));
    console.log('Created new survey responses file');
}

// Helper function to read survey data
function readSurveyData() {
    try {
        const data = fs.readFileSync(dataFile, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading survey data:', error);
        return [];
    }
}

// Helper function to write survey data
function writeSurveyData(data) {
    try {
        fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing survey data:', error);
        return false;
    }
}

// Email configuration (simplified - will use manual email for now)
const nodemailer = require('nodemailer');

function createTransporter() {
    // Only create transporter if email credentials are available
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.log('Email credentials not available - using manual email mode');
        return null;
    }
    
    return nodemailer.createTransporter({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
}

// Routes

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        dataFile: dataFile,
        responses: readSurveyData().length,
        emailConfigured: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS)
    });
});

// Submit survey response
app.post('/api/survey', async (req, res) => {
    try {
        console.log('Received survey submission');
        
        const { answers, categoryScores, totalScoreA, totalScoreB, totalScoreC, dominantCategory, totalYes, totalNo } = req.body;
        
        if (!answers || Object.keys(answers).length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No survey answers received'
            });
        }

        // Create response object
        const responseData = {
            id: 'resp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            timestamp: new Date().toISOString(),
            answers: answers,
            categoryScores: categoryScores || { A: 0, B: 0, C: 0 },
            totalScoreA: totalScoreA || 0,
            totalScoreB: totalScoreB || 0,
            totalScoreC: totalScoreC || 0,
            dominantCategory: dominantCategory || 'Unknown',
            totalYes: totalYes || 0,
            totalNo: totalNo || 0,
            totalQuestions: Object.keys(answers).length,
            userAgent: req.body.userAgent || req.get('User-Agent'),
            ip: req.ip || req.connection.remoteAddress,
            referrer: req.body.referrer || '',
            pageUrl: req.body.pageUrl || ''
        };

        console.log('Processed response:', {
            id: responseData.id,
            totalAnswers: Object.keys(answers).length,
            categoryScores: responseData.categoryScores,
            dominantCategory: responseData.dominantCategory
        });

        // Read existing data
        const existingData = readSurveyData();
        
        // Add new response
        existingData.push(responseData);
        
        // Save to file
        const writeSuccess = writeSurveyData(existingData);
        
        if (!writeSuccess) {
            throw new Error('Failed to save data to file');
        }

        // Try to send email automatically
        let emailResult = { success: false, error: 'Email not configured' };
        
        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            emailResult = await sendSurveyEmail(responseData);
        }

        res.json({
            success: true,
            message: 'Survey response saved successfully',
            responseId: responseData.id,
            timestamp: responseData.timestamp,
            totalResponses: existingData.length,
            scores: responseData.categoryScores,
            dominantCategory: responseData.dominantCategory,
            emailSent: emailResult.success,
            emailError: emailResult.error
        });

    } catch (error) {
        console.error('Error saving survey response:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error: ' + error.message
        });
    }
});

// Email sending function
async function sendSurveyEmail(surveyData) {
    try {
        const transporter = createTransporter();
        if (!transporter) {
            return { success: false, error: 'Email transporter not available' };
        }

        await transporter.verify();

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_TO || process.env.EMAIL_USER,
            subject: `📊 Attachment Style Results - ${surveyData.id}`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>Attachment Style Assessment Results</h2>
                    <div style="background: #f5f5f5; padding: 15px; border-radius: 5px;">
                        <p><strong>Response ID:</strong> ${surveyData.id}</p>
                        <p><strong>Date:</strong> ${new Date(surveyData.timestamp).toLocaleString()}</p>
                    </div>
                    <h3>Your Scores:</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin: 15px 0;">
                        <div style="text-align: center; padding: 10px; background: #e74c3c; color: white; border-radius: 5px;">
                            <div style="font-size: 24px; font-weight: bold;">${surveyData.categoryScores?.A || 0}</div>
                            <div>Anxious (A)</div>
                        </div>
                        <div style="text-align: center; padding: 10px; background: #27ae60; color: white; border-radius: 5px;">
                            <div style="font-size: 24px; font-weight: bold;">${surveyData.categoryScores?.B || 0}</div>
                            <div>Secure (B)</div>
                        </div>
                        <div style="text-align: center; padding: 10px; background: #3498db; color: white; border-radius: 5px;">
                            <div style="font-size: 24px; font-weight: bold;">${surveyData.categoryScores?.C || 0}</div>
                            <div>Avoidant (C)</div>
                        </div>
                    </div>
                    <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0;">
                        <strong>Dominant Style:</strong> ${surveyData.dominantCategory || 'Unknown'}
                    </div>
                    <p><strong>Summary:</strong> ${surveyData.totalYes || 0} Yes, ${surveyData.totalNo || 0} No out of ${surveyData.totalQuestions || 0} questions</p>
                    <p>This assessment was completed via the Attachment Style Assessment tool.</p>
                </div>
            `
        };

        const result = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', result.messageId);
        
        return { success: true, messageId: result.messageId };
        
    } catch (error) {
        console.error('Email sending failed:', error.message);
        return { success: false, error: error.message };
    }
}

// Get all survey responses (for admin)
app.get('/api/responses', (req, res) => {
    try {
        const data = readSurveyData();
        
        res.json({
            success: true,
            data: data,
            count: data.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error loading responses:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load responses'
        });
    }
});

// Get survey statistics
app.get('/api/stats', (req, res) => {
    try {
        const data = readSurveyData();
        
        const stats = {
            totalResponses: data.length,
            averageScores: { A: 0, B: 0, C: 0 },
            dominantCategories: { A: 0, B: 0, C: 0, Mixed: 0, Unknown: 0 },
            recentSubmissions: data.slice(-10).reverse()
        };
        
        if (data.length > 0) {
            const totalA = data.reduce((sum, resp) => sum + (resp.totalScoreA || 0), 0);
            const totalB = data.reduce((sum, resp) => sum + (resp.totalScoreB || 0), 0);
            const totalC = data.reduce((sum, resp) => sum + (resp.totalScoreC || 0), 0);
            
            stats.averageScores.A = (totalA / data.length).toFixed(2);
            stats.averageScores.B = (totalB / data.length).toFixed(2);
            stats.averageScores.C = (totalC / data.length).toFixed(2);
            
            data.forEach(response => {
                const category = response.dominantCategory || 'Unknown';
                stats.dominantCategories[category] = (stats.dominantCategories[category] || 0) + 1;
            });
        }
        
        res.json({
            success: true,
            stats: stats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to calculate statistics'
        });
    }
});

// Download responses as CSV
app.get('/api/responses/csv', (req, res) => {
    try {
        const data = readSurveyData();
        
        if (data.length === 0) {
            return res.status(404).json({ error: 'No data available' });
        }
        
        const headers = ['ID', 'Timestamp', 'Score A', 'Score B', 'Score C', 'Dominant Category', 'Total Yes', 'Total No', 'Total Questions'];
        let csv = headers.join(',') + '\n';
        
        data.forEach(item => {
            const row = [
                `"${item.id || ''}"`,
                `"${item.timestamp || ''}"`,
                item.totalScoreA || 0,
                item.totalScoreB || 0,
                item.totalScoreC || 0,
                `"${item.dominantCategory || 'Unknown'}"`,
                item.totalYes || 0,
                item.totalNo || 0,
                item.totalQuestions || 0
            ];
            csv += row.join(',') + '\n';
        });
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=attachment-survey-responses-${Date.now()}.csv`);
        res.send(csv);
        
    } catch (error) {
        console.error('Error generating CSV:', error);
        res.status(500).json({ error: 'Failed to generate CSV' });
    }
});

// Simple email sending endpoint (for manual trigger)
app.post('/api/send-email', async (req, res) => {
    try {
        const { results, responseId } = req.body;
        
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            return res.json({
                success: false,
                error: 'Email service not configured on server'
            });
        }

        const emailResult = await sendSurveyEmail({
            id: responseId,
            timestamp: new Date().toISOString(),
            ...results
        });

        res.json(emailResult);
        
    } catch (error) {
        console.error('Email sending failed:', error);
        res.json({
            success: false,
            error: error.message
        });
    }
});

// Email status endpoint (simple version)
app.get('/api/email-status/:responseId', (req, res) => {
    // For now, just return a simple status
    // In a real app, you'd track email sending status in a database
    res.json({
        success: true,
        emailStatus: {
            responseId: req.params.responseId,
            success: false,
            error: 'Email status tracking not implemented',
            timestamp: new Date().toISOString()
        }
    });
});

// Resend email endpoint
app.post('/api/resend-email', async (req, res) => {
    try {
        const { responseId } = req.body;
        
        // Find the original response
        const data = readSurveyData();
        const originalResponse = data.find(r => r.id === responseId);
        
        if (!originalResponse) {
            return res.status(404).json({
                success: false,
                error: 'Response not found'
            });
        }

        const emailResult = await sendSurveyEmail(originalResponse);

        res.json({
            success: true,
            emailResent: emailResult.success,
            messageId: emailResult.messageId
        });

    } catch (error) {
        console.error('Email resend error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to resend email'
        });
    }
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Attachment Survey server running on port ${PORT}`);
    console.log(`📊 Access the survey at: http://localhost:${PORT}`);
    console.log(`🔧 API health check: http://localhost:${PORT}/api/health`);
    console.log(`📈 View stats: http://localhost:${PORT}/api/stats`);
    console.log(`📧 Email configured: ${!(process.env.EMAIL_USER && process.env.EMAIL_PASS) ? 'NO - Using manual mode' : 'YES'}`);
    
    const data = readSurveyData();
    console.log(`💾 Loaded ${data.length} existing survey responses`);
});