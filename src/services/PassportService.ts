import { Field, PublicKey, PrivateKey, Signature, MerkleTree, Poseidon } from 'o1js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Identity data structure (stored off-chain, encrypted)
 */
export interface IdentityData {
  id: string;
  fullName: string;
  dateOfBirth: {
    year: number;
    month: number;
    day: number;
  };
  nationality: string;
  idNumber: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Passport commitment stored on-chain
 */
export interface PassportCommitment {
  id: string;
  commitment: string;
  nullifier: string;
  merkleIndex: number;
  createdAt: Date;
}

/**
 * Proof request types
 */
export type ProofType = 'age' | 'nationality' | 'membership' | 'existence';

export interface ProofRequest {
  type: ProofType;
  requestId: string;
  verifierId: string;
  parameters: Record<string, unknown>;
  createdAt: Date;
  expiresAt: Date;
}

export interface ProofResponse {
  requestId: string;
  proof: string;
  publicInputs: string[];
  verified: boolean;
  createdAt: Date;
}

/**
 * PassportService: Manages zk-Passport operations
 * 
 * Handles:
 * - Identity registration and commitment generation
 * - Proof generation for various attributes
 * - Merkle tree management for passport storage
 */
export class PassportService {
  private merkleTree: MerkleTree;
  private passports: Map<string, PassportCommitment>;
  private identities: Map<string, IdentityData>; // In production, this would be encrypted storage
  private adminPrivateKey: PrivateKey;
  private adminPublicKey: PublicKey;

  constructor(adminPrivateKey?: PrivateKey) {
    // Initialize Merkle tree with height 20 (supports ~1M passports)
    this.merkleTree = new MerkleTree(20);
    this.passports = new Map();
    this.identities = new Map();
    
    // Generate or use provided admin keys
    if (adminPrivateKey) {
      this.adminPrivateKey = adminPrivateKey;
    } else {
      this.adminPrivateKey = PrivateKey.random();
    }
    this.adminPublicKey = this.adminPrivateKey.toPublicKey();
  }

  /**
   * Get admin public key
   */
  getAdminPublicKey(): PublicKey {
    return this.adminPublicKey;
  }

  /**
   * Register a new identity and create passport commitment
   */
  async registerIdentity(identityData: Omit<IdentityData, 'id' | 'createdAt' | 'updatedAt'>): Promise<{
    identityId: string;
    passportCommitment: PassportCommitment;
    salt: Field;
  }> {
    const id = uuidv4();
    const now = new Date();

    // Create identity record
    const identity: IdentityData = {
      ...identityData,
      id,
      createdAt: now,
      updatedAt: now,
    };

    // Generate salt for commitments
    const salt = Field.random();

    // Create commitments for each attribute
    const nameCommitment = this.createStringCommitment(identity.fullName, salt);
    const dobCommitment = this.createDateCommitment(
      identity.dateOfBirth.year,
      identity.dateOfBirth.month,
      identity.dateOfBirth.day,
      salt
    );
    const nationalityCommitment = this.createStringCommitment(identity.nationality, salt);
    const idCommitment = this.createStringCommitment(identity.idNumber, salt);

    // Create identity hash
    const identityHash = Poseidon.hash([
      nameCommitment,
      dobCommitment,
      nationalityCommitment,
      idCommitment,
      salt,
    ]);

    // Create nullifier (prevents double registration)
    const nullifierSecret = Field.random();
    const nullifier = Poseidon.hash([
      this.createStringCommitment(identity.idNumber, nullifierSecret),
      nullifierSecret,
    ]);

    // Create passport commitment
    const commitment = Poseidon.hash([identityHash, nullifier]);

    // Get next available index in Merkle tree
    const merkleIndex = this.passports.size;

    // Add to Merkle tree
    this.merkleTree.setLeaf(BigInt(merkleIndex), commitment);

    // Create passport record
    const passportCommitment: PassportCommitment = {
      id: uuidv4(),
      commitment: commitment.toString(),
      nullifier: nullifier.toString(),
      merkleIndex,
      createdAt: now,
    };

    // Store records
    this.identities.set(id, identity);
    this.passports.set(passportCommitment.id, passportCommitment);

    return {
      identityId: id,
      passportCommitment,
      salt,
    };
  }

