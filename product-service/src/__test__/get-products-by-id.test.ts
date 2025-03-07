// get-products-by-id.test.ts
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { handler } from '../lambdas/createProduct';

const ddbMock = mockClient(DynamoDBDocumentClient);

describe('getProductsById handler', () => {
  beforeAll(() => {
    // Ensure the Lambda sees valid table names
    process.env.PRODUCTS_TABLE_NAME = 'products';
    process.env.STOCKS_TABLE_NAME = 'stocks';
  });

  beforeEach(() => {
    // Reset the mock before each test
    ddbMock.reset();
  });

  it('should return product if productId exists', async () => {
    // Mock get from PRODUCTS table => found
    // Mock get from STOCKS table => found or some default stock
    ddbMock.on(GetCommand).callsFake((params) => {
      if (params.TableName === 'products') {
        return { Item: { id: '1', title: 'ProductA', description: 'Test', price: 99 } };
      }
      if (params.TableName === 'stocks') {
        return { Item: { product_id: '1', count: 5 } };
      }
      return { Item: null };
    });

    const mockEvent: Partial<APIGatewayProxyEvent> = {
      pathParameters: { productId: '1' },
    };

    const result = (await handler(
      mockEvent as APIGatewayProxyEvent,
      {} as Context,
      () => {}
    )) as APIGatewayProxyResult;

    // Now we expect a 200 because the product was found
    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('ProductA');
  });

  it('should return 404 if product is not found', async () => {
    // Mock get => null for the product
    ddbMock.on(GetCommand).callsFake((params) => {
      if (params.TableName === 'products') {
        return { Item: null };
      }
      if (params.TableName === 'stocks') {
        // Could return null or some default
        return { Item: null };
      }
      return { Item: null };
    });

    const mockEvent: Partial<APIGatewayProxyEvent> = {
      pathParameters: { productId: '999' },
    };

    const result = (await handler(
      mockEvent as APIGatewayProxyEvent,
      {} as Context,
      () => {}
    )) as APIGatewayProxyResult;

    // Because the product is null
    expect(result.statusCode).toBe(404);
    expect(result.body).toContain('Product not found');
  });
});
