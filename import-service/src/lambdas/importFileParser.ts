import { S3Event } from 'aws-lambda';
import {
  S3Client,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import csvParser from 'csv-parser';
import { Readable } from 'stream';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'eu-central-1' });
const sqsClient = new SQSClient({ region: process.env.AWS_REGION || 'eu-central-1' });

export const handler = async (event: S3Event) => {
  console.log('S3 Event:', JSON.stringify(event));

  try {
    // Process each record in the S3 event
    for (const record of event.Records) {
      const bucketName = record.s3.bucket.name;
      const key = record.s3.object.key;
      console.log(`Processing file: ${key} from bucket: ${bucketName}`);

      // Download the CSV file from S3
      const getObjectResponse = await s3Client.send(
        new GetObjectCommand({
          Bucket: bucketName,
          Key: key,
        })
      );

      // Get the body as a Readable stream
      const stream = getObjectResponse.Body as Readable;

      // Collect promises for sending SQS messages
      const sendPromises: Promise<any>[] = [];

      // Create a promise that resolves when the stream finishes processing
      await new Promise<void>((resolve, reject) => {
        stream
          .pipe(csvParser())
          .on('data', (data) => {
            console.log('CSV Record:', data);
            // Push the SQS send promise into the array
            const promise = sqsClient
              .send(
                new SendMessageCommand({
                  QueueUrl: process.env.CATALOG_ITEMS_QUEUE_URL!, // Set via environment variables
                  MessageBody: JSON.stringify(data),
                })
              )
              .then(() => {
                console.log('Record sent to SQS');
              })
              .catch((err) => {
                console.error('Error sending message to SQS:', err);
              });
            sendPromises.push(promise);
          })
          .on('end', async () => {
            try {
              // Wait for all SQS messages to be sent
              await Promise.all(sendPromises);
              console.log(`Finished sending all records for file: ${key}`);

              // (Optional Extra) Move file from "uploaded/" to "parsed/" folder
              const destinationKey = key.replace('uploaded/', 'parsed/');
              await s3Client.send(
                new CopyObjectCommand({
                  Bucket: bucketName,
                  CopySource: `${bucketName}/${key}`,
                  Key: destinationKey,
                })
              );
              await s3Client.send(
                new DeleteObjectCommand({
                  Bucket: bucketName,
                  Key: key,
                })
              );
              resolve();
            } catch (copyErr) {
              console.error('Error moving file:', copyErr);
              reject(copyErr);
            }
          })
          .on('error', (err) => {
            console.error('Error while parsing CSV:', err);
            reject(err);
          });
      });
    }

    return {
      statusCode: 200,
      body: 'CSV processing complete',
    };
  } catch (error) {
    console.error('Error in importFileParser:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error processing CSV file' }),
    };
  }
};
