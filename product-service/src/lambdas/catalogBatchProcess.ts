import { SQSEvent } from 'aws-lambda';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';

// Helper to generate an ID if product has none
const generateId = () => Math.random().toString(36).substring(2, 15);

export const handler = async (event: SQSEvent) => {
  console.log('Received SQS event:', JSON.stringify(event));

  const snsClient = new SNSClient({ region: process.env.AWS_REGION || 'eu-central-1' });
  const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-central-1' });

  let processedCount = 0;
  let minPrice = Infinity; // We'll track the minimum price across all products

  // Process each message
  for (const record of event.Records) {
    try {
      const product = JSON.parse(record.body);

      // Prepare the DynamoDB item
      const params = {
        TableName: process.env.PRODUCTS_TABLE_NAME!, // set via environment
        Item: {
          id: { S: product.id || generateId() },
          title: { S: product.title },
          description: { S: product.description || '' },
          price: { N: product.price.toString() },
          count: { N: product.count.toString() },
        },
      };

      // Write item to DynamoDB
      await dynamoClient.send(new PutItemCommand(params));
      processedCount++;

      // Track the lowest price seen
      if (typeof product.price === 'number') {
        minPrice = Math.min(minPrice, product.price);
      }
    } catch (error) {
      console.error('Error processing record:', record, error);
      // Optionally throw to re-queue or handle in DLQ
    }
  }

  // Decide on a single "priceCategory" for the entire batch
  // e.g., if minPrice < 20 => "low", otherwise => "high"
  // If no products found (processedCount=0), minPrice is still Infinity => "high" by default
  const priceCategory = minPrice < 20 ? 'low' : 'high';

  // Send ONE SNS notification with the batch summary
  try {
    const publishParams = {
      TopicArn: process.env.CREATE_PRODUCT_TOPIC_ARN!, // environment variable
      Subject: 'Products Imported',
      Message: `Successfully processed ${processedCount} product(s)`,

      // Add an attribute "priceCategory" for SNS Filter Policies
      MessageAttributes: {
        priceCategory: {
          DataType: 'String',
          StringValue: priceCategory,
        },
      },
    };

    await snsClient.send(new PublishCommand(publishParams));
    console.log('SNS notification published');
  } catch (error) {
    console.error('Error publishing SNS notification:', error);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Catalog batch processing complete' }),
  };
};
