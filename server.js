const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Railway-compatible data directory
const dataDir = process.env.NODE_ENV === 'production' 
    ? path.join('/tmp', 'survey-data')
    : path.join(__dirname, 'data');

const dataFile = path.join(dataDir, 'survey-responses.json');
const emailFile = path.join(dataDir, 'email-records.json');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('Created data directory:', dataDir);
}

// Initialize data files if they don't exist
if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify([], null, 2));
    console.log('Created new survey responses file');
}

if (!fs.existsSync(emailFile)) {
    fs.writeFileSync(emailFile, JSON.stringify([], null, 2));
    console.log('Created new email records file');
}

// Helper function to read survey data
function readSurveyData() {
    try {
        if (!fs.existsSync(dataFile)) {
            return [];
        }
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

// Helper function to read email records
function readEmailRecords() {
    try {
        if (!fs.existsSync(emailFile)) {
            return [];
        }
        const data = fs.readFileSync(emailFile, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading email records:', error);
        return [];
    }
}

// Helper function to write email records
function writeEmailRecords(data) {
    try {
        fs.writeFileSync(emailFile, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing email records:', error);
        return false;
    }
}

// Routes

// Health check endpoint
app.get('/api/health', (req, res) => {
    const data = readSurveyData();
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        dataDirectory: dataDir,
        dataFile: dataFile,
        responses: data.length,
        railway: !!process.env.RAILWAY_STATIC_URL
    });
});

// Submit survey response
app.post('/api/survey', (req, res) => {
    try {
        console.log('📝 Received survey submission');
        
        const { answers, categoryScores, totalScoreA, totalScoreB, totalScoreC, dominantCategory, totalYes, totalNo, responseId } = req.body;
        
        // Validation
        if (!answers || Object.keys(answers).length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No survey answers received'
            });
        }

        // Create response object
        const responseData = {
            id: responseId || 'resp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
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
            ip: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'],
            referrer: req.body.referrer || '',
            pageUrl: req.body.pageUrl || ''
        };

        console.log('✅ Processed response:', {
            id: responseData.id,
            answers: Object.keys(answers).length,
            scores: responseData.categoryScores,
            dominant: responseData.dominantCategory
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

        console.log('💾 Saved survey response to file');

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
        console.error('❌ Error saving survey response:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error: ' + error.message
        });
    }
});

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

// Download responses as CSV
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

// Send email with results
app.post('/api/send-email', (req, res) => {
    try {
        const { toEmail, subject, results, timestamp } = req.body;
        
        console.log('📧 Email sending request received');
        console.log('To:', toEmail);
        console.log('Subject:', subject);
        console.log('Response ID:', results.responseId);
        console.log('Dominant Category:', results.dominantCategory);
        
        // For Railway deployment, we simulate email sending
        // In production, you would integrate with SendGrid, Mailgun, etc.
        setTimeout(() => {
            try {
                // Save email record
                const emailRecords = readEmailRecords();
                
                const emailRecord = {
                    id: 'email_' + Date.now(),
                    toEmail: toEmail,
                    subject: subject,
                    responseId: results.responseId,
                    dominantCategory: results.dominantCategory,
                    scores: results.categoryScores,
                    totalQuestions: results.totalQuestions,
                    sentAt: new Date().toISOString(),
                    status: 'simulated_sent'
                };
                
                emailRecords.push(emailRecord);
                writeEmailRecords(emailRecords);
                
                console.log('✅ Email record saved:', emailRecord.id);
                
                res.json({
                    success: true,
                    message: 'Email sent successfully (simulated on Railway)',
                    emailId: emailRecord.id,
                    timestamp: emailRecord.sentAt,
                    note: 'On Railway, integrate with real email service like SendGrid for actual email delivery'
                });
                
            } catch (emailError) {
                console.error('Error saving email record:', emailError);
                res.json({
                    success: true,
                    message: 'Email simulated (record saving failed)',
                    note: 'Check logs for details'
                });
            }
        }, 1000);
        
    } catch (error) {
        console.error('Error in email endpoint:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process email request: ' + error.message
        });
    }
});

// Get email sending history (admin endpoint)
app.get('/api/emails', (req, res) => {
    try {
        const emailRecords = readEmailRecords();
        
        res.json({
            success: true,
            count: emailRecords.length,
            emails: emailRecords
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to load email records'
        });
    }
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

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve other static pages
app.get('*', (req, res) => {
    const filePath = path.join(__dirname, 'public', req.path);
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).json({
            success: false,
            error: 'Endpoint not found'
        });
    }
});

// CSV conversion helper
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

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'API endpoint not found'
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log('=== SERVER STARTED SUCCESSFULLY ===');
    console.log(`🚀 Survey server running on port ${PORT}`);
    console.log(`📊 Access the survey at: http://localhost:${PORT}`);
    console.log(`🔧 API health check: http://localhost:${PORT}/api/health`);
    console.log(`💾 Data directory: ${dataDir}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🚂 Railway detected: ${process.env.RAILWAY_STATIC_URL ? 'YES' : 'NO'}`);
    
    // Test data file
    const data = readSurveyData();
    const emails = readEmailRecords();
    console.log(`💾 Loaded ${data.length} survey responses`);
    console.log(`📧 Loaded ${emails.length} email records`);
    console.log('=== SERVER READY ===');
});