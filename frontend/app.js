// ZK-Citizen Frontend Application
const API_BASE = 'http://localhost:3001/api';

// State
let state = {
  connected: false,
  identityId: null,
  passportId: null,
  salt: null,
};

// DOM Elements
const elements = {
  connectWallet: document.getElementById('connectWallet'),
  totalPassports: document.getElementById('totalPassports'),
  totalCitizens: document.getElementById('totalCitizens'),
  censusPopulation: document.getElementById('censusPopulation'),
  registerForm: document.getElementById('registerForm'),
  ageProofForm: document.getElementById('ageProofForm'),
  nationalityProofForm: document.getElementById('nationalityProofForm'),
  censusRegisterForm: document.getElementById('censusRegisterForm'),
  populationProofForm: document.getElementById('populationProofForm'),
  ageProofResult: document.getElementById('ageProofResult'),
  nationalityProofResult: document.getElementById('nationalityProofResult'),
  populationProofResult: document.getElementById('populationProofResult'),
  toast: document.getElementById('toast'),
};

// Toast notification
function showToast(message, type = 'success') {
  elements.toast.textContent = message;
  elements.toast.className = `toast ${type}`;
  elements.toast.classList.remove('hidden');
  setTimeout(() => elements.toast.classList.add('hidden'), 3000);
}

// API calls
async function apiCall(endpoint, method = 'GET', data = null) {
  try {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (data) options.body = JSON.stringify(data);
    
    const response = await fetch(`${API_BASE}${endpoint}`, options);
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    return { success: false, error: error.message };
  }
}

// Load stats
async function loadStats() {
  // Passport stats
  const passportStats = await apiCall('/passport/stats');
  if (passportStats.success) {
    elements.totalPassports.textContent = passportStats.data.totalPassports;
  }
  
  // Census stats
  const censusStats = await apiCall('/census/stats');
  if (censusStats.success) {
    elements.totalCitizens.textContent = censusStats.data.population;
    elements.censusPopulation.textContent = censusStats.data.population;
    updateAgeChart(censusStats.data.aggregates);
  }
}

// Update age distribution chart
function updateAgeChart(aggregates) {
  if (!aggregates) return;
  
  const total = aggregates.total || 1;
  const brackets = {
    '0-17': aggregates.age0to17 || 0,
    '18-25': aggregates.age18to25 || 0,
    '26-35': aggregates.age26to35 || 0,
    '36-50': aggregates.age36to50 || 0,
    '51-65': aggregates.age51to65 || 0,
    '65+': aggregates.age65plus || 0,
  };
  
  Object.entries(brackets).forEach(([age, count]) => {
    const bar = document.querySelector(`.chart-bar[data-age="${age}"] .bar`);
    if (bar) {
      const percentage = (count / total) * 100;
      bar.style.height = `${Math.max(percentage, 5)}%`;
    }
  });
}

// Register identity
elements.registerForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const fullName = document.getElementById('fullName').value;
  const dob = document.getElementById('dob').value;
  const nationality = document.getElementById('nationality').value;
  const idNumber = document.getElementById('idNumber').value;
  
  const [year, month, day] = dob.split('-').map(Number);
  
  const result = await apiCall('/passport/register', 'POST', {
    fullName,
    dateOfBirth: { year, month, day },
    nationality,
    idNumber,
  });
  
  if (result.success) {
    state.identityId = result.data.identityId;
    state.passportId = result.data.passportId;
    showToast('🎉 zk-Passport created successfully!');
    loadStats();
    elements.registerForm.reset();
  } else {
    showToast(result.error || 'Failed to create passport', 'error');
  }
});

