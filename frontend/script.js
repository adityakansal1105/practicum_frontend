document.addEventListener("DOMContentLoaded", function () {
    const PROD_API = 'https://adityakansal1105-practicum-backend.hf.space';
    const isLocal = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
    const API_BASE = isLocal ? 'http://127.0.0.1:8000' : PROD_API;

    if (!localStorage.getItem('diagnosis_history')) {
        localStorage.setItem('diagnosis_history', JSON.stringify([]));
    }

    const app = {
        state: {
            diagnosis: { name: '', age: null, gender: '', conditions: [], symptoms: [], severity: '' },
            selectedSymptoms: []
        },

        init() {
            if (document.getElementById('diagnosis-form')) {
                this.initDiagnosisPage();
            } else if (document.getElementById('diseases-list')) {
                this.initResultPage();
            } else if (document.getElementById('history-list')) {
                this.initDashboardPage();
            }
            this.injectChatbot();
        },

        showToast(message) {
            let toast = document.getElementById('toast');
            if (!toast) {
                toast = document.createElement('div');
                toast.id = 'toast';
                document.body.appendChild(toast);
            }
            toast.innerText = message;
            toast.style.display = 'block';
            setTimeout(() => { toast.style.display = 'none'; }, 4000);
        },

        // --- DIAGNOSIS PAGE LOGIC ---
        initDiagnosisPage() {
            this.populateSymptoms();
            
            const condInput = document.getElementById('diag-conditions');
            if (condInput) {
                condInput.addEventListener('change', (e) => {
                    const vals = e.target.value.split(',').map(s => s.trim()).filter(s => s);
                    this.state.diagnosis.conditions = vals;
                });
            }

            const searchInput = document.getElementById('symptom-search-input');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    this.filterSymptoms(e.target.value.toLowerCase());
                });
            }

            const form = document.getElementById('diagnosis-form');
            if (form) {
                form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.submitDiagnosis();
                });
            }
        },

        nextStep(step) {
            if (step === 2) {
                const nameInput = document.getElementById('diag-name');
                const ageInput = document.getElementById('diag-age');
                const genderInput = document.getElementById('diag-gender');
                
                if (!nameInput.value || !ageInput.value || !genderInput.value) {
                    document.getElementById('diagnosis-form').reportValidity();
                    return;
                }
                
                this.state.diagnosis.name = nameInput.value.trim();
                this.state.diagnosis.age = parseInt(ageInput.value);
                this.state.diagnosis.gender = genderInput.value;
            }

            if (step === 3) {
                if (this.state.selectedSymptoms.length === 0) {
                    this.showToast("Please select at least one symptom.");
                    return;
                }
            }

            const progressPercentage = ((step - 1) / 2) * 100 + 33.33; 
            document.getElementById('diag-progress').style.width = `${progressPercentage}%`;

            for (let i = 1; i <= 3; i++) {
                document.getElementById(`diag-step-${i}`).classList.add('hidden');
                document.getElementById(`step-label-${i}`).classList.remove('active');
            }
            
            document.getElementById(`diag-step-${step}`).classList.remove('hidden');
            
            for (let i = 1; i <= step; i++) {
                document.getElementById(`step-label-${i}`).classList.add('active');
            }
        },

        commonSymptomsList: [
            'Fever', 'Cough', 'Fatigue', 'Headache', 'Nausea', 'Vomiting', 'Diarrhea', 
            'Shortness of breath', 'Chest pain', 'Muscle ache', 'Sore throat', 'Chills',
            'Dizziness', 'Loss of taste', 'Loss of smell', 'Abdominal pain', 'Rash', 'Joint pain'
        ],

        populateSymptoms() {
            this.renderSymptomsList(this.commonSymptomsList);
        },

        renderSymptomsList(list) {
            const container = document.getElementById('symptoms-container');
            if (!container) return;

            container.innerHTML = list.map(sym => {
                const isSelected = this.state.selectedSymptoms.includes(sym);
                return `
                    <span class="tag ${isSelected ? 'selected' : ''}" data-sym="${sym}" onclick="app.toggleSymptom(this, '${sym}')">
                        ${sym} ${isSelected ? "<i class='bx bx-check'></i>" : "<i class='bx bx-plus'></i>"}
                    </span>
                `;
            }).join('');
        },

        filterSymptoms(query) {
            const filtered = this.commonSymptomsList.filter(sym => sym.toLowerCase().includes(query));
            this.renderSymptomsList(filtered);
        },

        toggleSymptom(el, sym) {
            const index = this.state.selectedSymptoms.indexOf(sym);
            if (index > -1) {
                this.state.selectedSymptoms.splice(index, 1);
            } else {
                this.state.selectedSymptoms.push(sym);
            }
            const searchInput = document.getElementById('symptom-search-input');
            const query = searchInput ? searchInput.value.toLowerCase() : '';
            this.filterSymptoms(query);
            this.renderSelectedSymptoms();
        },

        renderSelectedSymptoms() {
            const container = document.getElementById('selected-symptoms');
            if (!container) return;
            
            if (this.state.selectedSymptoms.length === 0) {
                container.innerHTML = '<span class="text-muted" style="font-size: 0.85rem;">None selected.</span>';
                return;
            }

            container.innerHTML = this.state.selectedSymptoms.map(sym => `
                <span class="tag selected" onclick="app.toggleSymptom(this, '${sym}')">
                    ${sym} <i class='bx bx-x'></i>
                </span>
            `).join('');
        },

        selectSeverity(level) {
            this.state.diagnosis.severity = level;
            document.querySelectorAll('.severity-card').forEach(card => card.classList.remove('selected'));
            document.getElementById(`sev-${level}`).classList.add('selected');
        },

        formatDateTime(dateObj) {
            const options = { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true };
            return dateObj.toLocaleDateString('en-GB', options).replace(',', '');
        },

        async submitDiagnosis() {
            if (!this.state.diagnosis.severity) {
                this.showToast("Please select the severity of your symptoms.");
                return;
            }

            this.state.diagnosis.symptoms = this.state.selectedSymptoms;

            const submitBtn = document.getElementById('submit-btn');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = 'Analyzing... <i class="bx bx-loader-alt bx-spin"></i>';
            }
            
            const loader = document.getElementById('global-loader');
            if (loader) loader.classList.remove('hidden');

            try {
                const payload = {
                    name: this.state.diagnosis.name || 'Anonymous',
                    age: this.state.diagnosis.age || 30,
                    gender: this.state.diagnosis.gender || 'Other',
                    symptoms: this.state.diagnosis.symptoms,
                    severity: this.state.diagnosis.severity,
                    conditions: this.state.diagnosis.conditions
                };

                const response = await fetch(`${API_BASE}/predict`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) throw new Error('API Request Failed');
                
                const result = await response.json();
                this.storeTempResultAndRedirect(result, this.state.diagnosis);

            } catch (error) {
                console.error('[API Error]', error);
                this.showToast("Failed to connect to prediction server. Please try again.");
                if (loader) loader.classList.add('hidden');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = "Get Diagnosis <i class='bx bx-magic-wand'></i>";
                }
            }
        },

        storeTempResultAndRedirect(result, requestData) {
            const formattedDate = this.formatDateTime(new Date());
            
            const pendingResult = {
                id: Date.now(),
                name: requestData.name,
                age: requestData.age,
                date: formattedDate,
                symptoms: requestData.symptoms,
                severity: requestData.severity, 
                ...result
            };

            localStorage.setItem('pending_result', JSON.stringify(pendingResult));
            window.location.href = 'result.html';
        },

        // --- RESULT PAGE LOGIC ---
        initResultPage() {
            const dataStr = localStorage.getItem('pending_result');
            if (!dataStr) {
                window.location.href = 'diagnosis.html';
                return;
            }

            const data = JSON.parse(dataStr);

            const greetingEl = document.getElementById('res-greeting');
            if (greetingEl) greetingEl.innerText = `Hello, ${data.name.split(' ')[0]}`;

            const banner = document.getElementById('emergency-banner');
            if (banner) {
                if (data.emergency) {
                    banner.classList.remove('hidden');
                } else {
                    banner.classList.add('hidden');
                }
            }

            const badge = document.getElementById('res-risk-badge');
            if (badge) {
                badge.innerText = data.risk_level;
                badge.className = 'badge'; 
                if (data.risk_level === 'High') badge.classList.add('badge-red');
                else if (data.risk_level === 'Medium') badge.classList.add('badge-yellow');
                else badge.classList.add('badge-green');
            }

            const recEl = document.getElementById('res-recommendation');
            if (recEl) recEl.innerText = data.recommendation;

            const list = document.getElementById('diseases-list');
            if (list) {
                list.innerHTML = data.possible_diseases.map((d) => {
                    const percentage = (d.probability * 100).toFixed(1);
                    return `
                        <div class="disease-item">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-weight: 500; color: var(--text-main);">
                                <span>${d.name}</span>
                                <span>${percentage}%</span>
                            </div>
                            <div class="prob-bar-bg">
                                <div class="prob-bar-fill" style="width: 0%" data-target-width="${percentage}%"></div>
                            </div>
                        </div>
                    `;
                }).join('');

                setTimeout(() => {
                    document.querySelectorAll('.prob-bar-fill').forEach(bar => {
                        bar.style.width = bar.getAttribute('data-target-width');
                    });
                }, 150);
            }

            const expSym = document.getElementById('exp-symptoms');
            const expDis = document.getElementById('exp-disease');
            if (expSym && expDis) {
                expSym.innerText = data.symptoms.join(', ');
                expDis.innerText = data.possible_diseases && data.possible_diseases.length > 0 ? data.possible_diseases[0].name : 'Unknown Condition';
            }

            this.calculateHealthScore(data);
            this.populateNextSteps(data.risk_level);
        },

        calculateHealthScore(data) {
            let baseScore = 100;
            
            let sevPenalty = data.severity === 'severe' ? 30 : (data.severity === 'moderate' ? 15 : 5);
            let symPenalty = Math.min((data.symptoms ? data.symptoms.length : 0) * 3, 20);
            let topProb = data.possible_diseases && data.possible_diseases.length > 0 ? data.possible_diseases[0].probability : 0;
            let probPenalty = topProb * 30;

            let healthScore = Math.floor(baseScore - sevPenalty - symPenalty - probPenalty);
            
            if (isNaN(healthScore)) healthScore = 50;
            if (healthScore < 5) healthScore = 5;
            if (healthScore > 100) healthScore = 100;

            const circle = document.getElementById('health-score-circle');
            const numEl = document.getElementById('hs-number');
            const labelEl = document.getElementById('hs-label');

            if (!circle || !numEl || !labelEl) return;

            let current = 0;
            const step = Math.max(1, Math.ceil(healthScore / 20)); 
            const timer = setInterval(() => {
                current += step;
                if (current >= healthScore) {
                    current = healthScore;
                    clearInterval(timer);
                }
                numEl.innerText = current;
            }, 30);

            if (healthScore >= 80) {
                circle.style.borderColor = "var(--accent)";
                labelEl.innerText = "Good";
                labelEl.style.color = "var(--accent)";
            } else if (healthScore >= 50) {
                circle.style.borderColor = "#F59E0B";
                labelEl.innerText = "Moderate";
                labelEl.style.color = "#F59E0B";
            } else {
                circle.style.borderColor = "#EF4444";
                labelEl.innerText = "High Risk";
                labelEl.style.color = "#EF4444";
            }
        },

        populateNextSteps(riskLevel) {
            const listEl = document.getElementById('next-steps-list');
            if (!listEl) return;

            let html = '';
            if (riskLevel === 'Low') {
                html = `
                    <li><i class='bx bx-check text-green'></i> Get plenty of rest and sleep.</li>
                    <li><i class='bx bx-check text-green'></i> Maintain proper hydration throughout the day.</li>
                    <li><i class='bx bx-check text-green'></i> Monitor your symptoms for any sudden changes.</li>
                `;
            } else if (riskLevel === 'Medium') {
                html = `
                    <li><i class='bx bx-error text-yellow'></i> Closely monitor your symptoms over the next 24 hours.</li>
                    <li><i class='bx bx-error text-yellow'></i> Consider scheduling an appointment with your doctor soon.</li>
                    <li><i class='bx bx-error text-yellow'></i> Avoid strenuous physical activities until you feel better.</li>
                `;
            } else {
                html = `
                    <li><i class='bx bx-error-circle text-red'></i> Seek immediate medical attention.</li>
                    <li><i class='bx bx-error-circle text-red'></i> Visit an urgent care or ER if symptoms worsen rapidly.</li>
                    <li><i class='bx bx-error-circle text-red'></i> Do not ignore sudden sharp pains, high fever, or breathing difficulties.</li>
                `;
            }

            listEl.innerHTML = html;
        },

        saveAndGoDashboard() {
            const saveBtn = document.getElementById('save-btn');
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.innerHTML = 'Saving... <i class="bx bx-loader-alt bx-spin"></i>';
            }

            localStorage.removeItem('pending_result');

            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 500);
        },

        // --- DASHBOARD PAGE LOGIC ---
        async initDashboardPage() {
            const list = document.getElementById('history-list');
            if (!list) return;

            let history = [];
            try {
                const response = await fetch(`${API_BASE}/history`);
                if (response.ok) {
                    history = await response.json();
                }
            } catch (err) {
                console.error("Failed to load history", err);
            }
            
            // Store globally for download
            window.currentHistory = history;

            const totalEl = document.getElementById('stat-total');
            const highRiskEl = document.getElementById('stat-high-risk');
            const medRiskEl = document.getElementById('stat-med-risk');
            const topSymEl = document.getElementById('stat-top-symptom');
            const topDisEl = document.getElementById('stat-top-disease');
            
            if (totalEl) totalEl.innerText = history.length;
            if (highRiskEl) highRiskEl.innerText = history.filter(h => h.risk_level === 'High').length;
            if (medRiskEl) medRiskEl.innerText = history.filter(h => h.risk_level === 'Medium').length;
            
            if (history.length === 0) {
                if (topSymEl) topSymEl.innerText = "N/A";
                if (topDisEl) topDisEl.innerText = "N/A";
                
                list.innerHTML = `
                    <div class="card text-center" style="padding: 60px 20px;">
                        <i class='bx bx-folder-open' style="font-size: 3rem; margin-bottom: 16px; color: var(--border-light);"></i>
                        <h3 style="margin-bottom: 8px;">No History Found</h3>
                        <p class="text-muted">You haven't completed any assessments yet.</p>
                        <button class="btn btn-primary mt-4" onclick="window.location.href='diagnosis.html'">Start Your First Diagnosis</button>
                    </div>
                `;
                
                // Hide timeline if empty
                document.getElementById('trend-status').innerHTML = "No trend data yet";
                document.getElementById('timeline-wrapper').innerHTML = "";
                return;
            }

            const symCounts = {};
            const disCounts = {};
            history.forEach(h => {
                h.symptoms.forEach(s => { symCounts[s] = (symCounts[s] || 0) + 1; });
                if (h.possible_diseases && h.possible_diseases.length > 0) {
                    const d = h.possible_diseases[0].name;
                    disCounts[d] = (disCounts[d] || 0) + 1;
                }
            });
            const topSym = Object.keys(symCounts).sort((a, b) => symCounts[b] - symCounts[a])[0];
            const topDis = Object.keys(disCounts).sort((a, b) => disCounts[b] - disCounts[a])[0];
            
            if (topSymEl) topSymEl.innerText = topSym || "N/A";
            if (topDisEl) topDisEl.innerText = topDis || "N/A";

            // Render Timeline
            this.renderHealthTrendTimeline(history);

            // Render All History
            list.innerHTML = history.map(item => {
                const isAlert = item.risk_level === 'High';
                const badgeClass = isAlert ? 'badge-red' : (item.risk_level === 'Medium' ? 'badge-yellow' : 'badge-green');
                const topDisease = item.possible_diseases && item.possible_diseases.length > 0 ? item.possible_diseases[0].name : 'Unknown';
                const prob = item.possible_diseases && item.possible_diseases.length > 0 ? (item.possible_diseases[0].probability * 100).toFixed(0) : 0;
                
                return `
                    <div class="card history-card" style="padding: 24px; border-left: 4px solid ${isAlert ? '#EF4444' : (item.risk_level === 'Medium' ? '#F59E0B' : '#10B981')}; display: flex; flex-direction: column; gap: 16px; cursor: pointer; transition: transform 0.2s;" onclick="app.viewHistoryDetail(${item.id})" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px;">
                            <div>
                                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 4px;">
                                    <h3 style="margin: 0; font-size: 1.1rem;">${item.name}</h3>
                                    <span class="badge ${badgeClass}">${item.risk_level} Risk</span>
                                </div>
                                <div style="color: var(--text-muted); font-size: 0.85rem; display: flex; align-items: center; gap: 6px;">
                                    <i class='bx bx-time-five'></i> ${item.date}
                                </div>
                            </div>
                            <div style="text-align: right;">
                                <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 2px;">Top Prediction</div>
                                <div style="font-weight: 600; color: var(--dark-card);">${topDisease} <span style="color: var(--primary); font-size: 0.9rem;">(${prob}%)</span></div>
                            </div>
                        </div>
                        <div style="background: var(--bg-color); padding: 12px 16px; border-radius: 8px;">
                            <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-main); margin-right: 8px;">Symptoms:</span>
                            <span style="font-size: 0.85rem; color: var(--text-muted);">${item.symptoms.join(', ')}</span>
                        </div>
                    </div>
                `;
            }).join('');
        },

        renderHealthTrendTimeline(history) {
            const tlWrapper = document.getElementById('timeline-wrapper');
            const trendStatus = document.getElementById('trend-status');
            if (!tlWrapper || !trendStatus) return;

            // Get up to last 7, reversed so oldest is first, newest is last (left to right)
            const tlHistory = history.slice(0, 7).reverse();

            if (tlHistory.length < 2) {
                trendStatus.innerHTML = "<i class='bx bx-minus-circle'></i> Stable condition";
            } else {
                // Calculate Trend between last two items
                const latest = tlHistory[tlHistory.length - 1];
                const previous = tlHistory[tlHistory.length - 2];
                
                const scoreMap = { 'Low': 1, 'Medium': 2, 'High': 3 };
                const latestScore = scoreMap[latest.risk_level] || 2;
                const prevScore = scoreMap[previous.risk_level] || 2;

                if (latestScore < prevScore) {
                    trendStatus.innerHTML = "<i class='bx bx-trending-down text-green'></i> <span class='text-green'>Your health is improving</span>";
                } else if (latestScore > prevScore) {
                    trendStatus.innerHTML = "<i class='bx bx-trending-up text-red'></i> <span class='text-red'>Health risk increasing</span>";
                } else {
                    trendStatus.innerHTML = "<i class='bx bx-minus-circle text-muted'></i> <span class='text-muted'>Stable condition</span>";
                }
            }

            tlWrapper.innerHTML = tlHistory.map((item, index) => {
                let color = "#10B981"; // Low (Green)
                if (item.risk_level === 'Medium') color = "#F59E0B"; // Yellow
                if (item.risk_level === 'High') color = "#EF4444"; // Red
                
                // Parse date string to extract just Day + Month safely
                let displayDate = item.date.split(',')[0]; 
                
                return `
                    <div class="timeline-node">
                        <div class="tl-dot" style="background: ${color}; box-shadow: 0 0 10px ${color}80;">
                            ${item.risk_level === 'High' ? '!' : (item.risk_level === 'Low' ? '✓' : '—')}
                        </div>
                        <div class="tl-date">${displayDate}</div>
                        <div class="tl-risk" style="color: ${color};">${item.risk_level}</div>
                    </div>
                `;
            }).join('');
        },

        viewHistoryDetail(id) {
            if (!window.currentHistory) return;
            const item = window.currentHistory.find(h => h.id === id);
            if (item) {
                // Ensure default values are populated in case they are missing in db
                const fullItem = {
                    ...item,
                    recommendation: item.recommendation || "Based on your symptoms, we recommend consulting a healthcare provider.",
                    severity: item.severity || (item.risk_level === 'High' ? 'severe' : 'moderate')
                };
                localStorage.setItem('pending_result', JSON.stringify(fullItem));
                window.location.href = 'result.html';
            }
        },

        async clearHistory() {
            if (confirm("Are you sure you want to clear all your assessment history? This cannot be undone.")) {
                try {
                    await fetch(`${API_BASE}/history`, { method: 'DELETE' });
                } catch(e) {
                    console.error("Failed to clear", e);
                }
                this.initDashboardPage();
            }
        },

        downloadReport() {
            const historyArr = window.currentHistory || [];
            if (historyArr.length === 0) {
                this.showToast("No history available to download.");
                return;
            }
            
            try {
                const prettyJson = JSON.stringify(historyArr, null, 2);
                const blob = new Blob([prettyJson], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `MedAI_Report_${new Date().getTime()}.json`;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }, 100);
            } catch(e) {
                console.error("Download failed", e);
                this.showToast("Failed to generate download report.");
            }
        },

        // --- DISEASE SEARCH ---
        handleSearchKey(e) {
            if (e.key === 'Enter') this.searchDisease();
        },

        async searchDisease() {
            const searchInput = document.getElementById('disease-search-input');
            if (!searchInput) return;

            const query = searchInput.value.trim();
            if (!query) return;

            const resultsEl = document.getElementById('search-results');
            const loadEl = document.getElementById('search-loading');
            const errEl = document.getElementById('search-error');
            
            if (resultsEl) resultsEl.classList.add('hidden');
            if (errEl) errEl.classList.add('hidden');
            if (loadEl) loadEl.classList.remove('hidden');

            try {
                const response = await fetch(`${API_BASE}/disease?name=${encodeURIComponent(query)}`);
                if (!response.ok) {
                    throw new Error('API Request Failed');
                }
                const result = await response.json();
                this.renderDiseaseSearchResult(result);
            } catch (error) {
                console.error('[API Error]', error);
                if (errEl) {
                    errEl.innerText = "Failed to fetch disease details. Please try again.";
                    errEl.classList.remove('hidden');
                }
                if (loadEl) loadEl.classList.add('hidden');
            }
        },

        renderDiseaseSearchResult(data) {
            const loadEl = document.getElementById('search-loading');
            const resultsEl = document.getElementById('search-results');
            
            if (loadEl) loadEl.classList.add('hidden');
            if (resultsEl) resultsEl.classList.remove('hidden');
            
            const nameEl = document.getElementById('sr-name');
            const symEl = document.getElementById('sr-symptoms');
            const cauEl = document.getElementById('sr-causes');
            const prevEl = document.getElementById('sr-prevention');
            const treatEl = document.getElementById('sr-treatment');
            
            if (nameEl) nameEl.innerText = data.name;
            if (symEl) symEl.innerHTML = (data.symptoms || []).map(s => `• ${s}`).join('<br>');
            if (cauEl) cauEl.innerHTML = (data.causes || []).map(c => `• ${c}`).join('<br>');
            if (prevEl) prevEl.innerText = data.prevention || 'Information not available.';
            if (treatEl) treatEl.innerText = data.treatment || 'Consult a medical professional for treatment.';
        },

        // --- CHATBOT LOGIC ---
        injectChatbot() {
            const html = `
            <div class="chatbot-container collapsed" id="chatbot">
                <div class="chat-header" onclick="app.toggleChatbot()">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <i class='bx bx-bot'></i> MedAI Assistant
                    </div>
                    <i class='bx bx-chevron-up' id="chat-toggle-icon"></i>
                </div>
                <div class="chat-body" id="chat-body">
                    <div class="message ai-message">
                        <div class="msg-avatar"><i class='bx bx-bot'></i></div>
                        <div class="msg-content">Hello! I'm your MedAI assistant. Ask me any health-related questions.</div>
                    </div>
                </div>
                <div class="chatbot-input">
                    <input type="text" id="chat-input" placeholder="Type your message..." onkeypress="app.handleChatKey(event)">
                    <button onclick="app.sendMessage()" id="chat-send-btn"><i class='bx bxs-send'></i></button>
                </div>
            </div>`;
            document.body.insertAdjacentHTML('beforeend', html);
        },

        toggleChatbot() {
            const chat = document.getElementById('chatbot');
            const icon = document.getElementById('chat-toggle-icon');
            if (!chat || !icon) return;

            chat.classList.toggle('collapsed');
            if (chat.classList.contains('collapsed')) {
                icon.className = 'bx bx-chevron-up';
            } else {
                icon.className = 'bx bx-chevron-down';
                document.getElementById('chat-input').focus();
            }
        },

        handleChatKey(e) {
            if (e.key === 'Enter') this.sendMessage();
        },

        async sendMessage() {
            const input = document.getElementById('chat-input');
            const btn = document.getElementById('chat-send-btn');
            if (!input) return;

            const msg = input.value.trim();
            if (!msg) return;

            input.value = '';
            input.disabled = true;
            if (btn) btn.disabled = true;

            this.appendChatMessage(msg, 'user');

            const chatBody = document.getElementById('chat-body');
            if (!chatBody) return;
            
            const loadingId = 'msg-' + Date.now();
            chatBody.insertAdjacentHTML('beforeend', `
                <div class="message ai-message" id="${loadingId}">
                    <div class="msg-avatar"><i class='bx bx-bot'></i></div>
                    <div class="msg-content">
                        <div class="typing-indicator">
                            <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>
                        </div>
                    </div>
                </div>
            `);
            chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: 'smooth' });

            try {
                const response = await fetch(`${API_BASE}/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: msg })
                });
                if (!response.ok) throw new Error('API Request Failed');
                
                const result = await response.json();
                document.getElementById(loadingId).remove();
                this.appendChatMessage(result.response || result.reply || result.message, 'ai');
            } catch (error) {
                console.error('[API Error]', error);
                document.getElementById(loadingId).remove();
                this.appendChatMessage("Server not responding", 'ai');
            } finally {
                input.disabled = false;
                if (btn) btn.disabled = false;
                input.focus();
            }
        },

        appendChatMessage(text, sender) {
            const chatBody = document.getElementById('chat-body');
            if (!chatBody) return;

            const isAI = sender === 'ai';
            const html = `
                <div class="message ${isAI ? 'ai-message' : 'user-message'}">
                    <div class="msg-avatar"><i class='bx ${isAI ? 'bx-bot' : 'bx-user'}'></i></div>
                    <div class="msg-content">${text}</div>
                </div>
            `;
            chatBody.insertAdjacentHTML('beforeend', html);
            chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: 'smooth' });
        }
    };

    window.app = app;
    window.app.init();
});
