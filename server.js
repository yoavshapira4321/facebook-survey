const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

const nodemailer = require('nodemailer');

// Email configuration
function createTransporter() {
    return nodemailer.createTransporter({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
}

// Email sending endpoint
app.post('/api/send-email', async (req, res) => {
    try {
        const { results, responseId } = req.body;
        
        console.log('Attempting to send email for:', responseId);
        
        // Check if email credentials are available
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            console.log('Email credentials not set');
            return res.json({
                success: false,
                error: 'Email service not configured'
            });
        }

        const transporter = createTransporter();
        
        // Verify connection
        await transporter.verify();
        console.log('Email connection verified');

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_TO || process.env.EMAIL_USER,
            subject: `Attachment Style Results - ${responseId}`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>Attachment Style Assessment Results</h2>
                    <div style="background: #f5f5f5; padding: 15px; border-radius: 5px;">
                        <p><strong>Response ID:</strong> ${responseId}</p>
                        <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
                    </div>
                    <h3>Your Scores:</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin: 15px 0;">
                        <div style="text-align: center; padding: 10px; background: #e74c3c; color: white; border-radius: 5px;">
                            <div style="font-size: 24px; font-weight: bold;">${results.categoryScores?.A || 0}</div>
                            <div>Anxious (A)</div>
                        </div>
                        <div style="text-align: center; padding: 10px; background: #27ae60; color: white; border-radius: 5px;">
                            <div style="font-size: 24px; font-weight: bold;">${results.categoryScores?.B || 0}</div>
                            <div>Secure (B)</div>
                        </div>
                        <div style="text-align: center; padding: 10px; background: #3498db; color: white; border-radius: 5px;">
                            <div style="font-size: 24px; font-weight: bold;">${results.categoryScores?.C || 0}</div>
                            <div>Avoidant (C)</div>
                        </div>
                    </div>
                    <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0;">
                        <strong>Dominant Style:</strong> ${results.dominantCategory || 'Unknown'}
                    </div>
                    <p>This assessment was completed via the Attachment Style Assessment tool.</p>
                </div>
            `
        };

        const result = await transporter.sendMail(mailOptions);
        console.log('Email sent successfully:', result.messageId);
        
        res.json({
            success: true,
            message: 'Email sent successfully',
            messageId: result.messageId
        });

    } catch (error) {
        console.error('Email sending failed:', error);
        res.json({
            success: false,
            error: error.message
        });
    }
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

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

// Routes

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        dataFile: dataFile,
        responses: readSurveyData().length
    });
});

// Submit survey response - UPDATED FOR NEW SURVEY FORMAT
app.post('/api/survey', (req, res) => {
    try {
        console.log('Received survey submission');
        
        // NEW: Accept the new survey format with categories
        const { answers, categoryScores, totalScoreA, totalScoreB, totalScoreC, dominantCategory, totalYes, totalNo } = req.body;
        
        // NEW VALIDATION: Check if we have answers
        if (!answers || Object.keys(answers).length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No survey answers received'
            });
        }

        // Create response object - UPDATED FOR NEW FORMAT
        const responseData = {
            id: 'resp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            timestamp: new Date().toISOString(),
            // New attachment style survey data
            answers: answers,
            categoryScores: categoryScores || { A: 0, B: 0, C: 0 },
            totalScoreA: totalScoreA || 0,
            totalScoreB: totalScoreB || 0,
            totalScoreC: totalScoreC || 0,
            dominantCategory: dominantCategory || 'Unknown',
            totalYes: totalYes || 0,
            totalNo: totalNo || 0,
            totalQuestions: Object.keys(answers).length,
            // Technical info
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

        res.json({
            success: true,
            message: 'Survey response saved successfully',
            responseId: responseData.id,
            timestamp: responseData.timestamp,
            totalResponses: existingData.length,
            scores: responseData.categoryScores,
            dominantCategory: responseData.dominantCategory
        });

    } catch (error) {
        console.error('Error saving survey response:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error: ' + error.message
        });
    }
});

// Get all survey responses (for admin) - UPDATED
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

// Get survey statistics - UPDATED FOR NEW FORMAT
app.get('/api/stats', (req, res) => {
    try {
        const data = readSurveyData();
        
        const stats = {
            totalResponses: data.length,
            averageScores: { A: 0, B: 0, C: 0 },
            dominantCategories: { A: 0, B: 0, C: 0, Tie: 0, Unknown: 0 },
            recentSubmissions: data.slice(-10).reverse()
        };
        
        if (data.length > 0) {
            // Calculate average scores for each category
            const totalA = data.reduce((sum, resp) => sum + (resp.totalScoreA || 0), 0);
            const totalB = data.reduce((sum, resp) => sum + (resp.totalScoreB || 0), 0);
            const totalC = data.reduce((sum, resp) => sum + (resp.totalScoreC || 0), 0);
            
            stats.averageScores.A = (totalA / data.length).toFixed(2);
            stats.averageScores.B = (totalB / data.length).toFixed(2);
            stats.averageScores.C = (totalC / data.length).toFixed(2);
            
            // Count dominant categories
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

// Download responses as CSV - UPDATED FOR NEW FORMAT
app.get('/api/responses/csv', (req, res) => {
    try {
        const data = readSurveyData();
        
        if (data.length === 0) {
            return res.status(404).json({ error: 'No data available' });
        }
        
        const csv = convertToCSV(data);
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=attachment-survey-responses-${Date.now()}.csv`);
        res.send(csv);
        
    } catch (error) {
        console.error('Error generating CSV:', error);
        res.status(500).json({ error: 'Failed to generate CSV' });
    }
});

