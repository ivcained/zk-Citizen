/**
 * ZK-Citizen Deployment Script
 * Deploys ZkPassport and ZkCensus contracts to Mina testnet
 */

import { Mina, PrivateKey, PublicKey, AccountUpdate, Field } from 'o1js';
import { ZkPassport } from '../contracts/src/ZkPassport';
import { ZkCensus } from '../contracts/src/ZkCensus';
import * as dotenv from 'dotenv';

dotenv.config();

// Configuration
const NETWORK = process.env.MINA_NETWORK || 'testnet';
const GRAPHQL_ENDPOINT = process.env.MINA_GRAPHQL_ENDPOINT || 
  'https://proxy.testnet.minaexplorer.com/graphql';

interface DeploymentResult {
  zkPassportAddress: string;
  zkCensusAddress: string;
  transactionHash: string;
}

async function deploy(): Promise<DeploymentResult> {
  console.log('🚀 Starting ZK-Citizen deployment...\n');

  // Set up network
  console.log(`📡 Connecting to ${NETWORK}...`);
  const Network = Mina.Network(GRAPHQL_ENDPOINT);
  Mina.setActiveInstance(Network);

  // Load deployer key
  const deployerKey = PrivateKey.fromBase58(process.env.ADMIN_PRIVATE_KEY!);
  const deployerAccount = deployerKey.toPublicKey();
  console.log(`👤 Deployer: ${deployerAccount.toBase58()}`);

  // Generate contract keys
  const zkPassportKey = PrivateKey.random();
  const zkPassportAddress = zkPassportKey.toPublicKey();
  console.log(`📜 ZkPassport address: ${zkPassportAddress.toBase58()}`);

  const zkCensusKey = PrivateKey.random();
  const zkCensusAddress = zkCensusKey.toPublicKey();
  console.log(`📊 ZkCensus address: ${zkCensusAddress.toBase58()}`);

  // Compile contracts
  console.log('\n⚙️  Compiling contracts...');
  console.log('   This may take a few minutes...');
  
  const passportCompileStart = Date.now();
  await ZkPassport.compile();
  console.log(`   ✅ ZkPassport compiled in ${(Date.now() - passportCompileStart) / 1000}s`);

  const censusCompileStart = Date.now();
  await ZkCensus.compile();
  console.log(`   ✅ ZkCensus compiled in ${(Date.now() - censusCompileStart) / 1000}s`);

  // Create contract instances
  const zkPassport = new ZkPassport(zkPassportAddress);
  const zkCensus = new ZkCensus(zkCensusAddress);

  // Deploy ZkPassport
  console.log('\n📤 Deploying ZkPassport...');
  const passportTxn = await Mina.transaction(
    { sender: deployerAccount, fee: 0.1e9 },
    async () => {
      AccountUpdate.fundNewAccount(deployerAccount);
      await zkPassport.deploy();
      await zkPassport.setAdmin(deployerAccount);
    }
  );
  await passportTxn.prove();
  const passportResult = await passportTxn.sign([deployerKey, zkPassportKey]).send();
  console.log(`   ✅ ZkPassport deployed! Hash: ${passportResult.hash}`);

  // Deploy ZkCensus
  console.log('\n📤 Deploying ZkCensus...');
  const censusTxn = await Mina.transaction(
    { sender: deployerAccount, fee: 0.1e9 },
    async () => {
      AccountUpdate.fundNewAccount(deployerAccount);
      await zkCensus.deploy();
      await zkCensus.setupCensus(deployerAccount, Field(1)); // Community ID = 1
    }
  );
  await censusTxn.prove();
  const censusResult = await censusTxn.sign([deployerKey, zkCensusKey]).send();
  console.log(`   ✅ ZkCensus deployed! Hash: ${censusResult.hash}`);

  // Save deployment info
  const deploymentInfo = {
    network: NETWORK,
    timestamp: new Date().toISOString(),
    zkPassport: {
      address: zkPassportAddress.toBase58(),
      privateKey: zkPassportKey.toBase58(), // Store securely!
    },
    zkCensus: {
      address: zkCensusAddress.toBase58(),
      privateKey: zkCensusKey.toBase58(), // Store securely!
    },
    deployer: deployerAccount.toBase58(),
  };

  console.log('\n✨ Deployment complete!\n');
  console.log('📋 Deployment Info:');
  console.log(JSON.stringify(deploymentInfo, null, 2));

  // Warning about private keys
  console.log('\n⚠️  IMPORTANT: Store the private keys securely!');
  console.log('   Never commit them to version control.\n');

  return {
    zkPassportAddress: zkPassportAddress.toBase58(),
    zkCensusAddress: zkCensusAddress.toBase58(),
    transactionHash: passportResult.hash,
  };
}

// Run deployment
deploy()
  .then((result) => {
    console.log('🎉 Deployment successful!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  });