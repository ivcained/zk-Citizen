# 🛡️ ZK-Citizen

**Privacy-Preserving Identity & Census Platform for Network States**

Built for the [Zypherpunk Hackathon](https://zypherpunk.xyz/) - Network School Track

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Built with Mina](https://img.shields.io/badge/Built%20with-Mina%20Protocol-blue)](https://minaprotocol.com)

---

## 🎯 Overview

ZK-Citizen is a comprehensive privacy-preserving platform that enables:

- **zk-Passport**: Create and verify digital identities without revealing personal data
- **zk-Census**: Measure population for Network States without doxxing members

### Problem Statement

Network States and digital communities need to:
1. Verify member identities for governance and access control
2. Count their population for legitimacy and resource allocation
3. Aggregate demographics for planning and analysis

**But** traditional methods expose sensitive personal information, creating privacy risks.

### Solution

ZK-Citizen uses zero-knowledge proofs to enable:
- ✅ Prove you're over 18 without revealing your birthdate
- ✅ Prove your nationality without exposing passport details
- ✅ Be counted in a census without being identified
- ✅ Aggregate demographics without individual tracking

---

## 🏆 Hackathon Tracks

### Primary: Network School ($30,000 in Memberships)
- **zk-Passport**: Privacy-preserving cryptoidentity solutions
- **zk-Census**: Measuring population without doxxing members

### Additional Bounties Targeted:
- **Mina Protocol** ($20,000): zkApps integration
- **Axelar** ($20,000): Cross-chain privacy solutions
- **Project Tachyon** ($35,000): General bounty

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      ZK-Citizen Platform                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
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
│  │         (zkApps for on-chain verification)           │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔐 How It Works

### zk-Passport

1. **Registration**: User provides identity data (name, DOB, nationality, ID number)
2. **Commitment**: Data is hashed with a salt to create commitments
3. **Storage**: Only commitments are stored on-chain; raw data stays with user
4. **Proofs**: User can generate ZK proofs for specific attributes

```typescript
// Example: Prove age without revealing birthdate
const proof = await zkPassport.proveAgeAbove(
  dobYear, dobMonth, dobDay,  // Private inputs
  salt, dobCommitment,         // Commitment verification
  minAge: 18,                  // Public input
  currentYear, currentMonth, currentDay
);
// Verifier learns: "User is 18+" but NOT their actual birthdate
```

### zk-Census

1. **Anonymous Registration**: Users register with passport commitment + nullifier
2. **Sybil Resistance**: Nullifiers prevent double-counting
3. **Demographic Aggregation**: Age brackets, regions counted without individual tracking
4. **Population Proofs**: Prove population thresholds without revealing exact count

```typescript
// Example: Prove population is above 10,000
const proof = await zkCensus.provePopulationAbove(
  threshold: 10000  // Public input
);
// Verifier learns: "Population ≥ 10,000" but NOT the exact count
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/zk-citizen/zk-citizen.git
cd zk-citizen

# Install dependencies
npm install

# Install contract dependencies
cd contracts && npm install && cd ..

# Build contracts
npm run build:contracts

# Start the development server
npm run dev:server

# In another terminal, serve the frontend
cd frontend && npx serve .
```

### Running Tests

```bash
# Run all tests
npm test

# Run contract tests
npm run test:contracts
```

---

## 📁 Project Structure

```
zk-citizen/
├── contracts/                 # Mina zkApp smart contracts
│   ├── src/
│   │   ├── ZkPassport.ts     # Identity management contract
│   │   ├── ZkCensus.ts       # Census management contract
│   │   └── index.ts          # Contract exports
│   ├── package.json
│   └── tsconfig.json
├── src/
│   ├── services/
│   │   ├── PassportService.ts # Passport business logic
│   │   └── CensusService.ts   # Census business logic
│   └── server/
│       └── index.ts          # Express API server
├── frontend/
│   ├── index.html            # Main HTML
│   ├── styles.css            # Styling
│   └── app.js                # Frontend logic
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🔧 API Reference

### Passport Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/passport/register` | POST | Register new identity |
| `/api/passport/prove/age` | POST | Generate age proof |
| `/api/passport/prove/nationality` | POST | Generate nationality proof |
| `/api/passport/stats` | GET | Get passport statistics |

### Census Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/census/community` | POST | Register a community |
| `/api/census/register` | POST | Register census participant |
| `/api/census/snapshot` | POST | Create census snapshot |
| `/api/census/stats` | GET | Get census statistics |

---

## 🛠️ Technical Details

### Cryptographic Primitives

- **Hash Function**: Poseidon (ZK-friendly)
- **Commitment Scheme**: `commitment = Poseidon(value, salt)`
- **Nullifiers**: `nullifier = Poseidon(id, secret)` for sybil resistance
- **Merkle Trees**: Height 20 (supports ~1M entries)

### Privacy Guarantees

| Data | On-Chain | Off-Chain | Revealed in Proofs |
|------|----------|-----------|-------------------|
| Full Name | ❌ | Encrypted | Never |
| Date of Birth | ❌ | Encrypted | Age bracket only |
| Nationality | ❌ | Encrypted | Yes/No match |
| ID Number | ❌ | Encrypted | Never |
| Passport Commitment | ✅ | - | As needed |
| Census Participation | ✅ (nullifier) | - | Never linked to identity |

---

## 🌐 Use Cases

### For Network States
- Verify citizenship without passport scans
- Count population for governance thresholds
- Aggregate demographics for resource planning

### For DAOs
- Age-gated voting without KYC
- Membership verification
- Sybil-resistant governance

### For Digital Communities
- Anonymous census for community size claims
- Demographic insights without surveillance
- Privacy-preserving identity verification

---

## 🗺️ Roadmap

- [x] Core zk-Passport contract
- [x] Core zk-Census contract
- [x] Backend services
- [x] Frontend interface
- [ ] Mina testnet deployment
- [ ] Cross-chain bridge (Axelar integration)
- [ ] Mobile SDK
- [ ] Governance module

---

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) first.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Mina Protocol](https://minaprotocol.com) for o1js and zkApps
- [Zcash](https://z.cash) for pioneering privacy technology
- [Network School](https://networkschool.io) for the vision of Network States
- [Zypherpunk](https://zypherpunk.xyz) for organizing this hackathon

---

## 📞 Contact

- **Project**: [github.com/zk-citizen](https://github.com/zk-citizen)
- **Twitter**: [@zk_citizen](https://twitter.com/zk_citizen)
- **Discord**: [Join our server](https://discord.gg/zkcitizen)

---

<p align="center">
  <strong>Built with ❤️ for the decentralized future</strong>
</p>
<p align="center">
  <em>"Privacy is not about having something to hide. Privacy is about having something to protect."</em>
</p>