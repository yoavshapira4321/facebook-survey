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
                        <button onclick="checkEmailStatus('${result.responseId}')" 
                                style="margin: 10px; padding: 10px 15px; background: #17a2b8; color: white; border: none; border-radius: 5px; cursor: pointer;">
                            📧 Check Email Status
                        </button>
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
                            <button onclick="resendEmail('${result.responseId}')" 
                                    style="margin: 5px; padding: 10px 15px; background: #dc3545; color: white; border: none; border-radius: 5px; cursor: pointer;">
                                🔄 Retry Email
                            </button>
                            <button onclick="showManualEmailOption(currentSurveyData, '${result.responseId}')" 
                                    style="margin: 5px; padding: 10px 15px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer;">
                                📧 Manual Email
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

// Enhanced email status checking
async function checkEmailStatus(responseId) {
    try {
        showEmailStatus('🔄 Checking email delivery status...', 'loading');
        
        const response = await fetch(`/api/email-status/${responseId}`);
        const result = await response.json();
        
        if (result.success) {
            const status = result.emailStatus;
            if (status.success) {
                showEmailStatus(`
                    <div style="text-align: center;">
                        <h4 style="color: #27ae60;">✅ Email Delivered Successfully!</h4>
                        <p><strong>Message ID:</strong> ${status.messageId}</p>
                        <p><strong>Sent:</strong> ${new Date(status.timestamp).toLocaleString()}</p>
                        <p><strong>To:</strong> ${status.recipient}</p>
                        <div style="background: #d4edda; padding: 10px; border-radius: 5px; margin: 10px 0;">
                            <strong>Status: Delivered ✓</strong>
                        </div>
                    </div>
                `, 'success');
            } else {
                showEmailStatus(`
                    <div style="text-align: center;">
                        <h4 style="color: #e74c3c;">❌ Email Failed to Send</h4>
                        <p><strong>Error:</strong> ${status.error}</p>
                        <p><strong>Time:</strong> ${new Date(status.timestamp).toLocaleString()}</p>
                        <div style="margin: 15px 0;">
                            <button onclick="resendEmail('${responseId}')" 
                                    style="margin: 5px; padding: 10px 15px; background: #dc3545; color: white; border: none; border-radius: 5px; cursor: pointer;">
                                🔄 Retry Email
                            </button>
                            <button onclick="showManualEmailOption(currentSurveyData, '${responseId}')" 
                                    style="margin: 5px; padding: 10px 15px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer;">
                                📧 Use Manual Method
                            </button>
                        </div>
                    </div>
                `, 'error');
            }
        } else {
            showEmailStatus('❌ Could not retrieve email status', 'error');
        }
    } catch (error) {
        showEmailStatus('❌ Error checking email status: ' + error.message, 'error');
    }
}

// Resend email function
async function resendEmail(responseId) {
    try {
        showEmailStatus('🔄 Resending email...', 'loading');
        
        const response = await fetch('/api/resend-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ responseId })
        });
        
        const result = await response.json();
        
        if (result.success && result.emailResent) {
            showEmailStatus(`
                <div style="text-align: center;">
                    <h4 style="color: #27ae60;">✅ Email Resent Successfully!</h4>
                    <p><strong>New Message ID:</strong> ${result.messageId}</p>
                    <p><strong>Sent:</strong> ${new Date().toLocaleString()}</p>
                </div>
            `, 'success');
        } else {
            throw new Error(result.error || 'Resend failed');
        }
    } catch (error) {
        showEmailStatus(`
            <div style="text-align: center;">
                <h4 style="color: #e74c3c;">❌ Failed to Resend Email</h4>
                <p>Error: ${error.message}</p>
                <button onclick="showManualEmailOption(currentSurveyData, '${responseId}')" 
                        style="margin: 10px; padding: 10px 15px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    📧 Use Manual Method Instead
                </button>
            </div>
        `, 'error');
    }
}

