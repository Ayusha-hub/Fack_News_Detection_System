// Dashboard JavaScript

// API base URL
const API_BASE_URL = 'http://localhost:5000/api';

// Current state
let currentTab = 'checker';
let currentInputType = 'text';
let selectedImageFile = null;

// Quiz state
let quizState = {
    currentQuestion: 0,
    answers: [],
    questions: [
        {
            question: "What is the best way to verify if a news source is reliable?",
            options: [
                "Check if it has a professional-looking website",
                "Look for author information and publication dates",
                "Share it with friends to see their opinion",
                "Trust it if it matches your beliefs"
            ],
            correct: 1
        },
        {
            question: "Which of these is a red flag for fake news?",
            options: [
                "Citing multiple sources",
                "Using emotional or sensational language",
                "Having clear author attribution",
                "Publishing correction notices"
            ],
            correct: 1
        },
        {
            question: "What should you do before sharing a shocking news story?",
            options: [
                "Share immediately to warn others",
                "Check multiple reliable sources first",
                "Only share with close friends",
                "Wait for celebrities to comment on it"
            ],
            correct: 1
        },
        {
            question: "Which is most likely to indicate misleading information?",
            options: [
                "Balanced reporting of different viewpoints",
                "Claims that sound too good to be true",
                "Acknowledging limitations in the information",
                "Providing links to source materials"
            ],
            correct: 1
        },
        {
            question: "What is the most important skill for fighting fake news?",
            options: [
                "Having many social media followers",
                "Critical thinking and fact-checking",
                "Being able to type quickly",
                "Knowing how to create viral content"
            ],
            correct: 1
        }
    ]
};

// Tip carousel state
let tipState = {
    currentTip: 0,
    tips: [
        "Always check the source of information before sharing. Look for established news organizations with editorial standards.",
        "Be skeptical of headlines that use extreme emotional language or make extraordinary claims without evidence.",
        "Verify information across multiple independent sources before accepting it as fact.",
        "Check the publication date - old news is often reshared as if it's current.",
        "Look for author credentials and contact information. Legitimate journalists stand by their work.",
        "Be aware that satire and parody sites exist - check if the source is meant to be humorous.",
        "Examine the URL for suspicious elements like misspellings or unusual domain extensions.",
        "Consider your own biases - we're more likely to believe and share information that confirms our existing views."
    ]
};

// History pagination state
let historyState = {
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    pageSize: 10
};

// Payment state
let paymentState = {
    selectedPlan: null,
    orderData: null,
    razorpayInstance: null
};

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    checkAuthentication();
    
    // Load user info
    loadUserInfo();
    
    // Initialize tabs
    initializeTabs();
    
    // Initialize input types
    initializeInputTypes();
    
    // Initialize tip carousel
    initializeTipCarousel();
    
    // Load history if on history tab
    if (currentTab === 'history') {
        loadHistory();
    }
});

// Check if user is authenticated
function checkAuthentication() {
    const token = localStorage.getItem('sachet_token');
    
    if (!token) {
        window.location.href = 'login.html';
        return;
    }
    
    // Verify token is still valid
    fetch(`${API_BASE}/auth/me`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Token invalid');
        }
    })
    .catch(error => {
        console.error('Auth check error:', error);
        localStorage.removeItem('sachet_token');
        localStorage.removeItem('sachet_user');
        window.location.href = 'login.html';
    });
}

// Load user information
function loadUserInfo() {
    const token = localStorage.getItem('sachet_token');
    const user = JSON.parse(localStorage.getItem('sachet_user') || '{}');
    
    if (user.name) {
        document.getElementById('userName').textContent = user.name;
    }
    
    if (user.subscriptionStatus) {
        const badge = document.getElementById('subscriptionBadge');
        const upgradeBtn = document.getElementById('upgradeBtn');
        
        badge.textContent = user.subscriptionStatus.charAt(0).toUpperCase() + user.subscriptionStatus.slice(1);
        
        // Update badge color based on subscription
        badge.className = 'px-2 py-1 text-xs font-medium rounded-full ';
        switch (user.subscriptionStatus) {
            case 'pro':
                badge.className += 'bg-purple-100 text-purple-800';
                upgradeBtn.classList.add('hidden'); // Hide upgrade button for Pro users
                break;
            case 'college':
                badge.className += 'bg-blue-100 text-blue-800';
                upgradeBtn.classList.add('hidden'); // Hide upgrade button for College users
                break;
            default:
                badge.className += 'bg-green-100 text-green-800';
                upgradeBtn.classList.remove('hidden'); // Show upgrade button for Free users
        }
    }
}

