import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Bucket, EventType } from 'aws-cdk-lib/aws-s3';
import { Function as LambdaFunction, Runtime, Code } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { S3EventSourceProps, S3EventSourceV2 } from 'aws-cdk-lib/aws-lambda-event-sources';
import { RestApi, LambdaIntegration, Cors } from 'aws-cdk-lib/aws-apigateway';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Fn } from 'aws-cdk-lib';

export class ImportServiceStack extends Stack {
  public readonly importApi: RestApi;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Импортируем бакет
    const importBucket = Bucket.fromBucketName(this, 'ImportBucket', 'rs-school-test-upload');

    // Импортируем очередь SQS с использованием fromQueueAttributes
    const catalogItemsQueue = sqs.Queue.fromQueueAttributes(this, 'ImportedCatalogItemsQueue', {
      queueArn: Fn.importValue('CatalogItemsQueueArn'),
      queueUrl: Fn.importValue('CatalogItemsQueueUrl'),
    });

    // 2. Создаём Lambda importProductsFile
    const importProductsFileLambda = new LambdaFunction(this, 'ImportProductsFileLambda', {
      runtime: Runtime.NODEJS_18_X,
      handler: 'importProductsFile.handler',
      code: Code.fromAsset('dist/import-service/src/lambdas'),
      environment: {
        IMPORT_BUCKET_NAME: importBucket.bucketName,
        CATALOG_ITEMS_QUEUE_URL: catalogItemsQueue.queueUrl,
      },
    });

    // 3. Создаём Lambda importFileParser
    const importFileParserLambda = new NodejsFunction(this, 'ImportFileParserLambda', {
      runtime: Runtime.NODEJS_18_X,
      entry: 'import-service/src/lambdas/importFileParser.ts',
      handler: 'handler',
      environment: {
        IMPORT_BUCKET_NAME: importBucket.bucketName,
        CATALOG_ITEMS_QUEUE_URL: catalogItemsQueue.queueUrl,
      },
    });

    // 4. Настраиваем S3-триггер для Lambda importFileParser
    importFileParserLambda.addEventSource(
      new S3EventSourceV2(importBucket, <S3EventSourceProps>{
        events: [EventType.OBJECT_CREATED],
        filters: [{ prefix: 'uploaded/' }],
      })
    );

    // 5. Грантим необходимые разрешения
    importBucket.grantPut(importProductsFileLambda);
    importBucket.grantRead(importFileParserLambda);
    importBucket.grantReadWrite(importFileParserLambda);

    catalogItemsQueue.grantSendMessages(importFileParserLambda);

    // 6. Создаем API Gateway
    this.importApi = new RestApi(this, 'ImportServiceApi', {
      restApiName: 'Import Service',
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
        allowCredentials: true,
      },
    });

    // 7. Добавляем ресурс /import
    const importResource = this.importApi.root.addResource('import');
    importResource.addMethod('GET', new LambdaIntegration(importProductsFileLambda), {
      requestParameters: {
        'method.request.querystring.name': false,
      },
    });
  }
}
