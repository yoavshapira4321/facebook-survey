let currentQuestion = 0;
const totalQuestions = document.querySelectorAll('.question').length;

// Counters for each category
let categoryCounters = {
    A: 0,  // Anxious category
    B: 0,  // Secure category  
    C: 0   // Avoidant category
};

// Track which questions have been counted to avoid duplicates
let countedQuestions = new Set();

// Backend configuration - will work relative to the same domain
const API_BASE_URL = window.location.origin;

// Hard-coded email address
const HARD_CODED_EMAIL = "yoavshapira4321@gmail.com";

function startSurvey() {
    document.getElementById('welcome-screen').classList.remove('active');
    document.getElementById('survey-form').classList.add('active');
    updateProgress();
    
    // Reset counters when survey starts
    resetCategoryCounters();
    
    // Add Enter key listener when survey starts
    addEnterKeyListener();
}

function showQuestion(index) {
    document.querySelectorAll('.question').forEach(q => q.classList.remove('active'));
    document.querySelectorAll('.question')[index].classList.add('active');
    
    document.getElementById('prev-btn').disabled = index === 0;
    document.getElementById('next-btn').style.display = index === totalQuestions - 1 ? 'none' : 'block';
    document.getElementById('submit-btn').style.display = index === totalQuestions - 1 ? 'block' : 'none';
    
    updateProgress();
    
    // Auto-focus on the first radio button for better keyboard navigation
    autoFocusCurrentQuestion();
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

// Add Enter key listener
function addEnterKeyListener() {
    document.addEventListener('keydown', function(e) {
        // Only handle Enter key (key code 13)
        if (e.key === 'Enter' || e.keyCode === 13) {
            // Prevent default form submission behavior
            e.preventDefault();
            
            // Check if we're on the last question
            if (currentQuestion === totalQuestions - 1) {
                // On last question, submit the form
                document.getElementById('survey-form').dispatchEvent(new Event('submit'));
            } else {
                // On other questions, go to next question
                nextQuestion();
            }
        }
    });
}

// Auto-focus on the first radio button of the current question
function autoFocusCurrentQuestion() {
    const currentQuestionElement = document.querySelectorAll('.question')[currentQuestion];
    if (currentQuestionElement) {
        const firstRadio = currentQuestionElement.querySelector('input[type="radio"]');
        if (firstRadio) {
            firstRadio.focus();
        }
    }
}

// Reset all category counters
function resetCategoryCounters() {
    categoryCounters = { A: 0, B: 0, C: 0 };
    countedQuestions.clear();
}

// Update category counters based on answer (only once per question)
function updateCategoryCounters(questionName, answerValue) {
    // Skip if we've already counted this question
    if (countedQuestions.has(questionName)) {
        return;
    }
    
    const questionElement = document.querySelector(`[name="${questionName}"]`).closest('.question');
    if (!questionElement) return;
    
    const category = questionElement.getAttribute('data-category');
    const isPositiveAnswer = answerValue === "1"; // "1" represents YES
    
    if (isPositiveAnswer && category) {
        categoryCounters[category]++;
        countedQuestions.add(questionName); // Mark as counted
        console.log(`Category ${category} counter increased to: ${categoryCounters[category]} for question ${questionName}`);
    }
}

// Enhanced form submission with automatic email sending
document.getElementById('survey-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // Remove Enter key listener during submission to prevent conflicts
    document.removeEventListener('keydown', enterKeyHandler);
    
    // Show loading state
    const submitBtn = document.getElementById('submit-btn');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Submitting...';
    submitBtn.disabled = true;
    
    // Show email sending status
    showEmailStatus('📨 Sending your results to our team...', 'loading');
    
    try {
        const formData = collectFormData();
        console.log('Submitting survey data with categories:', formData);
        
        // Submit to backend
        const result = await submitToBackend(formData);
        
        if (result.success) {
            // Automatically send email with results
            await sendResultsToEmail(formData, result.responseId);
            
            showThankYouScreen(result);
        } else {
            throw new Error(result.error || 'Submission failed');
        }
        
    } catch (error) {
        console.error('Submission error:', error);
        // Fallback to localStorage
        const formData = collectFormData();
        saveToLocalStorage(formData);
        
        // Try to send email even if backend submission failed
        try {
            await sendResultsToEmail(formData, 'local_' + Date.now());
        } catch (emailError) {
            console.error('Email sending also failed:', emailError);
        }
        
        showErrorScreen(error.message);
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
});

// Separate function for Enter key handling for proper removal
function enterKeyHandler(e) {
    if (e.key === 'Enter' || e.keyCode === 13) {
        e.preventDefault();
        
        // Check if we're on the last question
        if (currentQuestion === totalQuestions - 1) {
            document.getElementById('survey-form').dispatchEvent(new Event('submit'));
        } else {
            nextQuestion();
        }
    }
}

// Update the addEnterKeyListener function to use the named function
function addEnterKeyListener() {
    document.addEventListener('keydown', enterKeyHandler);
}

function collectFormData() {
    const formData = new FormData(document.getElementById('survey-form'));
    const responseId = 'resp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    const data = {
        responseId: responseId,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        referrer: document.referrer,
        pageUrl: window.location.href,
        categoryScores: { ...categoryCounters },
        totalScoreA: categoryCounters.A,
        totalScoreB: categoryCounters.B, 
        totalScoreC: categoryCounters.C
    };
    
    // Process all question answers
    const answers = {};
    let totalYesAnswers = 0;
    let totalNoAnswers = 0;
    
    // Convert FormData to object and track answers
    for (let [key, value] of formData.entries()) {
        answers[key] = value;
        
        // Count YES/NO answers
        if (value === "1") totalYesAnswers++;
        if (value === "2") totalNoAnswers++;
        
        // Update category counters for each answer (only once)
        updateCategoryCounters(key, value);
    }
    
    data.answers = answers;
    data.totalYes = totalYesAnswers;
    data.totalNo = totalNoAnswers;
    data.totalQuestions = totalQuestions;
    
    // Calculate percentages
    data.percentageYes = totalYesAnswers > 0 ? Math.round((totalYesAnswers / totalQuestions) * 100) : 0;
    data.percentageNo = totalNoAnswers > 0 ? Math.round((totalNoAnswers / totalQuestions) * 100) : 0;
    
    // Determine dominant category
    data.dominantCategory = getDominantCategory();
    
    console.log('Final category scores:', categoryCounters);
    console.log('Questions counted:', countedQuestions.size);
    console.log('Dominant category:', data.dominantCategory);
    
    return data;
}