// Initialize tabs
function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tabName = this.id.replace('Tab', '');
            switchTab(tabName);
        });
    });
}

// Switch between tabs
function switchTab(tabName) {
    currentTab = tabName;
    
    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(button => {
        button.classList.remove('border-indigo-500', 'text-indigo-600');
        button.classList.add('border-transparent', 'text-gray-500');
    });
    
    const activeTabButton = document.getElementById(tabName + 'Tab');
    activeTabButton.classList.remove('border-transparent', 'text-gray-500');
    activeTabButton.classList.add('border-indigo-500', 'text-indigo-600');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    document.getElementById(tabName + 'TabContent').classList.add('active');
    
    // Load history if switching to history tab
    if (tabName === 'history') {
        loadHistory();
    }
}

// Initialize input types
function initializeInputTypes() {
    const inputTypeButtons = document.querySelectorAll('[id$="TypeBtn"]');
    
    inputTypeButtons.forEach(button => {
        button.addEventListener('click', function() {
            const inputType = this.id.replace('TypeBtn', '');
            selectInputType(inputType);
        });
    });
}

// Select input type
function selectInputType(inputType) {
    currentInputType = inputType;
    
    // Update button styles
    document.querySelectorAll('[id$="TypeBtn"]').forEach(button => {
        button.classList.remove('bg-indigo-600', 'text-white');
        button.classList.add('bg-gray-200', 'text-gray-700');
    });
    
    const activeButton = document.getElementById(inputType + 'TypeBtn');
    activeButton.classList.remove('bg-gray-200', 'text-gray-700');
    activeButton.classList.add('bg-indigo-600', 'text-white');
    
    // Show/hide input sections
    document.querySelectorAll('.input-section').forEach(section => {
        section.classList.add('hidden');
    });
    
    document.getElementById(inputType + 'Input').classList.remove('hidden');
    
    // Reset results
    resetResults();
}

// Handle image selection
function handleImageSelect(event) {
    const file = event.target.files[0];
    
    if (file) {
        // Validate file size (5MB limit)
        if (file.size > 5 * 1024 * 1024) {
            alert('Image file size cannot exceed 5MB');
            event.target.value = '';
            return;
        }
        
        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please select a valid image file');
            event.target.value = '';
            return;
        }
        
        selectedImageFile = file;
        
        // Show preview
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('previewImg').src = e.target.result;
            document.getElementById('imagePreview').classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }
}

// Remove selected image
function removeImage() {
    selectedImageFile = null;
    document.getElementById('imageInputField').value = '';
    document.getElementById('imagePreview').classList.add('hidden');
}

// Handle analysis
async function handleAnalysis() {
    const token = localStorage.getItem('sachet_token');
    
    if (!token) {
        window.location.href = 'login.html';
        return;
    }
    
    let inputData;
    
    // Get input data based on type
    switch (currentInputType) {
        case 'text':
            const text = document.getElementById('textInputArea').value.trim();
            if (!text) {
                alert('Please enter text to analyze');
                return;
            }
            inputData = { text };
            break;
            
        case 'url':
            const url = document.getElementById('urlInputField').value.trim();
            if (!url) {
                alert('Please enter a URL to analyze');
                return;
            }
            
            // Validate URL format
            try {
                new URL(url);
            } catch (e) {
                alert('Please enter a valid URL');
                return;
            }
            
            inputData = { url };
            break;
            
        case 'image':
            if (!selectedImageFile) {
                alert('Please select an image to analyze');
                return;
            }
            break;
    }
    
    // Show loading state
    showLoading();
    
    try {
        let response;
        
        if (currentInputType === 'image') {
            // Handle image upload
            const formData = new FormData();
            formData.append('image', selectedImageFile);
            
            response = await fetch(`${API_BASE}/analysis/analyze`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });
        } else {
            // Handle text/URL analysis
            response = await fetch(`${API_BASE}/analysis/analyze`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(inputData)
            });
        }
        
        const data = await response.json();
        
        if (response.ok) {
            showResults(data.analysis);
        } else {
            showError(data.error || 'Analysis failed');
        }
    } catch (error) {
        console.error('Analysis error:', error);
        showError('Network error. Please try again.');
    } finally {
        hideLoading();
    }
}

