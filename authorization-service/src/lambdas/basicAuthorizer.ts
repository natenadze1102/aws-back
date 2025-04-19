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

  // Default principal ID for denied requests
  const principalId = 'user';

  try {
    if (!event.authorizationToken) {
      console.log('No authorization token provided');
      // Important: Return Deny policy instead of throwing an error
      return generatePolicy(principalId, event.methodArn, 'Deny');
    }

    const token = event.authorizationToken; // e.g., "Basic YWxhZGRpbjpvcGVuc2VzYW1l"
    const [authType, encodedCreds] = token.split(' ');

    if (authType !== 'Basic' || !encodedCreds) {
      console.log('Invalid token format');
      // Important: Return Deny policy instead of throwing an error
      return generatePolicy(principalId, event.methodArn, 'Deny');
    }

    try {
      const decoded = Buffer.from(encodedCreds, 'base64').toString('utf-8');
      console.log('Decoded credentials format:', decoded);

      if (!decoded.includes(':')) {
        console.log('Malformed credentials - no colon');
        return generatePolicy(principalId, event.methodArn, 'Deny');
      }

      const [login, password] = decoded.split(':');
      console.log(`Login: ${login}, checking against env vars`);

      // Look up the password from environment variables
      const storedPassword = process.env[login.toUpperCase()];

      if (!storedPassword) {
        console.log(`No stored password found for ${login.toUpperCase()}`);
        return generatePolicy(principalId, event.methodArn, 'Deny');
      }

      if (storedPassword !== password) {
        console.log('Password mismatch');
        return generatePolicy(principalId, event.methodArn, 'Deny');
      }

      console.log('Authentication successful');
      return generatePolicy(login, event.methodArn, 'Allow');
    } catch (decodeError) {
      console.error('Error decoding credentials:', decodeError);
      return generatePolicy(principalId, event.methodArn, 'Deny');
    }
  } catch (error) {
    console.error('Unexpected error in authorizer:', error);
    // Important: Always return a policy, never throw
    return generatePolicy(principalId, event.methodArn, 'Deny');
  }
};
