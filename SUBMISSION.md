# 🏆 Zypherpunk Hackathon Submission

## Project: ZK-Citizen

**Privacy-Preserving Identity & Census Platform for Network States**

---

## 📋 Submission Details

| Field | Value |
|-------|-------|
| **Project Name** | ZK-Citizen |
| **Track** | Network School |
| **Prize Category** | zk-Passport & zk-Census |
| **Team** | Solo Developer |
| **Demo** | [Live Demo](https://zk-citizen.vercel.app) |
| **Repository** | [GitHub](https://github.com/zk-citizen/zk-citizen) |
| **Video** | [YouTube Demo](https://youtube.com/watch?v=xxx) |

---

## 🎯 Problem Statement

Network States and digital communities face a critical challenge:

> **How do you verify identity and count population without compromising privacy?**

Traditional solutions require:
- Passport scans → Privacy violation
- KYC processes → Data breach risks
- Centralized databases → Single point of failure
- Public member lists → Doxxing risk

---

## 💡 Our Solution

**ZK-Citizen** uses zero-knowledge proofs to enable:

### zk-Passport
- Create cryptographic identity commitments
- Prove attributes (age, nationality) without revealing data
- Portable across multiple Network States
- Sybil-resistant with nullifier system

### zk-Census
- Anonymous population counting
- Demographic aggregation without individual tracking
- Verifiable population proofs for governance
- Time-based census snapshots

---

## 🔧 Technical Implementation

### Stack
- **Smart Contracts**: Mina Protocol zkApps (o1js)
- **Backend**: Node.js + Express + TypeScript
- **Frontend**: Vanilla JS + CSS (lightweight, no framework)
- **Cryptography**: Poseidon hash, Merkle trees, ZK proofs

### Key Features

#### 1. Commitment Scheme
```typescript
commitment = Poseidon(attribute, salt)
// Data stays with user, only commitment on-chain
```

#### 2. Age Proof
```typescript
// Prove: age >= 18
// Reveal: Nothing about actual birthdate
proveAgeAbove(dobYear, dobMonth, dobDay, salt, minAge)
```

#### 3. Anonymous Census
```typescript
// Register with nullifier (prevents double-counting)
// Aggregate demographics without individual tracking
registerParticipant(passportCommitment, demographics, nullifier)
```

#### 4. Population Proofs
```typescript
// Prove: population >= threshold
// Reveal: Nothing about exact count
provePopulationAbove(threshold)
```

---

## 📊 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      ZK-Citizen Platform                     │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐         ┌─────────────────┐           │
│  │   zk-Passport   │         │    zk-Census    │           │
│  │                 │         │                 │           │
│  │ • Identity Gen  │         │ • Anonymous     │           │
│  │ • Attribute     │◄───────►│   Counting      │           │
│  │   Proofs        │         │ • Demographics  │           │
│  │ • Verification  │         │ • Sybil Guard   │           │
│  └────────┬────────┘         └────────┬────────┘           │
│           │                           │                     │
│           └───────────┬───────────────┘                     │
│                       ▼                                     │
│           ┌─────────────────────┐                          │
│           │   ZK Proof Engine   │                          │
│           │      (o1js)         │                          │
│           └──────────┬──────────┘                          │
│                      ▼                                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Mina Protocol Blockchain                │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎬 Demo Walkthrough

### 1. Register Identity
- User enters personal data (name, DOB, nationality, ID)
- System creates cryptographic commitments
- Only commitments stored; raw data stays with user

### 2. Generate Age Proof
- User requests proof for "age >= 18"
- System generates ZK proof
- Verifier confirms age without seeing birthdate

### 3. Join Census
- User registers with passport commitment
- Nullifier prevents double-counting
- Demographics aggregated anonymously

### 4. View Population Stats
- Real-time population count
- Age distribution chart
- No individual data exposed

---

## 🏆 Bounty Alignment

### Network School ($30,000 in Memberships)

| Requirement | Implementation |
|-------------|----------------|
| zk-Passport | ✅ Full implementation with age/nationality proofs |
| zk-Census | ✅ Anonymous counting with demographic aggregation |
| Privacy-preserving | ✅ Zero-knowledge proofs, no data exposure |
| Sybil resistance | ✅ Nullifier-based system |

### Additional Bounties

| Sponsor | Bounty | Integration |
|---------|--------|-------------|
| Mina Protocol | $20,000 | ✅ Built entirely on o1js/zkApps |
| Project Tachyon | $35,000 | ✅ General bounty eligible |
| Axelar | $20,000 | 🔄 Cross-chain ready architecture |

---

## 🚀 Future Roadmap

1. **Phase 1** (Current)
   - Core zk-Passport & zk-Census
   - Mina testnet deployment
   - Basic frontend

2. **Phase 2** (Q1 2025)
   - Mainnet deployment
   - Mobile SDK
   - Cross-chain bridges (Axelar)

3. **Phase 3** (Q2 2025)
   - Governance module
   - Multi-community support
   - Enterprise features

---

## 👨‍💻 Team

**Solo Developer**
- Full-stack development
- ZK cryptography implementation
- UI/UX design

---

## 📝 How to Run

```bash
# Clone
git clone https://github.com/zk-citizen/zk-citizen.git
cd zk-citizen

# Install
npm install
cd contracts && npm install && cd ..

# Build
npm run build:contracts

# Run
npm run dev:server  # Backend on :3001
cd frontend && npx serve .  # Frontend on :3000
```

---

## 📄 License

MIT License - Open source for the community

---

## 🙏 Acknowledgments

- **Mina Protocol** for o1js and zkApps
- **Network School** for the vision of Network States
- **Zypherpunk** for organizing this hackathon
- **Zcash** for pioneering privacy technology

---

<p align="center">
  <strong>Built with ❤️ for the decentralized future</strong>
</p>

<p align="center">
  <em>"Privacy is not about having something to hide.<br>Privacy is about having something to protect."</em>
</p>