// Show loading state
function showLoading() {
    document.getElementById('initialState').classList.add('hidden');
    document.getElementById('errorState').classList.add('hidden');
    document.getElementById('resultsContent').classList.add('hidden');
    document.getElementById('loadingState').classList.remove('hidden');
    
    const analyzeBtn = document.getElementById('analyzeBtn');
    analyzeBtn.disabled = true;
    analyzeBtn.innerHTML = '<i class="fas fa-spinner animate-spin mr-2"></i>Analyzing...';
}

// Hide loading state
function hideLoading() {
    document.getElementById('loadingState').classList.add('hidden');
    
    const analyzeBtn = document.getElementById('analyzeBtn');
    analyzeBtn.disabled = false;
    analyzeBtn.innerHTML = '<i class="fas fa-search mr-2"></i>Analyze Content';
}

// Show results
function showResults(analysis) {
    document.getElementById('initialState').classList.add('hidden');
    document.getElementById('errorState').classList.add('hidden');
    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('resultsContent').classList.remove('hidden');
    
    // Update verdict card
    const verdictCard = document.getElementById('verdictCard');
    const verdictTitle = document.getElementById('verdictTitle');
    const verdictDescription = document.getElementById('verdictDescription');
    const confidenceBadge = document.getElementById('confidenceBadge');
    
    // Set verdict styling and text
    verdictCard.className = 'mb-6 p-4 rounded-lg verdict-' + analysis.verdict.toLowerCase();
    
    let verdictText = analysis.verdict;
    let verdictIcon = '';
    
    switch (analysis.verdict) {
        case 'Fake':
            verdictIcon = 'fas fa-times-circle';
            break;
        case 'Real':
            verdictIcon = 'fas fa-check-circle';
            break;
        case 'Misleading':
            verdictIcon = 'fas fa-exclamation-triangle';
            break;
        case 'Uncertain':
            verdictIcon = 'fas fa-question-circle';
            break;
    }
    
    verdictTitle.innerHTML = `<i class="${verdictIcon} mr-2"></i>${verdictText}`;
    verdictDescription.textContent = analysis.explanation;
    
    // Set confidence badge
    confidenceBadge.textContent = analysis.confidence + '%';
    confidenceBadge.className = 'px-2 py-1 text-xs font-medium rounded-full text-white ';
    
    if (analysis.confidence >= 70) {
        confidenceBadge.className += 'confidence-high';
    } else if (analysis.confidence >= 50) {
        confidenceBadge.className += 'confidence-medium';
    } else {
        confidenceBadge.className += 'confidence-low';
    }
    
    // Show/hide cyber alert
    const cyberAlert = document.getElementById('cyberAlert');
    const cyberAlertText = document.getElementById('cyberAlertText');
    
    if (analysis.cyberAlert) {
        cyberAlert.classList.remove('hidden');
        cyberAlertText.textContent = analysis.cyberAlert;
    } else {
        cyberAlert.classList.add('hidden');
    }
    
    // Set explanation
    document.getElementById('explanationText').textContent = analysis.explanation;
    
    // Set sources
    const sourcesSection = document.getElementById('sourcesSection');
    const sourcesList = document.getElementById('sourcesList');
    
    if (analysis.sources && analysis.sources.length > 0) {
        sourcesSection.classList.remove('hidden');
        sourcesList.innerHTML = '';
        
        analysis.sources.forEach(source => {
            const li = document.createElement('li');
            li.className = 'flex items-center space-x-2';
            li.innerHTML = `
                <i class="fas fa-external-link-alt text-gray-400"></i>
                <a href="${source}" target="_blank" class="text-sm text-indigo-600 hover:text-indigo-800 truncate">${source}</a>
            `;
            sourcesList.appendChild(li);
        });
    } else {
        sourcesSection.classList.add('hidden');
    }
    
    // Set processing info
    document.getElementById('processingTime').textContent = analysis.processingTime + 'ms';
    document.getElementById('analysisTime').textContent = new Date().toLocaleString();
}

// Show error
function showError(message) {
    document.getElementById('initialState').classList.add('hidden');
    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('resultsContent').classList.add('hidden');
    document.getElementById('errorState').classList.remove('hidden');
    
    document.getElementById('errorMessage').textContent = message;
}

// Reset results
function resetResults() {
    document.getElementById('initialState').classList.remove('hidden');
    document.getElementById('errorState').classList.add('hidden');
    document.getElementById('resultsContent').classList.add('hidden');
    document.getElementById('loadingState').classList.add('hidden');
}

