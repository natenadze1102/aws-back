import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyHandler } from 'aws-lambda';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-central-1' });
const docClient = DynamoDBDocumentClient.from(client);

export const handler: APIGatewayProxyHandler = async (event) => {
  console.log('Event received: ', event);

  try {
    if (!event.pathParameters) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing product ID' }),
      };
    }
    const productId = event.pathParameters.productId;

    // 1. Get Product
    const productResult = await docClient.send(
      new GetCommand({
        TableName: process.env.PRODUCTS_TABLE_NAME,
        Key: {
          id: productId,
        },
      })
    );

    const product = productResult.Item;
    if (!product) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Product not found' }),
      };
    }

    // 2. Get Stock
    const stockResult = await docClient.send(
      new GetCommand({
        TableName: process.env.STOCKS_TABLE_NAME,
        Key: {
          product_id: productId,
        },
      })
    );

    const stock = stockResult.Item || { count: 0 };

    // 3. Join and return
    const joined = {
      id: product.id,
      title: product.title,
      description: product.description,
      price: product.price,
      count: stock.count,
    };

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify(joined),
    };
  } catch (error) {
    console.error('Error fetching product by ID:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Internal Server Error',
      }),
    };
  }
};
