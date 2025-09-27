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

// Submit survey response
app.post('/api/survey', (req, res) => {
    try {
        console.log('Received survey submission');
        
        const { satisfaction, recommend, improvements, platforms } = req.body;
        
        // Validation
        if (!satisfaction || !recommend) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: satisfaction and recommend are required'
            });
        }

        // Create response object
        const responseData = {
            id: 'resp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            timestamp: new Date().toISOString(),
            satisfaction: parseInt(satisfaction),
            recommend: parseInt(recommend),
            improvements: improvements || '',
            platforms: platforms || [],
            userAgent: req.body.userAgent || req.get('User-Agent'),
            ip: req.ip || req.connection.remoteAddress,
            referrer: req.body.referrer || '',
            pageUrl: req.body.pageUrl || ''
        };

        console.log('Processed response:', responseData);

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
            totalResponses: existingData.length
        });

    } catch (error) {
        console.error('Error saving survey response:', error);
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
            averageSatisfaction: 0,
            averageRecommendation: 0,
            platforms: {},
            recentSubmissions: data.slice(-10).reverse() // Last 10 submissions
        };
        
        if (data.length > 0) {
            // Calculate averages
            stats.averageSatisfaction = (data.reduce((sum, resp) => sum + resp.satisfaction, 0) / data.length).toFixed(2);
            stats.averageRecommendation = (data.reduce((sum, resp) => sum + resp.recommend, 0) / data.length).toFixed(2);
            
            // Platform usage
            data.forEach(response => {
                if (response.platforms) {
                    const platforms = Array.isArray(response.platforms) ? response.platforms : [response.platforms];
                    platforms.forEach(platform => {
                        stats.platforms[platform] = (stats.platforms[platform] || 0) + 1;
                    });
                }
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
        res.setHeader('Content-Disposition', `attachment; filename=survey-responses-${Date.now()}.csv`);
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

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// CSV conversion helper
function convertToCSV(objArray) {
    if (objArray.length === 0) return 'No data available';
    
    const headers = ['ID', 'Timestamp', 'Satisfaction', 'Recommendation', 'Improvements', 'Platforms', 'IP Address'];
    let csv = headers.join(',') + '\n';
    
    objArray.forEach(item => {
        const row = [
            `"${item.id || ''}"`,
            `"${item.timestamp || ''}"`,
            item.satisfaction || '',
            item.recommend || '',
            `"${(item.improvements || '').replace(/"/g, '""')}"`,
            `"${(Array.isArray(item.platforms) ? item.platforms.join('; ') : item.platforms || '').replace(/"/g, '""')}"`,
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

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Survey server running on port ${PORT}`);
    console.log(`📊 Access the survey at: http://localhost:${PORT}`);
    console.log(`🔧 API health check: http://localhost:${PORT}/api/health`);
    console.log(`📈 View stats: http://localhost:${PORT}/api/stats`);
    
    // Test data file
    const data = readSurveyData();
    console.log(`💾 Loaded ${data.length} existing survey responses`);
});

// Add this to your server.js routes

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

// Add this to your server.js routes

// Send email with results
app.post('/api/send-email', (req, res) => {
    try {
        const { toEmail, subject, results, timestamp } = req.body;
        
        // In a real implementation, you would integrate with an email service like:
        // - Nodemailer (for Gmail, SMTP)
        // - SendGrid API
        // - Mailgun API
        // - AWS SES
        
        // For now, we'll simulate email sending and log the details
        console.log('=== EMAIL SENDING REQUEST ===');
        console.log('To:', toEmail);
        console.log('Subject:', subject);
        console.log('Results:', JSON.stringify(results, null, 2));
        console.log('Timestamp:', timestamp);
        console.log('=============================');
        
        // Simulate email processing delay
        setTimeout(() => {
            // Save email record to your data file
            const emailRecord = {
                id: 'email_' + Date.now(),
                toEmail: toEmail,
                subject: subject,
                results: results,
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