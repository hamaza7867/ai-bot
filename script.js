// --- Configuration & State ---
let currentFileData = null;
let currentFileName = null;
let currentFileType = null;
let conversationHistory = [];
let isConnected = false;
let apiKey = '';

// List of supported models for the dropdown
const supportedModels = [
    { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet' },
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku' },
    { value: 'deepseek-r1-0528', label: 'DeepSeek R1' },
    { value: 'deepseek-v3.1', label: 'DeepSeek v3.1' },
    { value: 'deepseek-v3.2', label: 'DeepSeek v3.2' },
    { value: 'glm-4.5', label: 'GLM 4.5' },
    { value: 'glm-4.6', label: 'GLM 4.6' }
];

// --- DOM Elements ---
const apiKeyInput = document.getElementById('apiKey');
const modelSelector = document.getElementById('modelSelector');
const connectBtn = document.getElementById('connectBtn');
const apiStatus = document.getElementById('apiStatus');
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const removeBtn = document.getElementById('removeBtn');
const fileInfo = document.getElementById('fileInfo');
const fileInfoText = document.getElementById('fileInfoText');
const errorDiv = document.getElementById('error');
const chatMessages = document.getElementById('chatMessages');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');


// --- Initialization and UI Helpers ---

function populateModelSelector() {
    supportedModels.forEach(model => {
        const option = document.createElement('option');
        option.value = model.value;
        option.textContent = model.label + ' (' + model.value + ')';
        // Set a default model
        if (model.value === 'claude-sonnet-4-5-20250929') {
            option.selected = true;
        }
        modelSelector.appendChild(option);
    });
}

populateModelSelector(); 

// Auto-resize textarea
userInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 150) + 'px';
});

function removeFile() {
    currentFileData = null;
    currentFileName = null;
    currentFileType = null;
    fileInput.value = '';
    fileInfo.style.display = 'none';
    removeBtn.style.display = 'none';
    uploadBtn.disabled = true;
}

function showFileInfo(fileName) {
    fileInfoText.textContent = `📎 File attached: ${fileName}`;
    fileInfo.style.display = 'flex';
    removeBtn.style.display = 'block';
    uploadBtn.disabled = true;
}