// Age proof
elements.ageProofForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  if (!state.identityId) {
    showToast('Please register an identity first', 'error');
    return;
  }
  
  const minAge = parseInt(document.getElementById('minAge').value);
  
  const result = await apiCall('/passport/prove/age', 'POST', {
    identityId: state.identityId,
    salt: state.salt || '12345',
    minAge,
  });
  
  elements.ageProofResult.classList.remove('hidden');
  if (result.success && result.data.isValid) {
    elements.ageProofResult.className = 'proof-result success';
    elements.ageProofResult.innerHTML = `
      <strong>✅ Proof Valid!</strong><br>
      You are verified to be ${minAge}+ years old.<br>
      <small>Proof: ${result.data.proof.substring(0, 50)}...</small>
    `;
  } else {
    elements.ageProofResult.className = 'proof-result error';
    elements.ageProofResult.textContent = '❌ Proof failed: Age requirement not met';
  }
});

// Nationality proof
elements.nationalityProofForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  if (!state.identityId) {
    showToast('Please register an identity first', 'error');
    return;
  }
  
  const targetNationality = document.getElementById('targetNationality').value;
  
  const result = await apiCall('/passport/prove/nationality', 'POST', {
    identityId: state.identityId,
    salt: state.salt || '12345',
    targetNationality,
  });
  
  elements.nationalityProofResult.classList.remove('hidden');
  if (result.success && result.data.isValid) {
    elements.nationalityProofResult.className = 'proof-result success';
    elements.nationalityProofResult.innerHTML = `
      <strong>✅ Proof Valid!</strong><br>
      Nationality verified as ${targetNationality}.<br>
      <small>Proof: ${result.data.proof.substring(0, 50)}...</small>
    `;
  } else {
    elements.nationalityProofResult.className = 'proof-result error';
    elements.nationalityProofResult.textContent = '❌ Proof failed: Nationality does not match';
  }
});

// Census registration
elements.censusRegisterForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const passportCommitment = document.getElementById('censusPassportId').value;
  const birthYear = parseInt(document.getElementById('censusBirthYear').value);
  const region = document.getElementById('censusRegion').value;
  
  const currentYear = new Date().getFullYear();
  let ageBracket = 5;
  const age = currentYear - birthYear;
  if (age < 18) ageBracket = 0;
  else if (age <= 25) ageBracket = 1;
  else if (age <= 35) ageBracket = 2;
  else if (age <= 50) ageBracket = 3;
  else if (age <= 65) ageBracket = 4;
  
  const result = await apiCall('/census/register', 'POST', {
    passportCommitment,
    demographics: {
      ageBracket,
      regionCode: region,
      membershipTier: 1,
      joinTimeBracket: 0,
    },
    nullifierSecret: Math.random().toString(),
  });
  
  if (result.success) {
    showToast('🎉 Registered in census anonymously!');
    loadStats();
    elements.censusRegisterForm.reset();
  } else {
    showToast(result.error || 'Failed to register', 'error');
  }
});

// Population proof
elements.populationProofForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const minPopulation = parseInt(document.getElementById('minPopulation').value);
  
  // Simulated proof for demo
  const censusStats = await apiCall('/census/stats');
  const currentPop = censusStats.success ? censusStats.data.population : 0;
  
  elements.populationProofResult.classList.remove('hidden');
  if (currentPop >= minPopulation) {
    elements.populationProofResult.className = 'proof-result success';
    elements.populationProofResult.innerHTML = `
      <strong>✅ Proof Valid!</strong><br>
      Population is verified to be ≥ ${minPopulation}.<br>
      <small>Merkle Root: ${censusStats.data?.merkleRoot?.substring(0, 30) || 'N/A'}...</small>
    `;
  } else {
    elements.populationProofResult.className = 'proof-result error';
    elements.populationProofResult.textContent = `❌ Proof failed: Population below ${minPopulation}`;
  }
});

// Connect wallet (simulated)
elements.connectWallet?.addEventListener('click', () => {
  if (state.connected) {
    state.connected = false;
    elements.connectWallet.textContent = 'Connect Wallet';
    showToast('Wallet disconnected');
  } else {
    state.connected = true;
    elements.connectWallet.textContent = 'Connected ✓';
    showToast('Wallet connected (demo mode)');
  }
});

// Smooth scroll for nav links
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const target = document.querySelector(link.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
      document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
    }
  });
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadStats();
  // Refresh stats every 30 seconds
  setInterval(loadStats, 30000);
});