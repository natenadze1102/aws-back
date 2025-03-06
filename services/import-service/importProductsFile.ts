import { APIGatewayProxyHandler } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'eu-central-1' });

export const handler: APIGatewayProxyHandler = async (event) => {
  console.log('Received event:', JSON.stringify(event));

  try {
    // 1. Parse the 'name' query parameter
    const fileName = event.queryStringParameters?.name;
    if (!fileName) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing "name" query parameter.' }),
      };
    }

    // 2. Build the S3 key => "uploaded/${fileName}"
    const key = `uploaded/${fileName}`;

    // 3. Generate a signed URL for an S3 PUT operation
    const bucketName = process.env.IMPORT_BUCKET_NAME; // We'll set this in CDK
    if (!bucketName) {
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'IMPORT_BUCKET_NAME not set in environment.' }),
      };
    }

    // Use getSignedUrl from @aws-sdk/s3-request-presigner
    const putCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: 'text/csv', // or whatever your CSV content type is
    });

    const signedUrl = await getSignedUrl(s3Client, putCommand, {
      expiresIn: 60, // URL expiration in seconds
    });

    // 4. Return the pre-signed URL
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'OPTIONS,GET,PUT',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      },
      body: signedUrl,
    };
  } catch (error) {
    console.error('Error in importProductsFile:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal Server Error' }),
    };
  }
};
