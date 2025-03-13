import { mockClient } from 'aws-sdk-client-mock';
import { S3Client } from '@aws-sdk/client-s3';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { handler as importProductsFile } from '../lambdas/importProductsFile';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Mock = mockClient(S3Client);
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

describe('importProductsFile', () => {
  beforeEach(() => {
    s3Mock.reset();
    (getSignedUrl as jest.Mock).mockReset();
  });

  it('should return a signed URL if "name" is provided', async () => {
    process.env.IMPORT_BUCKET_NAME = 'my-bucket';
    const fakeSignedUrl = 'https://signed.url/put';
    (getSignedUrl as jest.Mock).mockResolvedValue(fakeSignedUrl);

    // Minimal event with query param
    const event: Partial<APIGatewayProxyEvent> = {
      queryStringParameters: { name: 'test.csv' },
    };

    // Dummy context/callback
    const context = {} as Context;
    const callback = () => {};

    // Now pass ALL THREE arguments
    const result = (await importProductsFile(
      event as APIGatewayProxyEvent,
      context,
      callback
    )) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(200);
    expect(result.body).toBe(fakeSignedUrl);

    expect(getSignedUrl).toHaveBeenCalledTimes(1);
    // etc...
  });

  it('should return 400 if "name" is missing', async () => {
    const event: Partial<APIGatewayProxyEvent> = {
      queryStringParameters: undefined,
    };
    const context = {} as Context;
    const callback = () => {};

    const result = (await importProductsFile(
      event as APIGatewayProxyEvent,
      context,
      callback
    )) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).message).toContain('Missing "name"');
  });

  it('should return 500 if IMPORT_BUCKET_NAME is not set', async () => {
    delete process.env.IMPORT_BUCKET_NAME;
    const event: Partial<APIGatewayProxyEvent> = {
      queryStringParameters: { name: 'test.csv' },
    };
    const context = {} as Context;
    const callback = () => {};

    const result = (await importProductsFile(
      event as APIGatewayProxyEvent,
      context,
      callback
    )) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(500);
    expect(result.body).toContain('IMPORT_BUCKET_NAME not set');
  });
});
