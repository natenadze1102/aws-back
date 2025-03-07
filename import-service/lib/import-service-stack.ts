import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Bucket, EventType } from 'aws-cdk-lib/aws-s3';
import { Function as LambdaFunction, Runtime, Code } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { S3EventSourceProps, S3EventSourceV2 } from 'aws-cdk-lib/aws-lambda-event-sources';
import { RestApi, LambdaIntegration, Cors } from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';

export class ImportServiceStack extends Stack {
  // If you want your Import Service to have its own API Gateway, keep a reference here
  public readonly importApi: RestApi;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    /*
     * ==========================
     * IMPORT SERVICE
     * ==========================
     * Task 5
     */

    // 1. Reference or Create the S3 bucket
    //    If the bucket is already created in the AWS Console or by another stack,
    //    you can "import" it using Bucket.fromBucketName or fromBucketArn
    const importBucket = Bucket.fromBucketName(this, 'ImportBucket', 'rs-school-test-upload');

    // 2. Create the `importProductsFile` Lambda
    const importProductsFileLambda = new LambdaFunction(this, 'ImportProductsFileLambda', {
      runtime: Runtime.NODEJS_18_X,
      handler: 'importProductsFile.handler',
      code: Code.fromAsset('dist/services/import-service'), // adjust path as needed
      environment: {
        IMPORT_BUCKET_NAME: importBucket.bucketName,
      },
    });

    // 3. Create the `importFileParser` Lambda
    const importFileParserLambda = new NodejsFunction(this, 'ImportFileParserLambda', {
      runtime: Runtime.NODEJS_18_X,
      entry: 'services/import-service/importFileParser.ts', // your .ts entry file
      handler: 'handler',
      environment: {
        IMPORT_BUCKET_NAME: importBucket.bucketName,
      },
    });

    // 4. Configure S3 to trigger the `importFileParser` Lambda when objects are created in "uploaded/"
    importFileParserLambda.addEventSource(
      new S3EventSourceV2(importBucket, <S3EventSourceProps>{
        events: [EventType.OBJECT_CREATED],
        filters: [{ prefix: 'uploaded/' }], // Only triggers if object is inside "uploaded/"
      })
    );

    // 5. Grant necessary permissions
    importBucket.grantPut(importProductsFileLambda);
    importBucket.grantRead(importFileParserLambda);
    importBucket.grantReadWrite(importFileParserLambda);

    // 6. Create an API Gateway for the Import Service (or you can skip if you want a single gateway)
    this.importApi = new RestApi(this, 'ImportServiceApi', {
      restApiName: 'Import Service',
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
        allowCredentials: true,
      },
    });

    // 7. Add GET /import
    const importResource = this.importApi.root.addResource('import');
    importResource.addMethod('GET', new LambdaIntegration(importProductsFileLambda), {
      requestParameters: {
        // 'method.request.querystring.name': true // if you want it required
        'method.request.querystring.name': false,
      },
    });
  }
}
