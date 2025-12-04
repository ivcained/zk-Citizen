import { Field, MerkleTree, MerkleMap, Poseidon } from 'o1js';
import { v4 as uuidv4 } from 'uuid';

export interface CensusParticipant {
  id: string;
  passportCommitment: string;
  demographicHash: string;
  nullifier: string;
  merkleIndex: number;
  registeredAt: Date;
}

export interface DemographicBrackets {
  ageBracket: number;
  regionCode: string;
  membershipTier: number;
  joinTimeBracket: number;
}

export interface CensusSnapshotData {
  id: string;
  communityId: string;
  timestamp: Date;
  totalPopulation: number;
  participantRoot: string;
  demographicsHash: string;
  aggregates: DemographicAggregatesData;
}

export interface DemographicAggregatesData {
  age0to17: number;
  age18to25: number;
  age26to35: number;
  age36to50: number;
  age51to65: number;
  age65plus: number;
  total: number;
  regionDistribution: Record<string, number>;
  tierDistribution: Record<number, number>;
}

export interface CommunityConfig {
  id: string;
  name: string;
  description: string;
  adminPublicKey: string;
  createdAt: Date;
}

export class CensusService {
  private participantTree: MerkleTree;
  private nullifierMap: MerkleMap;
  private participants: Map<string, CensusParticipant>;
  private snapshots: Map<string, CensusSnapshotData>;
  private communities: Map<string, CommunityConfig>;
  private aggregates: DemographicAggregatesData;

  constructor() {
    this.participantTree = new MerkleTree(20);
    this.nullifierMap = new MerkleMap();
    this.participants = new Map();
    this.snapshots = new Map();
    this.communities = new Map();
    this.aggregates = this.initializeAggregates();
  }

  private initializeAggregates(): DemographicAggregatesData {
    return {
      age0to17: 0, age18to25: 0, age26to35: 0,
      age36to50: 0, age51to65: 0, age65plus: 0,
      total: 0, regionDistribution: {}, tierDistribution: {},
    };
  }

  registerCommunity(config: Omit<CommunityConfig, 'id' | 'createdAt'>): CommunityConfig {
    const community: CommunityConfig = { ...config, id: uuidv4(), createdAt: new Date() };
    this.communities.set(community.id, community);
    return community;
  }

  async registerParticipant(passportCommitment: string, demographics: DemographicBrackets, nullifierSecret: Field) {
    const nullifier = Poseidon.hash([Field(BigInt(passportCommitment)), nullifierSecret]);
    if (this.nullifierMap.get(nullifier).equals(Field(1)).toBoolean()) {
      return { participant: null, success: false, error: 'Already registered' };
    }
    const demographicHash = this.createDemographicHash(demographics);
    const participantEntry = Poseidon.hash([Field(BigInt(passportCommitment)), demographicHash, nullifier]);
    const merkleIndex = this.participants.size;
    this.participantTree.setLeaf(BigInt(merkleIndex), participantEntry);
    this.nullifierMap.set(nullifier, Field(1));
    const participant: CensusParticipant = {
      id: uuidv4(), passportCommitment, demographicHash: demographicHash.toString(),
      nullifier: nullifier.toString(), merkleIndex, registeredAt: new Date(),
    };
    this.participants.set(participant.id, participant);
    this.updateAggregates(demographics);
    return { participant, success: true };
  }

  private updateAggregates(demographics: DemographicBrackets): void {
    const brackets = ['age0to17', 'age18to25', 'age26to35', 'age36to50', 'age51to65', 'age65plus'] as const;
    if (demographics.ageBracket >= 0 && demographics.ageBracket < 6) {
      this.aggregates[brackets[demographics.ageBracket]]++;
    }
    this.aggregates.regionDistribution[demographics.regionCode] = 
      (this.aggregates.regionDistribution[demographics.regionCode] || 0) + 1;
    this.aggregates.tierDistribution[demographics.membershipTier] = 
      (this.aggregates.tierDistribution[demographics.membershipTier] || 0) + 1;
    this.aggregates.total++;
  }

  createSnapshot(communityId: string): CensusSnapshotData {
    const snapshot: CensusSnapshotData = {
      id: uuidv4(), communityId, timestamp: new Date(),
      totalPopulation: this.participants.size,
      participantRoot: this.participantTree.getRoot().toString(),
      demographicsHash: this.createAggregatesHash().toString(),
      aggregates: { ...this.aggregates },
    };
    this.snapshots.set(snapshot.id, snapshot);
    return snapshot;
  }

  getPopulation(): number { return this.participants.size; }
  getMerkleRoot(): Field { return this.participantTree.getRoot(); }
  getAggregates(): DemographicAggregatesData { return { ...this.aggregates }; }

  private createDemographicHash(demographics: DemographicBrackets): Field {
    return Poseidon.hash([
      Field(demographics.ageBracket), this.hashString(demographics.regionCode),
      Field(demographics.membershipTier), Field(demographics.joinTimeBracket),
    ]);
  }

  private createAggregatesHash(): Field {
    return Poseidon.hash([
      Field(this.aggregates.age0to17), Field(this.aggregates.age18to25),
      Field(this.aggregates.age26to35), Field(this.aggregates.age36to50),
      Field(this.aggregates.age51to65), Field(this.aggregates.age65plus),
      Field(this.aggregates.total),
    ]);
  }

  private hashString(value: string): Field {
    const bytes = new TextEncoder().encode(value);
    const fields: Field[] = [];
    for (let i = 0; i < bytes.length; i += 31) {
      let hex = '';
      for (let j = i; j < Math.min(i + 31, bytes.length); j++) {
        hex += bytes[j].toString(16).padStart(2, '0');
      }
      fields.push(Field(BigInt('0x' + hex.padEnd(62, '0'))));
    }
    return Poseidon.hash(fields.length ? fields : [Field(0)]);
  }
}

let censusServiceInstance: CensusService | null = null;
export function getCensusService(): CensusService {
  if (!censusServiceInstance) censusServiceInstance = new CensusService();
  return censusServiceInstance;
}