import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { handler } from '../getProductsList';

describe('getProductsList handler', () => {
  it('should return a list of products', async () => {
    const mockEvent: Partial<APIGatewayProxyEvent> = {};

    const result = await handler(mockEvent as APIGatewayProxyEvent, {} as Context, () => {});

    expect(result!.statusCode).toBe(200);
    const products = JSON.parse(result!.body);

    expect(Array.isArray(products)).toBe(true);
    expect(products).toHaveLength(3);
    expect(products[0]).toHaveProperty('id');
    expect(products[0]).toHaveProperty('title');
  });
});