// Load demo example
function loadDemoExample(type) {
    const examples = {
        fake: 'Breaking: Scientists discover that eating chocolate makes you fly! This revolutionary breakthrough was announced by researchers at the fictional University of Amazing Things.',
        real: "NASA's Perseverance rover successfully collected its first sample of Martian rock, marking a significant milestone in the search for ancient life on the Red Planet.",
        misleading: 'Study shows that drinking coffee reduces cancer risk by 100%! (Fine print: This study was conducted on 3 mice and has not been peer-reviewed.)'
    };
    
    // Switch to text input
    selectInputType('text');
    
    // Set the example text
    document.getElementById('textInputArea').value = examples[type];
    
    // Switch to checker tab
    switchTab('checker');
}

// Analyze sample message (auto-fill and analyze)
function analyzeSampleMessage(type) {
    const examples = {
        fake: 'Breaking: Scientists discover that eating chocolate makes you fly! This revolutionary breakthrough was announced by researchers at the fictional University of Amazing Things.',
        real: "NASA's Perseverance rover successfully collected its first sample of Martian rock, marking a significant milestone in the search for ancient life on the Red Planet.",
        misleading: 'Study shows that drinking coffee reduces cancer risk by 100%! (Fine print: This study was conducted on 3 mice and has not been peer-reviewed.)'
    };
    
    // Switch to text input
    selectInputType('text');
    
    // Set the example text
    document.getElementById('textInputArea').value = examples[type];
    
    // Switch to checker tab
    switchTab('checker');
    
    // Auto-analyze after a short delay
    setTimeout(() => {
        handleAnalysis();
    }, 500);
}

// Initialize tip carousel
function initializeTipCarousel() {
    updateTipDisplay();
    updateTipIndicators();
}

// Update tip display
function updateTipDisplay() {
    const tipContent = document.getElementById('tipContent');
    tipContent.textContent = tipState.tips[tipState.currentTip];
}

// Update tip indicators
function updateTipIndicators() {
    const indicatorsContainer = document.getElementById('tipIndicators');
    indicatorsContainer.innerHTML = '';
    
    for (let i = 0; i < tipState.tips.length; i++) {
        const indicator = document.createElement('button');
        indicator.className = `w-2 h-2 rounded-full transition-colors ${
            i === tipState.currentTip ? 'bg-indigo-600' : 'bg-gray-300'
        }`;
        indicator.onclick = () => goToTip(i);
        indicatorsContainer.appendChild(indicator);
    }
}

// Go to specific tip
function goToTip(index) {
    tipState.currentTip = index;
    updateTipDisplay();
    updateTipIndicators();
}

// Previous tip
function previousTip() {
    tipState.currentTip = (tipState.currentTip - 1 + tipState.tips.length) % tipState.tips.length;
    updateTipDisplay();
    updateTipIndicators();
}

// Next tip
function nextTip() {
    tipState.currentTip = (tipState.currentTip + 1) % tipState.tips.length;
    updateTipDisplay();
    updateTipIndicators();
}

// Start quiz
function startQuiz() {
    quizState.currentQuestion = 0;
    quizState.answers = [];
    
    document.getElementById('quizStart').classList.add('hidden');
    document.getElementById('quizQuestions').classList.remove('hidden');
    document.getElementById('quizResults').classList.add('hidden');
    
    updateQuizDisplay();
    updateProgressBar();
}

// Update quiz display
function updateQuizDisplay() {
    const question = quizState.questions[quizState.currentQuestion];
    const container = document.getElementById('questionContainer');
    
    document.getElementById('currentQuestion').textContent = quizState.currentQuestion + 1;
    document.getElementById('totalQuestions').textContent = quizState.questions.length;
    
    container.innerHTML = `
        <div class="mb-6">
            <h3 class="text-lg font-medium text-gray-900 mb-4">${question.question}</h3>
            <div class="space-y-3">
                ${question.options.map((option, index) => `
                    <label class="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                        <input type="radio" name="quizAnswer" value="${index}" class="mr-3" 
                               ${quizState.answers[quizState.currentQuestion] === index ? 'checked' : ''}
                               onchange="selectQuizAnswer(${index})">
                        <span class="text-gray-700">${option}</span>
                    </label>
                `).join('')}
            </div>
        </div>
    `;
    
    // Update button states
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    prevBtn.disabled = quizState.currentQuestion === 0;
    
    if (quizState.currentQuestion === quizState.questions.length - 1) {
        nextBtn.innerHTML = '<span data-i18n="finishQuiz">Finish Quiz</span>';
        nextBtn.onclick = finishQuiz;
    } else {
        nextBtn.innerHTML = '<span data-i18n="next">Next</span>';
        nextBtn.onclick = nextQuestion;
    }
    
    // Re-translate if needed
    if (typeof updateTranslations === 'function') {
        updateTranslations();
    }
}