function getDominantCategory() {
    const scores = Object.entries(categoryCounters);
    const maxScore = Math.max(...scores.map(([_, score]) => score));
    const dominantCategories = scores.filter(([_, score]) => score === maxScore).map(([cat]) => cat);
    
    return dominantCategories.length === 1 ? dominantCategories[0] : 'Tie';
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

async function sendResultsToEmail(surveyResults, responseId) {
    try {
        showEmailStatus('📨 Preparing your results for delivery...', 'loading');
        
        // Ensure we have valid data
        const emailResponseId = responseId || surveyResults?.responseId || Date.now();
        const safeResults = surveyResults || {};
        
        const response = await fetch(`${API_BASE_URL}/api/send-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                toEmail: HARD_CODED_EMAIL,
                subject: `Attachment Style Assessment Results - ${emailResponseId}`,
                results: { 
                    ...safeResults, 
                    responseId: emailResponseId 
                },
                timestamp: new Date().toISOString()
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('Email sent successfully:', result);
            
            showEmailStatus('✅ Results successfully sent to our team! We will review them shortly.', 'success');
            
            saveEmailSubmission(safeResults, true);
            return true;
        } else {
            throw new Error('Failed to send email');
        }
        
    } catch (error) {
        console.error('Email sending failed:', error);
        
        // Use safe data for fallback
        const mailtoLink = createMailtoFallback(surveyResults);
        showEmailStatus(`
            ❌ Automatic delivery failed. 
            <button onclick="useMailtoFallback()" style="margin-left: 10px; padding: 5px 10px; background: #3498db; color: white; border: none; border-radius: 3px; cursor: pointer;">
                Click here to send manually
            </button>
        `, 'error');
        
        window.fallbackMailtoLink = mailtoLink;
        window.fallbackSurveyResults = surveyResults;
        
        saveEmailSubmission(surveyResults, false);
        return false;
    }
}

function showEmailStatus(message, type) {
    const statusElement = document.getElementById('email-submission-status');
    const colors = {
        error: '#e74c3c',
        success: '#27ae60',
        loading: '#f39c12',
        info: '#3498db'
    };
    
    statusElement.innerHTML = '';
    
    if (message) {
        statusElement.innerHTML = `
            <div style="padding: 15px; border-radius: 8px; background: ${colors[type]}20; color: ${colors[type]}; border-left: 4px solid ${colors[type]}; margin: 10px 0;">
                ${message}
            </div>
        `;
    }
}

function createMailtoFallback(results) {
    // Safe property access with fallbacks
    const responseId = results?.responseId || Date.now();
    const categoryScores = results?.categoryScores || { A: 0, B: 0, C: 0 };
    const dominantCategory = results?.dominantCategory || 'Unknown';
    const totalYes = results?.totalYes || 0;
    const totalNo = results?.totalNo || 0;
    const percentageYes = results?.percentageYes || 0;
    const timestamp = results?.timestamp || new Date().toISOString();
    const userAgent = results?.userAgent || 'Unknown';
    const referrer = results?.referrer || 'Direct';
    const pageUrl = results?.pageUrl || 'Unknown';
    
    const subject = `Attachment Style Assessment Results - ${responseId}`;
    
    const body = `
ATTACHMENT STYLE ASSESSMENT RESULTS

Response ID: ${responseId}
Assessment Date: ${new Date(timestamp).toLocaleString()}

CATEGORY SCORES:
• Anxious Attachment (A): ${categoryScores.A}/15
• Secure Attachment (B): ${categoryScores.B}/15  
• Avoidant Attachment (C): ${categoryScores.C}/15

DOMINANT ATTACHMENT STYLE: ${dominantCategory}

SUMMARY:
- Total YES Answers: ${totalYes}
- Total NO Answers: ${totalNo}
- Completion Rate: ${percentageYes}% YES responses

TECHNICAL INFO:
- User Agent: ${userAgent}
- Referrer: ${referrer}
- Page URL: ${pageUrl}

This assessment helps identify relationship patterns based on attachment theory.
    `.trim();
    
    return `mailto:${HARD_CODED_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function useMailtoFallback() {
    if (window.fallbackMailtoLink) {
        window.location.href = window.fallbackMailtoLink;
    }
}

function saveEmailSubmission(results, success) {
    try {
        const responses = JSON.parse(localStorage.getItem('surveyResponses') || '[]');
        if (responses.length > 0) {
            const latestResponse = responses[responses.length - 1];
            latestResponse.emailSent = success;
            latestResponse.emailSentTo = HARD_CODED_EMAIL;
            latestResponse.emailSentAt = new Date().toISOString();
            latestResponse.emailSuccess = success;
            
            if (!success && window.fallbackMailtoLink) {
                latestResponse.emailFallbackLink = window.fallbackMailtoLink;
            }
            
            localStorage.setItem('surveyResponses', JSON.stringify(responses));
        }
    } catch (error) {
        console.error('Error saving email submission:', error);
    }
}

function showThankYouScreen(result) {
    document.getElementById('survey-form').classList.remove('active');
    document.getElementById('thank-you-screen').classList.add('active');
    
    // Remove Enter key listener on thank you screen
    document.removeEventListener('keydown', enterKeyHandler);
    
    displayCategoryResults();
    
    const messageElement = document.getElementById('submission-message');
    const responseIdElement = document.getElementById('response-id');
    
    if (messageElement) {
        messageElement.innerHTML = '✅ <strong>Assessment Complete!</strong> Your results have been processed.';
    }
    
    if (responseIdElement && result.responseId) {
        responseIdElement.textContent = result.responseId;
    }
    
    loadStatistics();
    showResponseCount();
}

function displayCategoryResults() {
    const resultsContainer = document.getElementById('category-results');
    if (!resultsContainer) return;
    
    const dominantCategory = getDominantCategory();
    const categoryLabels = {
        A: 'Anxious Attachment Style',
        B: 'Secure Attachment Style', 
        C: 'Avoidant Attachment Style'
    };
    
    const categoryDescriptions = {
        A: 'You may experience anxiety in relationships and seek high levels of intimacy and approval.',
        B: 'You feel comfortable with intimacy and are generally warm and loving in relationships.',
        C: 'You value independence and may feel uncomfortable with too much closeness.'
    };
    
    resultsContainer.innerHTML = `
        <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3>📊 Your Attachment Style Results</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 15px 0;">
                <div style="text-align: center; padding: 15px; background: white; border-radius: 8px; border-left: 4px solid #e74c3c;">
                    <div style="font-size: 24px; font-weight: bold; color: #e74c3c;">${categoryCounters.A}</div>
                    <div style="font-size: 14px; color: #666;">Anxious (A)</div>
                </div>
                <div style="text-align: center; padding: 15px; background: white; border-radius: 8px; border-left: 4px solid #27ae60;">
                    <div style="font-size: 24px; font-weight: bold; color: #27ae60;">${categoryCounters.B}</div>
                    <div style="font-size: 14px; color: #666;">Secure (B)</div>
                </div>
                <div style="text-align: center; padding: 15px; background: white; border-radius: 8px; border-left: 4px solid #3498db;">
                    <div style="font-size: 24px; font-weight: bold; color: #3498db;">${categoryCounters.C}</div>
                    <div style="font-size: 14px; color: #666;">Avoidant (C)</div>
                </div>
            </div>
            <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #f39c12;">
                <strong>Dominant Style: ${categoryLabels[dominantCategory] || 'Mixed'}</strong>
                <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">
                    ${categoryDescriptions[dominantCategory] || 'You show characteristics of multiple attachment styles.'}
                </p>
            </div>
        </div>
    `;
}

function showErrorScreen(errorMessage) {
    document.getElementById('survey-form').classList.remove('active');
    document.getElementById('thank-you-screen').classList.add('active');
    
    document.removeEventListener('keydown', enterKeyHandler);
    
    const messageElement = document.getElementById('submission-message');
    if (messageElement) {
        messageElement.innerHTML = `⚠️ <strong>Saved Locally:</strong> Response saved to browser (${errorMessage}).`;
    }
    
    displayCategoryResults();
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
    const dominantCategory = getDominantCategory();
    const categoryLabels = {
        A: 'Anxious Attachment Style',
        B: 'Secure Attachment Style',
        C: 'Avoidant Attachment Style'
    };
    
    const shareText = `I just discovered my attachment style is ${categoryLabels[dominantCategory]}! Take the attachment style assessment too:`;
    const facebookShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(surveyUrl)}&quote=${encodeURIComponent(shareText)}`;
    window.open(facebookShareUrl, '_blank', 'width=600,height=400');
}

function shareOnTwitter() {
    const surveyUrl = window.location.href;
    const twitterShareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(surveyUrl)}&text=I just took the attachment style assessment!`;
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
        a.download = `attachment-survey-responses-${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error downloading CSV:', error);
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
        a.download = `attachment-survey-backup-${Date.now()}.csv`;
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
    
    const headers = ['Timestamp', 'Total Score A', 'Total Score B', 'Total Score C', 'Dominant Category', 'Total Yes', 'Total No', 'Status'];
    let str = headers.join(',') + '\r\n';
    
    for (let i = 0; i < objArray.length; i++) {
        let line = [
            objArray[i].timestamp || '',
            objArray[i].totalScoreA || 0,
            objArray[i].totalScoreB || 0,
            objArray[i].totalScoreC || 0,
            objArray[i].dominantCategory || '',
            objArray[i].totalYes || 0,
            objArray[i].totalNo || 0,
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