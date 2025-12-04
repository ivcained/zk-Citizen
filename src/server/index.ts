import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { getPassportService } from '../services/PassportService';
import { getCensusService } from '../services/CensusService';
import { Field } from 'o1js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Initialize services
const passportService = getPassportService();
const censusService = getCensusService();

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============ PASSPORT ENDPOINTS ============

// Register new identity
app.post('/api/passport/register', async (req: Request, res: Response) => {
  try {
    const { fullName, dateOfBirth, nationality, idNumber } = req.body;
    const result = await passportService.registerIdentity({
      fullName, dateOfBirth, nationality, idNumber,
    });
    res.json({ success: true, data: { identityId: result.identityId, passportId: result.passportCommitment.id } });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Generate age proof
app.post('/api/passport/prove/age', async (req: Request, res: Response) => {
  try {
    const { identityId, salt, minAge } = req.body;
    const result = await passportService.generateAgeProof(identityId, Field(salt), minAge);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Generate nationality proof
app.post('/api/passport/prove/nationality', async (req: Request, res: Response) => {
  try {
    const { identityId, salt, targetNationality } = req.body;
    const result = await passportService.generateNationalityProof(identityId, Field(salt), targetNationality);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Get passport stats
app.get('/api/passport/stats', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      totalPassports: passportService.getTotalPassports(),
      merkleRoot: passportService.getMerkleRoot().toString(),
    },
  });
});

// ============ CENSUS ENDPOINTS ============

// Register community
app.post('/api/census/community', async (req: Request, res: Response) => {
  try {
    const { name, description, adminPublicKey } = req.body;
    const community = censusService.registerCommunity({ name, description, adminPublicKey });
    res.json({ success: true, data: community });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Register census participant
app.post('/api/census/register', async (req: Request, res: Response) => {
  try {
    const { passportCommitment, demographics, nullifierSecret } = req.body;
    const result = await censusService.registerParticipant(
      passportCommitment, demographics, Field(nullifierSecret)
    );
    res.json({ success: result.success, data: result.participant, error: result.error });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Create census snapshot
app.post('/api/census/snapshot', async (req: Request, res: Response) => {
  try {
    const { communityId } = req.body;
    const snapshot = censusService.createSnapshot(communityId);
    res.json({ success: true, data: snapshot });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Get census stats
app.get('/api/census/stats', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      population: censusService.getPopulation(),
      merkleRoot: censusService.getMerkleRoot().toString(),
      aggregates: censusService.getAggregates(),
    },
  });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 ZK-Citizen API server running on port ${PORT}`);
});

export default app;