// Update progress bar
function updateProgressBar() {
    const progressBar = document.getElementById('progressBar');
    progressBar.innerHTML = '';
    
    for (let i = 0; i < quizState.questions.length; i++) {
        const indicator = document.createElement('div');
        indicator.className = `w-2 h-2 rounded-full transition-colors ${
            i < quizState.currentQuestion ? 'bg-indigo-600' : 
            i === quizState.currentQuestion ? 'bg-indigo-400' : 'bg-gray-300'
        }`;
        progressBar.appendChild(indicator);
    }
}

// Select quiz answer
function selectQuizAnswer(answerIndex) {
    quizState.answers[quizState.currentQuestion] = answerIndex;
}

// Previous question
function previousQuestion() {
    if (quizState.currentQuestion > 0) {
        quizState.currentQuestion--;
        updateQuizDisplay();
        updateProgressBar();
    }
}

// Next question
function nextQuestion() {
    if (quizState.currentQuestion < quizState.questions.length - 1) {
        quizState.currentQuestion++;
        updateQuizDisplay();
        updateProgressBar();
    }
}

// Finish quiz
function finishQuiz() {
    // Calculate score
    let score = 0;
    for (let i = 0; i < quizState.questions.length; i++) {
        if (quizState.answers[i] === quizState.questions[i].correct) {
            score++;
        }
    }
    
    // Show results
    document.getElementById('quizQuestions').classList.add('hidden');
    document.getElementById('quizResults').classList.remove('hidden');
    
    document.getElementById('quizScore').textContent = score;
    
    // Set score message based on performance
    const scoreMessage = document.getElementById('scoreMessage');
    const percentage = (score / quizState.questions.length) * 100;
    
    if (percentage === 100) {
        scoreMessage.textContent = 'Perfect! You\'re a fake news detection expert!';
    } else if (percentage >= 80) {
        scoreMessage.textContent = 'Excellent! You have strong critical thinking skills.';
    } else if (percentage >= 60) {
        scoreMessage.textContent = 'Good job! Keep practicing your fact-checking skills.';
    } else if (percentage >= 40) {
        scoreMessage.textContent = 'Not bad! Consider learning more about media literacy.';
    } else {
        scoreMessage.textContent = 'Keep learning! Media literacy is an important skill to develop.';
    }
}

// Restart quiz
function restartQuiz() {
    startQuiz();
}

