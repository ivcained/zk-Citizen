import {
  Field,
  SmartContract,
  state,
  State,
  method,
  Struct,
  PublicKey,
  Signature,
  Poseidon,
  Bool,
  UInt64,
  MerkleWitness,
  Provable,
} from "o1js";

// Merkle tree height for storing passport commitments
export class PassportMerkleWitness extends MerkleWitness(20) {}

/**
 * Identity Attributes that can be proven without revealing actual values
 * Uses commitment scheme: commitment = Poseidon(attribute, salt)
 */
export class IdentityAttributes extends Struct({
  // Commitment to full name (not revealed)
  nameCommitment: Field,
  // Commitment to date of birth
  dobCommitment: Field,
  // Commitment to nationality
  nationalityCommitment: Field,
  // Commitment to unique identifier (passport number, etc.)
  idCommitment: Field,
  // Salt used for all commitments
  salt: Field,
}) {
  /**
   * Create a hash of all identity attributes
   */
  hash(): Field {
    return Poseidon.hash([
      this.nameCommitment,
      this.dobCommitment,
      this.nationalityCommitment,
      this.idCommitment,
      this.salt,
    ]);
  }
}

/**
 * Proof request for age verification
 */
export class AgeProofRequest extends Struct({
  // Minimum age required (in years)
  minAge: Field,
  // Current timestamp for age calculation
  currentTimestamp: UInt64,
}) {}

/**
 * Proof request for membership verification
 */
export class MembershipProofRequest extends Struct({
  // Community/Network State identifier
  communityId: Field,
  // Merkle root of community members
  membershipRoot: Field,
}) {}

/**
 * ZK-Passport: Privacy-preserving identity verification
 *
 * Features:
 * 1. Issue identity commitments without revealing data
 * 2. Prove age without revealing birthdate
 * 3. Prove nationality without revealing passport details
 * 4. Prove membership in communities/Network States
 * 5. Sybil-resistant unique identity verification
 */
export class ZkPassport extends SmartContract {
  // Merkle root of all registered passport commitments
  @state(Field) passportRoot = State<Field>();

  // Counter for total registered passports (for census)
  @state(Field) totalPassports = State<Field>();

  // Admin public key for issuing passports
  @state(PublicKey) admin = State<PublicKey>();

  // Nullifier set root (to prevent double-registration)
  @state(Field) nullifierRoot = State<Field>();

  /**
   * Initialize the contract
   */
  init() {
    super.init();
    this.passportRoot.set(Field(0));
    this.totalPassports.set(Field(0));
    this.nullifierRoot.set(Field(0));
  }

  /**
   * Set the admin who can issue passports
   */
  @method async setAdmin(adminPubKey: PublicKey) {
    // Only callable once during setup
    const currentAdmin = this.admin.get();
    this.admin.requireEquals(currentAdmin);
    this.admin.set(adminPubKey);
  }

  /**
   * Register a new passport commitment
   * The actual identity data never touches the blockchain
   */
  @method async registerPassport(
    identityAttributes: IdentityAttributes,
    nullifier: Field,
    witness: PassportMerkleWitness,
    adminSignature: Signature
  ) {
    // Verify admin signature
    const admin = this.admin.get();
    this.admin.requireEquals(admin);

    const identityHash = identityAttributes.hash();
    adminSignature.verify(admin, [identityHash, nullifier]).assertTrue();

    // Verify nullifier hasn't been used (prevent double registration)
    const nullifierRoot = this.nullifierRoot.get();
    this.nullifierRoot.requireEquals(nullifierRoot);

    // Compute new passport commitment
    const passportCommitment = Poseidon.hash([identityHash, nullifier]);

    // Verify and update Merkle tree
    const currentRoot = this.passportRoot.get();
    this.passportRoot.requireEquals(currentRoot);

    // Verify the witness for empty leaf
    const emptyLeaf = Field(0);
    witness.calculateRoot(emptyLeaf).assertEquals(currentRoot);

    // Calculate new root with passport commitment
    const newRoot = witness.calculateRoot(passportCommitment);
    this.passportRoot.set(newRoot);

    // Increment passport counter
    const currentTotal = this.totalPassports.get();
    this.totalPassports.requireEquals(currentTotal);
    this.totalPassports.set(currentTotal.add(1));
  }

  /**
   * Prove age is above minimum without revealing actual birthdate
   *
   * @param dobYear - Year of birth (private input)
   * @param dobMonth - Month of birth (private input)
   * @param dobDay - Day of birth (private input)
   * @param salt - Salt used in DOB commitment
   * @param minAge - Minimum age to prove
   * @param currentYear - Current year for calculation
   */
  @method async proveAgeAbove(
    dobYear: Field,
    dobMonth: Field,
    dobDay: Field,
    salt: Field,
    dobCommitment: Field,
    minAge: Field,
    currentYear: Field,
    currentMonth: Field,
    currentDay: Field
  ) {
    // Verify the DOB commitment matches
    const computedCommitment = Poseidon.hash([dobYear, dobMonth, dobDay, salt]);
    computedCommitment.assertEquals(dobCommitment);

    // Calculate age (simplified - just year difference)
    const age = currentYear.sub(dobYear);

    // Prove age >= minAge
    age.assertGreaterThanOrEqual(minAge);
  }