function showError(message) {
    errorDiv.textContent = '❌ ' + message;
    errorDiv.style.display = 'block';
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

function addMessage(content, isUser, avatarChar) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user' : 'assistant'}`;
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = avatarChar || (isUser ? 'U' : 'C');
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.textContent = content; 
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(messageContent);
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeLoadingMessage() {
    const loading = document.getElementById('loading-message');
    if (loading) loading.remove();
}

// --- Connection/Disconnection Logic ---

function disconnect() {
    isConnected = false;
    apiKey = '';
    apiKeyInput.disabled = false;
    modelSelector.disabled = false;
    apiKeyInput.value = '';
    apiStatus.textContent = '⚠️ Not Connected';
    apiStatus.className = 'api-status disconnected';
    connectBtn.textContent = 'Connect';
    connectBtn.style.background = '#667eea';
    fileInput.disabled = true;
    userInput.disabled = true;
    sendBtn.disabled = true;
    removeFile();
    conversationHistory = [];
    chatMessages.innerHTML = '';
    addMessage('👋 Hello! I\'m your AI assistant powered by AgentRouter. To get started, please connect your API key.', false, 'C');
}

async function connect() {
    if (isConnected) {
        disconnect();
        return;
    }

    const key = apiKeyInput.value.trim();
    if (!key) {
        showError('Please enter your API key');
        return;
    }

    // Test the API key
    try {
        const selectedModel = modelSelector.value;
        
        const response = await fetch('https://agentrouter.org', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': key,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: selectedModel,
                max_tokens: 10,
                messages: [{ role: 'user', content: 'Test connection' }]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = `API key failed validation. Status: ${response.status}.`;
            try {
                const errorJson = JSON.parse(errorText);
                errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
            } catch(e) {
                errorMessage += ` Details (non-JSON): ${errorText.substring(0, 50)}...`;
            }
            throw new Error(errorMessage);
        }

        // Connection successful
        apiKey = key;
        isConnected = true;
        apiStatus.textContent = '✅ Connected';
        apiStatus.className = 'api-status connected';
        apiKeyInput.disabled = true;
        modelSelector.disabled = true;
        connectBtn.textContent = 'Disconnect';
        connectBtn.style.background = '#ef5350';
        fileInput.disabled = false;
        userInput.disabled = false;
        sendBtn.disabled = false;
        userInput.focus();
        
        chatMessages.innerHTML = '';
        addMessage('✅ API Connection successful. Using model: ' + selectedModel + '. You can now start chatting!', false, 'C');

    } catch (error) {
        showError('Failed to connect to AgentRouter: ' + error.message);
    }
}

// --- Event Listeners and Upload Logic ---

connectBtn.addEventListener('click', connect);

fileInput.addEventListener('change', function() {
    uploadBtn.disabled = !this.files[0];
});

uploadBtn.addEventListener('click', async function() {
    const file = fileInput.files[0];
    if (!file) return;

    try {
        errorDiv.style.display = 'none';
        
        if (file.size > 5 * 1024 * 1024) {
            throw new Error('File size exceeds 5MB limit.');
        }
        
        if (file.type === 'application/pdf') {
            const reader = new FileReader();
            reader.onload = function(e) {
                currentFileData = e.target.result.split(',')[1];
                currentFileName = file.name;
                currentFileType = 'application/pdf';
                showFileInfo(file.name);
            };
            reader.readAsDataURL(file);
        } else if (file.type === 'text/plain') {
            const reader = new FileReader();
            reader.onload = function(e) {
                currentFileData = e.target.result;
                currentFileName = file.name;
                currentFileType = 'text/plain';
                showFileInfo(file.name);
            };
            reader.readAsText(file);
        } else {
            throw new Error('Unsupported file type. Please upload PDF or TXT files.');
        }
    } catch (error) {
        showError(error.message);
    }
});

removeBtn.addEventListener('click', removeFile);


// --- Message Sending Logic ---

async function sendMessage() {
    const message = userInput.value.trim();
    if (!message || !isConnected) return;

    addMessage(message, true, 'U');
    userInput.value = '';
    userInput.style.height = 'auto';
    userInput.disabled = true;
    sendBtn.disabled = true;
    // Helper function to show typing indicator
    const loadingMessageDiv = document.createElement('div');
    loadingMessageDiv.className = 'message assistant';
    loadingMessageDiv.id = 'loading-message';
    loadingMessageDiv.innerHTML = '<div class="message-avatar">C</div><div class="message-content"><div class="loading"><div class="loading-dot"></div><div class="loading-dot"></div><div class="loading-dot"></div></div></div>';
    chatMessages.appendChild(loadingMessageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
        let userMessageContent = [];
        const selectedModel = modelSelector.value;

        // Add file data ONLY if it's the first message since a file was uploaded
        if (currentFileData && conversationHistory.length === 0) {
            if (currentFileType === 'application/pdf') {
                userMessageContent.push({
                    type: "document",
                    source: {
                        type: "base64",
                        media_type: "application/pdf",
                        data: currentFileData
                    }
                });
            } else if (currentFileType === 'text/plain') {
                userMessageContent.push({
                    type: "text",
                    text: `Here is the content of attached file "${currentFileName}":\n\n${currentFileData}\n\n---\n\n`
                });
            }
        }
        
        userMessageContent.push({
            type: "text",
            text: message
        });

        let messages = [...conversationHistory];
        messages.push({
            role: "user",
            content: userMessageContent
        });

        const response = await fetch('https://agentrouter.org', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: selectedModel,
                max_tokens: 4096,
                messages: messages
            })
        });

        // Robust error handling to catch non-JSON responses (like HTML error pages)
        if (!response.ok) {
            let errorText = await response.text();
            let errorMessage = `API request failed! Status: ${response.status}.`;
            
            try {
                const errorJson = JSON.parse(errorText);
                errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
            } catch (e) {
                errorMessage += ` Server returned non-JSON data. Details (start): ${errorText.substring(0, 100)}...`;
            }
            throw new Error(errorMessage);
        }

        // Safely parse JSON
        const data = await response.json();
        const assistantMessage = data.content.map(c => c.text).join('\n').trim();

        // Update history
        conversationHistory.push({
            role: "user",
            content: userMessageContent
        });
        conversationHistory.push({
            role: "assistant",
            content: [{type: "text", text: assistantMessage}]
        });

        if (currentFileData) {
            currentFileData = null;
        }
        
        removeLoadingMessage();
        addMessage(assistantMessage, false, 'C');

    } catch (error) {
        removeLoadingMessage();
        showError(error.message);
        addMessage('Sorry, I encountered an error: ' + error.message, false, 'C');
    } finally {
        userInput.disabled = false;
        sendBtn.disabled = false;
        userInput.focus();
    }
}

sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && !e.shiftKey && !userInput.disabled) {
        e.preventDefault();
        sendMessage();
    }
});