// Load history
async function loadHistory(page = 1) {
    const token = localStorage.getItem('sachet_token');
    
    if (!token) {
        return;
    }
    
    const historyLoading = document.getElementById('historyLoading');
    const historyContent = document.getElementById('historyContent');
    const historyEmpty = document.getElementById('historyEmpty');
    
    // Show loading
    historyLoading.classList.remove('hidden');
    historyContent.classList.add('hidden');
    historyEmpty.classList.add('hidden');
    
    try {
        const response = await fetch(`${API_BASE}/analysis/history?page=${page}&limit=${historyState.pageSize}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            historyLoading.classList.add('hidden');
            
            if (data.analyses && data.analyses.length > 0) {
                historyContent.classList.remove('hidden');
                
                // Update pagination state
                historyState.currentPage = page;
                historyState.totalPages = Math.ceil(data.pagination.totalAnalyses / historyState.pageSize);
                historyState.totalItems = data.pagination.totalAnalyses;
                
                // Populate table
                populateHistoryTable(data.analyses);
                updatePaginationControls();
            } else {
                historyEmpty.classList.remove('hidden');
            }
        } else {
            historyLoading.classList.add('hidden');
            historyEmpty.classList.remove('hidden');
            console.error('Failed to load history:', data.error);
        }
    } catch (error) {
        console.error('History load error:', error);
        historyLoading.classList.add('hidden');
        historyEmpty.classList.remove('hidden');
    }
}

// Populate history table
function populateHistoryTable(analyses) {
    const tableBody = document.getElementById('historyTableBody');
    tableBody.innerHTML = '';
    
    analyses.forEach(analysis => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';
        
        // Message preview (truncate long text)
        let messagePreview = '';
        if (analysis.inputType === 'text') {
            messagePreview = analysis.originalText || 'No text available';
        } else if (analysis.inputType === 'url') {
            messagePreview = analysis.originalText || 'No URL available';
        } else {
            messagePreview = `Image: ${analysis.originalText || 'Unknown'}`;
        }
        
        if (messagePreview.length > 100) {
            messagePreview = messagePreview.substring(0, 100) + '...';
        }
        
        // Format date
        const date = new Date(analysis.createdAt).toLocaleDateString();
        const time = new Date(analysis.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        // Verdict styling
        const verdictColor = getVerdictColor(analysis.verdict);
        const verdictIcon = getVerdictIcon(analysis.verdict);
        
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                <div class="max-w-xs truncate" title="${analysis.originalText || 'No content'}">
                    ${messagePreview}
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${verdictColor}">
                    <i class="${verdictIcon} mr-1"></i>
                    ${analysis.verdict}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                    <div class="w-16 bg-gray-200 rounded-full h-2 mr-2">
                        <div class="bg-indigo-600 h-2 rounded-full" style="width: ${analysis.confidence}%"></div>
                    </div>
                    <span class="text-sm text-gray-900">${analysis.confidence}%</span>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                ${date}<br>${time}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm">
                <button onclick="viewHistoryItem('${analysis.id}')" class="text-indigo-600 hover:text-indigo-900 mr-3">
                    <i class="fas fa-eye"></i> View
                </button>
                <button onclick="deleteHistoryItem('${analysis.id}')" class="text-red-600 hover:text-red-900">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

// Update pagination controls
function updatePaginationControls() {
    const showingFrom = document.getElementById('showingFrom');
    const showingTo = document.getElementById('showingTo');
    const totalItems = document.getElementById('totalItems');
    const currentPage = document.getElementById('currentPage');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    
    const from = (historyState.currentPage - 1) * historyState.pageSize + 1;
    const to = Math.min(historyState.currentPage * historyState.pageSize, historyState.totalItems);
    
    showingFrom.textContent = from;
    showingTo.textContent = to;
    totalItems.textContent = historyState.totalItems;
    currentPage.textContent = historyState.currentPage;
    
    prevBtn.disabled = historyState.currentPage === 1;
    nextBtn.disabled = historyState.currentPage === historyState.totalPages;
}

// Load history page
function loadHistoryPage(direction) {
    let newPage = historyState.currentPage;
    
    if (direction === 'prev' && historyState.currentPage > 1) {
        newPage--;
    } else if (direction === 'next' && historyState.currentPage < historyState.totalPages) {
        newPage++;
    }
    
    if (newPage !== historyState.currentPage) {
        loadHistory(newPage);
    }
}

// Delete history item
async function deleteHistoryItem(analysisId) {
    const token = localStorage.getItem('sachet_token');
    
    if (!token) {
        return;
    }
    
    if (!confirm('Are you sure you want to delete this analysis?')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/analysis/history/${analysisId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Reload current page
            loadHistory(historyState.currentPage);
        } else {
            alert('Failed to delete analysis: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Delete history item error:', error);
        alert('Network error. Please try again.');
    }
}

// Create history item element
function createHistoryItem(analysis) {
    const div = document.createElement('div');
    div.className = 'border border-gray-200 rounded-lg p-4 hover:bg-gray-50';
    
    const verdictIcon = getVerdictIcon(analysis.verdict);
    const verdictColor = getVerdictColor(analysis.verdict);
    const date = new Date(analysis.createdAt).toLocaleDateString();
    const time = new Date(analysis.createdAt).toLocaleTimeString();
    
    div.innerHTML = `
        <div class="flex items-start justify-between">
            <div class="flex-1">
                <div class="flex items-center space-x-2 mb-2">
                    <i class="${verdictIcon} ${verdictColor}"></i>
                    <span class="font-medium text-gray-900">${analysis.verdict}</span>
                    <span class="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                        ${analysis.confidence}%
                    </span>
                </div>
                <p class="text-sm text-gray-600 mb-2 line-clamp-2">${analysis.explanation}</p>
                <div class="flex items-center space-x-4 text-xs text-gray-500">
                    <span><i class="fas fa-${getInputTypeIcon(analysis.inputType)} mr-1"></i>${analysis.inputType}</span>
                    <span><i class="fas fa-clock mr-1"></i>${date} ${time}</span>
                </div>
            </div>
            <button onclick="viewHistoryItem('${analysis.id}')" class="ml-4 px-3 py-1 text-sm text-indigo-600 hover:text-indigo-800">
                View
            </button>
        </div>
    `;
    
    return div;
}

// Get verdict icon
function getVerdictIcon(verdict) {
    const icons = {
        'Fake': 'fas fa-times-circle',
        'Real': 'fas fa-check-circle',
        'Misleading': 'fas fa-exclamation-triangle',
        'Uncertain': 'fas fa-question-circle'
    };
    return icons[verdict] || 'fas fa-question-circle';
}

// Get verdict color
function getVerdictColor(verdict) {
    const colors = {
        'Fake': 'text-red-600',
        'Real': 'text-green-600',
        'Misleading': 'text-yellow-600',
        'Uncertain': 'text-gray-600'
    };
    return colors[verdict] || 'text-gray-600';
}

// Get input type icon
function getInputTypeIcon(inputType) {
    const icons = {
        'text': 'keyboard',
        'url': 'link',
        'image': 'image'
    };
    return icons[inputType] || 'file';
}

// View history item details
async function viewHistoryItem(analysisId) {
    const token = localStorage.getItem('sachet_token');
    
    if (!token) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/analysis/history/${analysisId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Switch to checker tab and show results
            switchTab('checker');
            showResults(data.analysis);
        } else {
            alert('Failed to load analysis details');
        }
    } catch (error) {
        console.error('View history item error:', error);
        alert('Network error. Please try again.');
    }
}

// Refresh history
function refreshHistory() {
    loadHistory();
}

// Handle logout
function handleLogout() {
    localStorage.removeItem('sachet_token');
    localStorage.removeItem('sachet_user');
    window.location.href = 'login.html';
}

// Export functions for global access
window.switchTab = switchTab;
window.selectInputType = selectInputType;
window.handleImageSelect = handleImageSelect;
window.removeImage = removeImage;
window.handleAnalysis = handleAnalysis;
window.loadDemoExample = loadDemoExample;
window.analyzeSampleMessage = analyzeSampleMessage;
window.refreshHistory = refreshHistory;
window.viewHistoryItem = viewHistoryItem;
window.deleteHistoryItem = deleteHistoryItem;
window.loadHistoryPage = loadHistoryPage;
window.handleLogout = handleLogout;

// Quiz functions
window.startQuiz = startQuiz;
window.selectQuizAnswer = selectQuizAnswer;
window.previousQuestion = previousQuestion;
window.nextQuestion = nextQuestion;
window.finishQuiz = finishQuiz;
window.restartQuiz = restartQuiz;

// Tip carousel functions
window.previousTip = previousTip;
window.nextTip = nextTip;
window.goToTip = goToTip;

// Language functions
window.changeLanguage = changeLanguage;
window.updateTranslations = updateTranslations;

// Payment functions
window.showUpgradeModal = showUpgradeModal;
window.closeUpgradeModal = closeUpgradeModal;
window.selectPlan = selectPlan;
window.backToPlans = backToPlans;
window.processPayment = processPayment;

// Show upgrade modal
function showUpgradeModal() {
    document.getElementById('upgradeModal').classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

// Close upgrade modal
function closeUpgradeModal() {
    document.getElementById('upgradeModal').classList.add('hidden');
    document.body.style.overflow = 'auto';
    resetPaymentState();
}

// Reset payment state
function resetPaymentState() {
    paymentState.selectedPlan = null;
    paymentState.orderData = null;
    
    // Reset UI
    document.getElementById('paymentSection').classList.add('hidden');
    document.querySelectorAll('.plan-select-btn').forEach(btn => {
        btn.classList.remove('bg-purple-600', 'text-white');
        btn.classList.add('border', 'border-purple-600', 'text-purple-600');
    });
    
    // Reset plan selection
    document.querySelectorAll('[onclick*="selectPlan"]').forEach(card => {
        card.classList.remove('border-purple-500');
        card.classList.add('border-gray-200');
    });
}

// Select plan
function selectPlan(plan) {
    paymentState.selectedPlan = plan;
    
    // Update UI to show selected plan
    document.querySelectorAll('[onclick*="selectPlan"]').forEach(card => {
        card.classList.remove('border-purple-500');
        card.classList.add('border-gray-200');
    });
    
    const selectedCard = document.querySelector(`[onclick="selectPlan('${plan}')"]`);
    selectedCard.classList.remove('border-gray-200');
    selectedCard.classList.add('border-purple-500');
    
    // Update button styles
    document.querySelectorAll('.plan-select-btn').forEach(btn => {
        if (btn.getAttribute('data-plan') === plan) {
            btn.classList.remove('border', 'border-purple-600', 'text-purple-600');
            btn.classList.add('bg-purple-600', 'text-white');
        } else {
            btn.classList.add('border', 'border-purple-600', 'text-purple-600');
            btn.classList.remove('bg-purple-600', 'text-white');
        }
    });
    
    // Show payment section after a short delay
    setTimeout(() => {
        showPaymentSection(plan);
    }, 300);
}

// Show payment section
function showPaymentSection(plan) {
    const plans = {
        monthly: {
            name: 'Monthly Plan',
            price: '₹99/month',
            total: '₹99'
        },
        yearly: {
            name: 'Yearly Plan',
            price: '₹999/year',
            total: '₹999'
        }
    };
    
    const planInfo = plans[plan];
    document.getElementById('selectedPlanName').textContent = planInfo.name;
    document.getElementById('selectedPlanPrice').textContent = planInfo.price;
    document.getElementById('totalAmount').textContent = planInfo.total;
    
    document.getElementById('paymentSection').classList.remove('hidden');
}

// Back to plans
function backToPlans() {
    document.getElementById('paymentSection').classList.add('hidden');
    resetPaymentState();
}

// Process payment
async function processPayment() {
    if (!paymentState.selectedPlan) {
        alert('Please select a plan');
        return;
    }
    
    const token = localStorage.getItem('sachet_token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }
    
    const payBtn = document.getElementById('payBtn');
    const originalText = payBtn.innerHTML;
    
    try {
        // Show loading state
        payBtn.disabled = true;
        payBtn.innerHTML = '<i class="fas fa-spinner animate-spin mr-2"></i>Creating Order...';
        
        // Create Razorpay order
        const response = await fetch(`${API_BASE}/payment/create-order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                plan: paymentState.selectedPlan
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            if (data.error.includes('already have an active subscription')) {
                alert('You already have an active subscription.');
                closeUpgradeModal();
                return;
            }
            throw new Error(data.error || 'Failed to create order');
        }
        
        paymentState.orderData = data;
        
        // Open Razorpay checkout
        payBtn.innerHTML = '<i class="fas fa-spinner animate-spin mr-2"></i>Opening Payment...';
        
        const options = {
            key: data.keyId,
            amount: data.amount,
            currency: data.currency,
            name: 'Sachet',
            description: data.planDetails.description,
            order_id: data.orderId,
            handler: function(response) {
                handlePaymentSuccess(response);
            },
            modal: {
                ondismiss: function() {
                    payBtn.disabled = false;
                    payBtn.innerHTML = originalText;
                },
                escape: true,
                backdropclose: false,
                handleback: true,
                confirm_close: true,
                animation: 'fade'
            },
            prefill: {
                email: JSON.parse(localStorage.getItem('sachet_user') || '{}').email || ''
            },
            theme: {
                color: '#7c3aed'
            }
        };
        
        paymentState.razorpayInstance = new Razorpay(options);
        paymentState.razorpayInstance.open();
        
    } catch (error) {
        console.error('Payment error:', error);
        alert('Payment failed: ' + error.message);
        payBtn.disabled = false;
        payBtn.innerHTML = originalText;
    }
}

