import { App } from 'aws-cdk-lib';
import { ProductServiceStack } from '../product-service/lib/product-service-stack';
import { ImportServiceStack } from '../import-service/lib/import-service-stack';
import { AuthorizationServiceStack } from '../authorization-service/lib/authorization-service-stack';

const app = new App();

// Use the same environment for all stacks (ensure you're deploying to the same account/region)
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

// Deploy the Product Service stack (independent)
new ProductServiceStack(app, 'ProductServiceStack', { env });

// Create the Authorization stack; it simply creates the basic authorizer Lambda.
const authStack = new AuthorizationServiceStack(app, 'AuthorizationServiceStack', { env });

// Create the Import Service stack and pass the authorizer Lambda from authStack.
new ImportServiceStack(app, 'ImportServiceStack', { env });

app.synth();
