import { APIGatewayTokenAuthorizerEvent, APIGatewayAuthorizerResult } from 'aws-lambda';

function generatePolicy(
  principalId: string,
  resource: string,
  effect: 'Allow' | 'Deny'
): APIGatewayAuthorizerResult {
  return {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: effect,
          Resource: resource,
        },
      ],
    },
  };
}

export const handler = async (
  event: APIGatewayTokenAuthorizerEvent
): Promise<APIGatewayAuthorizerResult> => {
  console.log('Token Authorizer event:', JSON.stringify(event));

  if (!event.authorizationToken) {
    throw new Error('Unauthorized');
  }

  const token = event.authorizationToken; // e.g., "Basic YWxhZGRpbjpvcGVuc2VzYW1l"
  const [authType, encodedCreds] = token.split(' ');
  if (authType !== 'Basic' || !encodedCreds) {
    throw new Error('Unauthorized');
  }

  const decoded = Buffer.from(encodedCreds, 'base64').toString('utf-8');
  const [login, password] = decoded.split(':');

  // Look up the password from environment variables (e.g., "YOURGITHUBUSERNAME=TEST_PASSWORD")
  const storedPassword = process.env[login.toUpperCase()];
  if (!storedPassword) {
    throw new Error('Forbidden');
  }
  if (storedPassword !== password) {
    throw new Error('Forbidden');
  }

  return generatePolicy(login, event.methodArn, 'Allow');
};
