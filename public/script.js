let currentQuestion = 0;
const totalQuestions = document.querySelectorAll('.question').length;

// Backend configuration - will work relative to the same domain
const API_BASE_URL = window.location.origin; // Uses same domain as the frontend

function startSurvey() {
    document.getElementById('welcome-screen').classList.remove('active');
    document.getElementById('survey-form').classList.add('active');
    updateProgress();
}

function showQuestion(index) {
    document.querySelectorAll('.question').forEach(q => q.classList.remove('active'));
    document.querySelectorAll('.question')[index].classList.add('active');
    
    document.getElementById('prev-btn').disabled = index === 0;
    document.getElementById('next-btn').style.display = index === totalQuestions - 1 ? 'none' : 'block';
    document.getElementById('submit-btn').style.display = index === totalQuestions - 1 ? 'block' : 'none';
    
    updateProgress();
}

function nextQuestion() {
    if (currentQuestion < totalQuestions - 1) {
        currentQuestion++;
        showQuestion(currentQuestion);
    }
}

function previousQuestion() {
    if (currentQuestion > 0) {
        currentQuestion--;
        showQuestion(currentQuestion);
    }
}

function updateProgress() {
    const progress = ((currentQuestion + 1) / totalQuestions) * 100;
    if (!document.querySelector('.progress-bar')) {
        const progressBar = document.createElement('div');
        progressBar.className = 'progress-bar';
        progressBar.innerHTML = '<div class="progress"></div>';
        document.getElementById('survey-form').insertBefore(progressBar, document.getElementById('survey-form').firstChild);
    }
    document.querySelector('.progress').style.width = `${progress}%`;
}

// Enhanced form submission with Node.js backend integration
document.getElementById('survey-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // Show loading state
    const submitBtn = document.getElementById('submit-btn');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Submitting...';
    submitBtn.disabled = true;
    
    try {
        const formData = collectFormData();
        console.log('Submitting survey data:', formData);
        
        // Submit to backend
        const result = await submitToBackend(formData);
        
        if (result.success) {
            showThankYouScreen(result);
        } else {
            throw new Error(result.error || 'Submission failed');
        }
        
    } catch (error) {
        console.error('Submission error:', error);
        // Fallback to localStorage
        const formData = collectFormData();
        saveToLocalStorage(formData);
        showErrorScreen(error.message);
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
});

function collectFormData() {
    const formData = new FormData(document.getElementById('survey-form'));
    const data = {
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        referrer: document.referrer,
        pageUrl: window.location.href
    };
    
    // Convert FormData to object
    for (let [key, value] of formData.entries()) {
        if (data[key]) {
            if (!Array.isArray(data[key])) {
                data[key] = [data[key]];
            }
            data[key].push(value);
        } else {
            data[key] = value;
        }
    }
    
    // Handle checkbox groups properly
    if (data.platforms && !Array.isArray(data.platforms)) {
        data.platforms = [data.platforms];
    }
    
    return data;
}

async function submitToBackend(data) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/survey`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || `HTTP ${response.status}`);
        }
        
        return result;
        
    } catch (error) {
        console.error('Backend submission failed:', error);
        throw error;
    }
}

function saveToLocalStorage(data) {
    try {
        const existingData = JSON.parse(localStorage.getItem('surveyResponses') || '[]');
        data.localBackup = true;
        data.backupTimestamp = new Date().toISOString();
        data.backupId = 'backup_' + Date.now();
        existingData.push(data);
        localStorage.setItem('surveyResponses', JSON.stringify(existingData));
        console.log('Saved to localStorage as backup:', data);
        return true;
    } catch (error) {
        console.error('LocalStorage save failed:', error);
        return false;
    }
}

function showThankYouScreen(result) {
    document.getElementById('survey-form').classList.remove('active');
    document.getElementById('thank-you-screen').classList.add('active');
    
    // Update with backend response data
    const messageElement = document.getElementById('submission-message');
    const responseIdElement = document.getElementById('response-id');
    const statsElement = document.getElementById('response-stats');
    
    if (messageElement) {
        messageElement.innerHTML = '✅ <strong>Success!</strong> Your response has been saved to our database.';
    }
    
    if (responseIdElement && result.responseId) {
        responseIdElement.textContent = result.responseId;
    }
    
    if (statsElement && result.totalResponses) {
        statsElement.innerHTML = `You are response #${result.totalResponses}!`;
    }
    
    // Load and display statistics
    loadStatistics();
    showResponseCount();
}

