// // __tests__/importFileParser.test.ts
// import { S3Event } from 'aws-lambda';
// import { handler as importFileParser } from '../lambdas/importFileParser';

// import { mockClient } from 'aws-sdk-client-mock';
// import {
//   S3Client,
//   GetObjectCommand,
//   CopyObjectCommand,
//   DeleteObjectCommandnpm run deploy
// } from '@aws-sdk/client-s3';

// import { PassThrough } from 'stream';

// // Create a mock S3 client
// const s3Mock = mockClient(S3Client);

// describe('importFileParser', () => {
//   beforeEach(() => {
//     s3Mock.reset();
//   });

//   it('should parse CSV and move file to "parsed/"', async () => {
//     // 1) Create a PassThrough to act like S3's Body
//     const passThrough = new PassThrough();

//     // 2) Mock S3 GET -> return passThrough
//     s3Mock.on(GetObjectCommand).resolves({
//       Body: passThrough, // The code calls .pipe(csvParser()) on this
//     });

//     // 3) Mock the Copy and Delete commands
//     s3Mock.on(CopyObjectCommand).resolves({});
//     s3Mock.on(DeleteObjectCommand).resolves({});

//     // 4) Minimal S3Event with "uploaded/test.csv"
//     const event: S3Event = {
//       Records: [
//         {
//           s3: {
//             bucket: { name: 'my-bucket' },
//             object: { key: 'uploaded/test.csv' },
//           },
//         } as any,
//       ],
//     };

//     // 5) Start the handler, but don't await it yet
//     const promise = importFileParser(event);

//     // 6) Push CSV data into passThrough
//     //    The code uses stream.pipe(csvParser()), so this data triggers 'data' & 'end'.
//     passThrough.push('id,title\n1,TestProduct\n2,AnotherProduct\n');
//     passThrough.push(null); // end of stream

//     // 7) Now wait for the Lambda to finish
//     const result = await promise;

//     // 8) Verify S3 calls
//     expect(s3Mock.call(0).firstArg).toBeInstanceOf(GetObjectCommand); // get
//     expect(s3Mock.call(1).firstArg).toBeInstanceOf(CopyObjectCommand); // copy
//     expect(s3Mock.call(2).firstArg).toBeInstanceOf(DeleteObjectCommand); // delete

//     // 9) Check final response
//     expect(result).toEqual({
//       statusCode: 200,
//       body: 'CSV processing complete',
//     });
//   });

//   it('should return 500 if S3 GetObject fails', async () => {
//     // Force an error
//     s3Mock.on(GetObjectCommand).rejects(new Error('S3 error'));

//     const event: S3Event = {
//       Records: [
//         {
//           s3: {
//             bucket: { name: 'my-bucket' },
//             object: { key: 'uploaded/test.csv' },
//           },
//         } as any,
//       ],
//     };

//     const result = await importFileParser(event);
//     expect(result.statusCode).toBe(500);
//     expect(result.body).toContain('Error processing CSV file');
//   });
// });