// Manual email fallback option
function showManualEmailOption(surveyResults, responseId) {
    const subject = `Attachment Style Assessment Results - ${responseId}`;
    const emailBody = createEmailBody(surveyResults, responseId);
    
    showEmailStatus(`
        <div style="text-align: center;">
            <h3 style="color: #f39c12; margin-bottom: 15px;">📧 Manual Email Required</h3>
            <p><strong>Please send your results manually using one of these methods:</strong></p>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0;">
                <div style="background: #e8f4fd; padding: 15px; border-radius: 8px; text-align: center;">
                    <h4 style="color: #1877f2; margin-bottom: 10px;">Method 1: Webmail</h4>
                    <p>Open your webmail directly:</p>
                    <button onclick="openGmail('${subject}', \`${emailBody.replace(/'/g, "\\'")}\`)" 
                            style="width: 100%; padding: 10px; background: #ea4335; color: white; border: none; border-radius: 5px; cursor: pointer; margin: 5px 0;">
                        📧 Open Gmail
                    </button>
                    <button onclick="openOutlook('${subject}', \`${emailBody.replace(/'/g, "\\'")}\`)" 
                            style="width: 100%; padding: 10px; background: #0078d4; color: white; border: none; border-radius: 5px; cursor: pointer; margin: 5px 0;">
                        📧 Open Outlook
                    </button>
                </div>
                
                <div style="background: #fff3cd; padding: 15px; border-radius: 8px; text-align: center;">
                    <h4 style="color: #856404; margin-bottom: 10px;">Method 2: Copy & Paste</h4>
                    <p>Copy all content and paste into any email:</p>
                    <button onclick="copyFullEmailContent('${subject}', \`${emailBody.replace(/'/g, "\\'")}\`)" 
                            style="width: 100%; padding: 10px; background: #6c757d; color: white; border: none; border-radius: 5px; cursor: pointer; margin: 5px 0;">
                        📋 Copy All Content
                    </button>
                </div>
            </div>
            
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0; text-align: left;">
                <p><strong>Recipient:</strong> ${HARD_CODED_EMAIL}</p>
                <p><strong>Subject:</strong> ${subject}</p>
                <details>
                    <summary>Preview Email Content</summary>
                    <div style="background: white; padding: 10px; border: 1px solid #ddd; border-radius: 5px; margin-top: 10px; max-height: 200px; overflow-y: auto;">
                        <pre style="white-space: pre-wrap; font-size: 12px;">${emailBody}</pre>
                    </div>
                </details>
            </div>
        </div>
    `, 'info');
    
    // Store for retry purposes
    window.manualSurveyResults = surveyResults;
    window.currentResponseId = responseId;
}

// Webmail functions
function openGmail(subject, body) {
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${HARD_CODED_EMAIL}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(gmailUrl, '_blank');
}

function openOutlook(subject, body) {
    const outlookUrl = `https://outlook.live.com/owa/?path=/mail/action/compose&to=${HARD_CODED_EMAIL}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(outlookUrl, '_blank');
}

// Copy full email content
function copyFullEmailContent(subject, body) {
    const fullContent = `To: ${HARD_CODED_EMAIL}\nSubject: ${subject}\n\n${body}`;
    
    navigator.clipboard.writeText(fullContent).then(() => {
        showEmailStatus(`
            <div style="text-align: center;">
                <h4 style="color: #27ae60;">✅ Content Copied to Clipboard!</h4>
                <p>Now open your email app and paste the content.</p>
                <p><strong>Recipient:</strong> ${HARD_CODED_EMAIL}</p>
            </div>
        `, 'success');
    }).catch(() => {
        showEmailStatus('❌ Could not copy to clipboard. Please copy manually.', 'error');
    });
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

DETAILED ANSWERS:
${Object.entries(safeResults.answers || {}).map(([q, answer]) => 
    `Q${q.substring(1)}: ${answer === '1' ? 'YES' : 'NO'}`
).join('\n')}

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
    
    // Show admin panel if needed
    showAdminPanel();
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
    showAdminPanel();
}

// Admin panel functions
function showAdminPanel() {
    // Show admin panel for debugging
    const adminPanel = document.getElementById('admin-panel');
    if (adminPanel) {
        adminPanel.style.display = 'block';
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
                <div style="text-align: center;">
                    <div style="font-size: 24px; font-weight: bold; color: #f39c12;">${stats.emailSuccessRate || '0%'}</div>
                    <div style="font-size: 12px; color: #666;">Success Rate</div>
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
        C: 'Avoidant Attachment Style',
        Mixed: 'Mixed Attachment Style'
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