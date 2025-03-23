import { APIGatewayTokenAuthorizerEvent, APIGatewayAuthorizerResult } from 'aws-lambda';

// Helper function to generate IAM policy
const generatePolicy = (
  principalId: string,
  methodArn: string,
  effect: 'Allow' | 'Deny'
): APIGatewayAuthorizerResult => {
  return {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: methodArn,
        },
      ],
    },
  };
};

export const handler = async (
  event: APIGatewayTokenAuthorizerEvent
): Promise<APIGatewayAuthorizerResult> => {
  console.log('Token Authorizer event:', JSON.stringify(event));

  try {
    if (!event.authorizationToken) {
      // Return 401 Unauthorized if Authorization header is not provided
      throw new Error('Unauthorized'); // API Gateway will convert this to 401
    }

    const token = event.authorizationToken; // e.g., "Basic YWxhZGRpbjpvcGVuc2VzYW1l"
    const [authType, encodedCreds] = token.split(' ');
    if (authType !== 'Basic' || !encodedCreds) {
      // Return 401 Unauthorized if token format is invalid
      throw new Error('Unauthorized'); // API Gateway will convert this to 401
    }

    try {
      // Try to decode the base64 string - will throw an error if it's invalid
      const decoded = Buffer.from(encodedCreds, 'base64').toString('utf-8');

      // Check if the decoded string contains a colon (username:password format)
      if (!decoded.includes(':')) {
        throw new Error('Forbidden'); // Malformed credentials
      }

      const [login, password] = decoded.split(':');

      // Look up the password from environment variables
      const storedPassword = process.env[login.toUpperCase()];
      if (!storedPassword) {
        // Return 403 Forbidden if username doesn't exist
        throw new Error('Forbidden'); // API Gateway will convert this to 403
      }

      if (storedPassword !== password) {
        // Return 403 Forbidden if password is incorrect
        throw new Error('Forbidden'); // API Gateway will convert this to 403
      }

      return generatePolicy(login, event.methodArn, 'Allow');
    } catch (decodeError) {
      console.error('Error decoding credentials:', decodeError);
      throw new Error('Forbidden'); // Invalid base64 or other format issues
    }
  } catch (error) {
    console.error('Error in authorizer:', error);
    // If the error message is 'Unauthorized', it will result in a 401
    // If the error message is 'Forbidden', it will result in a 403
    // For any other error, we'll default to 'Unauthorized'
    if (error instanceof Error) {
      throw error; // Re-throw the original error with its message
    } else {
      throw new Error('Unauthorized'); // Default to 401 for unknown errors
    }
  }
};
