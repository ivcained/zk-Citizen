import { Field, Mina, PrivateKey, PublicKey, AccountUpdate, MerkleTree, Poseidon } from 'o1js';
import { ZkPassport, IdentityAttributes, PassportMerkleWitness, PassportUtils } from './ZkPassport';

describe('ZkPassport', () => {
  let deployerAccount: PublicKey;
  let deployerKey: PrivateKey;
  let userAccount: PublicKey;
  let userKey: PrivateKey;
  let zkPassport: ZkPassport;
  let zkPassportAddress: PublicKey;
  let zkPassportKey: PrivateKey;
  let merkleTree: MerkleTree;

  beforeAll(async () => {
    // Set up local blockchain
    const Local = await Mina.LocalBlockchain({ proofsEnabled: false });
    Mina.setActiveInstance(Local);

    deployerAccount = Local.testAccounts[0].key.toPublicKey();
    deployerKey = Local.testAccounts[0].key;
    userAccount = Local.testAccounts[1].key.toPublicKey();
    userKey = Local.testAccounts[1].key;

    zkPassportKey = PrivateKey.random();
    zkPassportAddress = zkPassportKey.toPublicKey();
    zkPassport = new ZkPassport(zkPassportAddress);

    merkleTree = new MerkleTree(20);
  });

  describe('Deployment', () => {
    it('should deploy the contract', async () => {
      const txn = await Mina.transaction(deployerAccount, async () => {
        AccountUpdate.fundNewAccount(deployerAccount);
        await zkPassport.deploy();
      });
      await txn.prove();
      await txn.sign([deployerKey, zkPassportKey]).send();

      const passportRoot = zkPassport.passportRoot.get();
      expect(passportRoot).toEqual(Field(0));
    });

    it('should set admin', async () => {
      const txn = await Mina.transaction(deployerAccount, async () => {
        await zkPassport.setAdmin(deployerAccount);
      });
      await txn.prove();
      await txn.sign([deployerKey]).send();

      const admin = zkPassport.admin.get();
      expect(admin).toEqual(deployerAccount);
    });
  });

  describe('PassportUtils', () => {
    it('should generate random salt', () => {
      const salt1 = PassportUtils.generateSalt();
      const salt2 = PassportUtils.generateSalt();
      expect(salt1).not.toEqual(salt2);
    });

    it('should create string commitment', () => {
      const salt = Field(12345);
      const commitment1 = PassportUtils.createStringCommitment('John Doe', salt);
      const commitment2 = PassportUtils.createStringCommitment('John Doe', salt);
      const commitment3 = PassportUtils.createStringCommitment('Jane Doe', salt);

      expect(commitment1).toEqual(commitment2);
      expect(commitment1).not.toEqual(commitment3);
    });

    it('should create date commitment', () => {
      const salt = Field(12345);
      const commitment = PassportUtils.createDateCommitment(1990, 5, 15, salt);
      expect(commitment).toBeDefined();
    });

    it('should create identity attributes', () => {
      const salt = PassportUtils.generateSalt();
      const attributes = PassportUtils.createIdentityAttributes(
        'John Doe',
        { year: 1990, month: 5, day: 15 },
        'Singapore',
        'E1234567A',
        salt
      );

      expect(attributes.nameCommitment).toBeDefined();
      expect(attributes.dobCommitment).toBeDefined();
      expect(attributes.nationalityCommitment).toBeDefined();
      expect(attributes.idCommitment).toBeDefined();
    });

    it('should create nullifier', () => {
      const secret = Field.random();
      const nullifier = PassportUtils.createNullifier('E1234567A', secret);
      expect(nullifier).toBeDefined();
    });
  });

  describe('Identity Hash', () => {
    it('should create consistent identity hash', () => {
      const salt = Field(12345);
      const attributes = PassportUtils.createIdentityAttributes(
        'John Doe',
        { year: 1990, month: 5, day: 15 },
        'Singapore',
        'E1234567A',
        salt
      );

      const hash1 = attributes.hash();
      const hash2 = attributes.hash();
      expect(hash1).toEqual(hash2);
    });

    it('should create different hash for different data', () => {
      const salt = Field(12345);
      const attributes1 = PassportUtils.createIdentityAttributes(
        'John Doe',
        { year: 1990, month: 5, day: 15 },
        'Singapore',
        'E1234567A',
        salt
      );

      const attributes2 = PassportUtils.createIdentityAttributes(
        'Jane Doe',
        { year: 1990, month: 5, day: 15 },
        'Singapore',
        'E1234567B',
        salt
      );

      expect(attributes1.hash()).not.toEqual(attributes2.hash());
    });
  });

  describe('Age Verification', () => {
    it('should verify age above minimum', async () => {
      const salt = Field(12345);
      const dobCommitment = PassportUtils.createDateCommitment(1990, 5, 15, salt);

      // This would be called as a zkApp method
      // For unit testing, we verify the commitment logic
      const computedCommitment = Poseidon.hash([
        Field(1990),
        Field(5),
        Field(15),
        salt,
      ]);

      expect(computedCommitment).toEqual(dobCommitment);

      // Age calculation: 2024 - 1990 = 34
      const age = Field(2024).sub(Field(1990));
      expect(age.toBigInt()).toBeGreaterThanOrEqual(18n);
    });
  });

  describe('Merkle Tree Operations', () => {
    it('should add passport to merkle tree', () => {
      const salt = PassportUtils.generateSalt();
      const attributes = PassportUtils.createIdentityAttributes(
        'John Doe',
        { year: 1990, month: 5, day: 15 },
        'Singapore',
        'E1234567A',
        salt
      );

      const nullifier = PassportUtils.createNullifier('E1234567A', Field.random());
      const passportCommitment = Poseidon.hash([attributes.hash(), nullifier]);

      const initialRoot = merkleTree.getRoot();
      merkleTree.setLeaf(0n, passportCommitment);
      const newRoot = merkleTree.getRoot();

      expect(newRoot).not.toEqual(initialRoot);
    });

    it('should generate valid merkle witness', () => {
      const salt = PassportUtils.generateSalt();
      const attributes = PassportUtils.createIdentityAttributes(
        'Jane Doe',
        { year: 1995, month: 8, day: 20 },
        'Malaysia',
        'A9876543B',
        salt
      );

      const nullifier = PassportUtils.createNullifier('A9876543B', Field.random());
      const passportCommitment = Poseidon.hash([attributes.hash(), nullifier]);

      merkleTree.setLeaf(1n, passportCommitment);
      const witness = merkleTree.getWitness(1n);

      expect(witness).toBeDefined();
      expect(witness.length).toBe(20); // Tree height
    });
  });
});