import {
  Field,
  SmartContract,
  state,
  State,
  method,
  Struct,
  PublicKey,
  Poseidon,
  Bool,
  UInt64,
  UInt32,
  MerkleWitness,
  MerkleMap,
  MerkleMapWitness,
  Provable,
} from "o1js";

// Merkle tree for census participants
export class CensusMerkleWitness extends MerkleWitness(20) {}

/**
 * Demographic category for census
 * Encoded as Field for privacy
 */
export class DemographicData extends Struct({
  // Age bracket (0-17, 18-25, 26-35, 36-50, 51-65, 65+)
  ageBracket: Field,
  // Region code (hashed)
  regionCode: Field,
  // Membership tier (1-5)
  membershipTier: Field,
  // Join timestamp bracket (for tenure analysis)
  joinTimeBracket: Field,
}) {
  hash(): Field {
    return Poseidon.hash([
      this.ageBracket,
      this.regionCode,
      this.membershipTier,
      this.joinTimeBracket,
    ]);
  }
}

/**
 * Census snapshot data
 */
export class CensusSnapshot extends Struct({
  // Timestamp of snapshot
  timestamp: UInt64,
  // Total population count
  totalPopulation: Field,
  // Merkle root of all participants
  participantRoot: Field,
  // Hash of aggregated demographics
  demographicsHash: Field,
}) {}

/**
 * Aggregated demographic counts (stored off-chain, verified on-chain)
 */
export class DemographicAggregates extends Struct({
  // Age bracket counts
  age0to17: Field,
  age18to25: Field,
  age26to35: Field,
  age36to50: Field,
  age51to65: Field,
  age65plus: Field,
  // Total for verification
  total: Field,
}) {
  hash(): Field {
    return Poseidon.hash([
      this.age0to17,
      this.age18to25,
      this.age26to35,
      this.age36to50,
      this.age51to65,
      this.age65plus,
      this.total,
    ]);
  }

  /**
   * Verify total matches sum of brackets
   */
  verifyTotal(): Bool {
    const sum = this.age0to17
      .add(this.age18to25)
      .add(this.age26to35)
      .add(this.age36to50)
      .add(this.age51to65)
      .add(this.age65plus);
    return sum.equals(this.total);
  }
}

/**
 * ZK-Census: Privacy-preserving population measurement
 *
 * Features:
 * 1. Count population without revealing individual identities
 * 2. Aggregate demographics without doxxing members
 * 3. Sybil-resistant unique person counting
 * 4. Time-based census snapshots
 * 5. Verifiable population proofs for Network States
 */
export class ZkCensus extends SmartContract {
  // Current census participant root
  @state(Field) participantRoot = State<Field>();

  // Total unique participants
  @state(Field) totalParticipants = State<Field>();

  // Nullifier root (prevents double-counting)
  @state(Field) nullifierRoot = State<Field>();

  // Latest census snapshot hash
  @state(Field) latestSnapshotHash = State<Field>();

  // Census admin
  @state(PublicKey) admin = State<PublicKey>();

  // Community/Network State identifier
  @state(Field) communityId = State<Field>();

  // Demographic aggregates hash
  @state(Field) demographicsHash = State<Field>();

  /**
   * Initialize the census contract
   */
  init() {
    super.init();
    this.participantRoot.set(Field(0));
    this.totalParticipants.set(Field(0));
    this.nullifierRoot.set(Field(0));
    this.latestSnapshotHash.set(Field(0));
    this.demographicsHash.set(Field(0));
  }

  /**
   * Set up the census for a specific community
   */
  @method async setupCensus(
    adminPubKey: PublicKey,
    communityIdentifier: Field
  ) {
    const currentCommunityId = this.communityId.get();
    this.communityId.requireEquals(currentCommunityId);

    // Only allow setup once
    currentCommunityId.assertEquals(Field(0));

    this.admin.set(adminPubKey);
    this.communityId.set(communityIdentifier);
  }

  /**
   * Register a participant in the census
   * Uses nullifier to prevent double-counting
   */
  @method async registerParticipant(
    // Commitment to participant's passport/identity
    passportCommitment: Field,
    // Nullifier derived from identity (prevents double registration)
    nullifier: Field,
    // Demographic data (private, only commitment stored)
    demographics: DemographicData,
    // Witness for participant tree
    participantWitness: CensusMerkleWitness,
    // Witness for nullifier tree
    nullifierWitness: MerkleMapWitness
  ) {
    // Verify nullifier hasn't been used
    const nullifierRoot = this.nullifierRoot.get();
    this.nullifierRoot.requireEquals(nullifierRoot);

    // Check nullifier is not in the tree (value should be 0)
    const [computedNullifierRoot, computedKey] =
      nullifierWitness.computeRootAndKeyV2(Field(0));
    computedNullifierRoot.assertEquals(nullifierRoot);
    computedKey.assertEquals(nullifier);

    // Create participant entry
    const participantEntry = Poseidon.hash([
      passportCommitment,
      demographics.hash(),
      nullifier,
    ]);

    // Update participant tree
    const currentRoot = this.participantRoot.get();
    this.participantRoot.requireEquals(currentRoot);

    // Verify empty slot
    participantWitness.calculateRoot(Field(0)).assertEquals(currentRoot);

    // Add participant
    const newRoot = participantWitness.calculateRoot(participantEntry);
    this.participantRoot.set(newRoot);

    // Mark nullifier as used
    const [newNullifierRoot] = nullifierWitness.computeRootAndKeyV2(Field(1));
    this.nullifierRoot.set(newNullifierRoot);

    // Increment participant count
    const currentTotal = this.totalParticipants.get();
    this.totalParticipants.requireEquals(currentTotal);
    this.totalParticipants.set(currentTotal.add(1));
  }

