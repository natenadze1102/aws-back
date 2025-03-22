import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Function as LambdaFunction, Runtime, Code } from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam'; // Add this import for ServicePrincipal

import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

export class AuthorizationServiceStack extends Stack {
  public readonly basicAuthorizerFn: LambdaFunction;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Get all environment variables that should be passed to the Lambda
    const lambdaEnv: Record<string, string> = {};

    // Find all environment variables that might be GitHub usernames with passwords
    Object.keys(process.env).forEach((key) => {
      if (key.includes('=') === false && process.env[key]?.includes('TEST_PASSWORD')) {
        lambdaEnv[key] = process.env[key] || '';
      }
    });

    // Ensure at least one credential exists
    if (Object.keys(lambdaEnv).length === 0) {
      // Fallback to your GitHub username if no credentials found in .env
      lambdaEnv['NATENADZE1102'] = 'TEST_PASSWORD'; // Replace with your GitHub username in uppercase
    }

    this.basicAuthorizerFn = new LambdaFunction(this, 'basicAuthorizerLambda', {
      runtime: Runtime.NODEJS_18_X,
      handler: 'basicAuthorizer.handler',
      code: Code.fromAsset('dist/authorization-service/src/lambdas'),
      environment: lambdaEnv,
    });

    // Add permission for API Gateway to invoke this Lambda
    this.basicAuthorizerFn.addPermission('ApiGatewayInvoke', {
      principal: new iam.ServicePrincipal('apigateway.amazonaws.com'),
      action: 'lambda:InvokeFunction',
    });

    // Export the ARN as a CloudFormation output
    new CfnOutput(this, 'BasicAuthorizerLambdaArnOutput', {
      value: this.basicAuthorizerFn.functionArn,
      exportName: 'BasicAuthorizerLambdaArn',
    });
  }
}
