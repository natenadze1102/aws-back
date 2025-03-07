import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyHandler } from 'aws-lambda';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'eu-central-1' });
const docClient = DynamoDBDocumentClient.from(client);

export const handler: APIGatewayProxyHandler = async (event) => {
  console.log('Event received: ', event);

  try {
    // 1. Read from products table
    const productsResult = await docClient.send(
      new ScanCommand({
        TableName: process.env.PRODUCTS_TABLE_NAME,
      })
    );

    const products = productsResult.Items || [];

    // 2. Read from stocks table
    const stocksResult = await docClient.send(
      new ScanCommand({
        TableName: process.env.STOCKS_TABLE_NAME,
      })
    );

    const stocks = stocksResult.Items || [];

    // 3. Join them by product_id === id
    const joinedProducts = products.map((product) => {
      const stockForProduct = stocks.find((s) => s.product_id === product.id) || { count: 0 };
      return {
        id: product.id,
        title: product.title,
        description: product.description,
        price: product.price,
        count: stockForProduct.count,
      };
    });

    // 4. Return successful response
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify(joinedProducts),
    };
  } catch (error) {
    console.error('Error fetching products list:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: `Internal Server Error ${error}`,
      }),
    };
  }
};
