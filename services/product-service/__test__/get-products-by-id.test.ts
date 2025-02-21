import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { handler } from '../getProductsById';

describe('getProductsById handler', () => {
  it('should return product if productId exists', async () => {
    const mockEvent: Partial<APIGatewayProxyEvent> = {
      pathParameters: { productId: '1' },
    };

    const result = await handler(mockEvent as APIGatewayProxyEvent, {} as Context, () => {});

    expect(result!.statusCode).toBe(200);
    expect(result!.body).toContain('ProductA');
  });

  it('should return 404 if product is not found', async () => {
    const mockEvent: Partial<APIGatewayProxyEvent> = {
      pathParameters: { productId: '999' },
    };

    const result = await handler(mockEvent as APIGatewayProxyEvent, {} as Context, () => {});

    expect(result!.statusCode).toBe(404);
    expect(result!.body).toContain('Product not found');
  });
});
