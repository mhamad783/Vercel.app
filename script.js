// Quest automation script
let automationCancelled = false;

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) discord/1.0.9215 Chrome/138.0.7204.251 Electron/37.6.0 Safari/537.36';

function generateSuperProperties() {
    const props = {
        "os": "Windows",
        "browser": "Discord Client",
        "release_channel": "stable",
        "client_version": "1.0.9215",
        "os_version": "10.0.19045",
        "os_arch": "x64",
        "app_arch": "x64",
        "system_locale": "en-US",
        "has_client_mods": false,
        "client_build_number": 471091,
        "native_build_number": 72186,
    };
    return btoa(JSON.stringify(props));
}

// UI Elements
const tokenInput = document.getElementById('tokenInput');
const toggleToken = document.getElementById('toggleToken');
const startBtn = document.getElementById('startBtn');
const cancelBtn = document.getElementById('cancelBtn');
const progressSection = document.getElementById('progressSection');
const logContainer = document.getElementById('logContainer');
const progressBar = document.querySelector('.progress-fill');
const progressText = document.getElementById('progressText');

// Toggle token visibility
toggleToken.addEventListener('click', () => {
    const type = tokenInput.type === 'password' ? 'text' : 'password';
    tokenInput.type = type;
});

// Log message function
function addLog(icon, message, type = 'info') {
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    
    let color = 'var(--text-secondary)';
    if (type === 'success') color = 'var(--success)';
    if (type === 'error') color = 'var(--danger)';
    if (type === 'warning') color = 'var(--warning)';
    
    logEntry.innerHTML = `
        <span class="log-icon">${icon}</span>
        <span class="log-text" style="color: ${color}">${message}</span>
    `;
    
    logContainer.appendChild(logEntry);
    logContainer.scrollTop = logContainer.scrollHeight;
}

function clearLogs() {
    logContainer.innerHTML = '';
}

function updateProgress(percentage) {
    progressBar.style.width = `${percentage}%`;
    progressText.textContent = `${Math.round(percentage)}%`;
}

