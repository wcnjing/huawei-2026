// 1. Database of scenario items mapped by key identifiers
const database = {
    mom: {
        isScam: false,
        sender: "Mom 👩",
        explanation: "This is a normal message from your family. No links, no panic, no strange routing profiles."
    },
    bank: {
        isScam: true,
        sender: "Chase Alerts <security-verification@chase-locked-portal.net>",
        textPre: "🔒 SECURITY ALERT: Unusual activity detected. Your debit access has been restricted. Please re-verify your identity immediately at: ",
        linkText: "http://chase-identity-login-gateway.net/secure",
        textPost: " to prevent account closure.",
        clues: {
            sender: "Red Flag: Look closely at the domain name. This email address uses a generic '.net' domain rather than the official 'chase.com'.",
            link: "Red Flag: This link looks official but navigates directly to a phishing site designed to copy your bank passwords.",
            urgency: "Red Flag: Scammers use fear terms like 'immediately' and 'account closure' to make you stop thinking critically."
        },
        explanation: "Banks will never threaten immediate closure via text lines containing non-standard domains."
    },
    usps: {
        isScam: true,
        sender: "USPS Notification <redelivery-agent92@tracking-update-post.org>",
        textPre: "⚠️ USPS Notice: The delivery address for your shipment was unreadable. A small handling modification charge of $1.25 applies. Follow link: ",
        linkText: "https://usps-address-redirection-processing.org",
        textPost: " within 12 hours or item returns to sender.",
        clues: {
            sender: "Red Flag: The official postal system does not send alerts using public '.org' accounts or random strings like 'agent92'.",
            link: "Red Flag: Lookalike tracking platforms look real but harvest card parameters on forms.",
            urgency: "Red Flag: The 12-hour limit forces panic responses."
        },
        explanation: "Postal services run on automated collection points and don't charge random micro-adjustment fees to change addresses over email."
    }
};

let activeKey = null;

// 2. Navigation Actions
function selectInboxMessage(key) {
    activeKey = key;
    const target = database[key];

    if (!target.isScam) {
        document.getElementById('feedback-section').classList.remove('hidden');
        document.getElementById('feedback-section').className = "feedback-card pass";
        document.getElementById('feedback-title').innerText = "✅ Good Judgment!";
        document.getElementById('feedback-text').innerText = `You opened a safe connection track. ${target.explanation}`;
        document.getElementById('action-panel-btn').innerText = "Back to Inbox ➡️";
        return;
    }

    // Reset layout panels back to normal chat mode
    document.getElementById('game-instructions').innerText = "Assess the threat conditions inside the active thread profile.";
    document.getElementById('inbox-view').classList.add('hidden');
    document.getElementById('chat-view').classList.remove('hidden');
    document.getElementById('feedback-section').classList.add('hidden');
    
    // Set the inspector banner back to its initial neutral state
    const banner = document.getElementById('inspector-hint');
    banner.classList.add('hidden');
    banner.innerText = "🔍 Click on the highlighted red flags above to learn why they are dangerous.";
    banner.style.background = "#f2f2f7";
    banner.style.borderColor = "#d1d1d6";

    // Build regular chat bubble layout state
    document.getElementById('scam-sender').innerText = target.sender;
    document.getElementById('scam-message-bubble').innerHTML = `
        <span>${target.textPre}</span>
        <a href="#" class="scam-trap-link" onclick="handleChoice('click'); return false;">${target.linkText}</a>
        <span>${target.textPost}</span>
    `;
}

// 3. Choice Processing Logic 
function handleChoice(action) {
    const target = database[activeKey];
    const feedbackSection = document.getElementById('feedback-section');
    const feedbackTitle = document.getElementById('feedback-title');
    const feedbackText = document.getElementById('feedback-text');

    feedbackSection.classList.remove('hidden', 'pass', 'fail');

    if (action === 'block' || action === 'ignore') {
        feedbackTitle.innerText = action === 'block' ? "✅ Outstanding Defense!" : "🛡️ Safe Response (Ignored)";
        feedbackText.innerText = `Great reflex! By refusing to interface with the message content elements, you kept your system locked. ${target.explanation}`;
        feedbackSection.classList.add('pass');
        document.getElementById('action-panel-btn').innerText = "Try Another Drill ➡️";
    } 
    else if (action === 'click') {
        // ACTIVATE INTERACTIVE RED FLAG INSPECTOR MODE
        feedbackTitle.innerText = "❌ Compromised / Threat Triggered";
        feedbackText.innerText = "Oh no! You clicked the dangerous link. The app has switched into Red Flag Inspector Mode. Click the glowing parts of the message below to analyze the trap structures.";
        feedbackSection.classList.add('fail');
        
        // FIX: Ensure this button is correctly configured to route back to the inbox screen
        document.getElementById('action-panel-btn').innerText = "Try Another Drill ➡️";

        // Reconstruct message segments into individual inspectable nodes
        document.getElementById('inspector-hint').classList.remove('hidden');
        document.getElementById('scam-message-bubble').innerHTML = `
            <span class="inspect-node urgency" onclick="inspectClue('urgency')">${target.textPre}</span>
            <span class="inspect-node link" onclick="inspectClue('link')">${target.linkText}</span>
            <span class="inspect-node urgency" onclick="inspectClue('urgency')">${target.textPost}</span>
        `;
        // Turn header profile details inspectable too
        document.getElementById('scam-sender').innerHTML = `<span class="inspect-node sender" onclick="inspectClue('sender')">${target.sender}</span>`;
    }
}

// 4. Inspector Tool Click Action
function inspectClue(clueKey) {
    const target = database[activeKey];
    
    // Updates the banner panel text content inline cleanly
    const banner = document.getElementById('inspector-hint');
    banner.innerText = target.clues[clueKey];
    banner.style.background = "#ffffe0"; 
    banner.style.borderColor = "#ffcc00";
}

function resetToInbox() {
    activeKey = null;
    document.getElementById('game-instructions').innerText = "Select an unread message from your inbox to begin.";
    document.getElementById('inbox-view').classList.remove('hidden');
    document.getElementById('chat-view').classList.add('hidden');
    document.getElementById('feedback-section').classList.add('hidden');
}