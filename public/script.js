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

// Track current survey data globally
let currentSurveyData = null;

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
    document.addEventListener('keydown', enterKeyHandler);
}

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
    showEmailStatus('📨 Processing your results and sending email...', 'loading');
    
    try {
        const formData = collectFormData();
        currentSurveyData = formData; // Store globally for retry purposes
        console.log('Submitting survey data with categories:', formData);
        
        // Submit to backend (this now automatically sends email)
        const result = await submitToBackend(formData);
        
        if (result.success) {
            // Show success message with email status
            if (result.emailSent) {
                showEmailStatus(`
                    <div style="text-align: center;">
                        <h3 style="color: #27ae60; margin-bottom: 15px;">✅ Results Sent Successfully!</h3>
                        <p><strong>Your results have been automatically delivered to:</strong></p>
                        <div style="background: #d4edda; padding: 10px; border-radius: 5px; margin: 10px 0;">
                            <strong>${HARD_CODED_EMAIL}</strong>
                        </div>
                        <p style="font-size: 14px; color: #666;">
                            Email Message ID: ${result.emailMessageId || 'N/A'}<br>
                            Check your inbox for confirmation.
                        </p>
                    </div>
                `, 'success');
            } else {
                // Email failed but survey was saved
                showEmailStatus(`
                    <div style="text-align: center;">
                        <h3 style="color: #e74c3c; margin-bottom: 15px;">⚠️ Survey Saved But Email Failed</h3>
                        <p>Your results were saved but we couldn't send the email automatically.</p>
                        <p><strong>Error:</strong> ${result.emailError || 'Unknown error'}</p>
                        <div style="margin: 15px 0;">
                            <button onclick="sendManualEmail()" 
                                    style="margin: 5px; padding: 10px 15px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer;">
                                📧 Send Manual Email
                            </button>
                        </div>
                    </div>
                `, 'error');
            }
            
            showThankYouScreen(result);
        } else {
            throw new Error(result.error || 'Submission failed');
        }
        
    } catch (error) {
        console.error('Submission error:', error);
        // Fallback to localStorage
        const formData = collectFormData();
        currentSurveyData = formData;
        saveToLocalStorage(formData);
        
        // Show manual email option
        showManualEmailOption(formData, 'local_' + Date.now());
        showErrorScreen(error.message);
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
});

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
        if (value === "0") totalNoAnswers++;
        
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
    
    return dominantCategories.length === 1 ? dominantCategories[0] : 'Mixed';
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

// Simple manual email function
function sendManualEmail() {
    const responseId = document.getElementById('response-id')?.textContent || Date.now();
    const categoryScores = window.categoryCounters || { A: 0, B: 0, C: 0 };
    const dominantCategory = getDominantCategory();
    
    const subject = `Attachment Style Results - ${responseId}`;
    const body = `
My Attachment Style Assessment Results:

Scores:
- Anxious (A): ${categoryScores.A}
- Secure (B): ${categoryScores.B}
- Avoidant (C): ${categoryScores.C}

Dominant Style: ${dominantCategory}

Response ID: ${responseId}
    `.trim();
    
    window.location.href = `mailto:${HARD_CODED_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// Manual email fallback option
function showManualEmailOption(surveyResults, responseId) {
    const subject = `Attachment Style Assessment Results - ${responseId}`;
    const emailBody = createEmailBody(surveyResults, responseId);
    
    showEmailStatus(`
        <div style="text-align: center;">
            <h3 style="color: #f39c12; margin-bottom: 15px;">📧 Manual Email Required</h3>
            <p><strong>Please send your results manually:</strong></p>
            
            <button onclick="sendManualEmail()" 
                    style="margin: 10px; padding: 12px 20px; background: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer;">
                📧 Open Email Client
            </button>
            
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0; text-align: left;">
                <p><strong>Recipient:</strong> ${HARD_CODED_EMAIL}</p>
                <p><strong>Subject:</strong> ${subject}</p>
            </div>
        </div>
    `, 'info');
}

// Email body creation
function createEmailBody(results, responseId) {
    const safeResults = results || {};
    const categoryScores = safeResults.categoryScores || { A: 0, B: 0, C: 0 };
    const dominantCategory = safeResults.dominantCategory || 'Unknown';
    const totalYes = safeResults.totalYes || 0;
    const totalNo = safeResults.totalNo || 0;
    const totalQuestions = safeResults.totalQuestions || 0;
    
    return `ATTACHMENT STYLE ASSESSMENT RESULTS

RESPONSE ID: ${responseId}
DATE: ${new Date().toLocaleString()}

YOUR SCORES:
• Anxious (A): ${categoryScores.A}
• Secure (B): ${categoryScores.B}  
• Avoidant (C): ${categoryScores.C}

DOMINANT ATTACHMENT STYLE: ${dominantCategory}

SUMMARY:
- Total Questions: ${totalQuestions}
- Yes Answers: ${totalYes}
- No Answers: ${totalNo}
- Completion Rate: ${Math.round((totalYes / totalQuestions) * 100)}%

This assessment was completed via the online Attachment Style Assessment tool.

--
Please do not reply to this automated message.`;
}

// Email status display function
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

function showThankYouScreen(result) {
    document.getElementById('survey-form').classList.remove('active');
    document.getElementById('thank-you-screen').classList.add('active');
    
    // Remove Enter key listener on thank you screen
    document.removeEventListener('keydown', enterKeyHandler);
    
    displayCategoryResults();
    
    const messageElement = document.getElementById('submission-message');
    const responseIdElement = document.getElementById('response-id');
    
    if (messageElement) {
        if (result.emailSent) {
            messageElement.innerHTML = '✅ <strong>Assessment Complete!</strong> Your results have been processed and emailed.';
        } else {
            messageElement.innerHTML = '⚠️ <strong>Assessment Complete!</strong> Your results have been processed. Please use manual email option.';
        }
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
        C: 'Avoidant Attachment Style',
        Mixed: 'Mixed Attachment Style'
    };
    
    const categoryDescriptions = {
        A: 'You may experience anxiety in relationships and seek high levels of intimacy and approval.',
        B: 'You feel comfortable with intimacy and are generally warm and loving in relationships.',
        C: 'You value independence and may feel uncomfortable with too much closeness.',
        Mixed: 'You show characteristics of multiple attachment styles.'
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
    const statsElement = document.getElementById('response-stats');
    if (!statsElement) return;
    
    statsElement.innerHTML = `
        <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; margin: 15px 0;">
            <h4>📊 Survey Statistics</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px;">
                <div style="text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; color: #3498db;">${stats.totalResponses || 0}</div>
                    <div style="font-size: 12px; color: #666;">Total Responses</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; color: #27ae60;">${stats.totalEmailsSent || 0}</div>
                    <div style="font-size: 12px; color: #666;">Emails Sent</div>
                </div>
            </div>
        </div>
    `;
}

function showResponseCount() {
    try {
        const responses = JSON.parse(localStorage.getItem('surveyResponses') || '[]');
        const countElement = document.getElementById('response-count');
        if (countElement) {
            countElement.innerHTML = `
                <div style="font-size: 0.9em; color: #666; margin-top: 10px;">
                    <div>📊 Total Local Responses: ${responses.length}</div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error showing response count:', error);
    }
}

// Initialize
showQuestion(0);