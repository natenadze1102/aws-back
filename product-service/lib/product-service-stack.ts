import { Stack, StackProps, RemovalPolicy, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { BlockPublicAccess, Bucket, BucketPolicy } from 'aws-cdk-lib/aws-s3';
import { Distribution, OriginAccessIdentity } from 'aws-cdk-lib/aws-cloudfront';
import { S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Cors, LambdaIntegration, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { Code, Runtime, Function as LambdaFunction } from 'aws-cdk-lib/aws-lambda';
import { Table, AttributeType, BillingMode } from 'aws-cdk-lib/aws-dynamodb';

export class ProductServiceStack extends Stack {
  public readonly api: RestApi; // Optionally export the API if you want to share it with the import-service

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    /*
     * ==========================
     * WEBSITE HOSTING SECTION
     * ==========================
     */

    // 1. Create a PRIVATE S3 Bucket for website hosting
    const websiteBucket = new Bucket(this, 'Task2Bucket', {
      publicReadAccess: false,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.RETAIN,
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

    // 5. Deploy the contents of the "dist" folder from your React build to the S3 bucket
    new BucketDeployment(this, 'DeployWebsite', {
      sources: [Source.asset('../aws-front/dist')],
      destinationBucket: websiteBucket,
      distribution,
      distributionPaths: ['/*'],
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

    // 7. Create products table
    const productsTable = new Table(this, 'ProductsTable', {
      tableName: 'products',
      partitionKey: { name: 'id', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
    });

    // 8. Create stocks table
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

    // 9. Create the Lambda functions for "getProductsList", "getProductsById" , "createProduct"
    const getProductsListLambda = new LambdaFunction(this, 'getProductsListLambda', {
      runtime: Runtime.NODEJS_18_X,
      handler: 'getProductsList.handler',
      code: Code.fromAsset('dist/services/product-service'),
      environment: {
        PRODUCTS_TABLE_NAME: productsTable.tableName,
        STOCKS_TABLE_NAME: stocksTable.tableName,
      },
    });

    const getProductsByIdLambda = new LambdaFunction(this, 'GetProductsByIdLambda', {
      runtime: Runtime.NODEJS_18_X,
      handler: 'getProductsById.handler',
      code: Code.fromAsset('dist/services/product-service'),
      environment: {
        PRODUCTS_TABLE_NAME: productsTable.tableName,
        STOCKS_TABLE_NAME: stocksTable.tableName,
      },
    });

    const createProductLambda = new LambdaFunction(this, 'CreateProductLambda', {
      runtime: Runtime.NODEJS_18_X,
      handler: 'createProduct.handler',
      code: Code.fromAsset('dist/services/product-service'),
      environment: {
        PRODUCTS_TABLE_NAME: productsTable.tableName,
        STOCKS_TABLE_NAME: stocksTable.tableName,
      },
    });

    // Permissions
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
    // 10. Create the API Gateway
    this.api = new RestApi(this, 'ProductServiceApi', {
      restApiName: 'Product Service',
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
        allowCredentials: true,
      },
    });

    // 11. Add "/products" resource
    const products = this.api.root.addResource('products');
    products.addMethod('GET', new LambdaIntegration(getProductsListLambda));
    products.addMethod('POST', new LambdaIntegration(createProductLambda));

    // 12. Add "/products/{productId}" resource
    const singleProductResource = products.addResource('{productId}');
    singleProductResource.addMethod('GET', new LambdaIntegration(getProductsByIdLambda));
  }
}