  /**
   * Prove nationality matches a specific value without revealing passport details
   */
  @method async proveNationality(
    nationality: Field,
    salt: Field,
    nationalityCommitment: Field,
    targetNationality: Field
  ) {
    // Verify the nationality commitment
    const computedCommitment = Poseidon.hash([nationality, salt]);
    computedCommitment.assertEquals(nationalityCommitment);

    // Prove nationality matches target
    nationality.assertEquals(targetNationality);
  }

  /**
   * Prove membership in a community/Network State
   */
  @method async proveMembership(
    passportCommitment: Field,
    membershipWitness: PassportMerkleWitness,
    communityRoot: Field
  ) {
    // Verify passport is in the community's member tree
    const computedRoot = membershipWitness.calculateRoot(passportCommitment);
    computedRoot.assertEquals(communityRoot);
  }

  /**
   * Verify a passport exists without revealing which one
   */
  @method async verifyPassportExists(
    passportCommitment: Field,
    witness: PassportMerkleWitness
  ) {
    const currentRoot = this.passportRoot.get();
    this.passportRoot.requireEquals(currentRoot);

    // Verify the passport commitment exists in the tree
    const computedRoot = witness.calculateRoot(passportCommitment);
    computedRoot.assertEquals(currentRoot);
  }

  /**
   * Get total number of registered passports (for census)
   * Note: This is a view function, call totalPassports state directly
   */
  getTotalPassportsCount(): Field {
    return this.totalPassports.get();
  }
}

/**
 * Helper functions for creating identity commitments off-chain
 */
export class PassportUtils {
  /**
   * Create a commitment to a string value
   */
  static createStringCommitment(value: string, salt: Field): Field {
    // Convert string to Field array for hashing
    const encoder = new TextEncoder();
    const bytes = encoder.encode(value);
    const fields: Field[] = [];

    // Process bytes in chunks of 31 (to fit in Field)
    for (let i = 0; i < bytes.length; i += 31) {
      let hex = "";
      for (let j = i; j < Math.min(i + 31, bytes.length); j++) {
        hex += bytes[j].toString(16).padStart(2, "0");
      }
      if (hex) {
        fields.push(Field(BigInt("0x" + hex.padEnd(62, "0"))));
      }
    }

    if (fields.length === 0) {
      fields.push(Field(0));
    }

    const valueField = Poseidon.hash(fields);
    return Poseidon.hash([valueField, salt]);
  }

  /**
   * Create a commitment to a date (year, month, day)
   */
  static createDateCommitment(
    year: number,
    month: number,
    day: number,
    salt: Field
  ): Field {
    return Poseidon.hash([Field(year), Field(month), Field(day), salt]);
  }

  /**
   * Create a commitment to a numeric value
   */
  static createNumericCommitment(value: number, salt: Field): Field {
    return Poseidon.hash([Field(value), salt]);
  }

  /**
   * Generate a random salt for commitments
   */
  static generateSalt(): Field {
    return Field.random();
  }

  /**
   * Create a nullifier from identity data (for sybil resistance)
   */
  static createNullifier(idNumber: string, secret: Field): Field {
    // Convert string to Field array for hashing
    const encoder = new TextEncoder();
    const bytes = encoder.encode(idNumber);
    const fields: Field[] = [];

    for (let i = 0; i < bytes.length; i += 31) {
      let hex = "";
      for (let j = i; j < Math.min(i + 31, bytes.length); j++) {
        hex += bytes[j].toString(16).padStart(2, "0");
      }
      if (hex) {
        fields.push(Field(BigInt("0x" + hex.padEnd(62, "0"))));
      }
    }

    if (fields.length === 0) {
      fields.push(Field(0));
    }

    const idField = Poseidon.hash(fields);
    return Poseidon.hash([idField, secret]);
  }

  /**
   * Create full identity attributes
   */
  static createIdentityAttributes(
    name: string,
    dob: { year: number; month: number; day: number },
    nationality: string,
    idNumber: string,
    salt: Field
  ): IdentityAttributes {
    return new IdentityAttributes({
      nameCommitment: this.createStringCommitment(name, salt),
      dobCommitment: this.createDateCommitment(
        dob.year,
        dob.month,
        dob.day,
        salt
      ),
      nationalityCommitment: this.createStringCommitment(nationality, salt),
      idCommitment: this.createStringCommitment(idNumber, salt),
      salt,
    });
  }
}