// CSV conversion helper - UPDATED FOR NEW FORMAT
function convertToCSV(objArray) {
    if (objArray.length === 0) return 'No data available';
    
    const headers = ['ID', 'Timestamp', 'Score A', 'Score B', 'Score C', 'Dominant Category', 'Total Yes', 'Total No', 'Total Questions', 'IP Address'];
    let csv = headers.join(',') + '\n';
    
    objArray.forEach(item => {
        const row = [
            `"${item.id || ''}"`,
            `"${item.timestamp || ''}"`,
            item.totalScoreA || 0,
            item.totalScoreB || 0,
            item.totalScoreC || 0,
            `"${item.dominantCategory || 'Unknown'}"`,
            item.totalYes || 0,
            item.totalNo || 0,
            item.totalQuestions || 0,
            `"${item.ip || ''}"`
        ];
        csv += row.join(',') + '\n';
    });
    
    return csv;
}

// Delete all responses (admin only)
app.delete('/api/responses', (req, res) => {
    try {
        const { confirm } = req.body;
        
        if (confirm !== 'YES_DELETE_ALL') {
            return res.status(400).json({
                success: false,
                error: 'Confirmation required. Send confirm: "YES_DELETE_ALL" in request body'
            });
        }
        
        const success = writeSurveyData([]);
        
        if (success) {
            res.json({
                success: true,
                message: 'All responses deleted successfully'
            });
        } else {
            throw new Error('Failed to clear data file');
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to delete responses'
        });
    }
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Save Facebook address
app.post('/api/survey/facebook', (req, res) => {
    try {
        const { responseId, facebookAddress, categoryScores, dominantCategory } = req.body;
        
        // Read existing data
        const data = readSurveyData();
        
        // Find the response and update it
        const responseIndex = data.findIndex(response => response.id === responseId);
        if (responseIndex !== -1) {
            data[responseIndex].facebookAddress = facebookAddress;
            data[responseIndex].facebookSubmittedAt = new Date().toISOString();
            
            // Save updated data
            writeSurveyData(data);
            
            console.log(`Facebook address saved for response ${responseId}: ${facebookAddress}`);
            
            res.json({
                success: true,
                message: 'Facebook address saved successfully'
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Response not found'
            });
        }
        
    } catch (error) {
        console.error('Error saving Facebook address:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save Facebook address'
        });
    }
});

// Send email with results
app.post('/api/send-email', (req, res) => {
    try {
        const { toEmail, subject, results, timestamp } = req.body;
        
        console.log('=== ATTACHMENT SURVEY EMAIL REQUEST ===');
        console.log('To:', toEmail);
        console.log('Subject:', subject);
        console.log('Response ID:', results.responseId);
        console.log('Dominant Category:', results.dominantCategory);
        console.log('Scores - A:', results.categoryScores?.A, 'B:', results.categoryScores?.B, 'C:', results.categoryScores?.C);
        console.log('Total Questions:', results.totalQuestions);
        console.log('========================================');
        
        // Simulate email processing delay
        setTimeout(() => {
            // Save email record to your data file
            const emailRecord = {
                id: 'email_' + Date.now(),
                toEmail: toEmail,
                subject: subject,
                responseId: results.responseId,
                dominantCategory: results.dominantCategory,
                scores: results.categoryScores,
                totalQuestions: results.totalQuestions,
                sentAt: new Date().toISOString(),
                status: 'sent'
            };
            
            // Save to emails file (create if doesn't exist)
            const emailFile = path.join(__dirname, 'data', 'email-records.json');
            let emailRecords = [];
            
            if (fs.existsSync(emailFile)) {
                emailRecords = JSON.parse(fs.readFileSync(emailFile, 'utf8'));
            }
            
            emailRecords.push(emailRecord);
            fs.writeFileSync(emailFile, JSON.stringify(emailRecords, null, 2));
            
            res.json({
                success: true,
                message: 'Email sent successfully',
                emailId: emailRecord.id,
                timestamp: emailRecord.sentAt
            });
            
        }, 1000);
        
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send email'
        });
    }
});

// Get email sending history (admin endpoint)
app.get('/api/emails', (req, res) => {
    try {
        const emailFile = path.join(__dirname, 'data', 'email-records.json');
        
        if (fs.existsSync(emailFile)) {
            const emailRecords = JSON.parse(fs.readFileSync(emailFile, 'utf8'));
            res.json({
                success: true,
                count: emailRecords.length,
                emails: emailRecords
            });
        } else {
            res.json({
                success: true,
                count: 0,
                emails: []
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to load email records'
        });
    }
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
    
    // Test data file
    const data = readSurveyData();
    console.log(`💾 Loaded ${data.length} existing survey responses`);
});