function showErrorScreen(errorMessage) {
    document.getElementById('survey-form').classList.remove('active');
    document.getElementById('thank-you-screen').classList.add('active');
    
    const messageElement = document.getElementById('submission-message');
    if (messageElement) {
        messageElement.innerHTML = `⚠️ <strong>Saved Locally:</strong> Response saved to browser (${errorMessage}).`;
    }
    
    showResponseCount();
}

async function loadStatistics() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/stats`);
        const result = await response.json();
        
        if (result.success) {
            displayStatistics(result.stats);
        }
    } catch (error) {
        console.error('Failed to load statistics:', error);
    }
}

function displayStatistics(stats) {
    const statsElement = document.getElementById('statistics');
    if (!statsElement) return;
    
    statsElement.innerHTML = `
        <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; margin: 15px 0;">
            <h4>📊 Survey Statistics</h4>
            <div>Total Responses: <strong>${stats.totalResponses}</strong></div>
            <div>Average Satisfaction: <strong>${stats.averageSatisfaction}/5</strong></div>
            <div>Average Recommendation: <strong>${stats.averageRecommendation}/5</strong></div>
        </div>
    `;
}

function showResponseCount() {
    try {
        const responses = JSON.parse(localStorage.getItem('surveyResponses') || '[]');
        const countElement = document.getElementById('response-count');
        if (countElement) {
            const onlineCount = responses.filter(r => !r.localBackup).length;
            const offlineCount = responses.filter(r => r.localBackup).length;
            
            countElement.innerHTML = `
                <div style="font-size: 0.9em; color: #666; margin-top: 10px;">
                    <div>✅ Online submissions: ${onlineCount}</div>
                    <div>📱 Local backups: ${offlineCount}</div>
                    <div>📊 Total: ${responses.length}</div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error showing response count:', error);
    }
}

// Social sharing functions
function shareOnFacebook() {
    const surveyUrl = window.location.href;
    const facebookShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(surveyUrl)}&quote=I just completed this survey! Check it out.`;
    window.open(facebookShareUrl, '_blank', 'width=600,height=400');
}

function shareOnTwitter() {
    const surveyUrl = window.location.href;
    const twitterShareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(surveyUrl)}&text=I just completed this survey!`;
    window.open(twitterShareUrl, '_blank', 'width=600,height=400');
}

function copySurveyLink() {
    const surveyUrl = window.location.href;
    navigator.clipboard.writeText(surveyUrl).then(() => {
        alert('Survey link copied to clipboard!');
    });
}

// Admin functions
async function downloadResponses() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/responses/csv`);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `survey-responses-${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error downloading CSV:', error);
        // Fallback to localStorage download
        downloadLocalResponses();
    }
}

function downloadLocalResponses() {
    try {
        const responses = JSON.parse(localStorage.getItem('surveyResponses') || '[]');
        const csv = convertToCSV(responses);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `survey-backup-${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    } catch (error) {
        alert('Error downloading responses: ' + error.message);
    }
}

function convertToCSV(objArray) {
    if (objArray.length === 0) return 'No data available';
    
    const headers = ['ID', 'Timestamp', 'Satisfaction', 'Recommendation', 'Improvements', 'Platforms', 'Status'];
    let str = headers.join(',') + '\r\n';
    
    for (let i = 0; i < objArray.length; i++) {
        let line = [
            objArray[i].id || objArray[i].backupId || '',
            objArray[i].timestamp || '',
            objArray[i].satisfaction || '',
            objArray[i].recommend || '',
            `"${(objArray[i].improvements || '').replace(/"/g, '""')}"`,
            `"${(Array.isArray(objArray[i].platforms) ? objArray[i].platforms.join('; ') : objArray[i].platforms || '').replace(/"/g, '""')}"`,
            objArray[i].localBackup ? 'Local Backup' : 'Online'
        ].join(',');
        str += line + '\r\n';
    }
    
    return str;
}

function clearResponses() {
    if (confirm('Are you sure you want to clear all LOCAL responses? This will not affect server data.')) {
        localStorage.removeItem('surveyResponses');
        showResponseCount();
        alert('Local responses cleared!');
    }
}

// Test backend connection on load
async function testBackendConnection() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/health`);
        const result = await response.json();
        console.log('Backend connection:', result);
        return result.status === 'OK';
    } catch (error) {
        console.warn('Backend connection failed:', error);
        return false;
    }
}

// Initialize
showQuestion(0);

// Test connection on load
window.addEventListener('load', async () => {
    const isConnected = await testBackendConnection();
    const statusElement = document.getElementById('connection-status');
    if (statusElement) {
        statusElement.textContent = isConnected ? '✅ Online' : '❌ Offline (Using local storage)';
        statusElement.style.color = isConnected ? 'green' : 'orange';
    }
});