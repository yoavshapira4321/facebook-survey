const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Basic middleware first
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static files
app.use(express.static('public'));

// Railway-compatible data directory
const getDataDir = () => {
    // Use /tmp on Railway, ./data locally
    if (process.env.NODE_ENV === 'production' || process.env.RAILWAY_STATIC_URL) {
        return path.join('/tmp', 'survey-data');
    }
    return path.join(__dirname, 'data');
};

const dataDir = getDataDir();
const dataFile = path.join(dataDir, 'survey-responses.json');
const emailFile = path.join(dataDir, 'email-records.json');

// Ensure data directory exists
const initializeDataDirectory = () => {
    try {
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
            console.log('✅ Created data directory:', dataDir);
        }
        
        // Initialize data files
        if (!fs.existsSync(dataFile)) {
            fs.writeFileSync(dataFile, JSON.stringify([]));
            console.log('✅ Created survey responses file');
        }
        
        if (!fs.existsSync(emailFile)) {
            fs.writeFileSync(emailFile, JSON.stringify([]));
            console.log('✅ Created email records file');
        }
        
        return true;
    } catch (error) {
        console.error('❌ Failed to initialize data directory:', error);
        return false;
    }
};

// Helper functions with better error handling
const readSurveyData = () => {
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
};

const writeSurveyData = (data) => {
    try {
        fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing survey data:', error);
        return false;
    }
};

const readEmailRecords = () => {
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
};

const writeEmailRecords = (data) => {
    try {
        fs.writeFileSync(emailFile, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing email records:', error);
        return false;
    }
};

// Initialize data directory on startup
if (!initializeDataDirectory()) {
    console.log('⚠️  Using in-memory storage only');
}

// Health check endpoint - simple and first
app.get('/api/health', (req, res) => {
    try {
        const data = readSurveyData();
        res.json({
            status: 'OK',
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development',
            dataDirectory: dataDir,
            responses: data.length,
            railway: !!process.env.RAILWAY_STATIC_URL
        });
    } catch (error) {
        res.status(500).json({
            status: 'ERROR',
            error: error.message
        });
    }
});

// Submit survey response
app.post('/api/survey', (req, res) => {
    try {
        console.log('📝 Received survey submission');
        
        const { answers, categoryScores, totalScoreA, totalScoreB, totalScoreC, dominantCategory, totalYes, totalNo } = req.body;
        
        if (!answers || Object.keys(answers).length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No survey answers received'
            });
        }

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

        console.log('✅ Processed response for:', responseData.dominantCategory);

        const existingData = readSurveyData();
        existingData.push(responseData);
        
        if (!writeSurveyData(existingData)) {
            throw new Error('Failed to save data');
        }

        res.json({
            success: true,
            message: 'Survey response saved successfully',
            responseId: responseData.id,
            timestamp: responseData.timestamp,
            totalResponses: existingData.length
        });

    } catch (error) {
        console.error('❌ Error saving survey:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

// Get all responses
app.get('/api/responses', (req, res) => {
    try {
        const data = readSurveyData();
        res.json({
            success: true,
            data: data,
            count: data.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to load responses'
        });
    }
});

// Get statistics
app.get('/api/stats', (req, res) => {
    try {
        const data = readSurveyData();
        const stats = {
            totalResponses: data.length,
            averageScores: { A: 0, B: 0, C: 0 },
            dominantCategories: { A: 0, B: 0, C: 0, Tie: 0, Unknown: 0 }
        };
        
        if (data.length > 0) {
            stats.averageScores.A = (data.reduce((sum, resp) => sum + (resp.totalScoreA || 0), 0) / data.length).toFixed(2);
            stats.averageScores.B = (data.reduce((sum, resp) => sum + (resp.totalScoreB || 0), 0) / data.length).toFixed(2);
            stats.averageScores.C = (data.reduce((sum, resp) => sum + (resp.totalScoreC || 0), 0) / data.length).toFixed(2);
            
            data.forEach(response => {
                const category = response.dominantCategory || 'Unknown';
                stats.dominantCategories[category] = (stats.dominantCategories[category] || 0) + 1;
            });
        }
        
        res.json({ success: true, stats: stats });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to calculate stats' });
    }
});

// Download CSV
app.get('/api/responses/csv', (req, res) => {
    try {
        const data = readSurveyData();
        if (data.length === 0) {
            return res.status(404).json({ error: 'No data available' });
        }
        
        const headers = ['ID', 'Timestamp', 'Score A', 'Score B', 'Score C', 'Dominant Category'];
        let csv = headers.join(',') + '\n';
        
        data.forEach(item => {
            const row = [
                `"${item.id}"`,
                `"${item.timestamp}"`,
                item.totalScoreA || 0,
                item.totalScoreB || 0,
                item.totalScoreC || 0,
                `"${item.dominantCategory}"`
            ];
            csv += row.join(',') + '\n';
        });
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=survey-${Date.now()}.csv`);
        res.send(csv);
        
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate CSV' });
    }
});

// Email endpoint
app.post('/api/send-email', (req, res) => {
    try {
        const { toEmail, subject, results } = req.body;
        
        console.log('📧 Email requested for:', results.responseId);
        
        // Simulate email sending
        setTimeout(() => {
            const emailRecords = readEmailRecords();
            const emailRecord = {
                id: 'email_' + Date.now(),
                toEmail: toEmail,
                subject: subject,
                responseId: results.responseId,
                sentAt: new Date().toISOString(),
                status: 'simulated'
            };
            
            emailRecords.push(emailRecord);
            writeEmailRecords(emailRecords);
            
            res.json({
                success: true,
                message: 'Email simulated successfully',
                emailId: emailRecord.id
            });
        }, 500);
        
    } catch (error) {
        res.status(500).json({ success: false, error: 'Email failed' });
    }
});

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Catch-all for SPA routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log('=== SERVER STARTED ===');
    console.log(`🚀 Port: ${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`💾 Data dir: ${dataDir}`);
    console.log(`📊 Responses: ${readSurveyData().length}`);
    console.log('✅ Server is ready');
});