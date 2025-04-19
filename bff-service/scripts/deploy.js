#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../.env') });

// Get GitHub username from environment or .env file
const getGithubUsername = () => {
  const username = process.env.GITHUB_USERNAME;
  if (!username) {
    console.error('Please set GITHUB_USERNAME environment variable');
    process.exit(1);
  }
  return username;
};

// Deploy to Elastic Beanstalk
const deploy = () => {
  try {
    const githubUsername = getGithubUsername();
    const applicationName = `${githubUsername}-bff-api`;
    const environmentName = 'production';
    const cnamePrefix = `${githubUsername}-bff-api-${environmentName}`;

    console.log(`Deploying to Elastic Beanstalk as: ${applicationName}`);

    // Create Procfile for Elastic Beanstalk
    fs.writeFileSync(path.join(__dirname, '../Procfile'), 'web: node dist/index.js\n');

    // Create package.json with start script for EB
    const packageJson = require('../package.json');
    if (!packageJson.scripts.start) {
      packageJson.scripts.start = 'node dist/index.js';
      fs.writeFileSync(
        path.join(__dirname, '../package.json'),
        JSON.stringify(packageJson, null, 2)
      );
      console.log('Added start script to package.json');
    }

    // Create .ebignore file
    fs.writeFileSync(
      path.join(__dirname, '../.ebignore'),
      `
node_modules/
src/
scripts/
.git/
.env.sample
README.md
`
    );

    // Delete .elasticbeanstalk directory if it exists to start fresh
    const ebConfigDir = path.join(__dirname, '../.elasticbeanstalk');
    if (fs.existsSync(ebConfigDir)) {
      console.log('Removing existing .elasticbeanstalk directory to start fresh');
      fs.rmSync(ebConfigDir, { recursive: true, force: true });
    }

    // Manual EB deployment process
    // 1. Initialize the application
    execSync(
      `eb init ${applicationName} --region eu-central-1 --platform node.js --keyname aws-eb`,
      {
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit',
      }
    );

    // 2. Try to terminate the existing environment if it exists
    try {
      console.log(`Checking if environment ${environmentName} exists and terminating if needed...`);
      execSync(`eb terminate ${environmentName} --force`, {
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit',
      });

      // Wait for termination to complete
      console.log('Waiting for environment termination to complete...');
      execSync('sleep 30'); // Wait 30 seconds for termination to complete
    } catch (error) {
      console.log(
        `Environment ${environmentName} may not exist or couldn't be terminated. Continuing...`
      );
    }

    // 3. Create a new environment
    console.log(`Creating new environment: ${environmentName} with CNAME: ${cnamePrefix}`);
    execSync(`eb create ${environmentName} --single --cname=${cnamePrefix} --timeout 20`, {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
    });

    console.log(`
Deployment complete!
Your BFF Service is now available at: http://${cnamePrefix}.eu-central-1.elasticbeanstalk.com
`);
  } catch (error) {
    console.error('Deployment failed:', error);
    process.exit(1);
  }
};

deploy();
