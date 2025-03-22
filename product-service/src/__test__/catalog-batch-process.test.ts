// product-service/src/__test__/catalog-batch-process.test.ts
import { SQSEvent, SQSRecord } from 'aws-lambda';
import { handler } from '../lambdas/catalogBatchProcess';

// 1. Create mock client instances for DDB and SNS
const mockDDBClientInstance = { send: jest.fn() };
const mockSNSClientInstance = { send: jest.fn() };

// 2. PARTIAL mock of @aws-sdk/client-dynamodb
jest.mock('@aws-sdk/client-dynamodb', () => {
  // Get the real module so we can keep PutItemCommand, etc.
  const originalModule = jest.requireActual('@aws-sdk/client-dynamodb');

  return {
    // Re-export everything from the real module (PutItemCommand, etc.)
    ...originalModule,

    // Overwrite just the DynamoDBClient constructor:
    DynamoDBClient: jest.fn(() => mockDDBClientInstance),
  };
});

// 3. PARTIAL mock of @aws-sdk/client-sns
jest.mock('@aws-sdk/client-sns', () => {
  const originalModule = jest.requireActual('@aws-sdk/client-sns');

  return {
    ...originalModule,
    SNSClient: jest.fn(() => mockSNSClientInstance),
  };
});

describe('catalogBatchProcess Lambda', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should process all records and call PutItem for each', async () => {
    // sample event with 2 messages
    const event: SQSEvent = {
      Records: [
        {
          messageId: '1',
          receiptHandle: 'abc',
          body: JSON.stringify({ id: '123', title: 'Product X', price: 10, count: 5 }),
          attributes: {},
          messageAttributes: {},
          md5OfBody: '',
          eventSource: 'aws:sqs',
          eventSourceARN: '',
          awsRegion: 'eu-central-1',
        } as SQSRecord,
        {
          messageId: '2',
          receiptHandle: 'def',
          body: JSON.stringify({ title: 'No ID', price: 20, count: 2 }),
          attributes: {},
          messageAttributes: {},
          md5OfBody: '',
          eventSource: 'aws:sqs',
          eventSourceARN: '',
          awsRegion: 'eu-central-1',
        } as SQSRecord,
      ],
    };

    // Invoke the handler
    await handler(event);

    // The code calls dynamoClient.send(new PutItemCommand(...)) for each record
    expect(mockDDBClientInstance.send).toHaveBeenCalledTimes(2);

    // The code also calls snsClient.send(new PublishCommand(...)) exactly once
    expect(mockSNSClientInstance.send).toHaveBeenCalledTimes(1);

    // The last call to SNS should mention "2 product(s)"
    expect(mockSNSClientInstance.send).toHaveBeenLastCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          Message: expect.stringContaining('2 product(s)'),
        }),
      })
    );
  });

  it('should publish SNS with "0 product(s)" if no records are in the event', async () => {
    const event: SQSEvent = { Records: [] };
    await handler(event);

    // No calls to DDB
    expect(mockDDBClientInstance.send).toHaveBeenCalledTimes(0);

    // 1 call to SNS, referencing "0 product(s)"
    expect(mockSNSClientInstance.send).toHaveBeenCalledTimes(1);
    expect(mockSNSClientInstance.send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          Message: expect.stringContaining('0 product(s)'),
        }),
      })
    );
  });

  it('should skip invalid JSON record but still process the rest', async () => {
    const event: SQSEvent = {
      Records: [
        {
          messageId: '1',
          receiptHandle: 'abc',
          body: '{ not valid JSON', // invalid
          attributes: {},
          messageAttributes: {},
          md5OfBody: '',
          eventSource: 'aws:sqs',
          eventSourceARN: '',
          awsRegion: 'eu-central-1',
        } as SQSRecord,
        {
          messageId: '2',
          receiptHandle: 'def',
          body: JSON.stringify({ id: '999', title: 'Valid Product', price: 50, count: 1 }),
          attributes: {},
          messageAttributes: {},
          md5OfBody: '',
          eventSource: 'aws:sqs',
          eventSourceARN: '',
          awsRegion: 'eu-central-1',
        } as SQSRecord,
      ],
    };

    await handler(event);

    // We expect 1 call to DDB (for the valid record)
    expect(mockDDBClientInstance.send).toHaveBeenCalledTimes(1);

    // And 1 call to SNS
    expect(mockSNSClientInstance.send).toHaveBeenCalledTimes(1);

    // That call references "1 product(s)"
    expect(mockSNSClientInstance.send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          Message: expect.stringContaining('1 product(s)'),
        }),
      })
    );
  });
});
