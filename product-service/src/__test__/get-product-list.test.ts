// get-products-list.test.ts
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { handler } from '../lambdas/getProductsList';
import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

const ddbMock = mockClient(DynamoDBDocumentClient);

describe('getProductsList handler', () => {
  beforeAll(() => {
    // Provide the environment variables your code needs
    process.env.PRODUCTS_TABLE_NAME = 'products';
    process.env.STOCKS_TABLE_NAME = 'stocks';
  });

  beforeEach(() => {
    // Reset mock before each test
    ddbMock.reset();
  });

  it('should return a list of products', async () => {
    // Mock the results of scanning each table:
    ddbMock.on(ScanCommand).callsFake((params) => {
      // If scanning the products table:
      if (params.TableName === 'products') {
        return {
          Items: [
            { id: '1', title: 'ProductA', description: 'desc', price: 10 },
            { id: '2', title: 'ProductB', description: 'desc', price: 20 },
            { id: '3', title: 'ProductC', description: 'desc', price: 30 },
          ],
        };
      }
      // If scanning the stocks table:
      if (params.TableName === 'stocks') {
        return {
          Items: [
            { product_id: '1', count: 5 },
            { product_id: '2', count: 10 },
            { product_id: '3', count: 15 },
          ],
        };
      }
      return { Items: [] };
    });

    // Now call your handler
    const mockEvent: Partial<APIGatewayProxyEvent> = {};
    const result = (await handler(
      mockEvent as APIGatewayProxyEvent,
      {} as Context,
      () => {}
    )) as APIGatewayProxyResult;

    // Check status is 200
    expect(result.statusCode).toBe(200);

    // Check response body
    const products = JSON.parse(result.body);
    expect(Array.isArray(products)).toBe(true);
    // The test expects exactly 3 items
    expect(products).toHaveLength(3);
    expect(products[0]).toHaveProperty('id');
    expect(products[0]).toHaveProperty('title');
  });
});
