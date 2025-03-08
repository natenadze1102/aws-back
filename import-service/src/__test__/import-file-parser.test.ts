// importFileParser.test.ts
import { handler } from '../lambdas/importFileParser'; // adjust the path if needed
import {
  S3Client,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommandOutput,
} from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';
import { Readable } from 'stream';

const s3Mock = mockClient(S3Client);

describe('importFileParser Lambda', () => {
  beforeEach(() => {
    s3Mock.reset();
  });

  it('should process the CSV file, copy it to parsed folder, and delete the original', async () => {
    // Create a CSV string to simulate CSV file contents
    const csvContent = 'name,age\nAlice,30\nBob,25\n';
    // Create a Readable stream from the CSV string
    const csvStream = Readable.from([csvContent]);

    // Mock GetObjectCommand to return the stream as the Body
    s3Mock.on(GetObjectCommand).resolves({
      Body: csvStream as unknown as GetObjectCommandOutput['Body'],
    });

    // Mock CopyObjectCommand and DeleteObjectCommand to resolve without error
    s3Mock.on(CopyObjectCommand).resolves({});
    s3Mock.on(DeleteObjectCommand).resolves({});

    // Create a sample S3 event with one record
    const event = {
      Records: [
        {
          s3: {
            bucket: { name: 'my-test-bucket' },
            object: { key: 'uploaded/testFile.csv' },
          },
        },
      ],
    };

    // Call the Lambda handler
    const result = await handler(event as any);

    // Verify that the handler returns a 200 status code and expected body
    expect(result.statusCode).toBe(200);
    expect(result.body).toBe('CSV processing complete');

    // Optionally, check that the CopyObjectCommand was called with the correct parameters
    const copyCalls = s3Mock.commandCalls(CopyObjectCommand, {
      Bucket: 'my-test-bucket',
      CopySource: 'my-test-bucket/uploaded/testFile.csv',
      Key: 'parsed/testFile.csv',
    });
    expect(copyCalls.length).toBe(1);

    // Check that the DeleteObjectCommand was called correctly
    const deleteCalls = s3Mock.commandCalls(DeleteObjectCommand, {
      Bucket: 'my-test-bucket',
      Key: 'uploaded/testFile.csv',
    });
    expect(deleteCalls.length).toBe(1);
  });
});
