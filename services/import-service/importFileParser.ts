import { S3Event } from 'aws-lambda';
import {
  S3Client,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import csvParser from 'csv-parser';
import { Readable } from 'stream';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'eu-central-1' });
const sqsClient = new SQSClient({ region: process.env.AWS_REGION || 'eu-central-1' });

export const handler = async (event: S3Event) => {
  console.log('S3 Event:', JSON.stringify(event));

  try {
    // Process each record in the S3 event
    for (const record of event.Records) {
      const bucketName = record.s3.bucket.name;
      const key = record.s3.object.key; // e.g., "uploaded/myFile.csv"
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

      // Parse CSV file using csv-parser
      await new Promise<void>((resolve, reject) => {
        stream
          .pipe(csvParser())
          .on('data', async (data) => {
            // Log each record to CloudWatch
            // console.log('CSV Record:', data);

            await sqsClient.send(
              new SendMessageCommand({
                QueueUrl: process.env.CATALOG_ITEMS_QUEUE_URL, // Set via environment variables
                MessageBody: JSON.stringify(data),
              })
            );
          })
          .on('end', async () => {
            console.log(`Finished processing file: ${key}`);

            // (Optional Extra) Move file from "uploaded/" to "parsed/" folder
            const destinationKey = key.replace('uploaded/', 'parsed/');
            // Copy the file to the new location
            await s3Client.send(
              new CopyObjectCommand({
                Bucket: bucketName,
                CopySource: `${bucketName}/${key}`,
                Key: destinationKey,
              })
            );
            // Delete the original file from the "uploaded/" folder
            await s3Client.send(
              new DeleteObjectCommand({
                Bucket: bucketName,
                Key: key,
              })
            );
            resolve();
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
