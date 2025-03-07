import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

import { DynamoDBDocumentClient, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { handler } from '../lambdas/createProduct';

// Mock AWS SDK
jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn().mockReturnValue({ send: jest.fn() }),
  },
  TransactWriteCommand: jest.fn(),
}));
const mockSend = DynamoDBDocumentClient.from(new DynamoDBClient({})).send as jest.Mock;

describe('createProduct Lambda', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 400 if request body is invalid', async () => {
    // 1. Prepare event, context, callback
    const event: Partial<APIGatewayProxyEvent> = {
      body: JSON.stringify({ /* missing title/price */ description: 'test' }),
    };
    const context = {} as Context;
    const callback = jest.fn();

    // 2. Call the handler with 3 arguments
    const response = (await handler(
      event as APIGatewayProxyEvent,
      context,
      callback
    )) as APIGatewayProxyResult;

    expect(response.statusCode).toBe(400);
    expect(response.body).toContain('Invalid product data');
  });

  it('should create a product and return 200', async () => {
    mockSend.mockResolvedValueOnce({}); // Simulate success

    const event: Partial<APIGatewayProxyEvent> = {
      body: JSON.stringify({
        title: 'Test Product',
        description: 'A great product',
        price: 100,
        count: 5,
      }),
    };
    const context = {} as Context;
    const callback = jest.fn();

    const response = (await handler(
      event as APIGatewayProxyEvent,
      context,
      callback
    )) as APIGatewayProxyResult;

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('"title":"Test Product"');
    expect(response.body).toContain('"count":5');
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(TransactWriteCommand).toHaveBeenCalled();
  });

  it('should return 500 if DynamoDB operation fails', async () => {
    mockSend.mockRejectedValueOnce(new Error('DynamoDB error'));

    const event: Partial<APIGatewayProxyEvent> = {
      body: JSON.stringify({
        title: 'Test Product',
        price: 100,
      }),
    };
    const context = {} as Context;
    const callback = jest.fn();

    const response = (await handler(
      event as APIGatewayProxyEvent,
      context,
      callback
    )) as APIGatewayProxyResult;

    expect(response.statusCode).toBe(500);
    expect(response.body).toContain('Internal Server Error');
  });
});
