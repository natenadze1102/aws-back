import { APIGatewayProxyHandler } from 'aws-lambda';

export const handler: APIGatewayProxyHandler = async () => {
  const products = [
    { id: '1', name: 'ProductA', price: 100 },
    { id: '2', name: 'ProductB', price: 200 },
  ];

  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
    },
    body: JSON.stringify(products),
  };
};