// Handle payment success
async function handlePaymentSuccess(response) {
    const token = localStorage.getItem('sachet_token');
    
    try {
        // Verify payment
        const verifyResponse = await fetch(`${API_BASE}/payment/verify-payment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature
            })
        });
        
        const data = await verifyResponse.json();
        
        if (verifyResponse.ok) {
            // Update user info in localStorage
            const user = JSON.parse(localStorage.getItem('sachet_user') || '{}');
            user.subscriptionStatus = 'pro';
            user.subscriptionExpiry = data.subscription.subscriptionExpiry;
            localStorage.setItem('sachet_user', JSON.stringify(user));
            
            // Update UI
            loadUserInfo();
            
            // Show success message
            closeUpgradeModal();
            showSuccessMessage('Payment successful! You are now a Pro user.');
            
        } else {
            throw new Error(data.error || 'Payment verification failed');
        }
        
    } catch (error) {
        console.error('Payment verification error:', error);
        alert('Payment verification failed: ' + error.message);
    }
}

// Show success message
function showSuccessMessage(message) {
    // Create a temporary success message
    const successDiv = document.createElement('div');
    successDiv.className = 'fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg shadow-lg z-50';
    successDiv.innerHTML = `
        <div class="flex items-center">
            <i class="fas fa-check-circle mr-2"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(successDiv);
    
    // Remove after 5 seconds
    setTimeout(() => {
        if (successDiv.parentNode) {
            successDiv.parentNode.removeChild(successDiv);
        }
    }, 5000);
}