// Start automation
startBtn.addEventListener('click', async () => {
    const token = tokenInput.value.trim();
    
    if (!token) {
        alert('Please enter your Discord token');
        return;
    }
    
    // Remove quotes if user copied with them
    const cleanToken = token.replace(/['"]/g, '');
    
    // Show progress section
    progressSection.style.display = 'block';
    startBtn.disabled = true;
    automationCancelled = false;
    clearLogs();
    updateProgress(0);
    
    try {
        await runQuestAutomation(cleanToken);
    } catch (error) {
        addLog('❌', `Error: ${error.message}`, 'error');
    } finally {
        startBtn.disabled = false;
    }
});

// Cancel automation
cancelBtn.addEventListener('click', () => {
    automationCancelled = true;
    addLog('⚠️', 'Automation cancelled by user', 'warning');
    startBtn.disabled = false;
});

// Main automation function
async function runQuestAutomation(token) {
    addLog('🔐', 'Verifying token...');
    
    const headers = {
        'Authorization': token,
        'User-Agent': USER_AGENT,
        'X-Super-Properties': generateSuperProperties(),
        'Content-Type': 'application/json'
    };
    
    // Verify token
    try {
        const userResp = await fetch('https://discord.com/api/v10/users/@me', { headers });
        
        if (!userResp.ok) {
            throw new Error(`Invalid token (HTTP ${userResp.status})`);
        }
        
        const userData = await userResp.json();
        const username = userData.discriminator === '0' ? userData.username : `${userData.username}#${userData.discriminator}`;
        
        addLog('✅', `Logged in as: ${username}`, 'success');
        updateProgress(10);
        
    } catch (error) {
        throw new Error('Failed to verify token. Make sure it\'s correct.');
    }
    
    if (automationCancelled) return;
    
    // Fetch quests
    addLog('🔍', 'Fetching quests...');
    
    try {
        const questsResp = await fetch('https://discord.com/api/v10/quests/@me', { headers });
        
        if (!questsResp.ok) {
            throw new Error(`Failed to fetch quests (HTTP ${questsResp.status})`);
        }
        
        const questsData = await questsResp.json();
        const quests = questsData.quests || [];
        
        addLog('📋', `Found ${quests.length} total quests`);
        updateProgress(20);
        
        // Find eligible quest
        let quest = null;
        for (const q of quests) {
            if (q.id === '1412491570820812933') continue; // Skip tutorial
            
            const userStatus = q.userStatus || {};
            if (userStatus.completedAt) continue;
            if (!userStatus.enrolledAt) continue;
            if (!q.config) continue;
            
            // Check expiration
            try {
                const expiresAt = new Date(q.config.expiresAt);
                if (expiresAt <= new Date()) continue;
            } catch (e) {}
            
            quest = q;
            break;
        }
        
        if (!quest) {
            throw new Error('No enrolled, incomplete quests found. Please accept a quest in Discord first!');
        }
        
        const questName = quest.config?.messages?.questName || 'Unknown Quest';
        const appName = quest.config?.application?.name || 'Unknown';
        
        addLog('🎮', `Quest: ${questName}`);
        addLog('📱', `Game: ${appName}`);
        updateProgress(30);
        
        if (automationCancelled) return;
        
        // Get task config
        const taskConfig = quest.config.taskConfig || quest.config.taskConfigV2;
        if (!taskConfig || !taskConfig.tasks) {
            throw new Error('Quest has no task configuration');
        }
        
        // Find task type
        const taskTypes = ['WATCH_VIDEO', 'WATCH_VIDEO_ON_MOBILE', 'PLAY_ACTIVITY'];
        let taskName = null;
        
        for (const t of taskTypes) {
            if (taskConfig.tasks[t]) {
                taskName = t;
                break;
            }
        }
        
        if (!taskName) {
            const available = Object.keys(taskConfig.tasks).join(', ');
            throw new Error(`Unsupported quest type: ${available}`);
        }
        
        const taskData = taskConfig.tasks[taskName];
        const secondsNeeded = taskData.target || 0;
        let secondsDone = quest.userStatus?.progress?.[taskName]?.value || 0;
        
        addLog('⚙️', `Task type: ${taskName}`);
        addLog('⏱️', `Target: ${secondsNeeded} seconds`);
        updateProgress(40);
        
        if (automationCancelled) return;
        
        // Handle VIDEO quests
        if (taskName === 'WATCH_VIDEO' || taskName === 'WATCH_VIDEO_ON_MOBILE') {
            addLog('🎥', 'Starting video quest automation...');
            
            const enrolledAt = new Date(quest.userStatus.enrolledAt);
            const maxFuture = 10;
            const speed = 7;
            const interval = 1000; // 1 second
            
            while (secondsDone < secondsNeeded) {
                if (automationCancelled) {
                    addLog('⚠️', 'Cancelled', 'warning');
                    return;
                }
                
                const now = Date.now();
                const maxAllowed = Math.floor((now - enrolledAt.getTime()) / 1000) + maxFuture;
                const diff = maxAllowed - secondsDone;
                
                if (diff >= speed) {
                    const timestamp = Math.min(secondsNeeded, secondsDone + speed + Math.random());
                    
                    try {
                        const resp = await fetch(`https://discord.com/api/v10/quests/${quest.id}/video-progress`, {
                            method: 'POST',
                            headers,
                            body: JSON.stringify({ timestamp })
                        });
                        
                        if (resp.ok) {
                            secondsDone = Math.min(secondsNeeded, Math.floor(timestamp));
                            const progress = 40 + (secondsDone / secondsNeeded) * 50;
                            updateProgress(progress);
                            addLog('📊', `Progress: ${secondsDone}/${secondsNeeded}s (${Math.round((secondsDone/secondsNeeded)*100)}%)`);
                        }
                    } catch (e) {
                        addLog('⚠️', 'Network error, retrying...', 'warning');
                    }
                }
                
                await new Promise(resolve => setTimeout(resolve, interval));
            }
            
            // Final completion
            try {
                await fetch(`https://discord.com/api/v10/quests/${quest.id}/video-progress`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ timestamp: secondsNeeded })
                });
            } catch (e) {}
            
            updateProgress(100);
            addLog('✅', 'Quest completed successfully!', 'success');
            addLog('🎁', 'You can now claim your reward in Discord!', 'success');
            
        } 
        // Handle ACTIVITY quests
        else if (taskName === 'PLAY_ACTIVITY') {
            addLog('🎮', 'Starting activity quest automation...');
            
            const streamKey = 'generic:1';
            
            while (secondsDone < secondsNeeded) {
                if (automationCancelled) {
                    addLog('⚠️', 'Cancelled', 'warning');
                    return;
                }
                
                try {
                    const resp = await fetch(`https://discord.com/api/v10/quests/${quest.id}/heartbeat`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ stream_key: streamKey, terminal: false })
                    });
                    
                    if (resp.ok) {
                        const data = await resp.json();
                        secondsDone = data.progress?.[taskName]?.value || secondsDone;
                        const progress = 40 + (secondsDone / secondsNeeded) * 50;
                        updateProgress(progress);
                        addLog('📊', `Progress: ${Math.floor(secondsDone)}/${secondsNeeded}s (${Math.round((secondsDone/secondsNeeded)*100)}%)`);
                    }
                } catch (e) {
                    addLog('⚠️', 'Network error, retrying...', 'warning');
                }
                
                await new Promise(resolve => setTimeout(resolve, 20000)); // 20 seconds
            }
            
            // Send terminal heartbeat
            try {
                await fetch(`https://discord.com/api/v10/quests/${quest.id}/heartbeat`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ stream_key: streamKey, terminal: true })
                });
            } catch (e) {}
            
            updateProgress(100);
            addLog('✅', 'Quest completed successfully!', 'success');
            addLog('🎁', 'You can now claim your reward in Discord!', 'success');
        }
        
    } catch (error) {
        throw error;
    }
}

// Smooth scroll for navigation
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});

