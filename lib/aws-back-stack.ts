import { Stack, StackProps, CfnOutput, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { BlockPublicAccess, Bucket, BucketPolicy } from 'aws-cdk-lib/aws-s3';
import { Distribution } from 'aws-cdk-lib/aws-cloudfront';
import { S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { OriginAccessIdentity } from 'aws-cdk-lib/aws-cloudfront';
import * as iam from 'aws-cdk-lib/aws-iam';
import { LambdaIntegration, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { Code, Runtime, Function } from 'aws-cdk-lib/aws-lambda';

export class SdkInfraStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

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

    // 5. Deploy the contents of the "dist" folder from your React build to the S3 bucket
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

    // NEW CODE: LAMBDA & API GATEWAY
    // 7. Create the Lambda functions for "getProductsList" and "getProductsById"
    const getProductsListLambda = new Function(this, 'getProductsListLambda', {
      runtime: Runtime.NODEJS_22_X,
      handler: 'getProductsList.handler',
      code: Code.fromAsset('dist/services/product-service'),
    });

    const getProductsByIdLambda = new Function(this, 'getProductsByIdLambda', {
      runtime: Runtime.NODEJS_22_X,
      handler: 'getProductsById.handler',
      code: Code.fromAsset('dist/services/product-service'),
    });

    // 8. Create the API Gateway
    const api = new RestApi(this, 'ProductServiceApi', {
      restApiName: 'Product Service',
    });

    // 9. Add "/products" resource
    const products = api.root.addResource('products');
    products.addMethod('GET', new LambdaIntegration(getProductsListLambda));

    // 10. Add "/products/{productId}" resource
    const productIdResource = products.addResource('{productId}');
    productIdResource.addMethod('GET', new LambdaIntegration(getProductsByIdLambda));
  }
}