  /**
   * Create a census snapshot
   * Captures current state for historical records
   */
  @method async createSnapshot(
    timestamp: UInt64,
    aggregates: DemographicAggregates
  ) {
    // Verify aggregates total matches participant count
    const totalParticipants = this.totalParticipants.get();
    this.totalParticipants.requireEquals(totalParticipants);

    aggregates.total.assertEquals(totalParticipants);
    aggregates.verifyTotal().assertTrue();

    // Get current roots
    const participantRoot = this.participantRoot.get();
    this.participantRoot.requireEquals(participantRoot);

    // Create snapshot
    const snapshot = new CensusSnapshot({
      timestamp,
      totalPopulation: totalParticipants,
      participantRoot,
      demographicsHash: aggregates.hash(),
    });

    // Store snapshot hash
    const snapshotHash = Poseidon.hash([
      snapshot.timestamp.value,
      snapshot.totalPopulation,
      snapshot.participantRoot,
      snapshot.demographicsHash,
    ]);

    this.latestSnapshotHash.set(snapshotHash);
    this.demographicsHash.set(aggregates.hash());
  }

  /**
   * Prove population is above a threshold
   * Without revealing exact count
   */
  @method async provePopulationAbove(threshold: Field) {
    const totalParticipants = this.totalParticipants.get();
    this.totalParticipants.requireEquals(totalParticipants);

    totalParticipants.assertGreaterThanOrEqual(threshold);
  }

  /**
   * Prove population is within a range
   * Useful for governance thresholds
   */
  @method async provePopulationInRange(
    minPopulation: Field,
    maxPopulation: Field
  ) {
    const totalParticipants = this.totalParticipants.get();
    this.totalParticipants.requireEquals(totalParticipants);

    totalParticipants.assertGreaterThanOrEqual(minPopulation);
    totalParticipants.assertLessThanOrEqual(maxPopulation);
  }

  /**
   * Verify a participant is registered without revealing identity
   */
  @method async verifyParticipation(
    participantEntry: Field,
    witness: CensusMerkleWitness
  ) {
    const currentRoot = this.participantRoot.get();
    this.participantRoot.requireEquals(currentRoot);

    witness.calculateRoot(participantEntry).assertEquals(currentRoot);
  }

  /**
   * Get current population count
   * Note: This is a getter method, not a provable method
   */
  getPopulationCount(): Field {
    return this.totalParticipants.get();
  }

  /**
   * Verify demographic aggregates match stored hash
   */
  @method async verifyDemographics(aggregates: DemographicAggregates) {
    const storedHash = this.demographicsHash.get();
    this.demographicsHash.requireEquals(storedHash);

    aggregates.hash().assertEquals(storedHash);
    aggregates.verifyTotal().assertTrue();
  }
}

/**
 * Helper utilities for census operations
 */
export class CensusUtils {
  /**
   * Calculate age bracket from birth year
   */
  static getAgeBracket(birthYear: number, currentYear: number): Field {
    const age = currentYear - birthYear;
    if (age < 18) return Field(0);
    if (age <= 25) return Field(1);
    if (age <= 35) return Field(2);
    if (age <= 50) return Field(3);
    if (age <= 65) return Field(4);
    return Field(5);
  }

  /**
   * Create region code from country/region string
   */
  static createRegionCode(region: string): Field {
    // Hash the region string for privacy
    const regionBytes = Buffer.from(region, "utf-8");
    const regionFields = regionBytes
      .toString("hex")
      .match(/.{1,62}/g)
      ?.map((hex) => Field(BigInt("0x" + hex))) || [Field(0)];
    return Poseidon.hash(regionFields);
  }

  /**
   * Calculate join time bracket
   */
  static getJoinTimeBracket(
    joinTimestamp: number,
    currentTimestamp: number
  ): Field {
    const daysAsMember =
      (currentTimestamp - joinTimestamp) / (24 * 60 * 60 * 1000);
    if (daysAsMember < 30) return Field(0); // < 1 month
    if (daysAsMember < 90) return Field(1); // 1-3 months
    if (daysAsMember < 180) return Field(2); // 3-6 months
    if (daysAsMember < 365) return Field(3); // 6-12 months
    if (daysAsMember < 730) return Field(4); // 1-2 years
    return Field(5); // 2+ years
  }

  /**
   * Create demographic data for a participant
   */
  static createDemographicData(
    birthYear: number,
    region: string,
    membershipTier: number,
    joinTimestamp: number,
    currentYear: number,
    currentTimestamp: number
  ): DemographicData {
    return new DemographicData({
      ageBracket: this.getAgeBracket(birthYear, currentYear),
      regionCode: this.createRegionCode(region),
      membershipTier: Field(membershipTier),
      joinTimeBracket: this.getJoinTimeBracket(joinTimestamp, currentTimestamp),
    });
  }

  /**
   * Create a census nullifier from passport commitment
   */
  static createCensusNullifier(
    passportCommitment: Field,
    censusId: Field,
    secret: Field
  ): Field {
    return Poseidon.hash([passportCommitment, censusId, secret]);
  }
}
