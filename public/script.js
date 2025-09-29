const API_URL = window.location.origin;
let currentQuestion = 0;
const questions = document.querySelectorAll('.question');
const totalQuestions = questions.length;

// Initialize survey
showQuestion(0);

// Form submission
document.getElementById('survey-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loading"></span> Submitting...';
    
    try {
        // Collect form data
        const formData = new FormData(e.target);
        const answers = {};
        
        for (let [key, value] of formData.entries()) {
            answers[key] = value;
        }
        
        // Calculate scores
        const categoryScores = { A: 0, B: 0, C: 0 };
        document.querySelectorAll('.question').forEach(question => {
            const category = question.getAttribute('data-category');
            const input = question.querySelector('input:checked');
            if (input && input.value === '1') {
                categoryScores[category]++;
            }
        });
        
        // Prepare data
        const surveyData = {
            answers: answers,
            categoryScores: categoryScores,
            totalScoreA: categoryScores.A,
            totalScoreB: categoryScores.B,
            totalScoreC: categoryScores.C,
            dominantCategory: getDominantCategory(categoryScores),
            totalYes: Object.values(answers).filter(v => v === '1').length,
            totalNo: Object.values(answers).filter(v => v === '2').length,
            totalQuestions: Object.keys(answers).length,
            userAgent: navigator.userAgent,
            pageUrl: window.location.href,
            referrer: document.referrer
        };
        
        // Send to server
        const response = await fetch(API_URL + '/api/survey', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(surveyData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            showSuccess(result);
        } else {
            throw new Error(result.error);
        }
        
    } catch (error) {
        alert('Submission failed: ' + error.message);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Survey';
    }
});

// Navigation functions
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

function showQuestion(index) {
    // Hide all questions
    questions.forEach(q => q.classList.remove('active'));
    
    // Show current question
    questions[index].classList.add('active');
    
    // Update navigation buttons
    document.getElementById('prev-btn').disabled = index === 0;
    document.getElementById('next-btn').style.display = index === totalQuestions - 1 ? 'none' : 'block';
    document.getElementById('submit-btn').style.display = index === totalQuestions - 1 ? 'block' : 'none';
    
    // Update progress
    updateProgress(index);
}

function updateProgress(index) {
    const progress = ((index + 1) / totalQuestions) * 100;
    if (!document.querySelector('.progress-bar')) {
        const progressBar = document.createElement('div');
        progressBar.className = 'progress-bar';
        progressBar.innerHTML = '<div class="progress"></div>';
        document.getElementById('survey-form').insertBefore(progressBar, document.getElementById('survey-form').firstChild);
    }
    document.querySelector('.progress').style.width = `${progress}%`;
}

function getDominantCategory(scores) {
    const max = Math.max(scores.A, scores.B, scores.C);
    if (scores.A === max) return 'A';
    if (scores.B === max) return 'B';
    return 'C';
}

function showSuccess(result) {
    document.getElementById('survey-form').classList.remove('active');
    document.getElementById('thank-you-screen').classList.add('active');
    
    document.getElementById('response-id').textContent = result.responseId;
    document.getElementById('email-status').textContent = 
        result.emailSent ? '✅ Email sent successfully' : '📧 Email feature coming soon';
    document.getElementById('save-status').textContent = 
        result.savedToFile ? '✅ Results saved successfully' : '❌ Save failed';
}

// Start survey function
function startSurvey() {
    document.getElementById('welcome-screen').classList.remove('active');
    document.getElementById('survey-form').classList.add('active');
}

// Add Enter key navigation
document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        if (currentQuestion === totalQuestions - 1) {
            document.getElementById('survey-form').dispatchEvent(new Event('submit'));
        } else {
            nextQuestion();
        }
    }
});