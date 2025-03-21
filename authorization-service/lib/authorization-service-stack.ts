// authorization-service-stack.ts
import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Function as LambdaFunction, Runtime, Code } from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';

export class AuthorizationServiceStack extends Stack {
  public readonly basicAuthorizerFn: LambdaFunction;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.basicAuthorizerFn = new LambdaFunction(this, 'basicAuthorizerLambda', {
      runtime: Runtime.NODEJS_18_X,
      handler: 'basicAuthorizer.handler',
      code: Code.fromAsset('dist/authorization-service/src/lambdas'),
      environment: {
        CREDENTIALS: process.env.CREDENTIALS || 'yourGithubUsername=TEST_PASSWORD',
      },
    });

    // Export the ARN as a CloudFormation output
    new CfnOutput(this, 'BasicAuthorizerLambdaArnOutput', {
      value: this.basicAuthorizerFn.functionArn,
      exportName: 'BasicAuthorizerLambdaArn',
    });
  }
}