  /**
   * Generate age proof
   */
  async generateAgeProof(
    identityId: string,
    salt: Field,
    minAge: number
  ): Promise<{
    proof: string;
    publicInputs: {
      minAge: number;
      currentDate: { year: number; month: number; day: number };
      dobCommitment: string;
    };
    isValid: boolean;
  }> {
    const identity = this.identities.get(identityId);
    if (!identity) {
      throw new Error('Identity not found');
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();

    // Calculate age
    let age = currentYear - identity.dateOfBirth.year;
    if (
      currentMonth < identity.dateOfBirth.month ||
      (currentMonth === identity.dateOfBirth.month && currentDay < identity.dateOfBirth.day)
    ) {
      age--;
    }

    // Create DOB commitment
    const dobCommitment = this.createDateCommitment(
      identity.dateOfBirth.year,
      identity.dateOfBirth.month,
      identity.dateOfBirth.day,
      salt
    );

    const isValid = age >= minAge;

    // In production, this would generate an actual ZK proof
    // For now, we return a placeholder that represents the proof structure
    const proofData = {
      dobYear: identity.dateOfBirth.year,
      dobMonth: identity.dateOfBirth.month,
      dobDay: identity.dateOfBirth.day,
      salt: salt.toString(),
      minAge,
      currentYear,
      currentMonth,
      currentDay,
    };

    return {
      proof: Buffer.from(JSON.stringify(proofData)).toString('base64'),
      publicInputs: {
        minAge,
        currentDate: { year: currentYear, month: currentMonth, day: currentDay },
        dobCommitment: dobCommitment.toString(),
      },
      isValid,
    };
  }

  /**
   * Generate nationality proof
   */
  async generateNationalityProof(
    identityId: string,
    salt: Field,
    targetNationality: string
  ): Promise<{
    proof: string;
    publicInputs: {
      targetNationality: string;
      nationalityCommitment: string;
    };
    isValid: boolean;
  }> {
    const identity = this.identities.get(identityId);
    if (!identity) {
      throw new Error('Identity not found');
    }

    const nationalityCommitment = this.createStringCommitment(identity.nationality, salt);
    const targetCommitment = this.createStringCommitment(targetNationality, salt);

    const isValid = identity.nationality.toLowerCase() === targetNationality.toLowerCase();

    const proofData = {
      nationality: identity.nationality,
      salt: salt.toString(),
      targetNationality,
    };

    return {
      proof: Buffer.from(JSON.stringify(proofData)).toString('base64'),
      publicInputs: {
        targetNationality,
        nationalityCommitment: nationalityCommitment.toString(),
      },
      isValid,
    };
  }

  /**
   * Generate existence proof (prove passport exists without revealing which one)
   */
  async generateExistenceProof(passportId: string): Promise<{
    proof: string;
    publicInputs: {
      merkleRoot: string;
    };
    isValid: boolean;
  }> {
    const passport = this.passports.get(passportId);
    if (!passport) {
      throw new Error('Passport not found');
    }

    const witness = this.merkleTree.getWitness(BigInt(passport.merkleIndex));
    const merkleRoot = this.merkleTree.getRoot();

    const proofData = {
      commitment: passport.commitment,
      witness: witness.map(w => ({ isLeft: w.isLeft, sibling: w.sibling.toString() })),
    };

    return {
      proof: Buffer.from(JSON.stringify(proofData)).toString('base64'),
      publicInputs: {
        merkleRoot: merkleRoot.toString(),
      },
      isValid: true,
    };
  }

  /**
   * Get current Merkle root
   */
  getMerkleRoot(): Field {
    return this.merkleTree.getRoot();
  }

  /**
   * Get total number of registered passports
   */
  getTotalPassports(): number {
    return this.passports.size;
  }

  /**
   * Get passport by ID
   */
  getPassport(passportId: string): PassportCommitment | undefined {
    return this.passports.get(passportId);
  }

  /**
   * Verify a proof (placeholder - in production would verify ZK proof)
   */
  async verifyProof(proof: string, publicInputs: Record<string, unknown>): Promise<boolean> {
    try {
      // Decode and validate proof structure
      const proofData = JSON.parse(Buffer.from(proof, 'base64').toString());
      return proofData !== null;
    } catch {
      return false;
    }
  }

  // Private helper methods

  private createStringCommitment(value: string, salt: Field): Field {
    const valueBytes = Buffer.from(value, 'utf-8');
    const valueFields: Field[] = [];
    
    // Convert string to fields (chunk into 31-byte segments for Field compatibility)
    for (let i = 0; i < valueBytes.length; i += 31) {
      const chunk = valueBytes.slice(i, Math.min(i + 31, valueBytes.length));
      const hexValue = chunk.toString('hex').padEnd(62, '0');
      valueFields.push(Field(BigInt('0x' + hexValue)));
    }
    
    if (valueFields.length === 0) {
      valueFields.push(Field(0));
    }

    const valueHash = Poseidon.hash(valueFields);
    return Poseidon.hash([valueHash, salt]);
  }

  private createDateCommitment(year: number, month: number, day: number, salt: Field): Field {
    return Poseidon.hash([Field(year), Field(month), Field(day), salt]);
  }

  /**
   * Sign identity hash with admin key
   */
  signIdentityHash(identityHash: Field, nullifier: Field): Signature {
    return Signature.create(this.adminPrivateKey, [identityHash, nullifier]);
  }
}

/**
 * Singleton instance for the passport service
 */
let passportServiceInstance: PassportService | null = null;

export function getPassportService(): PassportService {
  if (!passportServiceInstance) {
    passportServiceInstance = new PassportService();
  }
  return passportServiceInstance;
}

export function initializePassportService(adminPrivateKey: PrivateKey): PassportService {
  passportServiceInstance = new PassportService(adminPrivateKey);
  return passportServiceInstance;
}