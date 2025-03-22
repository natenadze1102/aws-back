// import-service-stack.ts
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { EventType } from 'aws-cdk-lib/aws-s3';
import { Function as LambdaFunction, Runtime, Code } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import {
  S3EventSource as S3EventSourceV2,
  S3EventSourceProps,
} from 'aws-cdk-lib/aws-lambda-event-sources';
import {
  RestApi,
  LambdaIntegration,
  Cors,
  TokenAuthorizer,
  AuthorizationType,
} from 'aws-cdk-lib/aws-apigateway';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Fn } from 'aws-cdk-lib';

interface ImportServiceStackProps extends StackProps {
  // No need for basicAuthorizerFn in props anymore.
}

export class ImportServiceStack extends Stack {
  public readonly importApi: RestApi;

  constructor(scope: Construct, id: string, props?: ImportServiceStackProps) {
    super(scope, id, props);

    // 1) Import an existing S3 bucket by name
    const importBucket = s3.Bucket.fromBucketName(this, 'ImportBucket', 'rs-school-test-upload');
    const realBucket = importBucket as s3.Bucket;

    // 2) Import an existing SQS queue using exported values
    const catalogItemsQueue = sqs.Queue.fromQueueAttributes(this, 'ImportedCatalogItemsQueue', {
      queueArn: Fn.importValue('CatalogItemsQueueArn'),
      queueUrl: Fn.importValue('CatalogItemsQueueUrl'),
    });

    // 3) Create Lambdas
    const importProductsFileLambda = new LambdaFunction(this, 'ImportProductsFileLambda', {
      runtime: Runtime.NODEJS_18_X,
      handler: 'importProductsFile.handler',
      code: Code.fromAsset('dist/import-service/src/lambdas'),
      environment: {
        IMPORT_BUCKET_NAME: realBucket.bucketName,
        CATALOG_ITEMS_QUEUE_URL: catalogItemsQueue.queueUrl,
      },
    });

    const importFileParserLambda = new NodejsFunction(this, 'ImportFileParserLambda', {
      runtime: Runtime.NODEJS_18_X,
      entry: 'import-service/src/lambdas/importFileParser.ts',
      handler: 'handler',
      environment: {
        IMPORT_BUCKET_NAME: realBucket.bucketName,
        CATALOG_ITEMS_QUEUE_URL: catalogItemsQueue.queueUrl,
      },
    });

    // 4) Set up the S3 trigger for the parser Lambda
    importFileParserLambda.addEventSource(
      new S3EventSourceV2(realBucket, <S3EventSourceProps>{
        events: [EventType.OBJECT_CREATED],
        filters: [{ prefix: 'uploaded/' }],
      })
    );

    // 5) Grant S3 permissions to Lambdas
    realBucket.grantPut(importProductsFileLambda);
    realBucket.grantRead(importFileParserLambda);
    realBucket.grantReadWrite(importFileParserLambda);

    // 6) Grant SQS permissions to parser Lambda
    catalogItemsQueue.grantSendMessages(importFileParserLambda);

    // 7) Create the API Gateway for the import service
    this.importApi = new RestApi(this, 'ImportServiceApi', {
      restApiName: 'Import Service',
      description: 'Handles import operations',
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
        allowCredentials: true,
      },
    });

    // 8) Create the /import resource
    const importResource = this.importApi.root.addResource('import');

    // 9) Retrieve the authorizer ARN from CloudFormation exports
    const authorizerArn = Fn.importValue('BasicAuthorizerLambdaArn');

    // 10) Import the authorizer Lambda by ARN
    const importedAuthorizerFn = LambdaFunction.fromFunctionArn(
      this,
      'ImportedAuthorizerFn',
      authorizerArn
    );

    // 11) Create a TokenAuthorizer using the imported function
    const tokenAuthorizer = new TokenAuthorizer(this, 'BasicTokenAuthorizer', {
      handler: importedAuthorizerFn,
    });

    // 12) Add GET method on /import with the custom authorizer attached
    importResource.addMethod('GET', new LambdaIntegration(importProductsFileLambda), {
      authorizer: tokenAuthorizer,
      authorizationType: AuthorizationType.CUSTOM,
    });
  }
}
