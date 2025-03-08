import { Stack, StackProps, CfnOutput, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { BlockPublicAccess, Bucket, BucketPolicy, EventType } from 'aws-cdk-lib/aws-s3';
import { Distribution } from 'aws-cdk-lib/aws-cloudfront';
import { S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { OriginAccessIdentity } from 'aws-cdk-lib/aws-cloudfront';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Cors, LambdaIntegration, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { Code, Runtime, Function } from 'aws-cdk-lib/aws-lambda';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { S3EventSource, S3EventSourceV2 } from 'aws-cdk-lib/aws-lambda-event-sources';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';

export class SdkInfraStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    /*
     * ==========================
     * WEBSITE HOSTING SECTION
     * ==========================
     */

    // 1. Create a PRIVATE S3 Bucket for website hosting
    const websiteBucket = new Bucket(this, 'Task2Bucket', {
      // websiteIndexDocument: 'index.html',
      // websiteErrorDocument: 'index.html', because of this ot says Static Website that is not deisred behavior
      publicReadAccess: false, // Ensure bucket is private
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL, // Block all public access
      removalPolicy: RemovalPolicy.RETAIN, // Change as needed
    });

    // 2. Create CloudFront Origin Access Identity (OAI)
    const oai = new OriginAccessIdentity(this, 'OAI');

    // 3. Attach an S3 Bucket Policy that allows CloudFront OAI to perform s3:GetObject
    const bucketPolicy = new BucketPolicy(this, 'BucketPolicy', {
      bucket: websiteBucket,
    });

    bucketPolicy.document.addStatements(
      new iam.PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [`${websiteBucket.bucketArn}/*`],
        principals: [
          new iam.CanonicalUserPrincipal(oai.cloudFrontOriginAccessIdentityS3CanonicalUserId),
        ],
      })
    );

    // 4. Create CloudFront Distribution with S3Origin using the OAI
    const distribution = new Distribution(this, 'MyDistribution', {
      defaultBehavior: {
        origin: new S3Origin(websiteBucket, {
          originAccessIdentity: oai,
        }),
      },
      defaultRootObject: 'index.html',

      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
    });

    // 7. Deploy the contents of the "dist" folder from your React build to the S3 bucket
    new BucketDeployment(this, 'DeployWebsite', {
      sources: [Source.asset('../aws-front/dist')],
      destinationBucket: websiteBucket,
      distribution,
      distributionPaths: ['/*'], // Invalidate CloudFront cache after deployment
    });

    // 6. (Optional) Output the CloudFront Distribution Domain
    new CfnOutput(this, 'CloudFrontURL', {
      value: distribution.distributionDomainName,
      description: 'The domain name of the CloudFront distribution',
    });

    /*
     * ==========================
     * DYNAMODB TABLES
     * ==========================
     */

    // 5. Create products table
    const productsTable = new Table(this, 'ProductsTable', {
      tableName: 'products',
      partitionKey: { name: 'id', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
    });

    // 6. Create stocks table
    const stocksTable = new Table(this, 'StocksTable', {
      tableName: 'stocks',
      partitionKey: { name: 'product_id', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
    });

    /*
     * ==========================
     * PRODUCT SERVICE LAMBDAS
     * ==========================
     */

    // 7. Create the Lambda functions for "getProductsList", "getProductsById" , "createProduct"
    const getProductsListLambda = new Function(this, 'getProductsListLambda', {
      runtime: Runtime.NODEJS_22_X,
      handler: 'getProductsList.handler',
      code: Code.fromAsset('dist/services/product-service'),
      environment: {
        PRODUCTS_TABLE_NAME: productsTable.tableName,
        STOCKS_TABLE_NAME: stocksTable.tableName,
      },
    });

    const getProductsByIdLambda = new Function(this, 'GetProductsByIdLambda', {
      runtime: Runtime.NODEJS_22_X,
      handler: 'getProductsById.handler',
      code: Code.fromAsset('dist/services/product-service'),
      environment: {
        PRODUCTS_TABLE_NAME: productsTable.tableName,
        STOCKS_TABLE_NAME: stocksTable.tableName,
      },
    });

    const createProductLambda = new Function(this, 'CreateProductLambda', {
      runtime: Runtime.NODEJS_22_X,
      handler: 'createProduct.handler',
      code: Code.fromAsset('dist/services/product-service'),
      environment: {
        PRODUCTS_TABLE_NAME: productsTable.tableName,
        STOCKS_TABLE_NAME: stocksTable.tableName,
      },
    });

    productsTable.grantReadData(getProductsListLambda);
    stocksTable.grantReadData(getProductsListLambda);
    productsTable.grantReadData(getProductsByIdLambda);
    stocksTable.grantReadData(getProductsByIdLambda);
    productsTable.grantWriteData(createProductLambda);
    stocksTable.grantWriteData(createProductLambda);

    /*
     * ==========================
     * PRODUCT SERVICE API GATEWAY
     * ==========================
     */
    // 8. Create the API Gateway
    const api = new RestApi(this, 'ProductServiceApi', {
      restApiName: 'Product Service',

      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS, // or ['https://your-frontend.com']
        allowMethods: Cors.ALL_METHODS, // or [ 'GET', 'POST', ... ]
        allowHeaders: ['Content-Type', 'Authorization'],
        allowCredentials: true,
      },
    });

    // 9. Add "/products" resource
    const products = api.root.addResource('products');
    products.addMethod('GET', new LambdaIntegration(getProductsListLambda));
    products.addMethod('POST', new LambdaIntegration(createProductLambda));

    // 10. Add "/products/{productId}" resource
    const singleProductResource = products.addResource('{productId}');
    singleProductResource.addMethod('GET', new LambdaIntegration(getProductsByIdLambda));

    /*
     * ==========================
     * IMPORT SERVICE
     * ==========================
     */

    const importBucket = Bucket.fromBucketName(this, 'ImportBucket', 'rs-school-test-upload');

    // 11. Create the importProductsFile Lambda
    const importProductsFileLambda = new Function(this, 'ImportProductsFileLambda', {
      runtime: Runtime.NODEJS_22_X,
      handler: 'importProductsFile.handler',
      code: Code.fromAsset('dist/services/import-service'),

      environment: {
        IMPORT_BUCKET_NAME: 'rs-school-test-upload',
      },
    });

    //12. Create the importFileParser Lambda function
    const importFileParserLambda = new NodejsFunction(this, 'ImportFileParserLambda', {
      runtime: Runtime.NODEJS_22_X,
      entry: 'services/import-service/importFileParser.ts',
      handler: 'handler',

      environment: {
        IMPORT_BUCKET_NAME: 'rs-school-test-upload',
      },
    });
    // Configure the Lambda to trigger when an object is created in the "uploaded/" folder
    importFileParserLambda.addEventSource(
      new S3EventSourceV2(importBucket, {
        events: [EventType.OBJECT_CREATED],
        filters: [{ prefix: 'uploaded/' }], // Trigger only for files in "uploaded/"
      })
    );

    // 13. Grant the Lambda permission to PUT objects to the bucket
    //    This is necessary to generate a pre-signed URL for PUT.
    importBucket.grantPut(importProductsFileLambda);
    importBucket.grantRead(importFileParserLambda);
    importBucket.grantReadWrite(importFileParserLambda);

    // 14. add /import GET
    const importResource = api.root.addResource('import');
    importResource.addMethod('GET', new LambdaIntegration(importProductsFileLambda), {
      requestParameters: {
        'method.request.querystring.name': false, // or 'true' if we want to mark it "required"
      },
    });
  }
}
