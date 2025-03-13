import { App } from 'aws-cdk-lib';
import { ProductServiceStack } from '../product-service/lib/product-service-stack';
import { ImportServiceStack } from '../import-service/lib/import-service-stack';

const app = new App();

new ProductServiceStack(app, 'ProductServiceStack', {});

new ImportServiceStack(app, 'ImportServiceStack', {});

app.synth();
