const API_URL = window.location.origin;

document.getElementById('survey-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
    
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

function getDominantCategory(scores) {
    const max = Math.max(scores.A, scores.B, scores.C);
    if (scores.A === max) return 'A';
    if (scores.B === max) return 'B';
    return 'C';
}

function showSuccess(result) {
    document.getElementById('survey-form').style.display = 'none';
    document.getElementById('thank-you-screen').style.display = 'block';
    
    document.getElementById('response-id').textContent = result.responseId;
    document.getElementById('email-status').textContent = 
        result.emailSent ? '✅ Email sent successfully' : '❌ Email failed';
    document.getElementById('save-status').textContent = 
        result.savedToFile ? '✅ Saved to file' : '❌ Save failed';
}