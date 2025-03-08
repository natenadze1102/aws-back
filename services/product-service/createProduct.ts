import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-central-1' });
const docClient = DynamoDBDocumentClient.from(client);

/**
 * Expects a POST body like:
 * {
 *   "title": "Some product",
 *   "description": "Optional description",
 *   "price": 100,
 *   "count": 2
 * }
 */
export const handler: APIGatewayProxyHandler = async (event) => {
  // +7.5 (Optional) - log request
  console.log('Incoming request for createProduct:', event);

  try {
    // 1. Parse body
    const body = event.body ? JSON.parse(event.body) : {};
    const { title, description, price, count } = body;

    // 2. +7.5 (Optional) - Return 400 if invalid
    if (!title || typeof price !== 'number') {
      console.error('Validation Error: "title" or "price" missing/incorrect');
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Invalid product data: "title" (string) and "price" (number) are required.',
        }),
      };
    }

    // 3. Prepare items for DB
    const productId = randomUUID();
    const productItem = {
      id: productId,
      title,
      description: description ?? '',
      price,
    };
    const stockItem = {
      product_id: productId,
      count: typeof count === 'number' ? count : 0,
    };

    // 4. Insert into DB
    //    * +7.5 (Optional) - transaction-based creation
    //      See "Transaction-based creation" section below.

    await docClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: process.env.PRODUCTS_TABLE_NAME,
              Item: productItem,
            },
          },
          {
            Put: {
              TableName: process.env.STOCKS_TABLE_NAME,
              Item: stockItem,
            },
          },
        ],
      })
    );

    // 5. Return success
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        ...productItem,
        count: stockItem.count,
      }),
    };
  } catch (error) {
    // +7.5 (Optional) - Return 500 on unhandled errors, plus console logs
    console.error('Error in createProduct:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: `Internal Server Error: ${error}` }),
    };
  }
};
